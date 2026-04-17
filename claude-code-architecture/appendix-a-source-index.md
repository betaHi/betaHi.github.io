---
layout: page
title: "附录 A 源码证据索引（按符号）"
permalink: /claude-code-architecture/appendix-a-source-index/
book_key: appendix-a-source-index
book_number: "A"
toc: true
---

## 这份索引的作用

本书大量结论基于 Claude Code 源码。本附录把正文里出现过的源码证据按**符号颗粒度**整理成一份可查表，用于：

1. 快速定位某个结论对应的源码位置
2. 验证正文判断是否站得住脚
3. 为后续源码阅读提供起点

**注意**：由于 Claude Code 代码持续演进，具体行号可能随版本漂移。本索引保证的是**文件 + 关键符号**的稳定，而不是逐行精确。

---

## A.1 Runtime 骨架

### `src/QueryEngine.ts`
**核心职责**：会话 owner 层。
**关键符号**：
- `QueryEngine` 类——持有会话级状态、管理 turn 生命周期
- `submitMessage()`——用户消息入口，触发上下文装配与 query loop
- session owner 生命周期管理

**正文引用章节**：03、08、09、13、18、27、30

### `src/query.ts`
**核心职责**：turn loop 主状态机。
**关键符号**：
- `queryLoop()`——单轮推进主循环
- tool use / tool result transition
- recovery 分支（`max_output_tokens`、prompt too long、retry）
- compact 触发点
- stop hook 介入点
- prefetch 启动点

**正文引用章节**：03、13、15、16、19、20、24

### `src/entrypoints/cli.tsx`
**核心职责**：CLI 入口与模式分流。
**关键符号**：
- fast-path 分流
- version / bridge / daemon / background session / MCP server 模式派发

**正文引用章节**：01、09、11

### `src/main.tsx`
**核心职责**：主程序装配与终端前台宿主。
**关键符号**：
- 启动期 profiling、MDM 读取、keychain prefetch
- React + Ink 前台组合

**正文引用章节**：01、04、09

---

## A.2 工具系统与执行面

### `src/tools.ts` / `src/Tool.ts`
**核心职责**：Tool registry 与 tool 抽象基类。
**关键符号**：
- Tool surface 定义
- 编译期 tool 裁剪

**正文引用章节**：02、09、22

### `src/tools/*`
**核心职责**：各具体 tool 实现目录。

### `src/services/tools/toolOrchestration.ts`
**核心职责**：Tool 并发/串行编排、上下文一致性维护。
**关键符号**：
- 并发资格判定
- context modifier 提交顺序
- sibling error / cancellation 传播

**正文引用章节**：09、13、16、18、22

### `src/services/tools/StreamingToolExecutor.ts`
**核心职责**：流式工具执行语义与结果回流。
**关键符号**：
- streaming fallback
- 结果顺序保证
- 取消传播

**正文引用章节**：09、16、22

---

## A.3 Permission 与治理

### `src/utils/permissions/permissions.ts`
**核心职责**：Permission pipeline。
**关键符号**：
- `canUseTool`——每次 tool use 前的判定
- allow / deny / ask 三态
- denial 累积状态

**正文引用章节**：06、09、11、21、22

### Trust dialog 相关路径
**核心职责**：首次运行与 workspace 可信度确认。

**正文引用章节**：04、06、21

### Managed settings / policy 相关路径
**核心职责**：企业级受管策略边界。

**正文引用章节**：06、07、21

---

## A.4 上下文装配

### `src/utils/messages.ts`
**核心职责**：消息规范化与历史管理。
**关键符号**：
- `normalizeMessagesForAPI`——内部消息 → API payload 的转换
- effective history 投影

**正文引用章节**：14（原 20）、20、23

### `src/utils/messages/systemInit.ts`
**核心职责**：System prompt / system context 装配。

**正文引用章节**：20

### `src/utils/attachments.ts`
**核心职责**：Attachment 注入（queued、relevant memory、skill prefetch）。

**正文引用章节**：13、15、20

---

## A.5 Memory 与长期上下文

### `src/memdir/memdir.ts`
**核心职责**：Durable memory 目录结构与 typed memory。
**关键符号**：
- `MEMORY.md` 索引
- typed memory 分类：`user / feedback / project / reference`
- 写入路径约束

**正文引用章节**：10、17、09

### `src/services/SessionMemory/sessionMemory.ts`
**核心职责**：当前会话工作记忆/摘要记忆。
**关键符号**：
- 后台维护的 session summary markdown
- 触发条件（token 数、tool call 数）
- forked subagent 提取

**正文引用章节**：10、17、24

### `src/services/extractMemories/extractMemories.ts`
**核心职责**：post-turn durable memory 提取 side-channel。
**关键符号**：
- stop-hook 路径异步触发
- forked agent 模式
- 共享父 prompt cache
- 极窄工具集

**正文引用章节**：10、15、17

### `src/services/compact/autoCompact.ts`
**核心职责**：自动 compact、阈值控制、circuit breaker。
**关键符号**：
- warning / error / blocking threshold
- consecutive failure 熔断
- env override（用于测试）

**正文引用章节**：10、19、24

### `src/services/compact/sessionMemoryCompact.ts`
**核心职责**：Session memory 与 compact 联动路径。

**正文引用章节**：10、24

---

## A.6 Hooks 与 Side-channels

### `src/utils/hooks/postSamplingHooks.ts`
**核心职责**：Post-sampling side-channel 插槽。
**关键符号**：
- 模型输出后触发
- fire-and-forget
- 出错只记录

**正文引用章节**：09、10、15、18

### `src/query/stopHooks.ts`
**核心职责**：Stop hook 执行面。
**关键符号**：
- `!needsFollowUp` 自然停止点进入
- blocking error / preventContinuation 反馈

**正文引用章节**：09、10、13、15、18、19

### `src/utils/hooks/skillImprovement.ts`
**核心职责**：受控 skill 自改进机制。
**关键符号**：
- 批量阈值 `TURN_BATCH_SIZE`
- 写入面限于 project skill 文件
- gate 控制
- post-sampling hook 挂载

**正文引用章节**：10、14、15

---

## A.7 Observability 与演化

### `src/services/analytics/index.ts`
**核心职责**：Telemetry / observability 基础设施。
**关键符号**：
- 低依赖 API
- sink 延迟 attach
- 早期事件队列
- metadata 强类型约束

**正文引用章节**：09、10、11

### Feature gates / dynamic config
**核心职责**：特性渐进启用与实验平台。

**正文引用章节**：07、09、10、11

---

## A.8 扩展面

### `src/skills/loadSkillsDir.ts` / `src/skills/SkillManager.ts`
**核心职责**：Skills 系统加载与命名空间。

**正文引用章节**：02、05、14、18

### `src/utils/plugins/loadPluginCommands.ts`
**核心职责**：Plugin 命令加载。

**正文引用章节**：05、09

### `src/services/mcp/client.ts`
**核心职责**：MCP 外部协议接入。

**正文引用章节**：05、09

### `src/remote/RemoteSessionManager.ts`
**核心职责**：Remote 运行形态与平台化能力。

**正文引用章节**：05、09、12

---

## A.9 Bootstrap 与状态

### `src/bootstrap/state.ts`
**核心职责**：Bootstrap / runtime state 中心。

**正文引用章节**：00、06、08、21

### `src/state/AppStateStore.ts`
**核心职责**：UI / session 状态模型。

**正文引用章节**：04、06、21

### `src/commands.ts`
**核心职责**：用户命令入口层。

**正文引用章节**：02、08、09

---

## 如何使用本索引

- **想验证某个结论**：在索引里找对应符号，直接对照源码。
- **想从某个机制开始读源码**：选一个你关心的主题（例如 memory、hooks、tools），从上面对应小节的第一个文件开始。
- **想做自己的 harness**：按 A.1 → A.4 → A.5 → A.6 的顺序读，对应「骨架 → 上下文 → 长期协作 → side-channel」的自然演进。

## 免责

- Claude Code 仓库持续演进，实际代码可能与本索引标注的符号名有差异。
- 本索引覆盖的是**正文引用过的关键符号**，不是完整的代码地图。
- 任何关于「这个符号表达了什么设计意图」的判断，都应结合正文章节的上下文来理解。

## 相关章节

- [第 09 章：Harness 工程经验综合](/claude-code-architecture/09-harness-engineering-lens/)
- [第 27 章：总体运行时架构图](/claude-code-architecture/27-runtime-architecture-map/)
- [第 29 章：术语表与核心区分](/claude-code-architecture/29-glossary-and-core-distinctions/)

{% include claude-code-architecture-nav.html %}
