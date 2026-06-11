/**
 * Trading Agents — a multi-agent financial analysis workflow for Claude Code.
 *
 * Mirrors the structure of a real trading firm as a single Claude Code
 * dynamic workflow:
 *
 *   Analyst Team (4 parallel)  →  Researcher Debate (bull vs bear, N rounds)
 *   →  Research Manager verdict →  Trader proposal
 *   →  Risk Debate (aggressive / neutral / conservative) → Risk Manager
 *   →  Portfolio Manager final call (5-tier rating)
 *   →  Export: a Markdown report + a deterministic, self-contained HTML page
 *
 * Run it:
 *   Workflow({ scriptPath: ".../trading-agents.workflow.js",
 *              args: { ticker: "NVDA", date: "2026-01-15", debateRounds: 2 } })
 *
 * ⚠️  Research/education only. NOT financial, investment, or trading advice.
 *     Agents are instructed to ground every claim in retrieved data and to
 *     flag — never fabricate — anything they cannot verify.
 */

export const meta = {
  name: 'trading-agents',
  description: 'Multi-agent equity analysis (analysts → bull/bear debate → trader → risk → PM)',
  whenToUse: 'Deep, multi-perspective analysis of a single ticker that ends in a rated, risk-checked decision. Research only — not financial advice.',
  phases: [
    { title: 'Analysts', detail: '4 analysts gather data in parallel: fundamentals, sentiment, news, technical' },
    { title: 'Six-Dimension Analysis', detail: 'Company stage, market pricing, expectation gap, key variables, main contradiction, data anomalies' },
    { title: 'Research Debate', detail: 'Bull vs bear researchers debate over N rounds' },
    { title: 'Research Verdict', detail: 'Research manager judges the debate' },
    { title: 'Trader', detail: 'Trader turns the verdict into a concrete proposal' },
    { title: 'Risk Debate', detail: 'Structured risk assessment with probability × impact scoring' },
    { title: 'Portfolio Manager', detail: 'Final approve/reject with T+1 rules and portfolio diagnosis' },
    { title: 'Export', detail: 'Write a Markdown report and a deterministic, self-contained HTML page' },
  ],
}

// ---- Inputs -----------------------------------------------------------------
// `args` is supplied at run time and may arrive two ways:
//   • a structured object — Workflow({ args: { ticker, date, debateRounds, riskRounds } })
//   • a free-text string  — the trailing text of the `/trading-agents NVDA as of 2026-05-28` command
// Handle both. (No Date.now()/new Date() in workflow scripts, so the date is parsed/passed in.)
const _obj = (args && typeof args === 'object') ? args : {}
const _text = (typeof args === 'string') ? args : ''
const _date = _text.match(/\b\d{4}-\d{2}-\d{2}\b/)               // e.g. 2026-05-28
// Ticker regex: must contain at least one letter OR a dot-suffix (to avoid matching pure numbers like dates)
const _ticker = _text.match(/\b[A-Z0-9]{1,6}(?:\.[A-Z]{1,4})\b/) ||  // e.g. 300255.SZ, NVDA, 0700.HK
  _text.match(/\b[A-Z]{1,6}\b/)  // e.g. NVDA, AAPL (no dot needed if all letters)

const ticker = _obj.ticker || (_ticker && _ticker[0]) || 'NVDA'
const date = _obj.date || (_date && _date[0]) || 'the most recent trading day'
const debateRounds = _obj.debateRounds || 2
const riskRounds = _obj.riskRounds || 1
const outDir = _obj.outDir || 'trading-agents-reports'
const isAShare = /\.(SH|SZ)$/i.test(ticker)

// Script paths — configurable via args.scriptsDir, defaults to "scripts" relative to workflow
const scriptsDir = _obj.scriptsDir || 'scripts'
const STOCK_SCRIPT = `${scriptsDir}/stock_data.py`
const FINANCE_SCRIPT = `${scriptsDir}/financial_analyzer.py`

// Portfolio context (optional)
const holdCost = _obj.holdCost || null       // 买入成本价
const holdQuantity = _obj.holdQuantity || null // 持仓数量
const holdingDate = _obj.holdingDate || null   // 买入日期 (YYYY-MM-DD)
const hasPosition = holdCost && holdQuantity && holdQuantity > 0

// A-share T+1 rule: cannot sell on the same day of purchase
const canSellToday = !isAShare || !holdingDate || holdingDate !== date
const t1Note = isAShare && holdingDate === date
  ? `\n\n⚠️ T+1限制：用户今天（${date}）买入，当天无法卖出。最早可操作日期为明天。请给出明日开盘策略（高开/平开/低开分别怎么应对），而非今天的即时操作建议。`
  : ''

// Portfolio prompt section
const portfolioPrompt = hasPosition ? `
## 用户持仓信息
- 买入成本：${holdCost}元
- 持仓数量：${holdQuantity}股
- 买入日期：${holdingDate || '未知'}
- 持仓市值：${holdCost * holdQuantity}元
- T+1限制：${canSellToday ? '可今天操作' : '今天买入，最早明天可操作'}
` : ''

const DATA_RULES = `
Ground every claim in data you actually retrieve using the tools available to you
(web search, market-data, news, and social tools — discover them via ToolSearch).
Treat the analysis date as ${date} and do not use information from after it.
If you cannot retrieve a figure, say so explicitly under dataGaps — never fabricate
numbers, prices, or quotes.

## Structured Data API (stock_data.py)
For A-share stocks (.SH/.SZ), use these CLI commands for structured data:

\`\`\`bash
# Real-time quote
python3 ${STOCK_SCRIPT} quote get --code ${ticker}

# Daily K-line + technical indicators (MA/RSI/MACD)
python3 ${STOCK_SCRIPT} bundle technical \
  --codes ${ticker} --interval 1d --limit 60 \
  --indicators ma:5,ma:10,ma:20,ma:60,rsi:14,macd
\`\`\`

## Financial Analysis (financial_analyzer.py)
For three-statement analysis and anomaly detection:

\`\`\`bash
# Generate sample data format
python3 ${FINANCE_SCRIPT} --sample > sample.json

# Analyze financial data
python3 ${FINANCE_SCRIPT} data.json --json
\`\`\`

Parse the JSON output. Use this data for technical analysis, price levels, and indicator readings.

## Financial Report Analysis
For fundamental analysis, fetch the three financial statements (income statement, balance sheet,
cash flow) from eastmoney F10 pages. Apply these anomaly detection rules:
1. Accounts receivable surge (AR growth - revenue growth > 20%)
2. Cash flow divergence (OCF / Net Income < 50%)
3. Inventory buildup (inventory growth - revenue growth > 15%)
4. Gross margin spike (change > 5pp)
5. Net margin spike (change > 3pp)
6. Persistent negative OCF (2+ consecutive periods)
7. Excessive goodwill (> 30% of total assets)
8. High leverage (debt/assets > 70%)
9. Low current ratio (< 1.0)
10. Accounts payable anomaly

## Web Search Fallback
If structured API fails, use Playwright browser to visit eastmoney.com or finance.sina.com.cn.
Navigate to the stock page, take a snapshot to read data, then RETURN YOUR REPORT IMMEDIATELY.
Do not spend more than 2-3 browser interactions.`.trim()

// ---- Structured-output schemas ---------------------------------------------
const ANALYST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    analyst: { type: 'string' },
    summary: { type: 'string', description: 'Tight 3-6 sentence read' },
    signal: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] },
    confidence: { type: 'number', description: '0-1' },
    keyPoints: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    dataGaps: { type: 'array', items: { type: 'string' } },
    sources: { type: 'array', items: { type: 'string' } },
  },
  required: ['analyst', 'summary', 'signal', 'confidence', 'keyPoints'],
}

const RESEARCH_VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    stance: { type: 'string', enum: ['bullish', 'bearish', 'mixed'] },
    conviction: { type: 'number', description: '0-1' },
    lean: { type: 'string', enum: ['buy', 'hold', 'sell'] },
    strongestBullArgument: { type: 'string' },
    strongestBearArgument: { type: 'string' },
    rationale: { type: 'string' },
  },
  required: ['stance', 'conviction', 'lean', 'rationale'],
}

const TRADE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: { type: 'string', enum: isAShare
      ? ['BUY', 'HOLD', 'REDUCE', 'AVOID']
      : ['BUY', 'SELL', 'HOLD']
    },
    sizePct: { type: 'number', description: 'Suggested position size as % of book' },
    entry: { type: 'string' },
    stopLoss: { type: 'string' },
    takeProfit: { type: 'string' },
    timeframe: { type: 'string' },
    rationale: { type: 'string' },
  },
  required: ['action', 'rationale'],
}

const RISK_REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    perspective: { type: 'string' },
    assessment: { type: 'string' },
    mainConcern: { type: 'string' },
    suggestedAdjustment: { type: 'string' },
    verdict: { type: 'string', enum: ['approve', 'approve_with_changes', 'reject'] },
  },
  required: ['perspective', 'assessment', 'verdict'],
}

const SIX_DIM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    companyStage: { type: 'string', description: '公司阶段：成长/成熟/衰退/转型' },
    marketPricing: { type: 'string', description: '当前估值隐含了什么预期，是否合理' },
    expectationGap: { type: 'string', description: '市场可能忽略的正/负预期差' },
    keyVariables: { type: 'array', items: { type: 'string' }, description: '未来6个月最关键的1-2个变量' },
    mainContradiction: { type: 'string', description: '多空最大分歧点' },
    dataAnomalies: { type: 'array', items: { type: 'string' }, description: '财务/资金流/市场行为的异常信号' },
    conclusion: { type: 'string', description: '六维分析综合结论' },
  },
  required: ['companyStage', 'marketPricing', 'expectationGap', 'keyVariables', 'mainContradiction', 'conclusion'],
}

const RISK_ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    category: { type: 'string', enum: ['A-Company', 'B-Industry', 'C-Financial', 'D-Macro'] },
    title: { type: 'string' },
    description: { type: 'string' },
    probability: { type: 'string', enum: ['Low', 'Medium', 'High', 'Very High'] },
    impact: { type: 'string', enum: ['Low', 'Medium', 'High', 'Very High'] },
    priority: { type: 'string', description: 'Priority score: ■ to ■■■■■' },
    timeHorizon: { type: 'string' },
    monitorSignal: { type: 'string' },
  },
  required: ['id', 'category', 'title', 'probability', 'impact', 'priority'],
}

const RISK_MANAGER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    riskRating: { type: 'string', enum: ['low', 'medium', 'high'] },
    approvedForPM: { type: 'boolean' },
    requiredAdjustments: { type: 'array', items: { type: 'string' } },
    rationale: { type: 'string' },
  },
  required: ['riskRating', 'approvedForPM', 'rationale'],
}

const PM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    decision: { type: 'string', enum: isAShare
      ? ['Buy', 'Overweight', 'Hold', 'Underweight', 'Reduce', 'Avoid']
      : ['Buy', 'Overweight', 'Hold', 'Underweight', 'Sell']
    },
    finalAction: { type: 'string' },
    positionSizePct: { type: 'number' },
    rationale: { type: 'string' },
    keyRisks: { type: 'array', items: { type: 'string' } },
    conditions: { type: 'array', items: { type: 'string' } },
    // T+1 / portfolio fields
    nextDayStrategy: { type: 'string', description: '明日开盘策略：高开/平开/低开分别怎么应对' },
    stopLossPrice: { type: 'string', description: '止损价位' },
    takeProfitPrice: { type: 'string', description: '止盈价位' },
    portfolioDiagnosis: { type: 'string', description: '持仓诊断（如有持仓）' },
  },
  required: ['decision', 'finalAction', 'rationale'],
}

// ---- Phase 1: Analyst Team (parallel) --------------------------------------
phase('Analysts')
log(`Analyzing ${ticker} as of ${date} — dispatching 4 analysts`)

const ANALYSTS = [
  {
    key: 'fundamentals',
    brief: `You are the FUNDAMENTALS ANALYST. Evaluate ${ticker}'s financials comprehensively.

      ## Required Analysis:
      1. **Three Statements**: Income statement, balance sheet, cash flow — fetch from eastmoney F10
      2. **YoY/QoQ Changes**: Compare latest period vs prior period and year-ago period
      3. **Financial Ratios**: Gross margin, net margin, ROE, debt ratio, current ratio, DSO, DIO
      4. **Anomaly Detection** (run ALL 10 rules):
         - AR surge (AR growth - revenue growth > 20%)
         - Cash flow divergence (OCF / Net Income < 50%)
         - Inventory buildup (inventory growth - revenue growth > 15%)
         - Gross margin spike (change > 5pp)
         - Net margin spike (change > 3pp)
         - Persistent negative OCF (2+ periods)
         - Excessive goodwill (> 30% of assets)
         - High leverage (debt/assets > 70%)
         - Low current ratio (< 1.0)
         - AP anomaly
      5. **Three-Statement Linkage**:
         - IS → BS: Is revenue growth driven by AR?
         - IS → CF: Does net income match OCF?
         - BS → CF: What funds asset expansion?

      Use structured data from stock_data.py or eastmoney F10 pages.
      ${hasPosition ? `\n${portfolioPrompt}\nEvaluate whether the user's entry price (${holdCost}) has adequate safety margin.` : ''}`,
  },
  {
    key: 'sentiment',
    brief: `You are the SENTIMENT ANALYST. Aggregate recent news headlines, StockTwits,
      and Reddit chatter on ${ticker} into a single short-term market-mood read.
      For Chinese A-share stocks (e.g. codes ending in .SH or .SZ), use Playwright
      browser tools to visit xueqiu.com (雪球), guba.eastmoney.com (股吧), and
      finance.sina.com.cn to gather retail sentiment, discussion volume, and mood.`,
  },
  {
    key: 'news',
    brief: `You are the NEWS ANALYST. Monitor global news and macro indicators relevant
      to ${ticker}; interpret how recent events and the macro backdrop affect it.
      For Chinese A-share stocks, use Playwright browser tools to visit
      finance.eastmoney.com, finance.sina.com.cn, and cls.cn (财联社) for
      real-time news and announcements.`,
  },
  {
    key: 'technical',
    brief: `You are the TECHNICAL ANALYST. Analyze ${ticker}'s price action using structured data.

      ## Data Source (Priority Order):
      1. **First**: Run this CLI command and parse JSON output:
         \`\`\`bash
         python3 ${STOCK_SCRIPT} bundle technical \
           --codes ${ticker} --interval 1d --limit 60 \
           --indicators ma:5,ma:10,ma:20,ma:60,rsi:14,macd
         \`\`\`
      2. **Fallback**: Playwright browser to quote.eastmoney.com

      ## Required Analysis:
      - **Trend**: MA5/10/20/60 alignment (bullish: MA5>MA10>MA20>MA60)
      - **Momentum**: RSI14 (>70 overbought, <30 oversold), MACD golden/death cross
      - **Volume**: Volume ratio, outer vs inner disk (buy vs sell pressure)
      - **Support/Resistance**: Key price levels from recent highs/lows
      - **Pattern**: Identify any chart patterns (gap, head-shoulders, etc.)

      ${hasPosition ? `## User's Position
      - Entry price: ${holdCost}
      - Current P&L: calculate from quote data
      - Key levels relative to entry: support below, resistance above
      - Give specific stop-loss and take-profit prices` : ''}`,
  },
]

const analystReports = (await parallel(
  ANALYSTS.map(a => () =>
    agent(
      `${a.brief}\n\n${DATA_RULES}\n\nReturn a structured analyst report for ${ticker}.`,
      { label: `analyst:${a.key}`, phase: 'Analysts', schema: ANALYST_SCHEMA },
    ),
  ),
)).filter(Boolean)

const analystDigest = analystReports
  .map(r => `### ${r.analyst} — signal: ${r.signal} (conf ${r.confidence})\n${r.summary}\nKey: ${(r.keyPoints || []).join('; ')}\nRisks: ${(r.risks || []).join('; ')}`)
  .join('\n\n')

// ---- Phase 1.5: Six-Dimension Analysis ----------------------------
phase('Six-Dimension Analysis')
const sixDim = await agent(
  `You are a SENIOR INVESTMENT ANALYST performing a six-dimension analysis on ${ticker}.

   Based on the analyst reports below, complete ALL six dimensions:

   **Dimension 1 — Company Stage**: Is the company in growth/maturity/decline/transformation?
   Use 3-5 core data points (revenue trend, profit quality, valuation, cash flow, market position).

   **Dimension 2 — Market Pricing**: What expectations are embedded in current valuation?
   Restore implicit assumptions (what growth rate is needed to justify market cap?).

   **Dimension 3 — Expectation Gap**: What might the market be missing?
   Identify positive or negative factors the market may be overlooking.

   **Dimension 4 — Key Variables**: In the next 6 months, which 1-2 variables would most change the view?
   Include fund flow / market sentiment as one variable.

   **Dimension 5 — Main Contradiction**: What is the biggest bull vs bear disagreement?
   Summarize strongest arguments from both sides.

   **Dimension 6 — Data Anomalies**: Any anomalies in financial/operational/fund flow data?
   Apply the 10 anomaly detection rules from the fundamentals analyst.

   Analyst reports:\n${analystDigest}

   ${portfolioPrompt}
   ${t1Note}`,
  { label: 'six-dimension', phase: 'Six-Dimension Analysis', schema: SIX_DIM_SCHEMA },
)
log(`Six-dimension analysis: ${sixDim.companyStage} stage, gap direction: ${sixDim.expectationGap?.substring(0, 50)}...`)

// ---- Phase 2: Researcher Debate (bull vs bear, sequential rounds) ----------
phase('Research Debate')
let transcript = ''
for (let round = 1; round <= debateRounds; round++) {
  const bull = await agent(
    `You are the BULLISH RESEARCHER debating ${ticker} (round ${round}/${debateRounds}).
     Build the strongest evidence-based case to BUY/hold long. Rebut the bear's latest points.

     IMPORTANT: Do NOT use browser tools. You may use web search to find 1-2 key supporting
     data points, but do NOT spend more than 3 tool calls total. Return your argument immediately.

     Six-dimension analysis:\n${JSON.stringify(sixDim)}\n\n
     Analyst reports:\n${analystDigest}\n\nDebate so far:\n${transcript || '(none yet)'}\n\n${DATA_RULES}`,
    { label: `bull:r${round}`, phase: 'Research Debate' },
  )
  transcript += `\n\n[Round ${round}] BULL: ${bull}`

  const bear = await agent(
    `You are the BEARISH RESEARCHER debating ${ticker} (round ${round}/${debateRounds}).
     Build the strongest evidence-based case to AVOID/short. Directly rebut the bull's points above.

     IMPORTANT: Do NOT use browser tools. You may use web search to find 1-2 key supporting
     data points, but do NOT spend more than 3 tool calls total. Return your argument immediately.

     Six-dimension analysis:\n${JSON.stringify(sixDim)}\n\n
     Analyst reports:\n${analystDigest}\n\nDebate so far:\n${transcript}\n\n${DATA_RULES}`,
    { label: `bear:r${round}`, phase: 'Research Debate' },
  )
  transcript += `\n\n[Round ${round}] BEAR: ${bear}`
  log(`Research debate round ${round}/${debateRounds} complete`)
}

// ---- Phase 3: Research Manager verdict -------------------------------------
phase('Research Verdict')
const researchVerdict = await agent(
  `You are the RESEARCH MANAGER. Judge the bull/bear debate on ${ticker} objectively and
   declare a balanced verdict. Weigh which side argued from stronger evidence.

   IMPORTANT: Do NOT use browser tools. Base your verdict ONLY on the data below.
   Return your structured output immediately.

   Analyst reports:\n${analystDigest}\n\nFull debate:\n${transcript}`,
  { label: 'research-manager', phase: 'Research Verdict', schema: RESEARCH_VERDICT_SCHEMA },
)

// ---- Phase 4: Trader proposal ----------------------------------------------
phase('Trader')
const trade = await agent(
  `You are the TRADER. Compose the analyst reports and the research manager's verdict into
   a concrete, actionable proposal for ${ticker} as of ${date}. Decide timing and magnitude.

   IMPORTANT: Do NOT use browser tools. Base your proposal ONLY on the data below.
   Return your structured output immediately.
   ${isAShare ? `
   A-SHARE CONSTRAINT: This is a Chinese A-share stock. Retail investors CANNOT short sell.
   Use these action codes instead of SELL:
   - "BUY" = buy/enter a long position
   - "HOLD" = hold existing position, no action
   - "REDUCE" = sell/reduce existing long position (for holders)
   - "AVOID" = do not buy, stay on the sidelines (for non-holders)
   Do NOT use "SELL" — it implies short selling which is not available for A-shares.
   Frame stopLoss and takeProfit from a LONG perspective (for holders considering reduction).
   ` : ''}

   Research verdict: ${JSON.stringify(researchVerdict)}\n\nAnalyst reports:\n${analystDigest}`,
  { label: 'trader', phase: 'Trader', schema: TRADE_SCHEMA },
)

// ---- Phase 5: Risk Debate (3 perspectives, optional rounds) ----------------
phase('Risk Debate')
const RISK_VIEWS = [
  { key: 'aggressive', brief: 'You favor higher risk/reward; defend the upside and argue for keeping or increasing exposure where justified.' },
  { key: 'neutral', brief: 'You are balanced; weigh reward against downside dispassionately.' },
  { key: 'conservative', brief: 'You prioritize capital preservation; surface tail risks and argue for caution or smaller size.' },
]

const STRUCTURED_RISK_BRIEF = `
## Structured Risk Assessment Framework
For each risk you identify, categorize it:
- **A-Company**: Execution, key person, customer concentration, technology, capital allocation, governance
- **B-Industry**: Competition, cyclicality, disruption, supply chain
- **C-Financial**: Leverage, liquidity, currency, valuation
- **D-Macro**: Interest rate, regulatory, geopolitical, macro cycle

Score each risk:
- Probability: Low (10-25%) / Medium (25-50%) / High (50-75%) / Very High (>75%)
- Impact: Low (±5%) / Medium (±5-15%) / High (±15-30%) / Very High (>30%)
- Priority: ■ (minimal) to ■■■■■ (critical)

Identify 6-8 risks minimum across at least 3 categories.
`

let riskReviews = []
for (let round = 1; round <= riskRounds; round++) {
  const priorRisk = riskReviews.length
    ? `\n\nPrior-round risk views:\n${riskReviews.map(r => `${r.perspective}: ${r.assessment}`).join('\n')}`
    : ''
  const round_ = (await parallel(
    RISK_VIEWS.map(v => () =>
      agent(
        `You are the ${v.key.toUpperCase()} RISK REVIEWER for the proposed ${ticker} trade.
         ${v.brief}

         ${STRUCTURED_RISK_BRIEF}

         IMPORTANT: Do NOT use browser tools. You may use web search ONLY to verify specific
         factual claims (e.g. stock price, PB ratio). Do NOT spend more than 2-3 tool calls
         on verification. Return your structured output immediately after gathering minimal
         verification data.
         ${isAShare ? 'A-SHARE NOTE: This stock cannot be shorted. Evaluate the trade as a long position reduction/exit, not a short.' : ''}

         Six-dimension analysis:\n${JSON.stringify(sixDim)}\n
         Proposed trade: ${JSON.stringify(trade)}\nResearch verdict: ${JSON.stringify(researchVerdict)}${priorRisk}
         ${hasPosition ? `\nUser's position: cost=${holdCost}, qty=${holdQuantity}, entry=${holdingDate}. Assess position-specific risks.` : ''}`,
        { label: `risk:${v.key}:r${round}`, phase: 'Risk Debate', schema: RISK_REVIEW_SCHEMA },
      ),
    ),
  )).filter(Boolean)
  riskReviews = round_
  log(`Risk debate round ${round}/${riskRounds} complete`)
}

const riskManagerCall = await agent(
  `You are the RISK MANAGER. Synthesize the risk reviewers into a single risk assessment for
   the ${ticker} trade. Decide whether it is fit to forward to the Portfolio Manager and what
   adjustments are required.

   IMPORTANT: Do NOT use browser tools. Base your assessment ONLY on the data below.
   Return your structured output immediately.

   Proposed trade: ${JSON.stringify(trade)}\nRisk reviews: ${JSON.stringify(riskReviews)}`,
  { label: 'risk-manager', phase: 'Risk Debate', schema: RISK_MANAGER_SCHEMA },
)

// ---- Phase 6: Portfolio Manager final decision -----------------------------
phase('Portfolio Manager')
const decision = await agent(
  `You are the PORTFOLIO MANAGER making the final call on ${ticker} as of ${date}.
   Approve or reject the trade and issue a 5-tier rating
   (Buy / Overweight / Hold / Underweight / ${isAShare ? 'Reduce / Avoid' : 'Sell'}). Be decisive but honor the risk
   manager's required adjustments.

   IMPORTANT: Do NOT use browser tools or any data retrieval tools. Your decision must
   be based SOLELY on the data already gathered by the analysts and risk reviewers below.
   Focus on making a decisive judgment call and returning your structured output immediately.
   ${isAShare ? `
   A-SHARE CONSTRAINT: This is a Chinese A-share stock. Retail investors CANNOT short sell.
   Use "Reduce" (for holders to sell part/all of position) or "Avoid" (for non-holders to stay out)
   instead of "Sell". Do NOT recommend short selling.
   ` : ''}
   ${t1Note}
   ${hasPosition ? `
   PORTFOLIO CONTEXT: The user has an existing position.
   - Cost basis: ${holdCost}元
   - Quantity: ${holdQuantity}股
   - Entry date: ${holdingDate || 'unknown'}
   - Can sell today: ${canSellToday ? 'YES' : 'NO (T+1 restriction)'}

   In your response:
   - portfolioDiagnosis: Assess the current P&L, position health, and whether the entry price has adequate safety margin
   - nextDayStrategy: Give specific plan for tomorrow's open (high open / flat open / low open scenarios)
   - stopLossPrice: Exact price to set stop-loss
   - takeProfitPrice: Exact price to take profit
   ` : ''}

   Six-dimension analysis:\n${JSON.stringify(sixDim)}\n
   Research verdict: ${JSON.stringify(researchVerdict)}
   Proposed trade: ${JSON.stringify(trade)}
   Risk manager: ${JSON.stringify(riskManagerCall)}

   Reminder: this is research/education only, not financial advice. State that in your rationale.`,
  { label: 'portfolio-manager', phase: 'Portfolio Manager', schema: PM_SCHEMA },
)

log(`Final rating for ${ticker}: ${decision.decision}`)

// ---- Phase 7: Export artifacts ---------------------------------------------
// Both artifacts are built by fixed templates (pure functions of the run data)
// — no LLM redesign, no timestamps, no randomness — so the same data always
// renders the same files. The workflow script can't touch the filesystem, so a
// single agent writes the pre-rendered bytes verbatim.
phase('Export')

const report = {
  ticker, date, decision, isAShare,
  riskManager: riskManagerCall,
  trade, researchVerdict,
  analysts: analystReports,
  sixDim,
  hasPosition, holdCost, holdQuantity, holdingDate, canSellToday, t1Note,
}
const slug = `${ticker}-${date}`.replace(/[^A-Za-z0-9._-]+/g, '_')
const mdPath = `${outDir}/${slug}.md`
const htmlPath = `${outDir}/${slug}.html`
const markdown = buildMarkdown(report)
const html = buildHtml(report)

await agent(
  `Write two pre-rendered report files to disk EXACTLY as given — byte for byte. Do NOT edit,
   reformat, summarize, pretty-print, or add anything of your own. Create the directory "${outDir}"
   if it does not exist, then use the Write tool to create each file with the exact content between
   its markers (do not include the marker lines). Reply with only the two file paths.

=== FILE A === path: ${mdPath}
<<<<<<MARKDOWN_BEGIN
${markdown}
MARKDOWN_END>>>>>>

=== FILE B === path: ${htmlPath}
<<<<<<HTML_BEGIN
${html}
HTML_END>>>>>>`,
  { label: 'export', phase: 'Export' },
)

log(`Exported report → ${mdPath} and ${htmlPath}`)

return {
  ticker,
  date,
  decision,
  riskManager: riskManagerCall,
  trade,
  researchVerdict,
  analysts: analystReports,
  sixDim,
  artifacts: { markdown: mdPath, html: htmlPath },
  market: isAShare ? 'A-Share (no short selling)' : 'Standard',
  portfolio: hasPosition ? { holdCost, holdQuantity, holdingDate, canSellToday } : null,
  disclaimer: 'Research/education only. Not financial, investment, or trading advice.' +
    (isAShare ? ' A-share stocks cannot be shorted by retail investors. SELL signals mean reduce/exit long positions only.' : ''),
}

// ---- Deterministic artifact builders (pure functions of the run data) ------
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function chipClass(v) {
  const s = String(v || '').toLowerCase()
  if (/(bull|buy|overweight|approve|low)/.test(s)) return 'pos'
  if (/(bear|sell|underweight|reject|high|reduce|avoid)/.test(s)) return 'neg'
  return 'neu'
}
function mdList(items) {
  return items && items.length ? items.map(x => `- ${x}`).join('\n') : '_None._'
}
function htmlList(items) {
  return items && items.length
    ? `<ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
    : '<p class="muted">None.</p>'
}
function paras(text) {
  const t = String(text || '').trim()
  if (!t) return ''
  return t.split(/\n\n+/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')
}

function buildMarkdown(r) {
  const d = r.decision, t = r.trade, rm = r.riskManager, rv = r.researchVerdict, sd = r.sixDim
  const analysts = r.analysts.map(a => [
    `### ${a.analyst}`,
    `**Signal:** ${a.signal} · confidence ${a.confidence}`,
    a.summary || '',
    `**Key points**\n${mdList(a.keyPoints)}`,
    `**Risks**\n${mdList(a.risks)}`,
    `**Data gaps**\n${mdList(a.dataGaps)}`,
    `**Sources**\n${mdList(a.sources)}`,
  ].join('\n\n')).join('\n\n')

  const portfolioSection = r.hasPosition ? [
    `## 📊 Portfolio Diagnosis`,
    `- **Entry price:** ${r.holdCost}元`,
    `- **Quantity:** ${r.holdQuantity}股`,
    `- **Entry date:** ${r.holdingDate || 'unknown'}`,
    `- **Can sell today:** ${r.canSellToday ? 'YES' : 'NO (T+1 restriction)'}`,
    d.portfolioDiagnosis ? `\n${d.portfolioDiagnosis}` : '',
    d.stopLossPrice ? `- **Stop-loss:** ${d.stopLossPrice}` : '',
    d.takeProfitPrice ? `- **Take-profit:** ${d.takeProfitPrice}` : '',
    d.nextDayStrategy ? `\n### Tomorrow's Strategy\n${d.nextDayStrategy}` : '',
  ].filter(Boolean).join('\n') : ''

  const t1Section = r.t1Note ? `\n> ⚠️ **T+1 Restriction**: Stock purchased today (${r.date}) cannot be sold until tomorrow.\n> The analysis below includes next-day strategy instead of intraday trading advice.\n` : ''

  return [
    `# ${r.ticker} — Equity Analysis`,
    `**Analysis date:** ${r.date}  \n**Final rating:** ${d.decision}` +
      (typeof d.positionSizePct === 'number' ? ` · position ${d.positionSizePct}%` : ''),
    r.isAShare
      ? `> ⚠️ Research/education only. Not financial, investment, or trading advice.\n> A-share stocks cannot be shorted. "Reduce" = sell existing position. "Avoid" = do not buy.`
      : `> ⚠️ Research/education only. Not financial, investment, or trading advice.`,
    t1Section,
    `## Decision`,
    d.finalAction || '',
    d.rationale || '',
    `### Conditions\n${mdList(d.conditions)}`,
    `### Key risks\n${mdList(d.keyRisks)}`,
    portfolioSection,
    `## Six-Dimension Analysis`,
    sd ? [
      `**Company stage:** ${sd.companyStage}`,
      `**Market pricing:** ${sd.marketPricing}`,
      `**Expectation gap:** ${sd.expectationGap}`,
      `**Key variables:** ${(sd.keyVariables || []).join('; ')}`,
      `**Main contradiction:** ${sd.mainContradiction}`,
      sd.dataAnomalies?.length ? `**Data anomalies:**\n${mdList(sd.dataAnomalies)}` : '',
      `**Conclusion:** ${sd.conclusion}`,
    ].filter(Boolean).join('\n\n') : '_Not available._',
    `## Trade proposal`,
    [
      `- **Action:** ${t.action}` + (typeof t.sizePct === 'number' ? ` · size ${t.sizePct}%` : ''),
      `- **Entry:** ${t.entry || '—'}`,
      `- **Stop loss:** ${t.stopLoss || '—'}`,
      `- **Take profit:** ${t.takeProfit || '—'}`,
      `- **Timeframe:** ${t.timeframe || '—'}`,
    ].join('\n'),
    t.rationale || '',
    `## Risk manager`,
    `- **Risk rating:** ${rm.riskRating}\n- **Approved for PM:** ${rm.approvedForPM ? 'yes' : 'no'}`,
    `**Required adjustments**\n${mdList(rm.requiredAdjustments)}`,
    rm.rationale || '',
    `## Research verdict`,
    `- **Stance:** ${rv.stance} · **lean:** ${rv.lean} · **conviction:** ${rv.conviction}`,
    `**Strongest bull argument**\n\n${rv.strongestBullArgument || '—'}`,
    `**Strongest bear argument**\n\n${rv.strongestBearArgument || '—'}`,
    rv.rationale || '',
    `## Analyst reports`,
    analysts,
    `---\n_Generated by the trading-agents workflow. Research only — not financial advice._`,
  ].filter(Boolean).join('\n\n') + '\n'
}

function buildHtml(r) {
  const d = r.decision, t = r.trade, rm = r.riskManager, rv = r.researchVerdict, sd = r.sixDim
  const cards = r.analysts.map(a => `
      <article class="card">
        <div class="card-h"><h3>${esc(a.analyst)}</h3><span class="chip ${chipClass(a.signal)}">${esc(a.signal)} · ${esc(a.confidence)}</span></div>
        ${paras(a.summary)}
        <h4>Key points</h4>${htmlList(a.keyPoints)}
        ${a.risks && a.risks.length ? `<h4>Risks</h4>${htmlList(a.risks)}` : ''}
        ${a.dataGaps && a.dataGaps.length ? `<h4>Data gaps</h4>${htmlList(a.dataGaps)}` : ''}
        ${a.sources && a.sources.length ? `<details><summary>Sources (${a.sources.length})</summary>${htmlList(a.sources)}</details>` : ''}
      </article>`).join('')

  const css = `
    *{box-sizing:border-box}
    body{margin:0;background:#fbfaf7;color:#1a1a1a;font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
    main{max-width:760px;margin:0 auto;padding:64px 24px 96px}
    .masthead{border-bottom:2px solid #1a1a1a;padding-bottom:24px;margin-bottom:8px}
    .eyebrow{letter-spacing:.12em;text-transform:uppercase;font-size:12px;color:#6b6b6b;margin:0 0 6px}
    h1{font:700 44px/1.1 Georgia,"Times New Roman",serif;margin:0 0 16px}
    h2{font:700 22px/1.3 Georgia,serif;margin:48px 0 12px;padding-bottom:6px;border-bottom:1px solid #e6e3dd}
    h3{font-size:16px;margin:24px 0 8px}
    h4{font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:#6b6b6b;margin:18px 0 6px}
    p{margin:0 0 14px}.muted{color:#6b6b6b}
    .disclaimer{color:#6b6b6b;font-size:13px;margin:14px 0 0}
    .verdict{display:flex;align-items:center;gap:12px;margin-top:8px}
    .chip{display:inline-block;padding:3px 12px;border-radius:999px;font-size:13px;font-weight:600}
    .rating{font-size:18px;padding:6px 18px}
    .chip.pos{background:#e8f5ee;color:#0a7f3f}.chip.neg{background:#fbeceb;color:#b3261e}.chip.neu{background:#fdf3da;color:#8a6d00}
    ul{margin:0 0 14px;padding-left:20px}li{margin:4px 0}
    table.kv{width:100%;border-collapse:collapse;margin:0 0 16px}
    table.kv th{text-align:left;width:120px;color:#6b6b6b;font-weight:600;vertical-align:top;padding:6px 12px 6px 0}
    table.kv td{padding:6px 0}
    .cards{display:grid;gap:20px}
    .card{border:1px solid #e6e3dd;border-radius:10px;padding:20px;background:#fff}
    .card-h{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px}.card-h h3{margin:0}
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:24px}@media(max-width:600px){.two-col{grid-template-columns:1fr}}
    details{margin-top:10px}summary{cursor:pointer;color:#6b6b6b;font-size:13px}
    footer{margin-top:64px;padding-top:16px;border-top:1px solid #e6e3dd;color:#6b6b6b;font-size:12px}`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(r.ticker)} — Equity Analysis (${esc(r.date)})</title>
<style>${css}</style>
</head>
<body>
<main>
  <header class="masthead">
    <p class="eyebrow">Equity analysis · ${esc(r.date)}</p>
    <h1>${esc(r.ticker)}</h1>
    <div class="verdict">
      <span class="rating chip ${chipClass(d.decision)}">${esc(d.decision)}</span>
      ${typeof d.positionSizePct === 'number' ? `<span class="muted">position ${esc(d.positionSizePct)}%</span>` : ''}
    </div>
  </header>
  <p class="disclaimer">⚠️ Research/education only. Not financial, investment, or trading advice.${r.isAShare ? ' A-share stocks cannot be shorted. Reduce=sell position. Avoid=do not buy.' : ''}</p>

  <section>
    <h2>Decision</h2>
    ${paras(d.finalAction)}
    ${paras(d.rationale)}
    <h3>Conditions</h3>${htmlList(d.conditions)}
    <h3>Key risks</h3>${htmlList(d.keyRisks)}
  </section>

  ${r.hasPosition ? `<section>
    <h2>📊 Portfolio Diagnosis</h2>
    <table class="kv">
      <tr><th>Entry price</th><td>${esc(r.holdCost)}元</td></tr>
      <tr><th>Quantity</th><td>${esc(r.holdQuantity)}股</td></tr>
      <tr><th>Entry date</th><td>${esc(r.holdingDate || 'unknown')}</td></tr>
      <tr><th>Can sell today</th><td>${r.canSellToday ? 'YES' : 'NO (T+1)'}</td></tr>
      ${d.stopLossPrice ? `<tr><th>Stop-loss</th><td><strong>${esc(d.stopLossPrice)}</strong></td></tr>` : ''}
      ${d.takeProfitPrice ? `<tr><th>Take-profit</th><td><strong>${esc(d.takeProfitPrice)}</strong></td></tr>` : ''}
    </table>
    ${d.portfolioDiagnosis ? paras(d.portfolioDiagnosis) : ''}
    ${d.nextDayStrategy ? `<h3>Tomorrow's Strategy</h3>${paras(d.nextDayStrategy)}` : ''}
  </section>` : ''}

  ${r.t1Note ? `<div class="disclaimer" style="background:#fff3cd;padding:12px;border-radius:8px;margin:16px 0;">⚠️ <strong>T+1 Restriction:</strong> Stock purchased today cannot be sold until tomorrow. Analysis includes next-day strategy.</div>` : ''}

  ${sd ? `<section>
    <h2>Six-Dimension Analysis</h2>
    <table class="kv">
      <tr><th>Company stage</th><td>${esc(sd.companyStage)}</td></tr>
      <tr><th>Market pricing</th><td>${esc(sd.marketPricing)}</td></tr>
      <tr><th>Expectation gap</th><td>${esc(sd.expectationGap)}</td></tr>
      <tr><th>Key variables</th><td>${esc((sd.keyVariables || []).join(' · '))}</td></tr>
      <tr><th>Main contradiction</th><td>${esc(sd.mainContradiction)}</td></tr>
    </table>
    ${sd.dataAnomalies?.length ? `<h4>Data anomalies</h4>${htmlList(sd.dataAnomalies)}` : ''}
    ${sd.conclusion ? `<p><strong>Conclusion:</strong> ${esc(sd.conclusion)}</p>` : ''}
  </section>` : ''}

  <section>
    <h2>Trade proposal</h2>
    <table class="kv">
      <tr><th>Action</th><td>${esc(t.action)}${typeof t.sizePct === 'number' ? ` · size ${esc(t.sizePct)}%` : ''}</td></tr>
      <tr><th>Entry</th><td>${esc(t.entry || '—')}</td></tr>
      <tr><th>Stop loss</th><td>${esc(t.stopLoss || '—')}</td></tr>
      <tr><th>Take profit</th><td>${esc(t.takeProfit || '—')}</td></tr>
      <tr><th>Timeframe</th><td>${esc(t.timeframe || '—')}</td></tr>
    </table>
    ${paras(t.rationale)}
  </section>

  <section>
    <h2>Risk manager</h2>
    <p><span class="chip ${chipClass(rm.riskRating)}">${esc(rm.riskRating)} risk</span> · approved for PM: ${rm.approvedForPM ? 'yes' : 'no'}</p>
    <h3>Required adjustments</h3>${htmlList(rm.requiredAdjustments)}
    ${paras(rm.rationale)}
  </section>

  <section>
    <h2>Research verdict</h2>
    <p><span class="chip ${chipClass(rv.stance)}">${esc(rv.stance)}</span> · lean ${esc(rv.lean)} · conviction ${esc(rv.conviction)}</p>
    <div class="two-col">
      <div><h4>Strongest bull</h4>${paras(rv.strongestBullArgument)}</div>
      <div><h4>Strongest bear</h4>${paras(rv.strongestBearArgument)}</div>
    </div>
    ${paras(rv.rationale)}
  </section>

  <section>
    <h2>Analyst reports</h2>
    <div class="cards">${cards}
    </div>
  </section>

  <footer>Generated by the trading-agents workflow · ${esc(r.ticker)} · ${esc(r.date)}</footer>
</main>
</body>
</html>
`
}
