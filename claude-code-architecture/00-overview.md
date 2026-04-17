---
layout: page
title: "00 总览"
permalink: /claude-code-architecture/00-overview/
book_key: overview
book_number: "00"
toc: true
---

## 本章目标

这一章作为整套研究的入口，不再只做早期仓库总览，而是回答四个更基础的问题：

1. 这套研究到底在研究什么？
2. Claude Code 整体上应该先被理解成什么系统？
3. 这套文档应该按什么方式进入，而不是从头硬读？
4. 如果后面只记住少数几个总导航章节，应该记住哪些？

换句话说，本章的职责不是替代后面的深挖章节，而是先给读者一张足够稳定的进入地图。

## 一、先给出总体判断

如果把这整套研究压缩成一句话，我会把 Claude Code 概括成：

> 一个围绕 QueryEngine / query loop 组织起来，并由上下文装配、工具执行、治理控制、side-channels、异步任务与子代理隔离共同支撑的长期协作型 agent runtime。

这里最重要的不是“它功能很多”，而是：

- 它不是单轮 prompt 壳；
- 它不是只会跑 shell 的 CLI；
- 它也不是只有 tools 的 function-calling demo；
- 它更像一套长期协作环境，而不是一次性问答器。

这也是为什么这份研究会把注意力放在：

- QueryEngine 与 query loop
- tools / skills / hooks / MCP / tasks / subagents
- memory / compact / effective history
- settings / permissions / trust / governance
- runtime 总图、阅读路径、术语系统与综合设计原则

而不是只盯着某个 prompt 或某个命令入口。

## 二、这套研究在研究什么，不研究什么

## 1. 研究重点

这套文档主要研究的是 Claude Code 的 **runtime architecture**，也就是：

- 一次 turn 如何进入系统并被推进
- 模型、工具、上下文、权限、恢复是怎样被组织的
- 长期协作能力为什么不仅仅等于聊天历史
- Claude Code 为什么比许多 demo agent 更像正式运行时
- 从这些源码里能提炼出哪些可迁移的 harness engineering 原则

因此，本系列更偏：

- 架构理解
- 边界划分
- 运行时机制分析
- 对 agent runtime / harness 的工程借鉴

## 2. 不研究什么

这套研究不打算重点做的是：

- 使用教程
- prompt 技巧清单
- 所有命令的用户手册
- 对未公开实现做强猜测
- 把每个目录都写成逐行实现注释

也就是说，这不是“Claude Code 快速上手指南”，而是：

- **从源码出发的架构研究与工程化阅读地图**

## 三、Claude Code 整体可以先怎样理解

在真正进入章节细节之前，先保留一个最稳定的粗粒度理解就够了。

## 1. 它的骨架是 QueryEngine / query loop

无论后面读到 tools、memory、hooks、compact、subagents 还是 permissions，最核心的骨架始终是：

- `QueryEngine` 持有会话级 owner 身份
- `query()` / `queryLoop()` 推进 turn 级状态机
- assistant -> tool -> tool_result -> continue / stop 构成主路径

所以如果只想先抓主干，最先要抓住的不是 UI，而是：

- **主循环是骨架，但不是全部**

## 2. 它的成熟度来自主循环之外的正式机制

Claude Code 真正值得研究的地方，不在于“也能调工具”，而在于它把很多复杂问题做成了正式机制，而不是零散补丁：

- context assembly
- memory retrieval / extraction / persistence
- compact / context collapse / recovery
- governance / permission / trust / managed settings
- hooks / side-channels
- tasks / background execution / scheduling
- subagents / isolation / worktree support

这些机制一起说明：

- Claude Code 的复杂度不是堆在一个大循环里
- 而是被分配到了多个相对稳定的 plane

## 3. 最稳妥的总体心智图

如果先不展开细节，可以暂时把 Claude Code 记成下面这张文字图：

```text
Claude Code = 长期协作型 agent runtime

核心骨架：
  QueryEngine + query loop

围绕骨架的关键平面：
  - Interaction Plane
  - Execution Plane
  - Context Plane
  - Governance Plane
  - Side-Channel Plane
```

更完整的 plane 化结构，在后面的第 27 章会正式展开；这里只需要先知道：

- 后面的章节不是零散专题
- 而是在逐步把这张图展开

## 四、这套研究如何组织

如果把当前文档集按职责来分，可以先粗分成四组。

## 1. 基础轮廓组

这组负责建立系统轮廓与入口：

- `00-overview.md`
- `01-entrypoints-and-startup.md`
- `02-commands-and-tools.md`
- `03-query-engine-and-execution-loop.md`
- `04-ui-and-interaction.md`
- `05-integrations-and-extensibility.md`
- `06-state-config-and-permissions.md`
- `07-build-flags-and-product-shaping.md`

## 2. 核心 runtime 深挖组

这组负责把主路径和周边关键机制真正拆开：

- `13-agent-loop-deep-dive.md`
- `14-skills-system-deep-dive.md`
- `15-hooks-and-side-channels-deep-dive.md`
- `16-tool-orchestration-and-concurrency.md`
- `17-memory-system-and-persistence.md`
- `18-runtime-cross-cutting-synthesis.md`
- `19-recovery-and-error-handling-deep-dive.md`
- `20-message-and-context-assembly-deep-dive.md`

## 3. 治理、异步与长期协作组

这组负责解释 Claude Code 为什么不是“只会跑一轮”的系统：

- `21-config-state-and-governance-boundaries.md`
- `22-tool-system-and-execution-boundaries.md`
- `23-streaming-output-event-protocol-and-sdk-boundary.md`
- `24-compact-context-collapse-and-recovery-boundary.md`
- `25-tasks-scheduling-and-background-execution.md`
- `26-subagents-parallel-exploration-and-isolation.md`

## 4. 总导航与综合组

这组是整套研究目前最重要的总导航层：

- `27-runtime-architecture-map.md`
- `28-reading-paths-and-index.md`
- `29-glossary-and-core-distinctions.md`
- `30-runtime-synthesis-and-design-principles.md`

这四章的职责分别是：

- `27`：给总体结构图
- `28`：给阅读路径与问题索引
- `29`：给术语与核心区分
- `30`：给最终综合与设计原则

也正因为这四章已经成形，本章的职责会更克制：

- 本章负责把你送到正确入口
- 不重复去替代 27 / 28 / 29 / 30

## 五、第一次阅读的最小路径

如果你第一次系统读这套研究，我建议最小集合是：

1. `00-overview.md`
2. `03-query-engine-and-execution-loop.md`
3. `06-state-config-and-permissions.md`
4. `13-agent-loop-deep-dive.md`
5. `20-message-and-context-assembly-deep-dive.md`
6. `27-runtime-architecture-map.md`

这条路线的目标是先建立六个最关键判断：

- Claude Code 的骨架在哪里
- 它为什么不是单纯 CLI
- 它的上下文是怎样被构造的
- 它为什么需要治理面
- 主路径与旁路是怎么分开的
- 它整体可以怎样被 plane 化理解

如果只读完这六章，你已经能拥有一张比较稳定的总体图。

## 六、按问题域进入的入口

如果你不是第一次读，而是带着问题来，建议直接走问题入口。

## 1. 如果你想看主循环

先读：

- `03-query-engine-and-execution-loop.md`
- `13-agent-loop-deep-dive.md`
- `16-tool-orchestration-and-concurrency.md`
- `19-recovery-and-error-handling-deep-dive.md`

## 2. 如果你想看 context / memory / 长会话

先读：

- `17-memory-system-and-persistence.md`
- `20-message-and-context-assembly-deep-dive.md`
- `24-compact-context-collapse-and-recovery-boundary.md`
- `29-glossary-and-core-distinctions.md`

## 3. 如果你想看 governance / permission / trust

先读：

- `06-state-config-and-permissions.md`
- `21-config-state-and-governance-boundaries.md`
- `22-tool-system-and-execution-boundaries.md`

## 4. 如果你想看异步任务与多代理

先读：

- `25-tasks-scheduling-and-background-execution.md`
- `26-subagents-parallel-exploration-and-isolation.md`
- `27-runtime-architecture-map.md`

## 5. 如果你想直接拿到总导航层

先读：

- `27-runtime-architecture-map.md`
- `28-reading-paths-and-index.md`
- `29-glossary-and-core-distinctions.md`
- `30-runtime-synthesis-and-design-principles.md`

这也是整套研究最应该长期保留在脑中的四章。

## 七、如何使用 27 / 28 / 29 / 30

这四章是现在整套研究的总导航中枢，本章只负责把它们介绍清楚。

## 1. 第 27 章：总体结构图

当你想知道：

- Claude Code 整体到底长什么样
- 各章节在总体架构里的位置是什么
- Interaction / Execution / Context / Governance / Side-Channel 这些 plane 如何拼起来

就回到：

- `27-runtime-architecture-map.md`

## 2. 第 28 章：阅读路径与问题索引

当你想知道：

- 我应该按什么顺序读
- 我只关心 memory / hooks / tools / governance 时该跳去哪
- 某个问题该查哪几章

就回到：

- `28-reading-paths-and-index.md`

## 3. 第 29 章：术语与核心区分

当你开始混淆下面这些概念时：

- tool / command / skill / hook / MCP
- memory / compact / summary
- internal history / effective history / SDK stream
- main path / side-channel
- context isolation / worktree isolation

就回到：

- `29-glossary-and-core-distinctions.md`

## 4. 第 30 章：最终综合与设计原则

当你已经读了很多细节，想知道最终应该带走什么时，就回到：

- `30-runtime-synthesis-and-design-principles.md`

它回答的是：

- Claude Code 的 runtime 本质上是什么
- 为什么它的成熟不在功能数量，而在边界稳定
- 对做 agent runtime / harness 的人，最该带走哪些原则

## 八、本章与后续章节的边界

为了避免本章和总导航层重复，需要明确几个边界。

## 1. 本章不是总图章

总体运行时架构图已经在第 27 章完成，因此这里不会重复把六个 plane 展开成完整结构图。

## 2. 本章不是总索引章

按问题域跳读、按目标选路线、按主题查章节，后面已经由第 28 章承担，因此这里只保留最小进入路径。

## 3. 本章不是术语表

涉及 core distinctions 的稳定定义，应以后面的第 29 章为准。

## 4. 本章也不是最终综合章

最终能迁移到你自己系统里的设计原则，应以后面的第 30 章为准。

因此，本章真正的作用只有一个：

- **让你以最低成本进入这整套研究**

## 九、Harness 视角

从 harness engineering 的角度看，本章最重要的工作不是提供某个技术结论，而是先建立阅读时的结构纪律。

Claude Code 最容易被误读的地方，是把它看成：

- 一个终端聊天程序
- 一个工具调用器
- 或一个“CLI + prompt”的组合

但只要你从一开始就把它看成 runtime，就更容易理解为什么后面会出现：

- compact boundary
- relevant memory prefetch
- stop hooks / stop failure hooks
- SDK protocol projection
- background tasks / cron / subagents
- permissions / governance / managed settings

也就是说，本章对应的不是某条源码链路，而是：

- **读整套仓库时的主心智模型入口**

## 十、工程化启发

这一章最值得保留的工程经验是：

## 1. 做架构研究时，先分导航层，再分技术层

如果没有总览、总图、索引、术语、综合这几层，后面章节越多，读者越难进入。

## 2. 理解 agent 系统时，先找 runtime，再看功能

比起先问“它支持哪些功能”，更重要的是先问：

- 它的主状态机在哪里？
- 它的上下文怎么进模型？
- 它的治理面在哪里？
- 它的旁路机制怎样挂接？

## 3. 导航层应该把读者送到正确章节，而不是替代所有章节

好的 overview 不该把所有结论提前说完，而应把：

- 最稳定的判断
- 最短的进入路径
- 最关键的总导航入口

先交给读者。

## 本章小结

如果把这一章压缩成一句话，可以说：

> 这套 Claude Code 架构研究最应该先被理解成一份围绕长期协作型 agent runtime 展开的分层研究地图，而不是一串顺序文章；本章的职责，就是先把读者送到正确的总体判断、最小阅读路径，以及 27 / 28 / 29 / 30 这组真正承担总导航功能的章节。

从这里继续读，最稳妥的路线是：

- 想先抓骨架：读 `03 / 06 / 13 / 20 / 27`
- 想按问题查：直接跳 `28`
- 想统一术语：直接跳 `29`
- 想看最终综合：直接跳 `30`

## 源码证据索引

- `src/entrypoints/cli.tsx` — 入口与启动分流
- `src/main.tsx` — 终端前台与主程序装配
- `src/QueryEngine.ts` — 会话 owner 与 runtime 骨架入口
- `src/query.ts` — turn loop、工具执行、recovery、hooks、context shaping
- `src/tools.ts` — tool surface 与执行能力面
- `src/bootstrap/state.ts` — bootstrap/runtime state 中心
- `src/state/AppStateStore.ts` — UI / session 状态模型

## 相关章节

- [第 03 章：QueryEngine 与执行循环总览](/claude-code-architecture/03-query-engine-and-execution-loop/)
- [第 06 章：state / config / permissions 基础图景](/claude-code-architecture/06-state-config-and-permissions/)
- [第 13 章：agent loop 深挖](/claude-code-architecture/13-agent-loop-deep-dive/)
- [第 20 章：message/context assembly 深挖](/claude-code-architecture/20-message-and-context-assembly-deep-dive/)
- [第 27 章：总体运行时架构图](/claude-code-architecture/27-runtime-architecture-map/)
- [第 28 章：阅读路径与索引](/claude-code-architecture/28-reading-paths-and-index/)
- [第 29 章：术语表与核心区分](/claude-code-architecture/29-glossary-and-core-distinctions/)
- [第 30 章：运行时综合与设计原则](/claude-code-architecture/30-runtime-synthesis-and-design-principles/)

{% include claude-code-architecture-nav.html %}
{% include mermaid.html %}
