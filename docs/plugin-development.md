# 插件开发指南

## 创建新插件

### 1. 复制模板

```bash
cp -r plugins/_template plugins/my-new-plugin
cd plugins/my-new-plugin
```

### 2. 填写 plugin.json

```json
{
  "name": "my-new-plugin",
  "version": "0.1.0",
  "description": "What this plugin does",
  "author": "yourname",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"],
  "platforms": {
    "claude-code": {
      "workflows": ["workflows/my-new-plugin.js"]
    },
    "codex": {
      "skill": "SKILL.md",
      "scripts": ["scripts/my_script.py"]
    }
  },
  "dependencies": {
    "python": ">=3.10",
    "packages": ["requests>=2.28.0"]
  }
}
```

### 3. 编写 SKILL.md

SKILL.md 是 Codex 的技能定义文件，使用 YAML frontmatter：

```markdown
---
name: my-new-plugin
description: |
  Plugin description in one paragraph.
metadata:
  platforms:
    codex:
      scripts: ["scripts/my_script.py"]
---

# My Plugin

## 角色
Describe the agent's role.

## 工具
List available tools.

## 使用示例
Show examples.
```

### 4. 开发脚本

Python 脚本放在 `scripts/` 目录下，遵循以下规范：

- 使用 `argparse` 提供 CLI 接口
- 输出 JSON 格式的结果
- 错误时返回 `{"ok": false, "error": {...}}`
- 成功时返回 `{"ok": true, "data": {...}}`

### 5. 开发 Workflow（可选）

如果需要 Claude Code workflow，在 `workflows/` 目录下创建 JS 文件：

```javascript
export const meta = {
  name: 'my-plugin',
  description: 'What this workflow does',
  phases: [
    { title: 'Step 1', detail: 'Description' },
  ],
}

// Workflow logic here
```

### 6. 测试

```bash
# 测试 Python 脚本
python3 scripts/my_script.py --help

# 测试 JSON 格式
python3 scripts/my_script.py some_input --json

# 验证 plugin.json
python3 -c "import json; json.load(open('plugin.json'))"
```

### 7. 提交

```bash
# 确保目录结构正确
ls -la
# plugin.json  SKILL.md  README.md  scripts/  workflows/

# 提交 PR
git add plugins/my-new-plugin
git commit -m "feat: add my-new-plugin"
git push origin main
```

## 最佳实践

### 脚本设计

- **单一职责**：每个脚本做一件事
- **可独立运行**：脚本不依赖 Claude Code 或 Codex
- **JSON 输出**：方便程序化调用
- **错误处理**：所有异常都要捕获并返回有意义的错误信息

### SKILL.md 编写

- **角色清晰**：第一段说清楚 agent 是什么
- **工具完整**：列出所有可用的 CLI 命令
- **示例丰富**：给出常见的使用场景

### 命名规范

- 插件目录：`my-plugin`（小写 + 连字符）
- Python 文件：`my_script.py`（下划线）
- Workflow 文件：`my-plugin.js`（连字符）
- 配置文件：`config.json`（下划线）

## 参考示例

- [trading-agents](../plugins/trading-agents/) — 完整的多智能体分析插件
- [_template](../plugins/_template/) — 最小化的插件模板
