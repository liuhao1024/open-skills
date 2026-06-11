# Changelog

## [1.0.0] - 2026-06-12

### Added

- **trading-agents** plugin: Multi-agent equity analysis pipeline
  - 4 parallel analysts (fundamentals, sentiment, news, technical)
  - Six-dimension analysis framework
  - Bull/bear debate with research verdict
  - Structured risk assessment (4 categories × probability × impact)
  - Portfolio manager with T+1 rules for A-shares
  - Financial anomaly detection (10 rules)
  - Auto-generated Markdown + HTML reports
  - `stock_data.py`: Real-time quotes, K-line, technical indicators (MA/RSI/MACD)
  - `financial_analyzer.py`: Three-statement analysis, YoY/QoQ, anomaly detection
- Plugin template for creating new skills
- Install script (`install.sh`) for Claude Code and Codex
- GitHub Actions CI (lint, validate, test on Python 3.10-3.13)
- Issue templates (bug report, feature request)
- PR template with checklist
- Documentation (getting-started, plugin-development)
- MIT License
