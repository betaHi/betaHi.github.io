---
layout: page
title: "09 Harness Engineering 视角"
permalink: /claude-code-architecture/09-harness-engineering-lens/
book_key: harness-engineering-lens
book_number: "09"
toc: true
---

## 本章目标

这一章不再把 Claude Code 当作“功能合集”来读，而是专门回答三个更工程化的问题：

1. 为什么它适合被理解成 harness / runtime，而不是 prompt wrapper？
2. 应该用什么观察框架去拆它的关键结构？
3. 从这个仓库里，究竟能带走哪些可迁移的 harness engineering 判断？

因此，本章的职责不是重复后面更细的 runtime 深挖，也不是充当总索引，而是：

- 把 Claude Code 压缩成一套可迁移的 harness 观察框架；
- 帮你用工程视角而不是功能视角阅读这套系统。

## 一、先给出一个工作定义

如果只用这份仓库来归纳，所谓 harness，可以理解成：

> 一个围绕模型构建的、受控的运行环境。它不仅负责把 prompt 发给模型，还负责定义模型能看到什么、能调用什么、调用后会发生什么、失败后怎么恢复、状态如何保存、风险如何控制、能力如何扩展。

按这个定义，Claude Code 的 harness 不是某一个文件，而是一整套协作结构。

因此，把 Claude Code 读成 harness，关键不是说“它功能很多”，而是说：

- 它有清楚的 runtime 骨架；
- 它有正式的 context shaping；
- 它有受控的 execution boundary；
- 它把 governance、side-channels、memory、async 都纳入了同一套运行时工程里。

## 二、为什么 Claude Code 值得从 harness engineering 角度来读

如果只是把它看成一个终端聊天工具，很容易只看到：

- 命令行入口
- tool 调用
- 一轮轮对话

但从 harness engineering 的角度看，更重要的是：

- 入口层先决定运行模式，而不是直接进入对话；
- QueryEngine / query loop 提供持续推进任务的主骨架；
- tool surface、permission pipeline、trust、managed settings 共同定义行动边界；
- memory、compact、tasks、subagents 让它具备长期协作能力；
- hooks、post-turn paths、background execution 让复杂度不必全部堆进主循环。

也就是说，Claude Code 的研究价值不在某个单点 feature，而在于它如何把长期协作型 agent 所需的复杂度分层组织起来。

## 三、读 Claude Code 时最有用的 harness 观察框架

如果要把这一章压成一张最有用的观察框架，我建议用下面七个问题去读这个仓库。

## 1. 它怎样定义运行环境

关键线索：

- `src/entrypoints/cli.tsx`
- `src/main.tsx`
- `src/entrypoints/init.ts`

这里首先决定：

- 是 REPL、bridge、daemon、background session 还是 remote-control
- 需要先建立哪些环境前提
- 哪些初始化逻辑必须前置

这说明 harness 第一件事不是“想 prompt”，而是**定义执行环境**。

## 2. 它怎样构造模型可见的上下文

关键线索：

- `src/QueryEngine.ts`
- `src/query.ts`
- `src/utils/messages.ts`
- `src/utils/messages/systemInit.ts`
- `src/memdir/memdir.ts`

这里真正做的是：

- system prompt 组装
- user / system context 注入
- memory prompt 接入
- attachments / tool results / effective history 的投影

因此 harness engineering 的核心之一，不只是“有上下文”，而是**上下文是系统化生产出来的**。

## 3. 它怎样定义模型的行动空间

关键线索：

- `src/tools.ts`
- `src/Tool.ts`
- `src/tools/*`
- `src/services/tools/toolOrchestration.ts`

这里解决的问题是：

- 模型有哪些工具
- 哪些工具在当前 build 存在
- 哪些工具在当前 session 可见
- 哪些工具会被权限和环境继续过滤

一个成熟 harness 的关键点是：

> 模型的 action space 必须被结构化建模，而不是“随便给几个函数”。

## 4. 它怎样把执行推进成可恢复回路

关键线索：

- `src/QueryEngine.ts`
- `src/query.ts`
- `src/services/tools/StreamingToolExecutor.ts`
- `src/services/tools/toolOrchestration.ts`

这里解决的不是“一问一答”，而是：

- 一轮任务如何持续推进
- tool use 后如何继续
- compact 后如何恢复
- output token 不够怎么办
- budget 超限怎么办

这部分是 Claude Code 里最典型的 harness 核心。

## 5. 它怎样把治理接进运行时

关键线索：

- `src/utils/permissions/permissions.ts`
- trust dialog 相关 UI 路径
- tool permission context
- remote permission requests

这里最关键的是：

- tool 可能在调用前就被隐藏
- trust 与 permission 是两层边界
- 权限不是补丁，而是主路径的一部分

这也是 Claude Code 和很多 demo agent 的本质差异之一。

## 6. 它怎样处理主路径之外的辅助复杂度

关键线索：

- `src/utils/hooks/postSamplingHooks.ts`
- `src/query/stopHooks.ts`
- `src/services/extractMemories/extractMemories.ts`
- `src/services/SessionMemory/sessionMemory.ts`

这里能看到一个很成熟的工程判断：

- 并不是所有认知工作都该塞进主 query loop
- 某些提炼、总结、memory 写回、skill improvement 更适合放到 side-channel
- side-channel 仍然要受权限、工具面、观测面约束

这正是长期协作型 harness 的关键成熟点。

## 7. 它怎样支持长期演化

关键线索：

- `src/services/analytics/index.ts`
- feature gates / dynamic config
- `src/services/mcp/client.ts`
- `src/skills/loadSkillsDir.ts`
- `src/utils/plugins/loadPluginCommands.ts`
- `src/remote/RemoteSessionManager.ts`

这说明 harness 不是封闭运行盒子，而是一个：

- 可观测
- 可实验
- 可 rollout
- 可扩展
- 可持续演化

的平台型 runtime。

## 四、从这个仓库里能学到的 harness engineering 核心判断

## 1. 先定义控制面，再定义能力面

很多人做 agent 时先想“加什么工具”。Claude Code 给出的反例是：

- 先定义启动模式
- 先定义 trust / permission / session 边界
- 先定义 state 与 prompt assembly
- 然后才是 tools 和 extensions

如果控制面不清楚，能力越多越危险。

## 2. 上下文不是字符串，而是基础设施

从 messages、memory、system init、attachments 等路径可以看出：

- 上下文由多个来源构成
- 这些来源有优先级与边界
- 它们最终是 runtime 投影，而不是原始 transcript 的直接堆叠

真正的 harness engineering，本质上很大一部分是在做 **context engineering infrastructure**。

## 3. 工具系统首先是 contract design

Claude Code 不是把所有工具都暴露给模型，而是：

- 编译期裁剪
- 运行期按环境启用
- 权限上下文继续过滤
- 某些工具在模型可见前就被去掉

这比“function calling 列个 JSON schema”要成熟得多。

## 4. 恢复能力必须进入主流程

`query.ts` 体现得很明显：

- compact
- reactive compact
- max_output_tokens recovery
- budget tracking
- tool result budgeting

成熟 harness 不会把失败恢复当成纯异常路径，而会把它当作主流程的一部分。

## 5. side-channel 不是附属物，而是正式平面

memory extraction、session memory、stop hooks、post-sampling hooks 都说明：

- 主循环是骨架，但不是全部
- 辅助认知工作需要被正式分流
- 分流之后仍然要受治理、观测和执行边界约束

这类设计对长期协作 agent 尤其关键。

## 6. harness 的成熟度体现在边界工程上

Claude Code 最值得学习的地方，不只是会调多少工具，而是它把下面这些边界做成了正式结构：

- model / tool boundary
- runtime / UI boundary
- main path / side-channel boundary
- session / durable memory boundary
- capability surface / governance surface boundary

这才是它比常见 agent demo 更成熟的地方。

## 五、Claude Code 比常见 agent demo 多了什么

如果和常见的 agent demo 做对比，这个仓库额外多出来的，就是 harness 的厚度与边界纪律：

### demo agent 常见结构

```text
prompt
  -> model
  -> tool call
  -> print result
```

### Claude Code 的实际结构

```text
entrypoint / mode dispatch
  -> config / trust / policy / environment init
  -> command/tool registry assembly
  -> system prompt + context + memory assembly
  -> QueryEngine session owner
  -> query loop with orchestration / budgets / recovery
  -> permissions / hooks / compact / side-channels
  -> UI / remote / bridge / tasks / background execution
  -> analytics / diagnostics / rollout / extensibility
```

这就是为什么它更适合被当成 harness engineering 学习材料。

## 六、怎样把这一章迁移到自己的系统设计里

如果你想自己做 harness，这个仓库最值得先迁移的不是某个具体接口，而是下面这些判断：

### 1. 先做最小 runtime 骨架

至少分清：

- entrypoint
- session owner
- turn loop
- tool registry
- permission gate

### 2. 再做上下文工程基础设施

至少分清：

- 原始历史
- 当前 query 视图
- system / user context
- tool results / attachments
- memory / summary / compact 的不同职责

### 3. 再补长期协作层

逐步引入：

- durable memory
- session memory
- compact
- async tasks
- subagents / isolation

### 4. 最后再考虑平台化扩展

包括：

- plugins / MCP
- remote / bridge
- feature gates / rollout
- analytics / eval

这比一开始复制完整产品形状更可行，也更符合 harness engineering 的学习顺序。

## 七、本章与后续章节的关系

为了避免和后面的章节抢职责，需要明确本章边界。

## 1. 本章不是主循环深挖章

更细的 loop、tool orchestration、recovery、context assembly，应以后面的：

- `13-agent-loop-deep-dive.md`
- `17-memory-system-and-persistence.md`
- `16-tool-orchestration-and-concurrency.md`
- `19-recovery-and-error-handling-deep-dive.md`
- `20-message-and-context-assembly-deep-dive.md`

为主。

## 2. 本章不是治理总图章

governance / execution boundary 的正式展开，应以后面的：

- `21-config-state-and-governance-boundaries.md`
- `22-tool-system-and-execution-boundaries.md`

为主。

## 3. 本章不是总导航层

总体结构图、阅读路径、术语与最终综合，应以后面的：

- `27-runtime-architecture-map.md`
- `28-reading-paths-and-index.md`
- `29-glossary-and-core-distinctions.md`
- `30-runtime-synthesis-and-design-principles.md`

为主。

## 八、Harness 视角

从 harness engineering 的角度看，本章最重要的意义，不是枚举 Claude Code 有哪些组件，而是训练下面这种判断：

- 一个 agent 系统的骨架在哪里
- 哪些复杂度必须进入主路径
- 哪些复杂度应该被分流到 side-channel
- 哪些边界必须在产品化之前就正式化
- 怎样把 runtime、context、governance、memory、async 看成同一套工程问题

Claude Code 恰好非常适合训练这种判断能力。

## 九、工程化启发

这一章最值得保留的工程经验是：

## 1. 先学观察框架，再学 feature 细节

如果一开始只记文件名、工具名、功能名，很容易看不到系统真正成熟的地方。更有效的方式是先问：

- 运行环境怎样定义？
- 上下文怎样构造？
- 行动空间怎样约束？
- 恢复怎样进入主路径？
- side-channel 怎样正式化？

## 2. 真正可迁移的是边界纪律

Claude Code 当前最值得带走的，不是具体 prompt 或某个 hook 名字，而是：

- runtime decomposition
- boundary discipline
- control-plane thinking
- context engineering
- side-channel design

## 3. 用 harness 视角读仓库，会更容易理解后面的 deep dives

因为一旦先建立了 harness 视角，后面看到 memory、hooks、compact、subagents、governance 时，就不会把它们误读成零散 feature，而会更自然地把它们放回同一套 runtime 结构里。

## 本章小结

如果把这一章压缩成一句话，可以说：

> Claude Code 最值得从 harness engineering 角度学习的，不是某个单点技巧，而是它如何把运行环境、上下文、行动空间、治理边界、side-channel 与长期协作基础设施组织成一套可分析、可控制、可扩展的 agent runtime。

如果你接下来想继续顺着这条线读，最稳妥的下一步通常是：

- 想看主循环：去 `13 / 16 / 19 / 20`
- 想看 memory 与 side-channel：去 `15 / 17 / 24`
- 想看治理与执行边界：去 `21 / 22`
- 想回到总图与综合：去 `27 / 30`

## 源码证据索引

- `src/entrypoints/cli.tsx` — 入口层与模式分流
- `src/main.tsx` — 主程序装配与前台宿主
- `src/QueryEngine.ts` — session owner 与 runtime 骨架
- `src/query.ts` — turn loop、recovery、compact、hooks、context shaping
- `src/tools.ts` — tool registry 与行动空间定义
- `src/services/tools/toolOrchestration.ts` — tool orchestration 与执行推进
- `src/services/tools/StreamingToolExecutor.ts` — tool 执行语义与结果流回
- `src/memdir/memdir.ts` — durable memory 边界
- `src/services/SessionMemory/sessionMemory.ts` — session memory 与长会话辅助层
- `src/services/extractMemories/extractMemories.ts` — post-turn durable memory 提取 side-channel
- `src/utils/permissions/permissions.ts` — permission pipeline 与治理控制边界
- `src/services/analytics/index.ts` — observability / telemetry 基础设施

## 相关章节

- [第 03 章：QueryEngine 与执行循环总览](/claude-code-architecture/03-query-engine-and-execution-loop/)
- [第 13 章：agent loop 深挖](/claude-code-architecture/13-agent-loop-deep-dive/)
- [第 15 章：hooks 与 side-channels 深挖](/claude-code-architecture/15-hooks-and-side-channels-deep-dive/)
- [第 16 章：tool orchestration 与并发](/claude-code-architecture/16-tool-orchestration-and-concurrency/)
- [第 17 章：memory system and persistence](/claude-code-architecture/17-memory-system-and-persistence/)
- [第 19 章：recovery 与错误处理深挖](/claude-code-architecture/19-recovery-and-error-handling-deep-dive/)
- [第 20 章：message / context assembly 深挖](/claude-code-architecture/20-message-and-context-assembly-deep-dive/)
- [第 21 章：config / state / governance boundaries](/claude-code-architecture/21-config-state-and-governance-boundaries/)
- [第 22 章：tool system 与 execution boundaries](/claude-code-architecture/22-tool-system-and-execution-boundaries/)
- [第 27 章：总体运行时架构图](/claude-code-architecture/27-runtime-architecture-map/)
- [第 29 章：术语表与核心区分](/claude-code-architecture/29-glossary-and-core-distinctions/)
- [第 30 章：运行时综合与设计原则](/claude-code-architecture/30-runtime-synthesis-and-design-principles/)

{% include claude-code-architecture-nav.html %}
