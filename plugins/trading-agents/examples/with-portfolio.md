# 带持仓分析

当你持有某只股票时，可以传入持仓信息，workflow 会：

1. 计算浮动盈亏
2. 给出精确的止盈止损价位
3. A 股自动检测 T+1 限制
4. 提供明日开盘策略（高开/平开/低开应对）

## 用法

```javascript
Workflow({
  scriptPath: "workflows/trading-agents.js",
  args: {
    ticker: "300255.SZ",
    date: "2026-06-11",
    holdCost: 34.7,        // 买入成本价
    holdQuantity: 10000,    // 持仓数量
    holdingDate: "2026-06-11",  // 买入日期
    scriptsDir: "scripts"
  }
})
```

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ticker | string | ✅ | 股票代码 (如 300255.SZ) |
| date | string | ❌ | 分析日期，默认当天 |
| holdCost | number | ❌ | 买入成本价 |
| holdQuantity | number | ❌ | 持仓数量 |
| holdingDate | string | ❌ | 买入日期 (YYYY-MM-DD) |
| debateRounds | number | ❌ | 多空辩论轮数，默认 2 |
| riskRounds | number | ❌ | 风险辩论轮数，默认 1 |
| scriptsDir | string | ❌ | 脚本目录路径，默认 "scripts" |
| outDir | string | ❌ | 报告输出目录，默认 "trading-agents-reports" |

## T+1 规则

A 股实行 T+1 交易制度：
- 当天买入的股票，当天不能卖出
- 如果 `holdingDate === date`，workflow 会自动：
  - 标记 T+1 限制
  - 给出明日开盘策略（而非今天的即时操作建议）
  - 在报告中醒目标注

## 输出示例

报告会包含以下持仓相关章节：

### 📊 Portfolio Diagnosis
- 买入成本：34.70元
- 持仓数量：10,000股
- 浮动盈亏：+2,100元 (+0.61%)
- 止损价位：34.50元
- 止盈价位：38.00元

### ⚠️ T+1 Restriction
今天买入，最早明天可操作。

### 📅 Tomorrow's Strategy
- **高开 (35.5+)**：考虑减半仓锁利润
- **平开 (35.0-35.5)**：持有观察
- **低开 (35.0 以下)**：看 34.50 支撑，破位止损
