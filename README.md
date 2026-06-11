# Open Skills 🔧

> 开源的 Claude Code & Codex 技能/插件集合

一个统一的技能仓库，同时兼容 **Claude Code** 和 **Codex** 两大 AI 编程平台。

## 📦 已收录插件

| 插件 | 描述 | 状态 |
|------|------|------|
| [trading-agents](plugins/trading-agents/) | 多智能体股票分析 pipeline | ✅ 稳定 |

## 🚀 快速开始

### 安装单个插件

```bash
# Claude Code
ln -s $(pwd)/plugins/trading-agents ~/.claude/plugins/trading-agents

# Codex
ln -s $(pwd)/plugins/trading-agents ~/.codex/skills/trading-agents
```

### 一键安装

```bash
# 安装全部插件到 Claude Code
bash install.sh --target claude-code

# 安装全部插件到 Codex
bash install.sh --target codex

# 安装指定插件
bash install.sh --plugin trading-agents --target claude-code
```

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
├── install.sh                  # 安装脚本
└── docs/                       # 文档
```

## 📝 插件规范

每个插件必须包含：

| 文件 | 必需 | 说明 |
|------|------|------|
| `plugin.json` | ✅ | 插件元数据（名称、版本、描述） |
| `SKILL.md` | ✅ | Codex skill 定义 |
| `README.md` | ✅ | 插件文档 |
| `scripts/` | ❌ | Python 脚本 |
| `workflows/` | ❌ | Claude Code workflow |
| `frameworks/` | ❌ | 分析框架文档 |
| `templates/` | ❌ | 输出模板 |

### plugin.json 格式

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Plugin description",
  "author": "yourname",
  "license": "MIT",
  "platforms": {
    "claude-code": {
      "workflows": ["workflows/my-plugin.js"]
    },
    "codex": {
      "skill": "SKILL.md",
      "scripts": ["scripts/main.py"]
    }
  },
  "dependencies": {
    "python": ">=3.10",
    "packages": ["requests>=2.28.0"]
  }
}
```

## 🤝 贡献

1. Fork 本仓库
2. 复制 `plugins/_template/` 作为起点
3. 开发你的插件
4. 提交 Pull Request

详见 [贡献指南](CONTRIBUTING.md)

## 📄 License

MIT License - 详见 [LICENSE](LICENSE)
