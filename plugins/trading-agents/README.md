# Trading Agents 🤖📈

> 多智能体股票分析系统 — 基于 Claude Code 的 workflow 引擎

模拟真实交易团队的分析流程：4 个分析师并行研究 → 多空辩论 → 研究经理裁决 → 交易员提案 → 风险评估 → 投资组合经理最终决策。

**⚠️ 免责声明：本项目仅供研究和教育用途，不构成任何投资建议。投资有风险，决策需谨慎。**

## 🏗️ 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Trading Agents Pipeline                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 1: Analysts (4 parallel)                             │
│  ├── Fundamentals Analyst    ── 三表分析 + 10项异常检测       │
│  ├── Sentiment Analyst       ── 股吧/雪球情绪分析             │
│  ├── News Analyst            ── 新闻/公告/政策解读            │
│  └── Technical Analyst       ── K线/MA/RSI/MACD 技术分析     │
│                                                             │
│  Phase 2: Six-Dimension Analysis                            │
│  ├── 公司阶段判断                                             │
│  ├── 市场定价分析                                             │
│  ├── 预期差分析                                               │
│  ├── 关键变量识别                                             │
│  ├── 多空主要矛盾                                             │
│  └── 数据异常检测                                             │
│                                                             │
│  Phase 3: Research Debate (Bull vs Bear, N rounds)          │
│                                                             │
│  Phase 4: Research Verdict                                   │
│                                                             │
│  Phase 5: Trader Proposal                                    │
│                                                             │
│  Phase 6: Risk Debate (Aggressive / Neutral / Conservative) │
│  └── 结构化风险评估 (4类 × 概率 × 影响)                       │
│                                                             │
│  Phase 7: Portfolio Manager                                  │
│  ├── T+1 规则适配 (A股)                                      │
│  ├── 持仓诊断                                                │
│  └── 明日操作策略                                             │
│                                                             │
│  Phase 8: Export (Markdown + HTML)                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 📦 项目结构

```
trading-agents/
├── README.md                    # 本文件
├── LICENSE                      # MIT License
├── requirements.txt             # Python 依赖
│
├── scripts/
│   ├── stock_data.py            # 行情数据 API (实时报价/K线/技术指标)
│   └── financial_analyzer.py    # 财报三表分析 (异常检测/YoY/QoQ)
│
├── workflows/
│   └── trading-agents.js        # Claude Code 主 workflow
│
├── frameworks/
│   ├── six-dimension-analysis.md  # 六维分析框架
│   ├── risk-framework.md          # 风险评估框架
│   └── anomaly-detection.md       # 异常检测规则
│
├── templates/
│   ├── report.css               # HTML 报告样式
│   └── tearsheet.css            # 速览报告样式
│
├── config/
│   └── watchlist.example.json   # 自选股配置示例
│
└── examples/
    ├── basic-usage.md           # 基本用法
    └── with-portfolio.md        # 带持仓分析
```

## 🚀 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/yourname/trading-agents.git
cd trading-agents

# 安装依赖
pip install -r requirements.txt
```

### 命令行工具

```bash
# 获取实时行情
python scripts/stock_data.py quote get --code 300255.SZ

# 获取日K线 + 技术指标
python scripts/stock_data.py bundle technical \
  --codes 300255.SZ --interval 1d --limit 60 \
  --indicators ma:20,ma:60,rsi:14,macd

# 生成财报分析示例
python scripts/financial_analyzer.py --sample > sample.json

# 分析财报数据
python scripts/financial_analyzer.py data.json --json
```

### Claude Code Workflow

```bash
# 基本分析
/trading-agents 300255.SZ

# 带持仓分析 (含 T+1 规则)
# 在 Claude Code 中运行:
Workflow({
  scriptPath: "workflows/trading-agents.js",
  args: {
    ticker: "300255.SZ",
    date: "2026-06-11",
    holdCost: 34.7,
    holdQuantity: 10000,
    holdingDate: "2026-06-11",
    scriptsDir: "scripts"
  }
})
```

## 📊 核心功能

### 1. 四维分析师团队

| 分析师 | 职责 | 数据源 |
|--------|------|--------|
| 基本面分析师 | 三表分析、异常检测、估值 | 东方财富 F10 |
| 情绪分析师 | 散户情绪、资金流向 | 股吧、雪球 |
| 新闻分析师 | 政策解读、事件驱动 | 财经新闻 |
| 技术分析师 | K线形态、指标信号 | stock_data.py |

### 2. 六维分析框架

1. **公司阶段** — 成长/成熟/衰退/转型
2. **市场定价** — 估值隐含了什么预期？
3. **预期差** — 市场可能忽略了什么？
4. **关键变量** — 未来6个月最关键的变量
5. **主要矛盾** — 多空最大分歧点
6. **数据异常** — 财务/资金流异常信号

### 3. 结构化风险评估

- **4 类风险**：公司特有 / 行业市场 / 财务 / 宏观监管
- **概率评分**：Low(10-25%) / Medium(25-50%) / High(50-75%) / Very High(>75%)
- **影响评分**：Low(±5%) / Medium(±5-15%) / High(±15-30%) / Very High(>30%)
- **优先级矩阵**：■ (最低) 到 ■■■■■ (最高)

### 4. 10 项财务异常检测

| # | 规则 | 阈值 |
|---|------|------|
| 1 | 应收账款暴增 | AR增速 - 营收增速 > 20% |
| 2 | 现金流背离利润 | OCF/NI < 50% |
| 3 | 存货积压 | 存货增速 - 营收增速 > 15% |
| 4 | 毛利率突变 | 环比变动 > 5pp |
| 5 | 净利率突变 | 环比变动 > 3pp |
| 6 | 经营现金流持续为负 | 连续 2+ 期 |
| 7 | 商誉占比过高 | > 30% |
| 8 | 资产负债率过高 | > 70% |
| 9 | 流动比率过低 | < 1.0 |
| 10 | 应付账款异常 | AP增速偏离成本增速 > 20% |

### 5. A 股特殊适配

- **T+1 规则**：当天买入当天不能卖出，自动提示明日操作策略
- **做空限制**：A 股不能做空，用 Reduce/Avoid 替代 Sell
- **持仓诊断**：根据买入成本计算盈亏，给出精确止盈止损价位

## 🔧 技术栈

- **Claude Code Workflow** — 多智能体编排引擎
- **Python** — 行情数据获取、财报分析
- **数据源** — 10jqka（同花顺）、东方财富、雪球
- **输出** — Markdown + 自包含 HTML 报告

## 📝 数据源说明

| 数据源 | 用途 | 协议 | 认证 |
|--------|------|------|------|
| 10jqka (同花顺) | A股实时行情 | HTTP | 无需 |
| 东方财富 | 日K线历史数据 | HTTPS | 无需 |
| 雪球 | 港美股行情 | HTTPS | 无需 |
| 东方财富 F10 | 财务数据 | HTTPS | 无需 |

所有数据源均为免费公开 API，无需注册或 API Key。

### 已知限制

如果你使用了代理工具（如 Clash、V2Ray 等），东方财富的 HTTPS 接口可能被代理拦截。解决方案：

```bash
# 方法1: 设置 NO_PROXY 环境变量
export NO_PROXY="push2his.eastmoney.com,10jqka.com.cn,xueqiu.com"

# 方法2: 在代理工具中添加直连规则
# DOMAIN-SUFFIX,eastmoney.com,DIRECT
# DOMAIN-SUFFIX,10jqka.com.cn,DIRECT
```

或者直接关闭代理后再运行脚本。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT License - 详见 [LICENSE](LICENSE)
