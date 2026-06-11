# Open Skills 🔧

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![CI](https://github.com/liuhao1024/open-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/liuhao1024/open-skills/actions/workflows/ci.yml)
[![GitHub Stars](https://img.shields.io/github/stars/liuhao1024/open-skills?style=social)](https://github.com/liuhao1024/open-skills/stargazers)

> 开源的 Claude Code & Codex 技能/插件集合

一个统一的技能仓库，同时兼容 **Claude Code** 和 **Codex** 两大 AI 编程平台。每个插件自包含，可独立使用，也可通过 workflow 串联成完整的分析 pipeline。

## 📦 已收录插件

| 插件 | 描述 | 平台 | 状态 |
|------|------|------|------|
| [trading-agents](plugins/trading-agents/) | 多智能体股票分析 pipeline（4分析师→辩论→风险→PM） | Claude Code + Codex | ✅ 稳定 |

> 💡 **想要更多插件？** 提交 [Feature Request](https://github.com/liuhao1024/open-skills/issues/new?template=feature_request.md) 或自己 [开发一个](docs/plugin-development.md)！

## 🚀 快速开始

```bash
# 克隆仓库
git clone https://github.com/liuhao1024/open-skills.git
cd open-skills

# 一键安装到 Claude Code
bash install.sh --target claude-code

# 或安装到 Codex
bash install.sh --target codex

# 或两者都装
bash install.sh --target both
```

安装后在 Claude Code 中：
```
/trading-agents 300255.SZ
```

或带持仓分析：
```javascript
Workflow({
  scriptPath: "workflows/trading-agents.js",
  args: { ticker: "300255.SZ", holdCost: 34.7, holdQuantity: 10000, holdingDate: "2026-06-11" }
})
```

详见 [快速开始指南](docs/getting-started.md)。

## 🏗️ 目录结构

```
open-skills/
├── plugins/                    # 插件目录
│   ├── trading-agents/         # 多智能体股票分析
│   │   ├── plugin.json         # 插件元数据
│   │   ├── SKILL.md            # Codex skill 定义
│   │   ├── scripts/            # Python 脚本
│   │   ├── workflows/          # Claude Code workflow
│   │   ├── frameworks/         # 分析框架
│   │   └── templates/          # 输出模板
│   └── _template/              # 新建插件的模板
├── shared/                     # 共享工具库
├── docs/                       # 文档
│   ├── getting-started.md      # 快速开始
│   └── plugin-development.md   # 插件开发指南
├── .github/                    # GitHub 配置
│   ├── workflows/ci.yml        # CI 测试
│   └── ISSUE_TEMPLATE/         # Issue 模板
├── install.sh                  # 一键安装脚本
├── CONTRIBUTING.md             # 贡献指南
└── LICENSE                     # MIT License
```

## 🔌 插件规范

每个插件是一个独立目录，包含：

| 文件 | 必需 | 说明 |
|------|------|------|
| `plugin.json` | ✅ | 插件元数据（名称、版本、依赖） |
| `SKILL.md` | ✅ | Codex skill 定义（frontmatter + 使用说明） |
| `README.md` | ✅ | 插件文档（安装、使用、配置） |
| `scripts/` | ❌ | Python 脚本（可独立运行） |
| `workflows/` | ❌ | Claude Code workflow（JS） |
| `frameworks/` | ❌ | 分析框架文档 |
| `templates/` | ❌ | 输出模板（CSS/HTML） |
| `config/` | ❌ | 配置示例 |

详见 [插件开发指南](docs/plugin-development.md)。

## 🤝 贡献

欢迎贡献新插件或改进现有插件！

1. Fork 本仓库
2. 复制 `plugins/_template/` 作为起点
3. 开发并测试你的插件
4. 提交 Pull Request

详见 [贡献指南](CONTRIBUTING.md)。

## 📄 License

[MIT License](LICENSE) — 自由使用、修改和分发。

---

<p align="center">
  Made with ❤️ for the AI coding community
</p>
