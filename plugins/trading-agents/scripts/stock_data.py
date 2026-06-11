#!/usr/bin/env python3
"""Stock market data CLI for the trading-agents project.

Standalone script providing real-time quotes, K-line series, technical
indicators (MA, RSI, MACD), and composite bundles for A-share, Hong Kong,
and US stocks.  Outputs a single JSON envelope to stdout; diagnostics go
to stderr.

Part of the trading-agents open-source project.

Usage examples::

    python scripts/stock_data.py quote get --code 300255.SZ
    python scripts/stock_data.py quote batch --codes 300255.SZ,600519.SH
    python scripts/stock_data.py series kline --code 300255.SZ --limit 60
    python scripts/stock_data.py indicator ma --period 20 --input-json '{}'
    python scripts/stock_data.py bundle technical --codes 300255.SZ --interval 1d --limit 60 --indicators ma:20,rsi:14,macd
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests


USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


# ---------------------------------------------------------------------------
# Error & envelope helpers
# ---------------------------------------------------------------------------

class AtomError(Exception):
    def __init__(self, code: str, message: str, *, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable


def log(message: str) -> None:
    print(message, file=sys.stderr)


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def ok(data: Any, *, sources: list[dict[str, Any]] | None = None,
       warnings: list[str] | None = None) -> dict[str, Any]:
    return {
        "ok": True,
        "data": data,
        "sources": sources or [],
        "warnings": warnings or [],
        "asOf": now_iso(),
    }


def fail(error: AtomError) -> dict[str, Any]:
    return {
        "ok": False,
        "error": {
            "code": error.code,
            "message": error.message,
            "retryable": error.retryable,
        },
        "sources": [],
        "warnings": [],
        "asOf": now_iso(),
    }


# ---------------------------------------------------------------------------
# Path & config helpers
# ---------------------------------------------------------------------------

def script_root() -> Path:
    override = os.environ.get("TRADING_AGENTS_HOME")
    if override:
        return Path(override).expanduser().resolve()
    return Path(__file__).resolve().parent.parent


ROOT = script_root()
CONFIG_FILE = ROOT / "config.json"
WATCHLIST_FILE = ROOT / "watchlist.json"


def load_json_file(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise AtomError("invalid_json", f"Failed to parse {path}: {exc}") from exc


def load_config() -> dict[str, Any]:
    cfg = load_json_file(CONFIG_FILE, {})
    if not isinstance(cfg, dict):
        raise AtomError("invalid_config", "config.json must be a JSON object")
    return cfg


def config_validate(_: argparse.Namespace) -> dict[str, Any]:
    cfg = load_config()
    return ok({
        "root": str(ROOT),
        "configPath": str(CONFIG_FILE),
        "watchlistPath": str(resolve_watchlist_path(cfg)),
    })


def resolve_watchlist_path(cfg: dict[str, Any] | None = None) -> Path:
    cfg = cfg if cfg is not None else load_config()
    value = cfg.get("watchlist", "watchlist.json")
    if not isinstance(value, str) or not value.strip():
        value = "watchlist.json"
    candidate = Path(value).expanduser()
    if not candidate.is_absolute():
        candidate = ROOT / candidate
    return candidate


def load_watchlist_items() -> list[dict[str, Any]]:
    path = resolve_watchlist_path()
    value = load_json_file(path, [])
    if not isinstance(value, list):
        raise AtomError("invalid_watchlist", "watchlist must be a JSON array")
    items = [item for item in value if isinstance(item, dict)]
    user_items = [item for item in items if not item.get("_example")]
    return user_items or items


def watchlist_list(_: argparse.Namespace) -> dict[str, Any]:
    items = [normalize_stock_item(item) for item in load_watchlist_items()]
    return ok({"items": items, "count": len(items)})


# ---------------------------------------------------------------------------
# Code normalisation & market inference
# ---------------------------------------------------------------------------

def normalize_code(code: str) -> str:
    value = code.strip().upper()
    if not value:
        raise AtomError("invalid_symbol", "code must not be empty")
    if "." in value:
        left, right = value.split(".", 1)
        if right == "HK" and left.isdigit():
            return f"{int(left):05d}.HK"
        return value
    if value.isdigit() and len(value) == 6:
        if value.startswith(("6", "9")):
            return f"{value}.SH"
        if value.startswith(("0", "2", "3")):
            return f"{value}.SZ"
        if value.startswith(("4", "8")):
            return f"{value}.BJ"
    if value.isdigit() and 1 <= len(value) <= 5:
        return f"{int(value):05d}.HK"
    return value


def infer_market(code: str) -> str:
    upper = code.upper()
    if upper.endswith((".SH", ".SZ", ".BJ")):
        return "CN"
    if upper.endswith(".HK"):
        return "HK"
    return "US"


def normalize_stock_item(item: dict[str, Any]) -> dict[str, Any]:
    code = normalize_code(str(item.get("code", "")))
    market = str(item.get("market") or infer_market(code))
    out = {
        "code": code,
        "name": str(item.get("name") or code),
        "market": market,
    }
    for key in ("currency", "hold_cost", "hold_quantity", "alerts"):
        if key in item:
            out[key] = item[key]
    return out


# ---------------------------------------------------------------------------
# HTTP session
# ---------------------------------------------------------------------------

def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    # Bypass system proxy (macOS System Preferences / Windows Internet Settings)
    # Chinese stock APIs often fail when routed through a proxy
    session.trust_env = False
    return session


# ---------------------------------------------------------------------------
# Real-time quotes
# ---------------------------------------------------------------------------

def fetch_cn_quote(code: str, session: requests.Session) -> dict[str, Any]:
    pure = normalize_code(code).split(".")[0]
    hex_code = f"hs_{pure}"
    ts = int(time.time() * 1000)
    rand = random.randint(1000, 9999)
    url = f"http://d.10jqka.com.cn/v6/time/{hex_code}/today?_={ts}&rand={rand}"
    resp = session.get(
        url,
        timeout=10,
        headers={"Referer": "http://stockpage.10jqka.com.cn/", "Cache-Control": "no-cache"},
    )
    resp.raise_for_status()
    text = resp.text
    if "quotebridge" not in text:
        raise AtomError("quote_format_error", f"Unexpected quote response for {code}")
    data = json.loads(text.split("(", 1)[1].rsplit(")", 1)[0]).get(hex_code, {})
    raw = data.get("data", "")
    if not raw:
        raise AtomError("quote_empty", f"No quote data for {code}")
    minutes = raw.split(";")
    last = minutes[-1].split(",")
    if len(last) < 5:
        raise AtomError("quote_format_error", f"Unexpected minute quote for {code}")
    price = float(last[1])
    pre_close = float(data.get("pre", price))
    prev_price = float(minutes[-2].split(",")[1]) if len(minutes) >= 2 else pre_close
    total_volume = 0
    total_amount = 0.0
    for row in minutes:
        parts = row.split(",")
        if len(parts) >= 5 and parts[2].strip() and parts[4].strip():
            total_volume += int(float(parts[4]))
            total_amount += float(parts[2])
    return {
        "code": normalize_code(code),
        "market": "CN",
        "price": price,
        "preClose": pre_close,
        "changePct": round((price - pre_close) / pre_close * 100, 2) if pre_close else 0,
        "change1mPct": round((price - prev_price) / prev_price * 100, 2) if prev_price else 0,
        "volume": total_volume,
        "amount": total_amount,
        "time": last[0],
    }


def fetch_hk_us_quote(code: str, session: requests.Session) -> dict[str, Any]:
    normalized = normalize_code(code)
    if normalized.endswith(".HK"):
        xq_symbol = normalized.replace(".HK", "")
        market = "HK"
        currency = "HKD"
    else:
        xq_symbol = normalized
        market = "US"
        currency = "USD"
    url = f"https://stock.xueqiu.com/v5/stock/realtime/quotec.json?symbol={xq_symbol}"
    resp = session.get(url, timeout=10, headers={"Referer": "https://xueqiu.com/"})
    resp.raise_for_status()
    payload = resp.json()
    rows = payload.get("data") or []
    if not rows:
        raise AtomError("quote_empty", f"No quote data for {code}")
    quote = rows[0]
    ts = quote.get("timestamp")
    time_str = datetime.fromtimestamp(ts / 1000).strftime("%H:%M") if ts else ""
    return {
        "code": normalized,
        "market": market,
        "currency": currency,
        "price": quote.get("current"),
        "preClose": quote.get("last_close"),
        "changePct": quote.get("percent"),
        "volume": quote.get("volume"),
        "time": time_str,
    }


def fetch_quote(code: str, session: requests.Session) -> dict[str, Any]:
    normalized = normalize_code(code)
    market = infer_market(normalized)
    if market == "CN":
        return fetch_cn_quote(normalized, session)
    return fetch_hk_us_quote(normalized, session)


def quote_get(args: argparse.Namespace) -> dict[str, Any]:
    stock = find_watchlist_stock(args.code)
    with make_session() as session:
        quote = fetch_quote(args.code, session)
    if stock:
        quote.update({"name": stock.get("name", quote["code"])})
        add_holding_fields(quote, stock)
    return ok(quote, sources=[{"name": quote_source_name(quote["market"]), "type": "quote"}])


def parse_codes(value: str | None) -> list[str]:
    if not value:
        return []
    return [normalize_code(part) for part in value.split(",") if part.strip()]


def quote_batch(args: argparse.Namespace) -> dict[str, Any]:
    codes = parse_codes(args.codes)
    if not codes:
        raise AtomError("missing_codes", "--codes is required")
    return ok(fetch_quote_items(codes), sources=[{"name": "10jqka/xueqiu", "type": "quote"}])


def quote_snapshot(_: argparse.Namespace) -> dict[str, Any]:
    stocks = [normalize_stock_item(item) for item in load_watchlist_items()]
    codes = [stock["code"] for stock in stocks]
    data = fetch_quote_items(codes, stocks_by_code={stock["code"]: stock for stock in stocks})
    return ok(data, sources=[{"name": "10jqka/xueqiu", "type": "quote"}])


def fetch_quote_items(
    codes: list[str],
    *,
    stocks_by_code: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    stocks_by_code = stocks_by_code or {}
    with make_session() as session:
        for code in codes:
            normalized = normalize_code(code)
            try:
                item = fetch_quote(normalized, session)
                stock = stocks_by_code.get(normalized) or find_watchlist_stock(normalized)
                if stock:
                    item["name"] = stock.get("name", normalized)
                    add_holding_fields(item, stock)
                items.append(item)
            except Exception as exc:
                errors.append({"code": normalized, "error": str(exc)})
    return {"items": items, "errors": errors, "count": len(items)}


def find_watchlist_stock(code: str) -> dict[str, Any] | None:
    normalized = normalize_code(code)
    for item in load_watchlist_items():
        stock = normalize_stock_item(item)
        if stock["code"] == normalized:
            return stock
    return None


def add_holding_fields(quote: dict[str, Any], stock: dict[str, Any]) -> None:
    cost = stock.get("hold_cost")
    qty = stock.get("hold_quantity")
    if isinstance(cost, (int, float)) and isinstance(qty, (int, float)) and cost > 0 and qty > 0:
        price = quote.get("price")
        if isinstance(price, (int, float)):
            quote["holdCost"] = cost
            quote["holdQuantity"] = qty
            quote["profit"] = round((price - cost) * qty, 2)
            quote["profitPct"] = round((price - cost) / cost * 100, 2)


def quote_source_name(market: str) -> str:
    return "10jqka" if market == "CN" else "xueqiu"


# ---------------------------------------------------------------------------
# K-line series (daily)
# ---------------------------------------------------------------------------

def eastmoney_secid(code: str) -> str:
    normalized = normalize_code(code)
    pure, suffix = normalized.split(".", 1)
    if suffix == "SH":
        return f"1.{pure}"
    if suffix in ("SZ", "BJ"):
        return f"0.{pure}"
    raise AtomError("unsupported_series_market", f"series kline only supports CN symbols: {code}")


def fetch_daily_kline(code: str, limit: int, session: requests.Session) -> dict[str, Any]:
    normalized = normalize_code(code)
    secid = eastmoney_secid(normalized)
    url = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
    params = {
        "secid": secid,
        "fields1": "f1,f2,f3,f4,f5,f6",
        "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
        "klt": "101",
        "fqt": "1",
        "end": "20500101",
        "lmt": str(limit),
    }
    resp = session.get(url, params=params, timeout=15, headers={"Referer": "https://quote.eastmoney.com/"})
    resp.raise_for_status()
    payload = resp.json()
    data = payload.get("data") or {}
    rows = data.get("klines") or []
    if not rows:
        raise AtomError("series_empty", f"No kline data for {normalized}")
    series = []
    for row in rows[-limit:]:
        parts = row.split(",")
        if len(parts) < 11:
            continue
        series.append({
            "date": parts[0],
            "open": to_float(parts[1]),
            "close": to_float(parts[2]),
            "high": to_float(parts[3]),
            "low": to_float(parts[4]),
            "volume": to_float(parts[5]),
            "amount": to_float(parts[6]),
            "amplitudePct": to_float(parts[7]),
            "changePct": to_float(parts[8]),
            "change": to_float(parts[9]),
            "turnoverPct": to_float(parts[10]),
        })
    return {
        "code": normalized,
        "name": data.get("name") or normalized,
        "market": "CN",
        "interval": "1d",
        "series": series,
    }


def to_float(value: Any) -> float | None:
    try:
        if value in ("", "-", None):
            return None
        return float(value)
    except Exception:
        return None


def series_kline(args: argparse.Namespace) -> dict[str, Any]:
    ensure_interval_supported(args.interval)
    with make_session() as session:
        data = fetch_daily_kline(args.code, args.limit, session)
    return ok(data, sources=[{"name": "eastmoney", "type": "kline"}])


def series_batch(args: argparse.Namespace) -> dict[str, Any]:
    ensure_interval_supported(args.interval)
    codes = parse_codes(args.codes)
    if not codes:
        raise AtomError("missing_codes", "--codes is required")
    return ok(fetch_series_items(codes, args.limit), sources=[{"name": "eastmoney", "type": "kline"}])


def series_watchlist(args: argparse.Namespace) -> dict[str, Any]:
    ensure_interval_supported(args.interval)
    stocks = [normalize_stock_item(item) for item in load_watchlist_items()]
    codes = [stock["code"] for stock in stocks]
    return ok(fetch_series_items(codes, args.limit), sources=[{"name": "eastmoney", "type": "kline"}])


def ensure_interval_supported(interval: str) -> None:
    if interval != "1d":
        raise AtomError("unsupported_interval", "Only interval=1d is supported in this first version")


def fetch_series_items(codes: list[str], limit: int) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    with make_session() as session:
        for code in codes:
            normalized = normalize_code(code)
            try:
                items.append(fetch_daily_kline(normalized, limit, session))
            except Exception as exc:
                errors.append({"code": normalized, "error": str(exc)})
    return {"items": items, "errors": errors, "count": len(items)}


# ---------------------------------------------------------------------------
# Technical indicators
# ---------------------------------------------------------------------------

def unwrap_envelope(value: Any) -> Any:
    if isinstance(value, dict) and value.get("ok") is True and "data" in value:
        return value["data"]
    return value


def parse_json_arg(value: str | None, label: str) -> Any:
    if value is None:
        raw = sys.stdin.read()
    elif value.startswith("@"):
        raw = Path(value[1:]).expanduser().read_text(encoding="utf-8")
    else:
        raw = value
    try:
        return unwrap_envelope(json.loads(raw))
    except Exception as exc:
        raise AtomError("invalid_input_json", f"Failed to parse {label}: {exc}") from exc


def extract_series(input_value: Any) -> list[dict[str, Any]]:
    value = unwrap_envelope(input_value)
    if isinstance(value, dict) and isinstance(value.get("series"), list):
        return value["series"]
    raise AtomError("invalid_series_input", "input must be a kline object with a series array")


def closes(series: list[dict[str, Any]]) -> list[float | None]:
    return [row.get("close") if isinstance(row.get("close"), (int, float)) else None for row in series]


def dated_values(series: list[dict[str, Any]], values: list[float | None]) -> list[dict[str, Any]]:
    out = []
    for row, value in zip(series, values):
        out.append({"date": row.get("date"), "value": round_float(value)})
    return out


def round_float(value: float | None, digits: int = 6) -> float | None:
    if value is None or not math.isfinite(value):
        return None
    return round(value, digits)


def calc_ma(values: list[float | None], period: int) -> list[float | None]:
    result: list[float | None] = []
    window: list[float] = []
    for value in values:
        if value is None:
            result.append(None)
            continue
        window.append(value)
        if len(window) > period:
            window.pop(0)
        result.append(sum(window) / period if len(window) == period else None)
    return result


def calc_rsi(values: list[float | None], period: int) -> list[float | None]:
    result: list[float | None] = [None] * len(values)
    gains: list[float] = []
    losses: list[float] = []
    prev: float | None = None
    for index, value in enumerate(values):
        if value is None:
            prev = None
            continue
        if prev is None:
            prev = value
            continue
        change = value - prev
        gains.append(max(change, 0.0))
        losses.append(max(-change, 0.0))
        if len(gains) > period:
            gains.pop(0)
            losses.pop(0)
        if len(gains) == period:
            avg_gain = sum(gains) / period
            avg_loss = sum(losses) / period
            result[index] = 100.0 if avg_loss == 0 else 100.0 - (100.0 / (1.0 + avg_gain / avg_loss))
        prev = value
    return result


def ema(values: list[float | None], period: int) -> list[float | None]:
    result: list[float | None] = []
    alpha = 2 / (period + 1)
    current: float | None = None
    for value in values:
        if value is None:
            result.append(current)
            continue
        current = value if current is None else alpha * value + (1 - alpha) * current
        result.append(current)
    return result


def calc_macd(values: list[float | None]) -> dict[str, list[float | None]]:
    ema12 = ema(values, 12)
    ema26 = ema(values, 26)
    diff = [
        (a - b) if a is not None and b is not None else None
        for a, b in zip(ema12, ema26)
    ]
    dea = ema(diff, 9)
    hist = [
        (d - e) * 2 if d is not None and e is not None else None
        for d, e in zip(diff, dea)
    ]
    return {"diff": diff, "dea": dea, "hist": hist}


def latest_non_null(values: list[float | None]) -> float | None:
    for value in reversed(values):
        if value is not None and math.isfinite(value):
            return value
    return None


def indicator_ma(args: argparse.Namespace) -> dict[str, Any]:
    series = extract_series(parse_json_arg(args.input_json, "--input-json"))
    values = calc_ma(closes(series), args.period)
    return ok({
        "name": f"ma{args.period}",
        "period": args.period,
        "value": round_float(latest_non_null(values)),
        "values": dated_values(series, values),
    })


def indicator_rsi(args: argparse.Namespace) -> dict[str, Any]:
    series = extract_series(parse_json_arg(args.input_json, "--input-json"))
    values = calc_rsi(closes(series), args.period)
    return ok({
        "name": f"rsi{args.period}",
        "period": args.period,
        "value": round_float(latest_non_null(values)),
        "values": dated_values(series, values),
    })


def indicator_macd(args: argparse.Namespace) -> dict[str, Any]:
    series = extract_series(parse_json_arg(args.input_json, "--input-json"))
    macd = calc_macd(closes(series))
    latest = {
        key: round_float(latest_non_null(value))
        for key, value in macd.items()
    }
    dated = []
    for index, row in enumerate(series):
        dated.append({
            "date": row.get("date"),
            "diff": round_float(macd["diff"][index]),
            "dea": round_float(macd["dea"][index]),
            "hist": round_float(macd["hist"][index]),
        })
    return ok({"name": "macd", "value": latest, "values": dated})


def parse_indicator_specs(spec: str) -> list[tuple[str, int | None]]:
    result: list[tuple[str, int | None]] = []
    for raw in spec.split(","):
        part = raw.strip().lower()
        if not part:
            continue
        if ":" in part:
            name, period = part.split(":", 1)
            result.append((name, int(period)))
        else:
            result.append((part, None))
    if not result:
        raise AtomError("missing_indicators", "--indicators must not be empty")
    return result


def compute_indicators_for_series(series: list[dict[str, Any]], specs: list[tuple[str, int | None]]) -> dict[str, Any]:
    close_values = closes(series)
    latest: dict[str, Any] = {}
    all_values: dict[str, Any] = {}
    for name, period in specs:
        if name == "ma":
            if period is None:
                raise AtomError("invalid_indicator", "ma requires a period, e.g. ma:250")
            values = calc_ma(close_values, period)
            key = f"ma{period}"
            latest[key] = round_float(latest_non_null(values))
            all_values[key] = dated_values(series, values)
        elif name == "rsi":
            period = 14 if period is None else period
            values = calc_rsi(close_values, period)
            key = f"rsi{period}"
            latest[key] = round_float(latest_non_null(values))
            all_values[key] = dated_values(series, values)
        elif name == "macd":
            macd = calc_macd(close_values)
            latest["macd"] = {key: round_float(latest_non_null(value)) for key, value in macd.items()}
            all_values["macd"] = [
                {
                    "date": row.get("date"),
                    "diff": round_float(macd["diff"][idx]),
                    "dea": round_float(macd["dea"][idx]),
                    "hist": round_float(macd["hist"][idx]),
                }
                for idx, row in enumerate(series)
            ]
        else:
            raise AtomError("unsupported_indicator", f"Unsupported indicator: {name}")
    return {"latest": latest, "series": all_values}


def indicator_batch(args: argparse.Namespace) -> dict[str, Any]:
    specs = parse_indicator_specs(args.indicators)
    data = parse_json_arg(args.input_json, "--input-json")
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        raise AtomError("invalid_series_batch_input", "input must be a series batch object")
    items = []
    errors = []
    for item in data["items"]:
        try:
            series = extract_series(item)
            computed = compute_indicators_for_series(series, specs)
            items.append({
                "code": item.get("code"),
                "name": item.get("name"),
                "indicators": computed["latest"],
                "indicatorSeries": computed["series"],
            })
        except Exception as exc:
            errors.append({"code": item.get("code", ""), "error": str(exc)})
    return ok({"items": items, "errors": errors, "count": len(items)})


# ---------------------------------------------------------------------------
# Composite bundles
# ---------------------------------------------------------------------------

def bundle_technical(args: argparse.Namespace) -> dict[str, Any]:
    codes = parse_codes(args.codes)
    if not codes:
        raise AtomError("missing_codes", "--codes is required")
    return build_bundle(codes, args.interval, args.limit, args.indicators)


def bundle_watchlist_technical(args: argparse.Namespace) -> dict[str, Any]:
    stocks = [normalize_stock_item(item) for item in load_watchlist_items()]
    return build_bundle([stock["code"] for stock in stocks], args.interval, args.limit, args.indicators)


def build_bundle(codes: list[str], interval: str, limit: int, indicators: str) -> dict[str, Any]:
    ensure_interval_supported(interval)
    specs = parse_indicator_specs(indicators)
    quote_data = fetch_quote_items(codes)
    quote_by_code = {item.get("code"): item for item in quote_data["items"]}
    series_data = fetch_series_items(codes, limit)
    items = []
    for item in series_data["items"]:
        computed = compute_indicators_for_series(item["series"], specs)
        code = item["code"]
        quote = quote_by_code.get(code)
        items.append({
            "code": code,
            "name": item.get("name") or (quote or {}).get("name") or code,
            "quote": quote,
            "series": item["series"],
            "indicators": computed["latest"],
            "indicatorSeries": computed["series"],
        })
    return ok({
        "items": items,
        "errors": [*quote_data["errors"], *series_data["errors"]],
        "count": len(items),
    }, sources=[
        {"name": "10jqka/xueqiu", "type": "quote"},
        {"name": "eastmoney", "type": "kline"},
    ])


# ---------------------------------------------------------------------------
# CLI argument parser
# ---------------------------------------------------------------------------

def add_common_input_arg(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--input-json", help="JSON string, @file path, or stdin when omitted")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="stock_data.py")
    sub = parser.add_subparsers(dest="domain", required=True)

    config = sub.add_parser("config")
    config_sub = config.add_subparsers(dest="action", required=True)
    config_sub.add_parser("validate").set_defaults(func=config_validate)

    watchlist = sub.add_parser("watchlist")
    watchlist_sub = watchlist.add_subparsers(dest="action", required=True)
    watchlist_sub.add_parser("list").set_defaults(func=watchlist_list)

    quote = sub.add_parser("quote")
    quote_sub = quote.add_subparsers(dest="action", required=True)
    p = quote_sub.add_parser("get")
    p.add_argument("--code", required=True)
    p.set_defaults(func=quote_get)
    p = quote_sub.add_parser("batch")
    p.add_argument("--codes", required=True)
    p.set_defaults(func=quote_batch)
    quote_sub.add_parser("snapshot").set_defaults(func=quote_snapshot)

    series = sub.add_parser("series")
    series_sub = series.add_subparsers(dest="action", required=True)
    p = series_sub.add_parser("kline")
    p.add_argument("--code", required=True)
    p.add_argument("--interval", default="1d")
    p.add_argument("--limit", type=int, default=300)
    p.set_defaults(func=series_kline)
    p = series_sub.add_parser("batch")
    p.add_argument("--codes", required=True)
    p.add_argument("--interval", default="1d")
    p.add_argument("--limit", type=int, default=300)
    p.set_defaults(func=series_batch)
    p = series_sub.add_parser("watchlist")
    p.add_argument("--interval", default="1d")
    p.add_argument("--limit", type=int, default=300)
    p.set_defaults(func=series_watchlist)

    indicator = sub.add_parser("indicator")
    indicator_sub = indicator.add_subparsers(dest="action", required=True)
    p = indicator_sub.add_parser("ma")
    p.add_argument("--period", type=int, required=True)
    add_common_input_arg(p)
    p.set_defaults(func=indicator_ma)
    p = indicator_sub.add_parser("rsi")
    p.add_argument("--period", type=int, default=14)
    add_common_input_arg(p)
    p.set_defaults(func=indicator_rsi)
    p = indicator_sub.add_parser("macd")
    add_common_input_arg(p)
    p.set_defaults(func=indicator_macd)
    p = indicator_sub.add_parser("batch")
    p.add_argument("--indicators", required=True)
    add_common_input_arg(p)
    p.set_defaults(func=indicator_batch)

    bundle = sub.add_parser("bundle")
    bundle_sub = bundle.add_subparsers(dest="action", required=True)
    p = bundle_sub.add_parser("technical")
    p.add_argument("--codes", required=True)
    p.add_argument("--interval", default="1d")
    p.add_argument("--limit", type=int, default=300)
    p.add_argument("--indicators", required=True)
    p.set_defaults(func=bundle_technical)
    p = bundle_sub.add_parser("watchlist-technical")
    p.add_argument("--interval", default="1d")
    p.add_argument("--limit", type=int, default=300)
    p.add_argument("--indicators", required=True)
    p.set_defaults(func=bundle_watchlist_technical)

    return parser


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        result = args.func(args)
    except AtomError as exc:
        result = fail(exc)
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
        return 1
    except Exception as exc:
        log(f"unexpected error: {exc}")
        result = fail(AtomError("unexpected_error", str(exc), retryable=True))
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
        return 1
    print(json.dumps(result, ensure_ascii=False, allow_nan=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
