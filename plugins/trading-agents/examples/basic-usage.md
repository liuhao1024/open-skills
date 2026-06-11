# 基本用法

## 获取实时行情

```bash
# A股
python scripts/stock_data.py quote get --code 300255.SZ

# 港股
python scripts/stock_data.py quote get --code 0700.HK

# 美股
python scripts/stock_data.py quote get --code AAPL
```

## 获取技术指标

```bash
# 单股 K 线 + 指标
python scripts/stock_data.py bundle technical \
  --codes 300255.SZ \
  --interval 1d \
  --limit 60 \
  --indicators ma:5,ma:10,ma:20,ma:60,rsi:14,macd

# 多股对比
python scripts/stock_data.py bundle technical \
  --codes 300255.SZ,600519.SH \
  --interval 1d \
  --limit 60 \
  --indicators ma:20,rsi:14,macd
```

## 财报分析

```bash
# 生成示例数据格式
python scripts/financial_analyzer.py --sample > sample.json

# 编辑 sample.json 填入真实数据后分析
python scripts/financial_analyzer.py sample.json

# 输出 JSON 格式
python scripts/financial_analyzer.py sample.json --json
```

## 运行完整分析 Workflow

在 Claude Code 中：

```
/trading-agents 300255.SZ
```

或使用 Workflow 工具：

```javascript
Workflow({
  scriptPath: "workflows/trading-agents.js",
  args: {
    ticker: "300255.SZ",
    date: "2026-06-11",
    scriptsDir: "scripts"
  }
})
```
