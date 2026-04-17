---
layout: page
title: "16 工具编排与并发执行"
permalink: /claude-code-architecture/16-tool-orchestration-and-concurrency/
book_key: tool-orchestration-and-concurrency
book_number: "16"
toc: true
---

# Claude Code 仓库架构研究：16 工具编排与并发执行

## 本章目标

这一章只聚焦 Claude Code 里的工具执行子系统，回答下面几个更窄、也更工程化的问题：

1. 多个 tool call 到来之后，系统是怎样切分批次并决定串行或并发的？
2. `runTools(...)` 和 `StreamingToolExecutor` 各自负责什么，二者是什么关系？
3. 并发安全、结果顺序、取消传播、以及 Bash 兄弟任务取消是怎样实现的？
4. 为什么这套机制不能被简单概括成“把命令并行跑起来”？

这里有一个明确边界：

- 本章讨论的是 **tool execution subsystem 本身**；
- 不重新展开整个 query loop；
- 不重复介绍 QueryEngine 如何组织一整轮对话。

因此，本文会尽量把“代码结构在做什么”和“这些结构实际提供了什么语义保证”分开写清楚。

## 一、先给出总体判断

如果只基于当前源码做判断，我会把 Claude Code 的工具编排概括成：

> 一个以工具语义为分批依据、支持流式接入与受控并发、显式处理顺序与取消、并把部分错误提升为跨兄弟任务联动取消的执行子系统。

它的关键点不在于“支持并发”，而在于以下四层同时成立：

1. **批次划分不是静态的**，而是按工具定义的 `isConcurrencySafe(input)` 决定。
2. **执行模式有两套**：普通批处理的 `runTools(...)`，以及流式到达时边接收边调度的 `StreamingToolExecutor`。
3. **结果顺序与上下文更新被单独治理**，不是谁先跑完谁就任意插入。
4. **取消策略带有工具语义**，尤其 Bash 错误会触发兄弟任务取消，而一般读类工具失败不会。

所以，更准确的说法不是“Claude Code 会并行调用工具”，而是：

> Claude Code 为工具执行建立了一层带语义约束的 orchestrator，用来控制何时能并发、并发后怎样保持顺序、以及什么错误应该扩散为批次级取消。

## 二、入口位置：工具执行如何接进主循环

从 `src/query.ts` 可以看到，tool execution 是在 assistant streaming 期间和之后接进来的，但本章只抽取和工具子系统直接相关的部分。

### 1. 继续条件来自实际 `tool_use` block

源码里有一段非常关键的注释：

- `stop_reason === 'tool_use' is unreliable`
- 真正决定是否继续的，是 streaming 过程中有没有收到 `tool_use` block

这件事对工具子系统很重要，因为它说明工具编排不是围绕某个高层状态字段工作，而是围绕已经到达的消息结构工作。也就是说，调度器接收的是一组明确的 `ToolUseBlock`，而不是一个抽象的“也许该跑工具了”的信号。

### 2. 存在两条执行路径

在 `src/query.ts` 中，运行工具时有一个清楚分叉：

- 如果启用了 streaming tool execution，就使用 `StreamingToolExecutor`
- 否则调用 `runTools(toolUseBlocks, assistantMessages, canUseTool, toolUseContext)`

这说明 Claude Code 没有把“工具执行”写成单一函数，而是根据 assistant 输出是否需要边流式接收边启动工具，选择不同实现。

### 3. 流式模式下，工具会在 assistant 还没完全结束时进入队列

在 assistant message 流中，一旦发现 `tool_use` blocks，`query.ts` 会立刻：

- 把它们加入 `toolUseBlocks`
- 设 `needsFollowUp = true`
- 调用 `streamingToolExecutor.addTool(toolBlock, message)`

随后又会周期性从 `streamingToolExecutor.getCompletedResults()` 中取出已经完成的结果并立即向外 yield。

结构上看，这是“边接收 assistant，边启动部分工具，边发出已完成结果”。

语义上看，这带来的不是单纯的吞吐提升，而是：

- 工具可以尽早开跑；
- progress message 可以尽早反馈给 UI；
- 但最终 tool result 仍然处在一个受控的顺序框架中，而不是完全无序地插回对话。

## 三、`runTools(...)`：普通批处理路径在做什么

`src/services/tools/toolOrchestration.ts` 是最直接说明“批次怎么切”的文件。

### 1. 结构上，它先做分批，再执行每个批次

`runTools(...)` 的骨架很清楚：

1. 先调用 `partitionToolCalls(...)`
2. 对返回的每个 batch 依次处理
3. 若 batch `isConcurrencySafe` 为真，则走并发执行
4. 否则按单工具串行执行

这意味着它不是“对所有工具统一应用一个并发策略”，而是：

- **批次之间串行**
- **批次内部按是否并发安全决定串行或并发**

### 2. `partitionToolCalls(...)` 的切分规则非常保守

源码注释已经写明，一个 batch 只会是两种形态之一：

1. 单个非并发安全工具
2. 多个连续的并发安全工具

具体判断方式是：

- 先根据工具名找到 tool definition
- 再用 `inputSchema.safeParse(toolUse.input)` 解析输入
- 如果解析成功，就调用 `tool.isConcurrencySafe(parsedInput.data)`
- 一旦解析失败，或者 `isConcurrencySafe(...)` 自己抛错，都按 `false` 处理

这里最值得强调的不是“有个布尔值”，而是它体现了非常明确的保守策略：

- 工具不存在，不并发
- 输入不合法，不并发
- 并发安全判断过程出错，不并发

结构上，这是一条简单的 fallback 逻辑。

语义上，这表示系统把“能否并发”看成一种需要证明的属性，而不是默认开启的优化。

### 3. 并发安全是按输入判定，而不是按工具类型静态判定

`isConcurrencySafe(input)` 的调用形式说明，并发安全不是只看工具名，也不是只看“这是读工具还是写工具”的粗分类，而是允许工具根据本次输入动态决定。

这点很关键。

它意味着：

- 同一个工具，面对不同输入，可以给出不同并发性结论；
- orchestration 层不自己猜测语义，而是把判断权交给工具定义；
- 调度器只是消费一个“本次调用是否可并发”的语义接口。

### 4. 批次顺序保留了 assistant 产生 `tool_use` 的原始相对顺序

`partitionToolCalls(...)` 是对 `toolUseMessages` 做一次线性 reduce，遇到连续并发安全工具才合并，否则新开 batch。

因此结构上它不会重排 assistant 产生的工具序列。

这带来的语义保证是：

- 调度器不会把后出现的独占工具提前到前面；
- 也不会把原本被独占工具隔开的两段并发工具强行合并；
- assistant 输出的工具序列，仍然是总调度顺序的基础骨架。

## 四、`runTools(...)` 里的串行与并发，分别保证了什么

### 1. 串行路径：上下文修改立即生效

`runToolsSerially(...)` 对每个工具逐个调用 `runToolUse(...)`。在每个工具的执行流中，只要出现 `contextModifier`，就立即：

- 更新 `currentContext`
- 把新 context 继续传给后续工具

结构上，这是标准的串行状态推进。

语义上，这说明独占批次不仅是“一个个跑”，更是“后一个工具看到前一个工具完成后的上下文”。这对会修改执行上下文的工具尤其重要。

### 2. 并发路径：结果可以并发产生，但上下文修改不会并发写入

`runToolsConcurrently(...)` 使用 `all(...)` 同时消费多个 `runToolUse(...)` 生成器，并受 `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` 控制，默认上限为 10。

但 `runTools(...)` 外层对并发批次做了一个额外处理：

- 执行期间先把各工具产生的 `contextModifier` 暂存到 `queuedContextModifiers[toolUseID]`
- 等并发批次全部跑完后
- 再按照原始 `blocks` 顺序回放这些 modifier，顺序更新 `currentContext`

结构上，这是一种“并发收集，顺序提交”的模式。

语义上，它提供了两个重要效果：

1. 并发工具不会在运行时竞争写同一个 context。
2. 即便并发执行，context 的可见更新顺序仍然与 assistant 发出工具的顺序一致。

这正是“代码结构”和“语义保证”需要分开看的地方：

- 结构上，工具在同时跑；
- 语义上，context 更新没有变成无序竞争，而是被序列化提交。

### 3. `setInProgressToolUseIDs` 说明调度器还维护运行中集合

无论串行还是并发路径，工具启动前都会把当前 `toolUse.id` 加进 in-progress 集合，完成后再移除。

这件事本身不是调度算法核心，但它说明工具编排并不只是“调用函数并拿结果”，还会同步维护运行中状态，供 UI 或外层控制面感知。

因此，这个子系统兼顾了两件事：

- 实际执行工具
- 维护对外可观察的执行状态

## 五、`StreamingToolExecutor`：为什么需要第二套执行器

`src/services/tools/StreamingToolExecutor.ts` 代表的不是 `runTools(...)` 的简单重写，而是另一类问题的处理器：当 `tool_use` block 还在 streaming 过程中逐个到达时，系统怎样边收边调度。

### 1. 它维护的是一个显式队列状态机

`StreamingToolExecutor` 为每个工具维护 `TrackedTool`，字段包括：

- `queued`
- `executing`
- `completed`
- `yielded`
- `pendingProgress`
- `results`
- `contextModifiers`
- `isConcurrencySafe`

结构上看，它不是“把工具 Promise 存起来”，而是建立了一套带状态标签的队列模型。

语义上，这意味着它要同时解决三类问题：

1. 哪些工具现在可以启动；
2. 哪些结果虽然完成了，但暂时不能发；
3. 哪些 progress 应该立即透传，而哪些 final result 要等到顺序允许时再发。

### 2. `addTool(...)` 的职责是接收流式到达的工具，并立刻尝试调度

当新的 `tool_use` block 到来时，执行器会：

- 查找工具定义
- 解析输入
- 计算 `isConcurrencySafe`
- 把工具记为 `queued`
- 调用 `processQueue()`

如果工具本身不存在，则不会进入真正执行，而是直接生成一个错误型 `tool_result`。

这说明 streaming 模式下，执行器本身已经吸收了一部分“工具解析失败”的收口逻辑，而不是把所有异常都甩给更外层。

### 3. `canExecuteTool(...)` 把并发条件写成了显式规则

判断标准是：

- 当前没有执行中的工具，则可以启动；
- 或者当前执行中的所有工具都并发安全，并且新工具也并发安全，则可以加入并行执行。

这就形成了一个很清楚的执行语义：

- 只要队列里出现独占工具，它就要求执行窗口清空后单独运行；
- 并发安全工具只能和同类一起并发；
- 执行器不会为了追求吞吐，把独占工具和并发工具混跑。

### 4. `processQueue()` 还承担了“遇到独占工具就停住后续扫描”的职责

`processQueue()` 会按工具进入顺序扫描队列。对于一个 `queued` 工具：

- 如果当前条件允许，就启动它；
- 如果不允许，而且它是非并发安全工具，就直接 `break`

结构上，这看起来只是一个简单分支。

语义上，这意味着顺序约束是硬性的：

- 一个前面的独占工具尚未获得执行窗口时，后面的工具不会为了“先跑起来”而越过它。

因此，`StreamingToolExecutor` 不是一个纯吞吐优先的 work-stealing 调度器，而是一个保持顺序屏障的受限执行器。

## 六、顺序控制：并发执行并不等于无序发射结果

这是整个子系统最容易被误读的地方。

### 1. 普通路径里，并发批次的消息可以先 yield，但 context 提交是有序的

在 `runTools(...)` 中，并发批次内部由 `all(...)` 驱动，各工具产生的消息会随着执行进展被向外 yield；但 context modifier 会延后到批次结束后，按原始工具顺序统一提交。

这意味着：

- 消息流的到达顺序可以体现并发性；
- 但影响后续工具语义的共享 context，不会因并发完成顺序而被乱序写入。

### 2. Streaming 路径里，progress 和 final result 被区别对待

`StreamingToolExecutor` 的 `getCompletedResults()` 有一个非常明确的策略：

- `pendingProgress` 总是尽快 yield
- final `results` 只有在该工具进入 `completed` 且满足顺序条件时才发出
- 一旦发出，状态从 `completed` 变成 `yielded`

因此结构上，progress 和 final result 是两条不同的输出通道。

语义上，这提供了两个兼容目标：

1. UI 可以尽早看到“工具正在干什么”；
2. 对话历史中的最终 `tool_result` 仍然保持受控顺序，不会因为某个后发工具先完成就任意穿插。

### 3. 非并发安全工具会形成顺序栅栏

在 `getCompletedResults()` 中，如果扫描到一个 `executing` 且 `!isConcurrencySafe` 的工具，会直接 `break`。

这意味着独占工具不仅在执行时独占，在结果发射上也形成一个屏障：它后面的结果不会越过它发出。

这不是偶然实现细节，而是语义上的顺序保证：

- 独占工具前后的边界，在执行阶段和发射阶段都是边界。

### 4. `getRemainingResults()` 用等待策略把“完成事件”和“进度事件”统一起来

如果当前还有执行中的工具，但既没有 completed results，也没有 pending progress，那么执行器会：

- 收集所有 executing tool 的 promise
- 同时构造一个 `progressPromise`
- `Promise.race([...executingPromises, progressPromise])`

结构上，这是一个等待任一“新事件”的循环。

语义上，它让执行器既不会忙等，也不会因为只等最终完成而错过中途 progress 的及时上报。

## 七、取消与中断：为什么说这里有“语义化取消策略”

### 1. 执行器区分多种取消原因

`StreamingToolExecutor` 会把取消原因归成几类：

- `sibling_error`
- `user_interrupted`
- `streaming_fallback`

并用 `createSyntheticErrorMessage(...)` 为不同原因生成不同的 synthetic `tool_result`。

结构上，这是在工具执行器里内建了取消后的结果补全。

语义上，它有一个非常重要的作用：

- 即使工具没有自然跑完，assistant 已经发出的 `tool_use` 也尽量补上对应的 `tool_result`，避免对话轨迹残缺。

### 2. 用户中断并不是一律取消所有工具

`getAbortReason(...)` 里有一层更细的判断：

- 如果外层 abort reason 是 `interrupt`
- 只有当工具定义的 `interruptBehavior()` 返回 `cancel` 时，才把它视为 `user_interrupted`
- 否则返回 `null`

这说明“用户发来新消息”并不自动意味着所有在跑工具都要被硬切掉。

语义上，这是一条很明确的工具级中断策略：

- 有些工具可以安全取消；
- 有些工具需要阻塞式完成；
- 是否可取消，由工具定义声明，而不是由 orchestrator 粗暴决定。

### 3. `discard()` 说明 streaming fallback 不是普通失败，而是整批执行废弃

在 `query.ts` 里，如果 streaming fallback 或某些重试路径发生，会先调用：

- `streamingToolExecutor.discard()`
- 然后创建一个新的 executor

源码注释明确写到，这样做是为了防止旧尝试里的 orphan `tool_results` 带着旧的 `tool_use_id` 泄漏到后续重试中。

结构上，这是替换执行器实例。

语义上，这保证了：

- 一次失败流中的工具执行结果，不会污染下一次重试；
- `tool_use_id` 与 `tool_result` 的对应关系仍然属于同一尝试。

这显然不是“多线程并行跑命令”会自然提供的保证，而是围绕消息一致性额外设计出来的约束。

## 八、Bash 兄弟任务取消：并发中的特殊联动

这是整个工具子系统里最有代表性的语义化策略之一。

### 1. 只有 Bash 错误会触发兄弟取消

在 `executeTool()` 内部，执行器会检测每个 update 是否为 error result。如果当前出错工具是 Bash：

- `this.hasErrored = true`
- 记录 `erroredToolDescription`
- `this.siblingAbortController.abort('sibling_error')`

但注释同时明确说明：

- Bash commands 往往存在隐式依赖链
- Read / WebFetch 等通常相互独立
- 因此一个读类工具失败，不应该把其他并发工具全部掐掉

这点非常重要。

它说明错误传播不是按“任意错误都 fail-fast”处理，而是按工具语义区分：

- Bash 更像一组可能共享 shell/文件系统前置条件的操作
- 很多读工具则更像独立查询

### 2. `siblingAbortController` 是子控制器，不会直接终止整个 query turn

注释写得很清楚：

- `siblingAbortController` 是 `toolUseContext.abortController` 的 child
- 它在 Bash sibling error 时触发
- 目的是让兄弟 subprocess 立刻结束
- 但 abort 这个 child **不会**直接 abort parent，因此 query loop 不会因此整轮立刻结束

结构上，这是两级 abort controller。

语义上，这实现的是“取消兄弟工具，但不等于取消整轮 query”。这是一种比全局 abort 更细粒度的故障隔离。

### 3. 正在运行的工具会收到 synthetic error，而不是简单静默消失

一旦 `sibling_error` 生效，其他工具在 `getAbortReason(...)` 检测到后，如果自己不是最初出错者，就会生成：

- `Cancelled: parallel tool call ... errored`

对应的 synthetic `tool_result`。

这保证了两件事：

1. 并发批次中被牵连取消的工具，在消息层仍然有可见结果；
2. 模型后续看到的是“某工具因兄弟错误取消”，而不是无结果缺口。

### 4. UI 层还有与 sibling cancellation 对应的处理

`interactiveHandler.ts` 里的注释也明确提到：

- Sibling Bash error 可以经由 `StreamingToolExecutor` 级联到 `siblingAbortController`
- UI 侧要把某些纯装饰性的对话框清理掉，避免阻塞后续队列项

这说明 Bash sibling cancellation 不是孤立局部逻辑，而是从执行器一直延伸到交互层都有对应处理。

## 九、上下文一致性：为什么这套系统不只是“跑工具再收结果”

### 1. 工具结果会回流为下一轮输入

无论使用哪条执行路径，工具执行产生的 message 最终都会经过 `normalizeMessagesForAPI(...)`，把可进入 API 历史的结果收集到 `toolResults`，成为下一轮模型输入的一部分。

所以工具执行器的输出不是单纯给 UI 看的日志，而是后续 agent 推进的正式输入。

### 2. 这使得结果顺序和补全性变得非常重要

因为这些 `tool_result` 会重新喂给模型，所以系统必须处理：

- 如果发生取消，如何补 synthetic result；
- 如果 streaming fallback，如何丢弃旧批次；
- 如果并发执行，如何避免 context 更新乱序；
- 如果存在独占工具，如何维持前后边界。

也就是说，工具执行子系统并不是一个外部命令池，而是对话状态机的一部分。它输出的是下一轮推理所依赖的语义材料。

### 3. 从这个角度看，“顺序”不是 UI 偏好，而是推理一致性要求

如果 tool result 顺序随意漂移、或者部分 `tool_use` 没有对应结果、或者旧尝试的结果混入新尝试，那么受到影响的不是日志可读性，而是模型对当前世界状态的判断。

因此，本章讨论的很多机制虽然表面上是并发控制，实质上是在维护下一轮推理所需的消息一致性。

## 十、和已有文档的边界

### 1. 与第 03 章的边界

`03-query-engine-and-execution-loop.md` 讨论的是：

- `QueryEngine` 与 `query.ts` 的两级结构
- assistant / tool / compact / budget 怎样处在同一个执行循环里

本章不再重述整个循环，而是只把其中的工具执行子系统拆出来，聚焦：

- `runTools(...)`
- `partitionToolCalls(...)`
- `StreamingToolExecutor`
- 取消、顺序、并发安全这些更细部的运行语义

可以把关系理解为：

- `03` 说明“工具执行位于哪里”
- 本章说明“工具执行本身如何工作”

### 2. 与第 13 章的边界

`13-agent-loop-deep-dive.md` 关注的是 turn loop 如何推进，包括：

- `tool_use` 为什么是继续信号
- compact / recovery / hooks / memory / queued commands 如何挂入 loop

本章不展开这些外围机制，也不把工具执行重新放回完整 turn transition 中解释，而是只讨论工具执行器这一层：

- 怎样分批
- 怎样调度
- 怎样发结果
- 怎样处理中断和 sibling cancellation

因此，本章可以看成第 13 章里“工具执行”那一小段的细化版，但关注点收得更窄，也更偏执行语义本身。

### 3. 本章特别强调的区分

与前文相比，这一章会反复区分两件事：

- **代码结构**：有哪些函数、状态、队列、控制器
- **语义保证**：这些结构分别确保了什么，不确保什么

因为如果不把二者分开，很容易把“看起来用了并发”误读成“系统允许任意并发”，或者把“有序发结果”误读成“所有执行都严格串行”。

## 十一、Harness 视角

从 harness engineering 的角度，这一章最值得注意的，不是 Claude Code“支持工具调用”，而是它把工具调用提升成了一个独立的执行平面。

一个较弱的 harness，通常只会做下面这件事：

- 收到若干工具调用
- 开几个 Promise
- 等结果回来
- 填回模型

而 Claude Code 当前源码体现的是更厚的一层：

- 并发资格由工具定义给出，而不是 orchestrator 硬编码猜测
- 流式模式和非流式模式分别建模
- final result 与 progress 区分处理
- 共享 context 的更新被显式顺序化
- 取消传播按错误语义细分，而不是统一 fail-fast
- `tool_use_id` / `tool_result` 的配对一致性被当成主路径约束

这说明对 agent harness 来说，工具执行不是“模型调用后的附属阶段”，而是 runtime consistency 的一部分。

也正因为如此，这套实现比“并行执行外部命令”厚得多。它要维护的不是单机并发效率，而是整个对话轨迹在下一轮仍然可推理、可恢复、可解释。

## 十二、工程化启发

### 1. 并发不该按技术类型粗暴划分，而应暴露为工具语义接口

Claude Code 这里最有价值的做法之一，是把“能否并发”做成 `isConcurrencySafe(input)`。这让并发资格从 orchestrator 的猜测，变成工具自己的语义声明。

对于复杂 agent 系统，这是比“读工具都并发、写工具都串行”更稳妥的扩展方式。

### 2. 并发执行和状态提交最好拆开

`runTools(...)` 对并发批次采取“并发收集、顺序提交 context modifier”的方式，非常值得借鉴。

因为真正危险的通常不是工具同时运行，而是共享状态被并发写乱。把执行和提交拆开，可以同时保留吞吐和一致性。

### 3. Progress 与 final result 应该是两种不同的一等事件

`StreamingToolExecutor` 对 progress 立即透传、对 final result 受控排序的处理，说明 agent harness 最好不要把“工具输出”看成单一流。

很多时候，用户需要尽快看到工具正在做什么；但模型需要看到的是结构完整、顺序受控的最终结果。这两者天然不是同一种事件。

### 4. 错误传播应该带语义，而不是一刀切

Bash sibling cancellation 的设计说明，一旦进入多工具并发，就需要认真定义：

- 什么错误只影响自己
- 什么错误应扩散到兄弟工具
- 扩散后如何补结果，避免轨迹断裂

如果没有这一层，系统往往会在“保守到全停”和“激进到乱跑”之间摇摆。

### 5. 如果工具结果会回流模型，调度器就必须关心消息一致性

一旦 `tool_result` 会成为下一轮输入，那么 orchestration 的目标就不只是“把工具跑完”，而是“生产一份对模型仍然一致的结果历史”。

这会自然推导出：

- 丢弃旧尝试结果
- 补 synthetic result
- 保留顺序屏障
- 避免 context 乱序提交

这些看似“啰嗦”的机制，其实都是消息一致性要求的直接结果。

## 本章小结

如果把这一章压缩成一句话，可以说：

> Claude Code 的工具执行子系统，本质上不是一个并行命令池，而是一个围绕批次切分、顺序约束、上下文一致性与语义化取消而设计的 orchestrator。

从源码可以稳妥得出的结论包括：

- `runTools(...)` 负责普通批处理路径，先按 `isConcurrencySafe(input)` 切分批次，再按批次串行推进。
- `StreamingToolExecutor` 负责流式模式，维护显式队列状态机，支持边接收 `tool_use` 边启动工具。
- 并发安全的核心不是“可以一起跑”，而是“共享 context 如何不被并发写乱”。
- 结果顺序不是附属 UI 问题，而是下一轮推理一致性的一部分。
- 取消传播不是统一 fail-fast，而是带工具语义，尤其 Bash 错误会触发兄弟任务取消。
- 因为工具结果要重新进入消息历史，所以这套机制天然比“并行执行几个外部命令”更厚、更像 runtime 子系统。

## 源码证据索引

- `src/query.ts` — tool_use 收集、普通/流式执行路径分叉、结果回流下一轮消息
- `src/services/tools/toolOrchestration.ts` — `runTools(...)`、`partitionToolCalls(...)`、context modifier 顺序提交
- `src/services/tools/StreamingToolExecutor.ts` — 队列状态机、结果顺序、取消传播、sibling Bash error 策略
- `src/services/tools/toolTypes.ts` — 工具 schema 与 `isConcurrencySafe(input)` 语义入口
- `src/ui/interactive/interactiveHandler.ts` — sibling cancellation 对交互层的联动影响

## 相关章节

- [第 13 章：tool execution 在主 agent loop 中的位置](/claude-code-architecture/13-agent-loop-deep-dive/)
- [第 18 章：工具执行平面在运行时横切结构中的角色](/claude-code-architecture/18-runtime-cross-cutting-synthesis/)
- [第 19 章：fallback / abort / missing tool results 的恢复边界](/claude-code-architecture/19-recovery-and-error-handling-deep-dive/)
- [第 22 章：tool system 的 contract 与 execution boundary](/claude-code-architecture/22-tool-system-and-execution-boundaries/)
- [第 25 章：background execution 与 task system 的关系](/claude-code-architecture/25-tasks-scheduling-and-background-execution/)
- [第 27 章：Execution Plane 在总体 Runtime Architecture Map 中的位置](/claude-code-architecture/27-runtime-architecture-map/)

{% include claude-code-architecture-nav.html %}
