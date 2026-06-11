# 贡献指南

感谢你对 Open Skills 的兴趣！

## 如何贡献

### 1. 提交新插件

1. Fork 本仓库
2. 复制 `plugins/_template/` 作为起点
3. 填写 `plugin.json` 和 `SKILL.md`
4. 开发你的插件
5. 测试通过后提交 Pull Request

### 2. 改进现有插件

1. Fork 本仓库
2. 在对应插件目录下修改
3. 测试通过后提交 Pull Request

### 3. 报告问题

在 Issues 中提交 bug 报告或功能建议。

## 插件开发规范

### 必需文件

- `plugin.json` — 插件元数据
- `SKILL.md` — Codex skill 定义
- `README.md` — 插件文档

### plugin.json 格式

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What this plugin does",
  "author": "yourname",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"],
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
    "packages": []
  }
}
```

### SKILL.md 格式

```markdown
---
name: my-plugin
description: |
  What this plugin does in one paragraph.
metadata:
  platforms:
    codex:
      scripts: ["scripts/main.py"]
---

# My Plugin

## 角色
Describe the agent's role.

## 工具
List available tools and how to use them.

## 使用示例
Show example interactions.
```

### 命名规范

- 插件目录名：小写 + 连字符（如 `my-plugin`）
- Python 脚本：下划线命名（如 `my_script.py`）
- Workflow 文件：连字符命名（如 `my-plugin.js`）

### 测试要求

提交前请确保：
- [ ] Python 脚本可独立运行
- [ ] Workflow 语法验证通过
- [ ] README 包含使用说明
- [ ] 有至少一个使用示例

## 行为准则

- 尊重他人
- 保持专业
- 欢迎新手提问
