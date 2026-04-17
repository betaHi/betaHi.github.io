---
layout: page
title: "10 Memory、评测与自我改进"
permalink: /claude-code-architecture/10-memory-evaluation-and-self-improvement/
book_key: memory-evaluation-and-self-improvement
book_number: "10"
toc: true
---

# Claude Code 仓库架构研究：10 Memory、评测与自我改进

## 本章目标

这一章专门回答四个更聚焦的问题：

1. Claude Code 里的 memory 到底是怎样分层的？
2. 评测能力在这套系统里是以什么形态存在的？
3. 所谓“自我改进”在这里到底有哪些明确证据，哪些又不该过度解读？
4. 这些能力为什么更应该被理解成长期协作 runtime 的 side-channel / governance / context engineering 基础设施？

因此，本章的职责不是把 memory、compact、hooks、eval 全部重新定义一遍，而是：

- 把长期协作 agent 中最容易混淆的 memory / evaluation / self-improvement 问题放回运行时边界里；
- 说明 Claude Code 值得学习的不是“会不会自动进化”，而是“如何做受控自改进”。

## 一、先给出总体判断

基于这次调研，我会把结论压成三层：

### 1. 明确存在的机制

源码里能明确看到：

- 持久 memory 机制（`memdir` / `MEMORY.md` / typed memory）
- session memory 机制（当前会话摘要与压缩辅助）
- 自动 durable memory 提取机制（stop hook 后 forked agent 提取 memories）
- post-sampling hooks 与 stop hooks（主输出之后的附加分析插槽）
- skill improvement（对项目 skill 的改进建议与受限自动应用实验）
- compact / recovery / retry / budget（执行层面的自修复）
- analytics / telemetry / feature gates（让系统可评估、可 rollout）

### 2. 明确不存在“失控式自进化”证据

这份源码里没有明显证据表明 Claude Code 在做一种完全自动、闭环、自主重写自身核心代码的大规模自我进化。

更准确的说法是：

> 它具备很多 **局部自我改进与自我维护机制**，但这些机制都被严格限制在特定边界内。

### 3. 真正值得学的是“受控自改进”

Claude Code 更像是在做：

- 自动提炼记忆
- 自动维护 session summary
- 自动检测 skill 改进点
- 自动 compact / 恢复 / retry
- 自动记录 telemetry 以支撑后续评估

这是一种非常工程化的“渐进式自改进”，而不是失控式自治。

## 二、为什么这一章要把 memory、评测、自改进放在一起看

表面上看，这三件事像是不同主题：

- memory 像上下文问题
- evaluation 像评测问题
- self-improvement 像智能增强问题

但从长期协作 runtime 的角度看，它们其实共享同一个核心问题：

> 系统怎样在不污染主任务路径的前提下，持续维持认知连续性、观测自身表现，并对局部行为做受控改进。

所以这三者在 Claude Code 里并不是孤立 feature，而是共同落在：

- Context Plane
- Side-Channel Plane
- Governance Plane

的交叉地带。

## 三、Memory 在这个仓库里至少有三层

## 1. 持久 memory：`src/memdir/memdir.ts`

这是最显式的一层。

从 `memdir.ts` 可见：

- memory 以文件目录形式存在
- 入口文件是 `MEMORY.md`
- `MEMORY.md` 只是索引，不直接存内容
- 每条 memory 都应写入独立文件，并带 frontmatter
- memory 被限制为四类：`user / feedback / project / reference`
- 明确禁止把可从代码推导出的内容随便存成 memory

这里最有价值的工程点是：

### durable memory 被设计成“结构化知识库”，不是聊天缓存

它要求：

- 有类型
- 有描述
- 有索引
- 有内容与索引分离
- 有明确的“什么不该存”边界

这其实是一种很成熟的 memory engineering 思路。

## 2. Session memory：`src/services/SessionMemory/sessionMemory.ts`

这层 memory 不同于持久 memory，它更像 **当前会话的工作记忆 / 摘要记忆**。

从代码看：

- 它在后台定期维护一个 markdown 文件
- 触发条件与 token 数、tool call 数有关
- 它通过 forked subagent 提取当前会话的重要信息
- 会在 auto compact 与 session memory compact 中被使用

这里体现了一个非常关键的设计：

> 长会话里，不能只靠原始 transcript 维持认知，必须生成中间层记忆。

## 3. 自动 durable memory 提取：`src/services/extractMemories/extractMemories.ts`

这个模块更进一步：它会在 query loop 正常完成后，由 stop hook 路径异步触发 durable memory 抽取。

源码里能明确看到：

- 它运行在完整 query loop 结束后
- 采用 forked agent 模式
- 共享父 prompt cache
- 只允许极受限的工具集
- Edit/Write 只能写到 auto-memory 路径
- Bash 只允许只读命令

这非常值得学习，因为它说明 Claude Code 的 memory 提取不是“主 agent 顺手干一下”，而是：

- 放到 side-channel
- 用权限严格受限的子 agent 完成
- 避免干扰主线程任务

这就是很典型的 harness engineering 手法。

## 四、memory 的工程价值，不只是“记住东西”

## 1. memory 是上下文工程的一部分

`loadMemoryPrompt()` 与 system prompt 构造路径说明：memory 最终会参与 prompt 构建。也就是说，它不是外部数据库，而是 **context assembly 的组成部分**。

## 2. memory 是 token 预算治理的一部分

session memory 和 compaction 之间有明显耦合，说明 memory 还承担：

- 帮助长会话维持连续性
- 在上下文窗口有限时保留关键信息

## 3. memory 是用户体验个性化的一部分

typed memory 中的 `user / feedback / project / reference` 四类，天然对应：

- 用户画像
- 协作偏好
- 当前项目背景
- 外部资源线索

这说明 memory 不是单纯摘要，而是产品层的长期个性化基础设施。

## 五、有没有自我评测？有，但更像“评估基础设施”而不是单一 eval 模块

## 1. Analytics 与 telemetry 是评测基础设施

`src/services/analytics/index.ts` 很值得注意：

- 它被刻意设计成低依赖，避免 import cycle
- sink 可以晚 attach
- 早期事件会先入队
- metadata 被强约束，避免意外记录代码/路径等敏感信息

这意味着团队不是“先做功能，后面再想监控”，而是把观测能力当成基础设施。

对于 harness engineering 来说，这非常关键，因为没有稳定遥测，就没有可靠评测。

## 2. compact / recovery 自带可测性

`src/services/compact/autoCompact.ts` 中有很多工程化细节：

- 明确的 token threshold
- warning / error / blocking limit
- consecutive failure circuit breaker
- env override 方便测试
- 与 reactive compact / context collapse 的联动

这说明这套系统本身就是可调、可试验、可观察的，而不是写死逻辑。

## 3. feature gates + dynamic config = 渐进实验平台

无论 session memory、skill improvement，还是其他特性，都大量依赖 gate 与 config。

这说明很多能力是：

- 先 gated
- 再 rollout
- 再根据观测逐步调整

这本质上就是 agent 系统里的线上实验基础设施。

## 六、有没有自我修复？有，而且是 runtime 级的

## 1. query loop 的恢复机制

在 `src/query.ts` 里可以看到：

- `max_output_tokens` 恢复
- auto compact / reactive compact
- tool result budget 管理
- stop hook 介入

这些都属于执行层面的自修复。

这里最重要的判断是：

> 它不是“模型自己想到修复”，而是 harness 保证可以恢复。

这是非常关键的 distinction：

- LLM 层的临场修复不稳定
- runtime 层的恢复机制更可信、更可测

## 2. session memory / durable memory 也是一种认知修复

长上下文系统最常见的问题之一是“忘”。

Claude Code 的 session memory、extract memories、compaction 都是在修这个问题：

- 通过摘要维持连续性
- 通过 durable memory 保留长期偏好/背景
- 通过 compact 后边界保持会话可继续

这是一种“认知连续性修复”。

## 七、有没有“自我进化”？谨慎地说：有局部进化机制

## 1. `src/utils/hooks/skillImprovement.ts` 是最明显的证据

这个文件特别值得看，因为它已经不是单纯记录，而是在做：

- 检测最近几轮消息中用户对 skill 的偏好/纠正
- 抽取潜在 skill update
- 把建议写入 app state
- 在某路径下自动改写 skill 文件

这非常接近“系统根据交互反馈改进自己的工作流定义”。

### 但它仍然是严格受限的

- 只在特定 gate 下开启
- 目标是 project skill 这种边界明确的对象
- 有批量阈值（每 `TURN_BATCH_SIZE` 轮才分析一次）
- 改的是 skill file，不是任意系统代码

这是一种 **局部、可控、可解释的自进化**。

## 2. stop hook / post-sampling hook 架构给自改进留下了插槽

从 `src/utils/hooks/postSamplingHooks.ts` 和 `src/query/stopHooks.ts` 看：

- 模型输出后可以跑额外分析
- turn 结束后可以跑额外 side effects
- 这些都拿得到完整上下文对象

这意味着系统架构上已经为“反思型子流程”留好了插槽。

这类插槽未来可以承载：

- 记忆提取
- 总结提炼
- skill 改进
- 评分类器
- 失败原因分析

也就是说，Claude Code 当前已展现出**自改进架构能力**，即便不是所有能力都 fully on。

## 八、从这套设计能学到什么

## 1. 把“反思”放到 side-channel，不要污染主线程

memory extraction、session memory、skill improvement 都不是主任务里硬塞进去的，而是：

- post-turn 触发
- forked agent 执行
- 工具权限缩小
- 尽量复用 prompt cache

这是非常成熟的工程化方式。

## 2. memory、summary、compact、eval 不能混成一团

至少要区分：

- prompt 内即时上下文
- session memory
- durable memory
- compact / context collapse
- telemetry / evaluation
- UI / runtime state

如果把这些混在一起，系统会很快失控。

## 3. 自我改进只能在狭窄边界内先做起来

Claude Code 没有直接“让 agent 自动改任何东西”，而是先从：

- skill definition
- session summary
- durable memory
- compact / recovery 策略

这些边界清楚的对象开始。这是非常对的路线。

## 4. 没有 telemetry，就谈不上 agent 改进

无论是 feature gate 还是 compact config，背后都默认依赖足够的可观测性。没有这个基础，所谓自改进很容易变成盲改。

## 九、本章与后续章节的关系

为了避免术语和职责混乱，需要明确本章边界。

## 1. 本章不是 memory 总索引章

memory、compact、context distinction 的更完整区分，应以后面的：

- `17-memory-system-and-persistence.md`
- `24-compact-context-collapse-and-recovery-boundary.md`
- `29-glossary-and-core-distinctions.md`

为主。

## 2. 本章不是 hooks / side-channel 深挖章

更细的 hook 与 side-channel 运行时分析，应以后面的：

- `15-hooks-and-side-channels-deep-dive.md`
- `19-recovery-and-error-handling-deep-dive.md`

为主。

## 3. 本章不是最终综合章

长期协作 runtime 中 memory / evaluation / self-improvement 的最终综合理解，应以后面的：

- `27-runtime-architecture-map.md`
- `30-runtime-synthesis-and-design-principles.md`

为主。

## 十、Harness 视角

从 harness engineering 的角度看，这一章最重要的价值，不是证明 Claude Code “很智能”，而是训练下面这种判断：

- 哪些认知工作应该留在主路径
- 哪些应该移到受控 side-channel
- 哪些写回面必须收窄
- 哪些改进必须依赖遥测与 gate
- memory、evaluation、self-improvement 为什么首先是边界工程问题

Claude Code 在这些问题上给出的答案，比很多泛泛而谈的“agent 自进化”讨论更有工程价值。

## 十一、工程化启发

这一章最值得带走的工程经验是：

## 1. 不要把 memory 理解成聊天记录增强

真正成熟的 memory 系统，一定会区分 durable、session、summary、retrieval、compact 等不同层次。

## 2. 不要把自我改进理解成无限自治

更现实也更安全的做法，是先做：

- 有边界的写回面
- 有 gate 的启用方式
- 有观测支撑的渐进 rollout
- 有 side-channel 隔离的反思流程

## 3. 长期协作能力本质上是基础设施问题

Claude Code 的启发不是“加一个更聪明的 prompt”，而是：

- 建立 memory infra
- 建立 evaluation infra
- 建立 recovery infra
- 建立 controlled improvement infra

## 本章小结

如果把这一章压缩成一句话，可以说：

> Claude Code 在 memory、评测与自我改进上最值得学习的，不是某种神奇自治能力，而是它如何把认知连续性、运行时观测、局部改进与受限写回做成一套可治理、可隔离、可渐进演化的长期协作基础设施。

如果你接下来想继续顺着这条线读，最稳妥的下一步通常是：

- 想看 memory 本体：去 `17 / 20 / 24`
- 想看 hooks / side-channel：去 `15 / 19`
- 想看 tasks / subagents / 长时间工作：去 `25 / 26`
- 想回到总图与综合：去 `27 / 30`

## 源码证据索引

- `src/memdir/memdir.ts` — durable memory 目录、typed memory 与索引边界
- `src/services/extractMemories/extractMemories.ts` — post-turn durable memory 提取 side-channel
- `src/services/SessionMemory/sessionMemory.ts` — session memory 与工作记忆层
- `src/services/compact/sessionMemoryCompact.ts` — session memory compact 路径
- `src/services/compact/autoCompact.ts` — 自动 compact、阈值与恢复边界
- `src/utils/hooks/postSamplingHooks.ts` — post-sampling side-channel 插槽
- `src/query/stopHooks.ts` — stop hook 执行面
- `src/utils/hooks/skillImprovement.ts` — 项目 skill 改进检测与受限自动改写
- `src/services/analytics/index.ts` — telemetry / observability 基础设施
- `src/query.ts` — runtime recovery、budget、stop-hook integration

## 相关章节

- [第 15 章：hooks 与 side-channels 深挖](/claude-code-architecture/15-hooks-and-side-channels-deep-dive/)
- [第 17 章：memory system and persistence](/claude-code-architecture/17-memory-system-and-persistence/)
- [第 19 章：recovery 与错误处理深挖](/claude-code-architecture/19-recovery-and-error-handling-deep-dive/)
- [第 20 章：message / context assembly 深挖](/claude-code-architecture/20-message-and-context-assembly-deep-dive/)
- [第 24 章：compact、context collapse 与 recovery boundary](/claude-code-architecture/24-compact-context-collapse-and-recovery-boundary/)
- [第 25 章：tasks、scheduling 与 background execution](/claude-code-architecture/25-tasks-scheduling-and-background-execution/)
- [第 26 章：subagents、parallel exploration 与 isolation](/claude-code-architecture/26-subagents-parallel-exploration-and-isolation/)
- [第 27 章：Runtime Architecture Map](/claude-code-architecture/27-runtime-architecture-map/)
- [第 29 章：Glossary and Core Distinctions](/claude-code-architecture/29-glossary-and-core-distinctions/)
- [第 30 章：Runtime Synthesis and Design Principles](/claude-code-architecture/30-runtime-synthesis-and-design-principles/)

{% include claude-code-architecture-nav.html %}
