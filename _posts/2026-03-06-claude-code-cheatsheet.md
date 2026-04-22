---
title: Claude Code 速查表
date: 2026-03-06 13:32:00 +0800
categories: [Tech, Tools]
tags: [claude-code, cheatsheet, ai-coding, slash-commands, hooks, mcp]
---

最近在 reddit 看到一个关于 Claude Code Cheatsheet 帖子，对照整理成中文版如下

## 快捷键

### ESSENTIAL（基础）

- `Enter`：发送消息 / 提交
- `Esc`：中断 / 停止生成
- `Esc Esc`：打开回溯菜单（回到对话或代码状态）
- `Ctrl+C`：取消当前操作（强制停止）
- `Ctrl+D`：退出 Claude Code
- `Shift+Tab`：循环切换模式（`Normal` → `Auto-Accept` → `Plan`）

### NAVIGATION（导航）

- `Ctrl+R`：搜索命令历史
- `Ctrl+T`：切换任务列表
- `Ctrl+O`：切换详细传输日志
- `Ctrl+G`：打开外部编辑器（写长 Prompt）
- `Ctrl+V`：粘贴图片（截图 / 图表）
- `Ctrl+S`：暂存当前 Prompt
- `Cmd+P / Meta+P`：打开模型选择器（快速切换模型）
- `Cmd+Y / Meta+Y`：切换 extended thinking

### EDITING (BASH-STYLE)（编辑，类 Bash）

- `Ctrl+A`：跳到行首
- `Ctrl+E`：跳到行尾
- `Opt+F`：向前一个单词
- `Opt+B`：向后一个单词
- `Ctrl+W`：删除前一个词
- `Shift+Enter`：换行（不发送）

### BACKGROUND TASKS（后台任务）

- `Ctrl+B`：把运行中的任务放到后台

> 运行 `/terminal-setup` 可启用多行输入（`Shift+Enter`）；在 iTerm2 / VS Code 可用 `/keybindings` 自定义快捷键。
{: .prompt-tip }

---

## Slash 命令

### SESSION CONTROL（会话控制）

- `/clear`：重置会话历史（全新开始）
- `/compact [hint]`：压缩上下文以节省 token（可加保留提示）
- `/rewind`：回退到对话 AND/OR 代码变更前
- `/export [file]`：导出会话到文件或剪贴板
- `/cost`：查看当前会话成本与 token 用量
- `/usage`：查看套餐用量与限额
- `/context`：查看 token 消耗可视化

### CONFIGURATION（配置）

- `/config`：打开设置面板
- `/model`：切换 Sonnet / Opus / Haiku
- `/permissions`：查看并更新工具权限
- `/keybindings`：打开快捷键配置文件
- `/vim`：输入区切换 Vim 模式
- `/terminal-setup`：配置 `Shift+Enter` 多行输入

### DEVELOPMENT（开发）

- `/init`：为项目创建 `CLAUDE.md`（建议最先执行）
- `/memory`：查看 / 编辑项目记忆（`CLAUDE.md`）
- `/review`：代码评审分析
- `/doctor`：环境诊断与健康检查
- `/agents`：管理子代理（sub-agents）
- `/mcp`：管理 MCP 服务器

### ADVANCED（高级）

- `/insights`：生成 HTML 用量报告（NEW）
- `/pr-comments`：查看 GitHub PR 反馈
- `/install-github-app`：配置自动化 PR review
- `/tasks`：持久化任务列表管理
- `/teleport`：在 Web / 本地间迁移会话

---

## CLI 启动 Flags

### STARTING SESSIONS（启动会话）

- `claude`：启动交互会话
- `claude "query"`：带初始提示启动
- `claude -p "query"`：打印模式（回答后退出，便于脚本）
- `claude -c`：继续最后一次会话
- `claude -r "name"`：按会话名或 ID 恢复
- `claude -w name`：在隔离的 git worktree 中启动

### MODEL & BEHAVIOR（模型与行为）

- `--model sonnet`：使用 Sonnet（快、便宜）
- `--model opus`：使用 Opus（最强）
- `--agent my_agent`：指定子代理
- `--permission-mode plan`：以 Plan 模式启动
- `--max-turns N`：限制对话轮数
- `--max-budget-usd N`：设置最大花费上限

### CONTEXT & DIRECTORIES（上下文与目录）

- `--add-dir ./path`：向上下文添加额外目录
- `--chrome`：启用浏览器集成
- `--verbose`：显示详细日志

### PERMISSIONS（权限）

- `--allowedTools`：仅允许指定工具
- `--disallowedTools`：禁用指定工具
- `--tools "Bash,Edit"`：限制仅可使用这些工具

### OUTPUT FORMATS（`-p` 模式输出）

- `--output-format text`：纯文本（默认）
- `--output-format json`：结构化 JSON
- `--output-format stream-json`：流式 JSON

---

## 五大 Claude Code Extension System

### 1. CLAUDE.md（PROJECT MEMORY）

- **What**：Claude 每次会话都会读取的项目"记忆文档"（架构、约定、常用命令、编码风格等）
- **Where**：`./CLAUDE.md`（项目）或 `~/.claude/CLAUDE.md`（全局）
- **Create**：在项目里运行 `/init` 自动生成

### 2. 自定义 Slash Commands

- **What**：你自己的 `/commands`，手动调用的自定义提示词模板（Markdown 文件）
- **Where**：`.claude/commands/`（项目）或 `~/.claude/commands/`（全局）
- **Use**：文件名即命令名，例如 `review.md` 对应 `/project:review`

### 3. Skills

- **What**：类似命令，但由 Claude 自动判断何时触发（无需手动调用）
- **Where**：`.claude/skills/<skill>/SKILL.md`
- **Use**：直接做项目任务即可，Claude 会按上下文自动选用相关 skill

### 4. Sub-Agents（专职子代理）

- **What**：独立上下文/角色的 Claude 实例（如 reviewer、debugger、architect）
- **Where**：`.claude/agents/`（带 YAML 元数据的 markdown）
- **Invoke**：通过 `/agents` 管理，或在会话中指定使用，如 "Use the reviewer agent"
- **CLI**：`--agent my-agent` 或 `--agents {json}`

### 5. MCP Servers（外部工具连接）

- **What**：连接外部系统（GitHub、数据库、API、浏览器等）
- **Setup**：`claude mcp add <name> <command>`
- **List**：`claude mcp list`
- **Config**：`--mcp-config ./mcp.json`（启动时指定）

### Plugins

- **What**：commands、skills、hooks 等打包扩展
- **Browse**：`/plugin` 浏览 / 安装 / 启用 / 禁用
- **Dir**：`--plugin-dir ./my-plugins` 指定本地插件目录

> **How they differ**
> - Custom Commands：你来调用
> - Skills：由 Claude 自动调用
> - Sub-Agents：多个独立 AI 实例协作
> - MCP：外部工具连接层
{: .prompt-info }

---

## Permission Modes（权限模式）

- `Normal`：每次工具调用都询问权限（读/写/bash 等）
- `Auto-Accept`：不询问直接执行（更快但控制更少，适合可信任务）
- `Plan Mode`：只读与规划，不执行写入；先审阅方案，再切回 Normal 执行
- `Shift+Tab`：在 `Normal / Auto-Accept / Plan` 间快速切换

> **Best workflow**：先用 Plan 理解问题并审阅计划，再切执行模式落地。
{: .prompt-tip }

---

## Hooks — Event Automation（事件自动化）

- `PreToolUse`：工具执行前触发（可校验、拦截、修改）
- `PostToolUse`：工具执行后触发（检查结果、自动格式化、lint）
- `UserPromptSubmit`：用户消息被处理前触发
- `Stop`：Claude 完成回复时触发
- `SessionStart`：会话开始时触发
- `SessionEnd`：会话结束时触发
- `PreCompact`：上下文压缩前触发
- `Notification`：Claude 发送通知时触发

> **Example**：每次改文件后自动跑 prettier；或禁止写入 `.env`（在 settings JSON 中配置）。
{: .prompt-info }

---

## Input Superpowers

- `@mention`：用 `@` 引用文件/目录，Claude 会读入上下文
- `!prefix`：用 `!` 行内执行 shell 命令（例：`!git status`）
- **Paste Images**：`Ctrl+V` 粘贴截图/图表/报错图
- **Pipe Input**：`cat file.py | claude -p "explain"` 直接喂输入
- **Multi-dir**：`--add-dir ./api ./web` 同时处理多目录/多项目
- **Worktrees**：在隔离 git 分支 + Claude 会话中并行工作

> **Pro tip**：优先用 `@` 引用，少复制粘贴，既省 token 又更准确。
{: .prompt-tip }

---

## Configuration（配置）

### Settings Priority（优先级：高 → 低）

1. **Enterprise**：`/etc/claude-code/managed-settings.json`
2. **Project Local**：`.claude/settings.local.json`（个人项目配置）
3. **Project Shared**：`.claude/settings.json`（提交到 git，团队共享）
4. **User Global**：`~/.claude/settings.json`（用户默认）

### Config CLI

- `claude config list`：显示全部设置
- `claude config get <key>`：查看某项值
- `claude config set <key> <value>`：修改值
- `claude config add <key> <value>`：向数组项追加值

> **Permissions Example**：例如将 `Bash(git:*)` 加到 `allowedTools`，可放行 git 相关命令而不再询问。
{: .prompt-info }

---

## File Structure Map（文件结构图）

### Project Level（`.claude/`）

- `CLAUDE.md`：项目记忆（约定、架构、命令）
- `settings.json`：共享项目设置（提交到 git）
- `settings.local.json`：个人设置（通常 gitignore）
- `commands/`：项目 slash commands（`*.md`）
- `skills/`：项目 skills（含 `SKILL.md`）
- `agents/`：项目 sub-agents（`*.md`）

### Global Level（`~/.claude/`）

- `CLAUDE.md`：全局记忆（作用于所有项目）
- `settings.json`：全局设置
- `commands/`：个人全局 command
- `skills/`：个人全局 skills
- `keybindings.json`：自定义快捷键

---

## Rewind & Checkpoints（回溯与检查点）

- `Esc Esc`：随处打开回溯菜单
- `/rewind`：同上（命令方式）

### Rewind Options（回溯选项）

- `Conversation`：仅回退对话，代码保持不变
- `Code`：仅恢复文件，对话保持不变
- `Full Rewind`：同时恢复对话与代码到检查点

> - Bash 副作用（数据库变更、API 调用、`rm` 删除等）无法通过 rewind 回滚
> - 检查点主要覆盖 Claude 可控的会话/文件状态；持久安全请配合 Git
{: .prompt-warning }

---

## Pro Workflow — How to Get the Best Out of Claude Code（高效工作流）

### STARTING A NEW PROJECT

1. `cd project && claude`
2. `/init`
3. 编辑 `CLAUDE.md`
4. 开始编码

### THE PLAN → EXECUTE PATTERN

- `Shift+Tab` 进入 Plan Mode
- 描述目标
- Review Claude 计划
- 再切 `Normal / Auto-Accept` 执行

### DEBUGGING LIKE A PRO

- **Paste errors**：粘贴完整错误信息（含堆栈）
- **Paste screenshots**：粘贴截图让 Claude 看问题
- **Pipe logs**：`cat error.log | claude -p "what's wrong?"`
- `/doctor`：感觉环境异常时先跑诊断

### PARALLEL DEVELOPMENT

- **Worktrees**：`claude -W feature-auth --isolated branch + session`
- **Multi-dirs**：`--add-dir ./api ./web --work`（跨目录/仓库）
- **Background**：`Ctrl+B` 把长任务挂后台，可以继续做别的
- **Agent Teams**：多个 Claude 实例协作

### SAVING MONEY

- `/compact`：上下文变大时压缩，节省 token
- `/clear`：不同任务间清空上下文，避免串味
- 例行任务优先 Sonnet，复杂决策再用 Opus
- 多用 `@` 引用，少复制粘贴代码

---

## Create Custom Commands（创建自定义命令）

1. **Create file**：`.claude/commands/review.md`
2. **Write prompt**：Markdown 内容就是命令提示词
3. **Use it**：在 Claude Code 里输入 `/project:review`

### Optional YAML Frontmatter

- `argument-hint`：参数输入占位提示
- `description`：显示在 `/help` 列表中的说明
- `allowed-tools`：限制该命令可用工具
- `model`：强制该命令使用指定模型

### Variables

- `$ARGUMENTS`：将你在命令后输入的内容注入模板

> **Example**
> - `/project:review src/auth.ts`
> - `$ARGUMENTS = "src/auth.ts"`
{: .prompt-info }

---

## Quick Reference — Most Used Combos（高频组合）

### DAILY ESSENTIALS

- **Start project**：`cd project && claude`
- **Continue where I left off**：`claude -c`
- **Quick question**（不进入长期会话）：`claude -p "how do I ..."`
- **Review my changes**：`git diff | claude -p "review"`
- **Explain error**：`cat error.log | claude -p "explain"`
- **Check cost**：随时输入 `/cost`
- **Undo mistake**：`Esc Esc` → `rewind`

### POWER MOVES

- **Parallel sessions**：`claude -W feature-a` + `claude -W feature-b`
- **Custom reviewer agent**：创建 `.claude/agents/reviewer.md`
- **Auto-format on edit**：用 `PostToolUse` hook 自动跑 `prettier`
- **Web session**：`claude --remote "fix the bug"`
- **Transfer to local**：`claude --teleport`
- **Budget limit**：`claude -p --max-budget-usd 2 "query"`
- **Scripted automation**：`claude -p --output-format json "query" | jq`

---

## 原文地址

[Claude Code Cheatsheet - Reddit](https://www.reddit.com/r/ClaudeCode/comments/1revj4g/claude_code_cheatsheet/)
