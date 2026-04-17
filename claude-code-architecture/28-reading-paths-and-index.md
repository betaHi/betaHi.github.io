---
layout: page
title: "28 Reading Paths and Index"
permalink: /claude-code-architecture/28-reading-paths-and-index/
book_key: reading-paths-and-index
book_number: "28"
toc: true
---

# Claude Code 仓库架构研究：28 Reading Paths and Index

## 本章目标

前面的章节已经逐步把 Claude Code 拆成了一套相对完整的架构研究：

- 既有总览和入口章节
- 也有围绕 QueryEngine、query loop、memory、hooks、permissions、compact、subagents 等做的深挖章节
- 现在又补上了第 27 章的总体架构图

但内容一多，读者会立刻遇到两个问题：

1. 我应该按什么顺序读？
2. 如果我只关心某个问题，应该跳到哪些章节？

所以这一章的目标不是补充新的技术判断，而是把这整套研究变成一份**可进入、可跳读、可按问题检索**的阅读索引。

换句话说：

- 第 27 章回答“Claude Code 整体长什么样”
- 本章回答“这套研究应该怎么读、怎么查、怎么按目标选章节”

本章重点包括：

- 不同读者的阅读路径
- 按主题的问题索引
- 按目标的最小阅读集合
- 章节之间的组织关系

---

## 一、先给出总体判断

如果把当前这套研究看成一张知识地图，而不是一串顺序文章，那么最稳妥的理解是：

> 这套研究不是单线教程，而是一份围绕 Claude Code agent runtime 各个 plane 展开的分层研究索引；它既可以顺序阅读，也更适合按问题域、按工程目标、按架构层次跳读。

这意味着有三种最合理的阅读方式：

1. **顺序读**：适合第一次系统建立整体模型  
2. **按主题读**：适合只研究某个子系统  
3. **按目标读**：适合带着明确工程问题来查资料  

如果把整套内容的组织方式再压缩成一句话，可以说：

- 前半段帮助你建立系统轮廓
- 中段帮助你理解主循环和核心子系统
- 后半段帮助你理解长期协作、治理、异步、隔离与综合结构

因此本章的核心不是“推荐唯一顺序”，而是给出：

- **哪种读者最适合读哪几章**

---

## 二、如果你第一次读，最推荐的路径是什么

## 1. 最稳妥的第一次阅读路线

如果你是第一次系统阅读这套研究，我建议优先按下面的顺序读：

1. `00-overview.md`
2. `03-query-engine-and-execution-loop.md`
3. `06-state-config-and-permissions.md`
4. `13-agent-loop-deep-dive.md`
5. `20-message-and-context-assembly-deep-dive.md`
6. `27-runtime-architecture-map.md`

这六章足以建立 Claude Code 的基本框架感。

为什么是这六章：

- `00` 给你入口和范围
- `03` 让你先抓到主骨架
- `06` 让你知道系统不是“纯 loop”，而是有治理面
- `13` 把 loop 真正展开
- `20` 解释模型上下文不是自然给定的
- `27` 把前面内容重新收束成一张总体图

如果只读完这六章，你大概已经能回答：

- Claude Code 的主状态机是什么
- 它为什么不是单纯聊天壳
- 它的上下文是怎样被构造的
- 它的控制面在哪里
- 它整体上可以拆成哪些 plane

## 2. 这条路线适合什么读者

这条路线最适合：

- 第一次认真看 Claude Code 架构的人
- 已经知道 Claude Code 是什么，但没系统研究过源码结构的人
- 想先要一张总图，再决定深入哪个方向的人

它不适合的读者是：

- 只想看某一个子系统的人
- 已经熟悉主循环，只想直奔 memory / hooks / permissions / SDK 的人

---

## 三、如果你是做 agent runtime / harness 的工程师，最推荐怎么读

## 1. Runtime / Harness 路线

如果你的目标不是“理解 Claude Code 产品”，而是：

- 借鉴 Claude Code 的 agent runtime 设计
- 看它怎样处理 loop、tool、memory、context、governance、subagent
- 提炼可迁移的工程原则

那么更推荐下面这条路线：

1. `09-harness-engineering-lens.md`
2. `13-agent-loop-deep-dive.md`
3. `15-hooks-and-side-channels-deep-dive.md`
4. `16-tool-orchestration-and-concurrency.md`
5. `17-memory-system-and-persistence.md`
6. `19-recovery-and-error-handling-deep-dive.md`
7. `20-message-and-context-assembly-deep-dive.md`
8. `21-config-state-and-governance-boundaries.md`
9. `24-compact-context-collapse-and-recovery-boundary.md`
10. `26-subagents-parallel-exploration-and-isolation.md`
11. `27-runtime-architecture-map.md`

这条路径的核心目的不是把 Claude Code 当作产品看，而是把它当作：

- **一个成熟 agent runtime 的样本**

## 2. 这条路线重点看什么

读这条路径时，建议特别关注这些 recurring themes：

- 主路径与旁路如何分层
- tool execution 与 governance 如何耦合
- memory 与 compact 如何区分
- query runtime 与 protocol / UI / SDK 如何分界
- 长会话与异步工作如何不压垮主循环
- 多代理与上下文隔离如何避免主会话污染

如果你的目标是“做自己的 harness”，这条路线通常比顺序通读更有价值。

---

## 四、如果你想快速理解 Claude Code 的主循环，只读哪几章

如果你只关心：

- 一次 turn 是怎么跑起来的
- assistant / tool / tool_result 是怎么推进的
- 哪些机制贴着 loop，哪些是旁路

那么建议最小集合是：

1. `03-query-engine-and-execution-loop.md`
2. `13-agent-loop-deep-dive.md`
3. `16-tool-orchestration-and-concurrency.md`
4. `19-recovery-and-error-handling-deep-dive.md`

如果再补一章，我建议加：

5. `20-message-and-context-assembly-deep-dive.md`

因为主循环如果不结合 context assembly 去看，很容易误以为：

- message history 就是 query 输入
- tool/result 是孤立事件
- stop hooks / prefetch / attachments 只是零散增强

实际上不是。

---

## 五、如果你只关心 memory / context / 长会话问题，读哪些章

这是另一个非常常见的阅读目标。

如果你最关心的是：

- Claude Code 有没有长期记忆
- memory prompt / relevant memory / extraction 怎样工作
- 历史太长时怎么 compact
- 上下文到底怎么组装

那么建议按这个顺序读：

1. `17-memory-system-and-persistence.md`
2. `20-message-and-context-assembly-deep-dive.md`
3. `24-compact-context-collapse-and-recovery-boundary.md`

如果你还想知道：

- memory 写回为什么要走 side-channel
- hooks / stop-hook 在这里扮演什么角色

再补：

4. `15-hooks-and-side-channels-deep-dive.md`

这组章节合起来，基本能覆盖：

- durable memory
- runtime retrieval
- prompt injection
- attachment injection
- compact boundary
- effective history
- write-back path

---

## 六、如果你最关心 settings / permissions / policy / trust，读哪些章

如果你是从安全、治理、企业控制面这个角度进入 Claude Code，那么建议读：

1. `06-state-config-and-permissions.md`
2. `21-config-state-and-governance-boundaries.md`
3. `22-tool-system-and-execution-boundaries.md`

如果还想补“UI 和交互里权限是怎样显化的”，再加：

4. `04-ui-and-interaction.md`

这组章节能帮助你理解：

- settings source merge
- GlobalConfig / ProjectConfig
- policy / managed settings
- trust acceptance
- permission execution pipeline
- allow / deny / ask
- tool execution 与 governance 的关系

这也是 Claude Code 最明显区别于 demo 型 agent 的一组内容。

---

## 七、如果你最关心 tools / actions / agent 能做什么，读哪些章

如果你的关注点是：

- 工具怎么暴露给模型
- tool orchestration 怎么组织
- tool system 和 skill / hook / MCP 的边界
- agent 实际行动面是怎样构造的

那么建议读：

1. `02-commands-and-tools.md`
2. `16-tool-orchestration-and-concurrency.md`
3. `22-tool-system-and-execution-boundaries.md`

如果还想看：

- 长时执行与后台任务
- 子代理和委托执行

再加：

4. `25-tasks-scheduling-and-background-execution.md`
5. `26-subagents-parallel-exploration-and-isolation.md`

这组章节能帮助你建立一个更完整的 Execution Plane 视角。

---

## 八、如果你最关心 SDK / streaming / external protocol，读哪些章

如果你来自 SDK / integration / protocol 视角，最该读的是：

1. `04-ui-and-interaction.md`
2. `05-integrations-and-extensibility.md`
3. `23-streaming-output-event-protocol-and-sdk-boundary.md`
4. `27-runtime-architecture-map.md`

如果还想理解：

- 为什么 SDK-visible stream 不等于内部 message history
- system/init 属于什么层
- QueryEngine 为什么既是入口又是桥接层

可以再回读：

5. `20-message-and-context-assembly-deep-dive.md`

---

## 九、如果你最关心 hooks / side-channels / self-improvement，一定读哪些章

如果你的核心问题是：

- Claude Code 里有哪些 hook 机制
- prefetch、post-sampling、stop hooks 各挂在哪里
- memory extraction、skill improvement 属于哪种 side-channel
- 为什么这些能力不直接塞进主循环

那么建议读：

1. `15-hooks-and-side-channels-deep-dive.md`
2. `17-memory-system-and-persistence.md`
3. `19-recovery-and-error-handling-deep-dive.md`
4. `27-runtime-architecture-map.md`

这组章节结合起来，能帮助你看清：

- 哪些机制是 main-path-adjacent
- 哪些是 end-of-turn collection point
- 哪些是 analysis side-channel
- Side-Channel Plane 为什么是独立架构层

---

## 十、如果你最关心长时工作流、后台执行、并行和子代理，读哪些章

如果你把 Claude Code 当作“长期协作 agent”去理解，那么建议读：

1. `25-tasks-scheduling-and-background-execution.md`
2. `26-subagents-parallel-exploration-and-isolation.md`
3. `24-compact-context-collapse-and-recovery-boundary.md`
4. `17-memory-system-and-persistence.md`
5. `27-runtime-architecture-map.md`

这组章节合起来，能帮助你理解：

- 会话怎么承载长时工作
- 为什么需要 task objects
- 为什么需要 background execution
- 为什么需要 subagent 和 worktree isolation
- 长会话为什么需要 compact 与 effective history
- 长期协作为什么还需要 durable memory

---

## 十一、如果你只想快速获得“Claude Code 为什么成熟”的答案，最小读法是什么

如果你的时间很少，但想快速理解：

- 为什么 Claude Code 比很多 demo agent 成熟
- 它成熟在什么地方
- 哪几处最值得借鉴

我建议只读这五章：

1. `13-agent-loop-deep-dive.md`
2. `15-hooks-and-side-channels-deep-dive.md`
3. `17-memory-system-and-persistence.md`
4. `21-config-state-and-governance-boundaries.md`
5. `27-runtime-architecture-map.md`

如果还能再加一章：

6. `24-compact-context-collapse-and-recovery-boundary.md`

这几章能非常集中地体现它成熟的地方：

- loop 清楚
- side-channel 正式化
- memory 不只是聊天摘要
- governance 不只是附加安全逻辑
- compact / long-session handling 是正式子系统
- 全局架构是分 plane 的，不是大杂烩

---

## 十二、按问题索引：你有问题时应该跳去哪

下面给一个按问题跳转的索引。

| 如果你的问题是… | 建议先读 |
|---|---|
| Claude Code 的主循环怎么跑？ | 03, 13 |
| QueryEngine 和 `query()` 怎么分工？ | 03, 13, 20 |
| system prompt / user context / system context 怎么进模型？ | 20 |
| Claude Code 的 memory 到底是什么？ | 17 |
| memory 和 compact 有什么区别？ | 17, 24, 29 |
| hooks / prefetch / stop hooks 挂在哪里？ | 15, 13 |
| tool system 和 skill / hook / MCP 有什么区别？ | 14, 22, 29 |
| settings / config / AppState / bootstrap state 怎么分？ | 21, 29 |
| policy / trust / permissions 怎么落地？ | 06, 21, 22 |
| SDK stream 和内部 message history 有什么区别？ | 23, 20, 29 |
| Claude Code 为什么需要 compact boundary？ | 24 |
| Claude Code 怎么做长时工作流？ | 25, 26 |
| 子代理的意义是什么？ | 26 |
| Claude Code 整体架构总图在哪里？ | 27 |
| 我应该怎么按主题跳读？ | 28 |
| 核心术语怎么统一理解？ | 29 |
| 整套系统最后能总结成什么设计原则？ | 30 |

---

## 十三、按章节分组来理解整套书

除了按问题读，也可以按“章节群”来理解。

## 1. 基础轮廓组
- 00
- 01
- 02
- 03
- 04
- 05
- 06
- 07

这组章节负责建立：

- Claude Code 是什么
- 它从哪里启动
- 用户怎么接触它
- 工具、集成、配置、权限大概是什么样

## 2. 核心 runtime 深挖组
- 13
- 15
- 16
- 19
- 20

这组章节负责解释：

- 主循环怎么推进
- hooks / side-channels 怎样挂接
- tools 怎样被调度
- 出错怎么恢复
- 模型上下文怎样被组装

## 3. 长期协作与上下文组
- 17
- 24

这组章节负责解释：

- durable memory
- relevant memory retrieval
- compact boundary
- effective history
- 长会话怎么继续工作

## 4. 控制与治理组
- 06
- 21
- 22

这组章节负责解释：

- settings source merge
- config / state 边界
- policy / trust / permissions
- tools 为什么是被治理的能力面

## 5. 异步与多代理组
- 25
- 26

这组章节负责解释：

- tasks / background execution
- cron / scheduling
- subagents / parallel exploration
- worktree isolation
- 长期协作 agent 的异步执行基础设施

## 6. 收束与索引组
- 08
- 09
- 12
- 27
- 28
- 29
- 30

这组章节负责把前面的研究重新组织起来：

- 结论
- harness lens
- 继续研究路线
- 总图
- 阅读路径
- 术语表
- 综合设计原则

---

## 十四、如果你想把这套研究当 reference，而不是从头读

这是另一种很重要的使用方式。

如果你已经不准备从头顺读，而是把这套内容当作 reference，那么建议你记住下面这几章的角色：

- `27`：总图入口  
- `28`：阅读路径与问题索引  
- `29`：术语与核心区分  
- `30`：整体综合与设计原则  

这四章会逐渐承担“总索引层”的角色。  
以后如果忘了：

- 某概念属于哪个 plane
- 某问题该去哪个章节查
- 某术语和另一个术语的边界在哪

就优先回到这几章。

---

## 十五、这套研究最适合什么样的读者

比较稳妥地说，这套研究最适合三类读者：

## 1. 想认真理解 Claude Code 内部结构的人
不是只想知道“怎么用”，而是想知道：

- 为什么它这样设计
- 各个系统怎样连接
- 哪些地方体现了成熟 runtime 思维

## 2. 想做 agent runtime / harness 的工程师
这类读者往往最关心：

- loop
- tools
- governance
- memory
- compact
- side-channels
- subagents
- protocol boundary

## 3. 想从 Claude Code 提炼一般性设计原则的人
这类读者未必只关心 Claude Code 本身，而更关心：

- 这套设计哪些可迁移
- 哪些是长期协作 agent 的共性
- 哪些是特别值得抄的方法论

相反，如果你只想找：

- prompt 技巧
- 快速上手指令
- 一分钟入门操作手册

那么这套研究并不是最优先的材料。

---

## 十六、阅读这套内容时最容易踩的误区

为了让索引更有用，也需要提醒几个常见误区。

## 1. 不要把每章都当独立散文
这些章节虽然能单读，但最好始终记得它们在第 27 章总图中的位置。

## 2. 不要把 memory、compact、summary 混成一回事
这几者相关，但属于不同问题域。  
如果混淆，建议回看 17、24、29。

## 3. 不要把 tool、hook、skill、MCP 混成一回事
这组概念最容易互相污染。  
如果混淆，建议看 14、15、22、29。

## 4. 不要把内部 message history 和 SDK stream 混成一回事
这在读 20 和 23 时尤其需要注意。

## 5. 不要把 governance 当成“配置细节”
Claude Code 的治理面其实是整套架构成熟度的关键之一。  
如果忽略这一点，会严重低估 06、21、22 的价值。

---

## 本章小结

如果把这一章压缩成一句话，可以说：

> 这套 Claude Code 架构研究最适合被当作一张可跳读、可按问题检索、可按工程目标选择路径的知识地图，而不是一份只能顺序阅读的单线教程；不同读者应从不同入口进入，但无论怎么读，第 27 章的总图、当前这一章的路径索引、第 29 章的术语表和第 30 章的综合章，都会逐渐成为整套内容的总导航层。

从这一章能直接得到的使用方法包括：

- 第一次读，优先走 `00 → 03 → 06 → 13 → 20 → 27`
- 做 runtime / harness，优先走 `09 → 13 → 15 → 16 → 17 → 19 → 20 → 21 → 24 → 26 → 27`
- 按问题查阅时，先看本章的问题索引
- 把 `27 / 28 / 29 / 30` 当作整套研究的总导航层使用

## 源码证据索引

- `src/QueryEngine.ts` — runtime 骨架与主路径入口
- `src/query.ts` — turn loop、tool orchestration、context shaping、recovery
- `src/memdir/memdir.ts` — memory / durable context 路径代表
- `src/utils/permissions/permissions.ts` — governance / permission 边界代表
- `src/services/tools/toolOrchestration.ts` — execution plane 代表实现
- `src/services/analytics/index.ts` — observability / eval 基础设施代表
- `src/services/mcp/client.ts` — extensibility / protocol 接入代表

## 相关章节

- [第 00 章：全书入口与研究范围](/claude-code-architecture/00-overview/)
- [第 08 章：阶段性结论与阅读指引](/claude-code-architecture/08-conclusions-and-reading-guide/)
- [第 09 章：Harness engineering lens](/claude-code-architecture/09-harness-engineering-lens/)
- [第 12 章：从本仓库继续展开研究的路线](/claude-code-architecture/12-study-roadmap-from-this-repo/)
- [第 27 章：总体 Runtime Architecture Map](/claude-code-architecture/27-runtime-architecture-map/)
- [第 29 章：Glossary and Core Distinctions](/claude-code-architecture/29-glossary-and-core-distinctions/)
- [第 30 章：Runtime Synthesis and Design Principles](/claude-code-architecture/30-runtime-synthesis-and-design-principles/)

{% include claude-code-architecture-nav.html %}
