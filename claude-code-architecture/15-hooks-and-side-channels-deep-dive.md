---
layout: page
title: "15 Hooks 与 Side-Channels 深挖"
permalink: /claude-code-architecture/15-hooks-and-side-channels-deep-dive/
book_key: hooks-and-side-channels-deep-dive
book_number: "15"
toc: true
---

## 本章目标

这一章聚焦 Claude Code 运行时里的 hooks 与 side-channels，尽量沿着源码链路回答几个更具体的问题：

1. Claude Code 里实际存在哪些 hook / side-channel 机制？
2. post-sampling hooks、stop hooks、prefetch、skill improvement 分别挂在什么位置？
3. 它们哪些属于主路径，哪些属于 turn 结束时的收口点，哪些属于旁路分析？
4. 这些机制的设计边界在哪里，和前两章怎么分工？

这里的重点不是把 hooks 理解成“插件接口”，而是把它们放回 agent runtime 的执行流里看：它们是如何在一次 turn 的推进、收尾和旁路分析中被组织起来的。

## 一、先给出总体判断

如果只基于当前源码做判断，我会把 Claude Code 的 hooks 与 side-channels 概括成：

> 一组挂接在 query runtime 不同阶段的运行时机制：有的在主路径上异步预取上下文，有的在 sampling 完成后做旁路分析，有的在 turn 结束处统一收口执行；它们共同服务于主循环，但并不等于主循环本身。

更具体地说：

- `prefetch` 更像主路径周边的并行预取机制
- `post-sampling hooks` 是 assistant 产出完成后的旁路分析插槽
- `stop hooks` 是没有 follow-up 时的 turn 尾部收口点
- `skillImprovement` 是挂在 post-sampling hook 上的一种受限 side-channel，而不是独立主路径

这也意味着一个重要判断：

- Claude Code 确实把 hooks/side-channels 做成了 runtime 机制
- 但它没有把这些旁路能力混同为“任意时刻都可改写主循环”的插件系统

## 二、先把几类机制分开

先按源码中的附着位置区分，能得到一个比较稳定的分类。

## 1. prefetch：在 turn 内并行启动、在后续节点择机消费

`src/query.ts` 在进入循环后会启动：

- `startRelevantMemoryPrefetch(...)`
- `skillPrefetch?.startSkillDiscoveryPrefetch(...)`

其中 memory prefetch 的注释写得很直接：它是 “started once per user turn and runs while the main model streams and tools execute”，并且在 collect point 上“consume-if-ready or skip-and-retry-next-iteration — the prefetch never blocks the turn”。

这说明 prefetch 的关键特征是：

- 启动点在 turn 主流程里
- 执行时机与主模型 streaming / tools 并行
- 收集点仍由主循环控制
- 设计目标是隐藏等待，而不是改变主循环所有权

所以它不是独立 hook 框架，更像 runtime 内建的旁路预取。

## 2. post-sampling hooks：sampling 结束后的统一分析插槽

`src/utils/hooks/postSamplingHooks.ts` 定义了一个很窄的接口：

- `registerPostSamplingHook(hook)`
- `executePostSamplingHooks(...)`

其注释直接说明：

- “called after model sampling completes”
- “not exposed in settings.json config (yet), only used programmatically”

而 `src/query.ts` 中的调用位置也很清楚：当 `assistantMessages.length > 0` 时，在模型响应完成后执行：

- `void executePostSamplingHooks([...messagesForQuery, ...assistantMessages], ...)`

这里有几个边界值得强调：

- 它发生在 assistant 响应已经形成之后
- 它是 fire-and-forget，不阻塞后续主流程判断
- 它拿到的是完整上下文对象 `REPLHookContext`
- 但 hook 报错只会被记录，不会让主 turn 失败

因此 post-sampling hook 更像一个“采样后分析插槽”，不是主路径控制器。

## 3. stop hooks：turn 结束前的统一收口阶段

`src/query.ts` 在 `!needsFollowUp` 时进入：

- `handleStopHooks(...)`

而 `src/query/stopHooks.ts` 把这个阶段组织得很明确：先构造 `stopHookContext`，然后集中处理一批 turn 结束后动作，包括：

- 保存 cache-safe params
- 模板 job classification
- prompt suggestion
- extract memories
- auto dream
- computer use cleanup
- stop hooks / teammate hooks / task completed hooks

其中真正的 stop hooks 通过 `executeStopHooks(...)` 执行，还会处理：

- progress message
- blocking error
- preventContinuation
- stop hook summary message

这说明 stop hooks 不是“任意时刻可插入”的分析器，而是一个明确的 turn epilogue 阶段。

## 4. skill improvement：挂在 post-sampling hook 上的受限分析/改写链路

`src/utils/hooks/skillImprovement.ts` 通过：

- `registerPostSamplingHook(createSkillImprovementHook())`

把自己注册进 post-sampling hook 注册表。

所以从附着位置上看，skill improvement 不是 stop hook，也不是 prefetch，而是：

- sampling 完成后运行的 side-channel hook
- 使用小模型分析最近交互
- 把结果写入 app state 供后续 UI/用户确认
- 另有单独的 apply 路径去改写 project skill 文件

这一点和第 14 章的 skills 系统边界有关：这里讨论的是它“怎么挂进 runtime”，不是重讲 skills 的数据模型与 frontmatter。

## 三、这些机制分别挂在哪里

## 1. prefetch 挂在 query loop 的前段与后段之间

`src/query.ts` 显示，memory prefetch 在进入 `while (true)` 之前就启动，一次 user turn 只起一次；skill discovery prefetch 则是 per-iteration 启动。

从代码注释能得到两个重要判断：

- 它们都刻意把工作隐藏在模型 streaming 与工具执行期间
- collect point 在 post-tools 阶段，而不是启动后立刻等待

因此 prefetch 的附着方式是：

- 启动在主循环早段
- 消费在主循环后段
- 生命周期受 turn abort 与 query 退出统一管理

memory prefetch 甚至实现了 `[Symbol.dispose]()`，由 `query.ts` 用 `using` 绑定，以便在各种退出路径上统一 abort 与记录 telemetry。这个设计进一步说明，它是 runtime 内建旁路，而不是松散的外部后台任务。

## 2. post-sampling hooks 挂在 assistant response 完成之后、stop hooks 之前

`query.ts` 里相关顺序很清楚：

1. 模型 streaming 完成并形成 `assistantMessages`
2. 若有 assistant 输出，则 `void executePostSamplingHooks(...)`
3. 然后继续处理 abort、tool result、recovery、needsFollowUp、stop hooks

所以 post-sampling hooks 的位置可以概括为：

- 晚于 sampling
- 早于 turn 最终收口
- 不等待工具后的 stop 阶段才开始
- 也不接管主循环的继续/停止判定

这也是它和 stop hooks 最核心的区别之一。

## 3. stop hooks 挂在“本轮不再继续”这一分支上

`query.ts` 只有在 `!needsFollowUp` 时才进入 `handleStopHooks(...)`。也就是说，stop hooks 的前提不是“assistant 有输出”，而是：

- 本轮已经不需要继续 tool follow-up
- 也没有被 API error 分支提前返回

另外，源码还专门在 API error 场景跳过 stop hooks，理由写得很明确：

- 模型没有产生真实响应
- 否则会形成 error → hook blocking → retry → error 的死循环

这说明 stop hooks 虽然是 turn 尾部收口点，但仍然受主路径状态机严格约束，并不是无条件执行。

## 4. skill improvement 挂在 post-sampling registry，而不是 query 主干判断里

`initSkillImprovement()` 做的事情非常简单：在 feature flag 与 GrowthBook gate 都满足时注册一个 post-sampling hook。

因此它的附着点不是：

- `query.ts` 中的专门分支
- `stopHooks.ts` 中的尾部收口
- skills 加载链路本身

而是 post-sampling hook registry。

这说明 skill improvement 在架构上属于：

- 被动附着于运行时的分析器
- 不是 query runtime 的直接调度骨架

## 四、主路径、收口点与 side-channel 的角色区分

## 1. prefetch 贴近主路径，但不是主路径决策器

prefetch 最容易被误解成“后台功能”。实际上它和主路径耦合很深：

- 由 `query.ts` 显式启动
- 由 turn-level abort 直接取消
- 由主循环决定何时 collect
- 其结果会作为 attachment 注入后续上下文

但它依然不是主路径决策器，因为：

- 它不决定 loop 是否继续
- collect point 不会为了它阻塞 turn
- 没有它，主循环仍然能推进

所以更准确的说法是：

> prefetch 属于主路径旁的并行增益机制，不属于主状态转移本身。

## 2. stop hooks 是 end-of-turn collection point

从 `handleStopHooks(...)` 的内容来看，它的职责不是继续主循环，而是把 turn 结束时要做的后处理统一收口。

这一层里既有真正的 hook 执行，也有其他尾部 bookkeeping。它们的共同点是：

- 都以本轮 `messagesForQuery + assistantMessages` 为输入
- 都发生在主任务已经到达一个自然停止点之后
- 其中一部分可以反向生成 blocking error，要求主循环再来一轮

因此 stop hooks 既不是纯旁路，也不是完整主路径；更贴切的定位是：

- turn 结束阶段的 collection / enforcement point

## 3. post-sampling hooks 是 side-channel analysis point

`executePostSamplingHooks(...)` 的实现非常保守：

- 顺序执行已注册 hook
- 错误只记录，不中断主流程
- API 暂未暴露到 settings

这些特征共同说明，post-sampling hooks 当前更偏向：

- 内部分析插槽
- 辅助 runtime 的旁路观测或提炼
- 而不是产品化的强控制面

## 4. skill improvement 是 side-channel 中的一个受限实例

第 14 章已经说明，`skillImprovement` 是 gated、限频、限 querySource、限 project skill 范围的。

在本章语境下，最重要的是把它放回 taxonomy：

- 它不是通用 self-modification 框架
- 它不是 skills 系统的主执行路径
- 它是 post-sampling side-channel 的一个具体挂件

同理，memory extraction 在本章里也只应被视作 stop hook 阶段触发的 side-channel 例子之一，而不是单独展开的 memory 体系。本仓库中关于 memory retrieval / extraction / persistence 的系统性分析，应留给第 17 章。

## 五、源码链路下的几个关键观察

## 1. hooks 的上下文对象是统一的 REPLHookContext

无论是 post-sampling hooks 还是 stop hooks，源码都复用了 `REPLHookContext`，其内容包括：

- `messages`
- `systemPrompt`
- `userContext`
- `systemContext`
- `toolUseContext`
- `querySource`

这说明 hooks 的设计不是“拿一段文本做分析”，而是拿到足以理解 turn 运行态的结构化上下文。

## 2. post-sampling hooks 的错误不会升级为 turn 失败

`postSamplingHooks.ts` 中对每个 hook 都是 try/catch，失败只 `logError`。

因此从源码能得出的倾向性结论是：

- post-sampling hook 被视为可失败的辅助分析
- 不是必须成功的主任务步骤

## 3. stop hooks 允许阻塞与阻止继续

与之相对，`handleStopHooks(...)` 会显式收集：

- `blockingErrors`
- `preventContinuation`

并把这些结果回传给主循环，让 `query.ts` 决定：

- 直接结束
- 还是把 blocking error 重新注入 message state 后继续下一轮

这说明 stop hooks 虽然属于 turn 尾部，但其结果可以反馈回主状态机，因此它比 post-sampling hooks 更“硬”。

## 4. prefetch 的边界是“可注入上下文”，不是“直接改写当前决策”

从 memory prefetch 的注释与使用位置看，它最终产物是 attachment。也就是说，它做的是：

- 预取可能相关的上下文
- 在合适时机注入给后续模型轮次

而不是直接改变本次 streaming 中已经做出的模型判断。

这种边界很重要，因为它让 side-channel 结果仍然通过主 prompt/message 体系进入主路径，而不是在外部悄悄篡改决策。

## 六、和已有文档的边界

## 1. 与第 13 章的边界

第 13 章讨论的是 agent loop 的主状态机：

- `QueryEngine` 与 `query()` 的分工
- assistant -> tool -> tool_result -> continue 的推进
- compact / recovery / queued commands / prefetch / stop hooks 怎样挂进 loop

本章不再重复整个 loop 结构，而是进一步拆分：

- 哪些机制算 hook，哪些更像 side-channel
- 它们具体附着在 runtime 的哪个阶段
- 哪些是 main-path-adjacent，哪些是 end-of-turn collection point，哪些是 analysis side-channel

所以本章可以看作是对第 13 章中 hooks/prefetch/尾部机制那一部分的专题展开。

## 2. 与第 14 章的边界

第 14 章讨论的是 skills 系统本身：

- skills 的数据模型
- 加载来源
- frontmatter 字段
- skills 与 command / tool / plugin 的边界
- `skillImprovement` 在 skills 体系里代表什么程度的受控改写

本章只讨论 `skillImprovement` 作为 hook / side-channel 机制是怎样接入 runtime 的：

- 它注册到 post-sampling hooks
- 它为什么属于旁路分析
- 它为什么不应被视为独立主路径

因此这里不会重复 skills 的完整系统分析。

## 1. 主循环与旁路能力被刻意分层

Claude Code 没有把所有增强能力都塞进一次模型调用里，而是把它们分散到：

- turn 内并行 prefetch
- sampling 后分析
- turn 尾部收口

这让 runtime 能同时获得：

- 主路径的可控性
- 辅助分析的灵活性
- 收尾阶段的统一治理点

## 2. 旁路机制必须有明确的 fail-open 边界

post-sampling hooks 出错只记录日志，prefetch 也允许“没赶上这轮就下轮再说”。这种设计说明系统默认接受：

- side-channel 可能失败
- 但主任务不应因此整体失效

这对 agent harness 很重要，因为旁路能力越多，越需要限制它们对主路径稳定性的侵入。

## 3. 真正会反馈进主状态机的点必须收紧

stop hooks 与 post-sampling hooks 的差别，本质上就是“是否允许结构化反馈到主循环”。

在当前实现里：

- post-sampling hook 基本只是分析与记录
- stop hooks 才能返回 blocking / preventContinuation 之类更强的控制信号

这是一种比较清楚的控制面分级。

## 4. side-channel 的写入面被刻意做窄

skill improvement 只针对 project skill 文件；memory extraction 也不是任意改写系统核心。即使存在“从交互中提炼并写回”的能力，源码仍然体现出很强的写入面约束。

这说明 Claude Code 的思路更像：

- 先把 side-channel 用在边界清楚、可解释、可回滚的对象上
- 而不是把它升级成对核心 runtime 的泛化自改写能力

## 1. 不要把 hooks 只理解成插件 API

从这个仓库看，hooks 的核心价值不在“开放给第三方”，而在：

- 为 runtime 提供阶段化附着点
- 让主路径之外的分析、治理、提炼有规范的落点

这比单纯的插件机制更接近 agent runtime 的真实需求。

## 2. side-channel 最好按阶段切开

Claude Code 至少区分了三类时机：

- sampling 期间隐藏延迟的 prefetch
- sampling 后立即分析的 post-sampling
- turn 结束统一收口的 stop hooks

这比把所有旁路逻辑都塞进一个“after response”回调里更清晰，也更容易控制副作用。

## 3. 主路径稳定性应优先于旁路完整性

从 prefetch 的 non-blocking、post-sampling 的 fail-open、stop hooks 对 API error 的跳过可以看出，这套设计反复强调的一点是：

- 不要让 side-channel 轻易把主循环拖入死锁、死循环或大面积失败

这是一种很典型的工程化 runtime 思维。

## 4. 需要把“可分析”与“可执法”分开

post-sampling hooks 偏分析，stop hooks 才有更强 enforcement 能力。这种区分很值得借鉴，因为很多系统一旦把“分析结果”直接接到“阻断/改写”上，复杂度会迅速失控。

## 本章小结

如果把这一章压缩成一句话，就是：

> Claude Code 的 hooks 与 side-channels 不是松散插件，而是挂接在 query runtime 不同阶段的运行时机制：prefetch 负责并行预取，post-sampling hooks 负责采样后旁路分析，stop hooks 负责 turn 尾部收口与有限反馈，skill improvement 则是其中一个受限的 side-channel 实例。

也正因为这些机制被清楚地区分为主路径邻接、turn 收口和旁路分析三类，Claude Code 才能在增强能力不断叠加的同时，仍然保持 agent loop 的主状态机边界相对清晰。

## 源码证据索引

- `src/query.ts` — prefetch 启动、post-sampling hook 调用、stop hook 进入条件
- `src/utils/hooks/postSamplingHooks.ts` — post-sampling hooks 注册与执行语义
- `src/query/stopHooks.ts` — turn 尾部收口、blocking / preventContinuation 反馈
- `src/utils/hooks/skillImprovement.ts` — skill improvement 作为受限 side-channel 的接入点

## 相关章节

- [第 13 章：agent loop 深挖](/claude-code-architecture/13-agent-loop-deep-dive/)
- [第 14 章：skills system 深挖](/claude-code-architecture/14-skills-system-deep-dive/)
- [第 17 章：memory system and persistence](/claude-code-architecture/17-memory-system-and-persistence/)
- [第 19 章：recovery and error handling](/claude-code-architecture/19-recovery-and-error-handling-deep-dive/)
- [第 27 章：总体运行时架构图](/claude-code-architecture/27-runtime-architecture-map/)

{% include claude-code-architecture-nav.html %}
