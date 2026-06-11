# 快速开始

## 前置条件

- Python 3.10+
- Claude Code 或 Codex（任选其一）

## 安装

### 方式一：一键安装（推荐）

```bash
git clone https://github.com/liuhao1024/open-skills.git
cd open-skills

# 安装到 Claude Code
bash install.sh --target claude-code

# 或安装到 Codex
bash install.sh --target codex

# 或两者都装
bash install.sh --target both
```

### 方式二：手动安装

```bash
git clone https://github.com/liuhao1024/open-skills.git

# Claude Code
ln -s $(pwd)/open-skills/plugins/trading-agents ~/.claude/plugins/trading-agents

# Codex
ln -s $(pwd)/open-skills/plugins/trading-agents ~/.codex/skills/trading-agents
```

### 方式三：安装单个插件

```bash
bash install.sh --plugin trading-agents --target claude-code
```

## 验证安装

### Claude Code

在 Claude Code 中输入：
```
/trading-agents 300255.SZ
```

### Codex

在 Codex 中输入：
```
分析常山药业
```

## Python 脚本独立使用

每个插件的 Python 脚本都可以独立使用，不需要 Claude Code 或 Codex。

```bash
cd open-skills/plugins/trading-agents

# 获取实时行情
python3 scripts/stock_data.py quote get --code 300255.SZ

# 获取技术指标
python3 scripts/stock_data.py bundle technical \
  --codes 300255.SZ --interval 1d --limit 60 \
  --indicators ma:20,rsi:14,macd

# 财报分析
python3 scripts/financial_analyzer.py --sample > sample.json
python3 scripts/financial_analyzer.py sample.json
```

## 下一步

- 查看 [插件开发指南](plugin-development.md) 学习如何创建自己的插件
- 查看各插件的 README 了解详细用法
