---
layout: page
title: "18 运行时横切结构综合"
permalink: /claude-code-architecture/18-runtime-cross-cutting-synthesis/
book_key: runtime-cross-cutting-synthesis
book_number: "18"
toc: true
---

## 本章目标

前面几章已经分别下钻了 agent loop、skills、hooks/side-channels、工具编排、memory 等主题。本章不再按子系统逐个回顾，而是尝试回答一个更横切的问题：

- 如果把第 13 至 17 章连起来，Claude Code 运行时里最重要的横切结构是什么？
- hooks、tool orchestration、memory、skills、budget、permissions 是怎样共同塑造运行时的？
- 哪些机制属于主路径，哪些属于 side-channel，哪些更接近控制面？
- 从源码出发，什么样的 runtime / harness 心智模型最稳定？

本章有两个明确边界：

1. 它不是第 08 章那种总结性收束，也不是整组文档的全书结论。
2. 它不重复第 14 章对 skills 子系统的数据模型、加载链路和 frontmatter 语义分析；这里讨论的是 skills 在整体运行时中的位置，而不是 skills 本体。

因此，本章关注的不是“某个目录如何实现”，而是“这些机制叠加后，运行时实际上呈现出怎样的结构”。

## 一、先给出总体判断

如果只基于当前源码做判断，我会把 Claude Code 的运行时横切结构概括成：

> 一个由执行主路径、异步旁路、长期上下文边界、以及治理控制面共同组成的 agent harness；其中 QueryEngine/query 负责主状态推进，tools 负责把推理接到外部动作，memory 与 skills 提供可注入的工作流上下文，hooks 提供阶段化旁路与收口点，而 budget 与 permissions 则持续对整套运行时施加约束。

这个判断里最重要的不是某一个子系统，而是四个横切事实：

1. Claude Code 的核心不是“调用模型”，而是“推进一次受约束的状态转换”。
2. 主路径之外存在大量真实工作的旁路，但这些旁路没有接管主循环所有权。
3. 长期上下文不是单一 memory 功能，而是一组被严格分层的注入、检索、发现与写回机制。
4. 预算、权限、工具可用性、hook 反馈等治理能力，不是外围配置，而是持续作用于运行时的控制面。

因此，把第 13 至 17 章连起来之后，更稳定的心智模型不再是“一个聊天循环附带若干功能”，而是：

```text
Claude Code runtime
= 主状态机
+ 受控工具执行平面
+ 分阶段 side-channels
+ 分层长期上下文系统
+ 持续施加约束的控制面
```

## 二、执行主路径

## 1. 主路径的骨架仍然是 turn state machine

从第 13 章可以看出，Claude Code 的主路径首先不是围绕“prompt 模板”组织，而是围绕 turn 级状态推进组织：

- `QueryEngine` 持有会话级 owner 身份
- `query.ts` 负责当前 turn 的循环推进
- assistant 输出、tool_use、tool_result、recovery、continue/stop 构成主要 transition

这里最重要的横切结论是：后面很多机制虽然看起来分属不同主题，但最终都要么进入这个状态机，要么围绕这个状态机工作。

也就是说：

- tools 并不是外挂执行器，而是主路径的继续条件之一
- compact / budget 不是外层统计，而是主路径中的裁剪与终止条件
- permissions 不是单独的设置页概念，而是每次工具执行都要穿过的判定边界
- memory / skill 不是静态背景，而是在主路径不同节点被装配、预取或注入
- hooks 也不是任意插件，而是附着在主路径不同阶段的旁路机制

所以 Claude Code 的运行时主轴，仍然是第 13 章已经确认的那条线：assistant 不是终点，tool use 才是下一次 transition 的入口。

## 2. 工具执行是主路径的一部分，不是后处理

第 16 章把工具编排拆开后，可以更清楚地看到这一点。

Claude Code 的工具执行子系统不是“模型说完以后去跑几个命令”，而是：

- 接收实际 `tool_use` block
- 按工具语义决定串行还是并发
- 维护结果顺序与 context modifier 提交顺序
- 处理取消传播、兄弟任务取消、streaming fallback 丢弃
- 把 `tool_result` 严格回流到下一轮消息历史

这意味着工具执行在架构上已经是一个独立执行平面，但它仍属于主路径而不是旁路。因为它的产物不是日志，而是下一轮推理的正式输入。

如果把这一层放回横切结构里看，可以得到一个更稳的判断：

- `query.ts` 负责总体状态推进
- tool orchestration 负责把“外部动作”纳入状态推进
- 二者共同构成主路径的执行骨架

因此，Claude Code 的主路径并不是“模型主路径 + 工具副路径”，而是“模型推理和平面化工具执行共同构成的一条执行主路径”。

## 3. 主路径中的上下文装配是结构化的，而不是一次性模板拼接

第 13、17 章连起来看，还能看到另一个横切特点：运行时并不是在每轮开始时拼一个固定大 prompt 就结束。

当前源码至少区分了：

- `systemPrompt`
- `systemContext`
- `userContext`
- message history
- memory prompt
- relevant memory attachments
- queued command / notification attachments
- skills 相关上下文资源

这些材料以不同方式进入当前 turn：

- 有些在 `QueryEngine.submitMessage()` 阶段进入
- 有些在 `queryLoop()` 开始时预取
- 有些在工具执行后注入
- 有些只在 stop hook 或 side-channel 中消费

因此，从横切视角看，Claude Code 的主路径不是“prompt 发送器”，而是“上下文装配与状态推进一体化”的执行器。

## 4. 预算和权限不是主路径外部的注释，而是主路径内的硬边界

如果只单看某个子系统，容易把 budget 和 permissions 当成治理层附属品；但从跨章节视角看，它们更像持续作用于主路径的运行时边界。

预算侧至少体现在：

- 最大 turn 限制
- token / tool result 预算裁剪
- compact、microcompact、collapse、autocompact
- max budget、max output tokens、prompt too long 等恢复或终止分支

权限侧则持续体现在：

- 每次 tool use 前的 `canUseTool`
- skill 的 `allowed-tools`
- memory / skill 写入面的限制
- stop-hook / extraction / shell command 的受控工具集
- 用户审批与拒绝累积进入运行态结果

这些机制之所以应被视作主路径内的硬边界，是因为它们不是事后记录，而是直接改变：

- 当前 turn 能否继续
- 哪些工具可以执行
- 哪些上下文可以注入
- 当前状态机会走 recovery 还是 stop

所以更准确的说法不是“主路径之外还有预算和权限”，而是：

> 主路径本身就是在预算与权限约束下运行的。

## 三、异步旁路与 side-channels

## 1. Claude Code 明显存在一条真正的 side-channel 层

第 15 章最重要的贡献之一，是把 hooks 与 side-channels 从“杂项回调”里分离出来。

从横切角度看，Claude Code 的 side-channel 层主要包含三种不同附着方式：

- turn 内并行预取
- post-sampling 分析插槽
- turn 结束处的统一收口机制

这三类虽然都不等于主循环本身，但也不是完全松散的后台任务。它们都由主运行时显式启动、约束和消费。

因此，“side-channel” 在这里更准确的含义是：

- 工作发生在主路径旁边
- 结果可能回流主路径或影响后续回合
- 但它们不拥有主状态机

这和很多系统里的“所有增强都塞进一次模型调用”形成了明显对比。

## 2. prefetch 属于主路径邻接的异步旁路

relevant memory prefetch 和 skill discovery prefetch 都体现出一种很典型的 harness 设计：

- 启动点在主路径中
- 执行与模型 streaming / tools 并行
- collect point 由主循环控制
- 没赶上就跳过，不阻塞本轮

这类机制非常接近主路径，但仍不应直接归入主路径本身。因为：

- 它不决定循环是否继续
- 它没有主状态转移权
- 它更像 latency hiding 与上下文补充机制

所以在横切分类上，把它放在“主路径邻接的异步旁路”更准确。

## 3. post-sampling hooks 是分析旁路，不是执行主干

post-sampling hooks 的位置很清楚：

- assistant 输出完成后触发
- fire-and-forget
- 出错只记录，不让主 turn 失败

这类机制的横切意义在于，它为运行时留出了一个分析平面：

- 可以基于刚完成的模型输出做附加判断
- 可以挂 skill improvement 这类受限分析器
- 但不会直接取代或中断主状态推进

这说明 Claude Code 在架构上已经区分了两类能力：

- “推进任务”的能力
- “分析刚刚发生了什么”的能力

从 harness 角度看，这种分离非常重要，因为一旦分析旁路和主执行混在一起，故障面和复杂度都会显著上升。

## 4. stop hooks 是 turn 尾部收口点，而不是一般意义的回调

stop hooks 更特殊一些。它们虽然也不属于主路径主体，但比 post-sampling hooks 更硬，因为：

- 只在 `!needsFollowUp` 的自然停止点进入
- 集中承接 turn 尾部的后处理
- 可以反馈 blocking error 或 preventContinuation
- 其结果能重新影响主状态机

所以 stop hooks 在横切结构中更像：

- side-channel 与 control plane 的交界点
- turn 结束时的 enforcement / collection point

也正因为如此，第 15 章把 stop hooks 和普通 post-sampling hooks 区分开是必要的。它们都不是主路径主体，但 stop hooks 更接近控制反馈面，而 post-sampling hooks 更接近分析旁路。

## 5. skill improvement 只应被视为受限 side-channel 实例

把第 14、15 章连起来后，这个边界会更清楚。

`skillImprovement` 的主体分析，属于第 14 章 skills 系统的边界；但它接入 runtime 的方式，属于第 15 章 side-channel 范畴。它是：

- 注册到 post-sampling hooks
- gated、限频、限 query source
- 分析最近交互中可沉淀到 project skill 的偏好
- 写入面仅限 project skill 文件

因此，从运行时横切结构看，它不是：

- 主路径的一部分
- 通用自改写框架
- skills 子系统的主执行流程

而只是一个典型例子，说明 Claude Code 确实支持“从交互中提炼改进”的旁路，但把写入面做得很窄。

## 四、长期上下文边界

## 1. 长期上下文不是单个 memory 功能，而是一条分层链路

第 17 章如果单独看，重点在 memory system；但放回横切视角，真正重要的是：Claude Code 对“长期上下文”做了清楚分层。

至少可以区分为：

- durable memory 存储
- query 前的 memory prompt 注入
- turn 内 relevant memory retrieval / prefetch
- nested memory / loaded path 发现状态
- turn 结束后的 durable extraction / write-back

这说明 Claude Code 的“长期上下文能力”不是一个 feature，而是一组生命周期不同、进入位置不同、权限边界不同的运行时结构。

因此，比起说“Claude Code 有 memory”，更准确的说法是：

> Claude Code 把长期上下文做成了运行时中一条受控的读写链路。

## 2. 读路径和写路径被明确拆开

从横切结构看，memory 最成熟的地方之一，是读写分离做得很清楚。

读路径包括：

- system prompt 中的长期背景注入
- turn 内 relevant memory 预取与 attachment 注入
- nested memory 的渐进发现

写路径则主要表现为：

- stop-hook 阶段的 extraction
- forked agent
- 受限工具集
- 窄写入面

这意味着 Claude Code 没有把“长期上下文”做成任意读写的黑箱，而是把：

- retrieval
- injection
- extraction
- persistence

变成四个有边界的阶段。

这种分层对横切综合尤其关键，因为它解释了为什么 memory 能和主路径、hooks、permissions 同时成立，而不会全部塌进一个大 prompt。

## 3. 长期上下文边界也覆盖了 skills，但二者不应混同

这里需要明确和第 14 章的边界。

第 14 章讨论的是 skills 作为工作流资源系统本身：它们怎样被加载、解析、命名空间化、附带元数据；而本章讨论的是更广义的长期上下文边界。

在这个意义上，skills 确实属于长期上下文的一部分，因为它们提供：

- 可复用工作流知识
- 带元数据的 prompt 资源
- 可按路径、项目、插件、managed source 渐进显现的行为

但它们和 memory 不是同一种东西：

- memory 更偏长期协作知识与个性化背景
- skills 更偏工作流模板与执行元数据资源

二者在运行时中的共同点是：都不是简单字符串，都要以结构化方式进入上下文装配；但边界仍应保持清楚。

因此，本章只讨论 skills 作为长期上下文边界中的一个构件，不重复第 14 章对其内部机制的展开。

## 4. 长期上下文边界受预算与权限双重塑形

跨章节看，长期上下文最值得强调的一点是：它并不是“能找到就都塞进去”。

原因至少有两个：

第一，预算约束持续存在：

- memory prompt 注入受上下文窗口与 compact 体系影响
- relevant memory attachment 也要和其他上下文竞争预算
- 长期上下文越厚，越要求更强的 context shaping

第二，权限约束持续存在：

- durable memory 写回的工具集被限制
- skills 的 shell expansion 受 `allowed-tools` 与来源边界影响
- MCP skill 与本地 skill 的能力边界不同
- 写入长期上下文的面被刻意做窄

因此，从横切视角看，长期上下文并不是“数据层”，而是被预算与权限持续调节的一层 runtime substrate。

## 五、治理与控制面

## 1. 控制面不是单一模块，而是一组持续施加约束的机制

如果把主路径、异步旁路、长期上下文都看完，再回头看 budget 与 permissions，会更容易发现：Claude Code 明显有一层控制面。

这层控制面不等于某个目录，也不等于某个服务，而是贯穿运行时的治理机制组合，包括：

- tool permission checks
- user approval / denial 累积
- allowed tool scopes
- task budget / max budget / max turns
- structured output retry limits
- stop hook 的阻断反馈
- 各类 gated feature / execution boundary

它们的共同特征是：

- 不直接推进任务
- 不直接产生工作内容
- 但持续限制、裁剪、放行或阻断运行时行为

所以从架构上看，这一层更接近 control plane，而不是 data plane 或 execution plane。

## 2. permissions 是最直接的运行时控制面

第 17 章主要谈 memory，第 16 章谈工具，第 13、15 章触及执行与 hooks；把它们连起来后，permissions 的横切角色会更清楚。

permissions 影响的不只是“某个工具能不能点允许”，而是整个运行时执行边界：

- `canUseTool` 决定工具调用是否被允许进入实际执行
- skill 的 `allowed-tools` 影响其工作流运行边界
- shell interpolation 只有在特定来源和权限条件下才允许
- extraction、write-back 等写路径使用更窄的工具许可
- denial 会累积为会话运行态的一部分

因此 permissions 在 Claude Code 里更像：

- 工具执行平面的 admission control
- 长期上下文写入面的 boundary control
- 某些工作流资源可执行性的 runtime guardrail

## 3. budget 是另一条持续工作的控制面

budget 的横切价值在于，它并不是“最后算一下花了多少钱”，而是把 token economics 直接变成状态机的一部分。

预算会持续塑造：

- messagesForQuery 的形成
- tool result budget 的裁剪
- compact / collapse / autocompact 的触发
- 是否启用 recovery、fallback 或终止
- 整个 turn 是否还能继续

所以，budget 在这里不是监控指标，而是运行时治理结构。

更进一步说，Claude Code 的控制面有一个很明显的特点：

- permissions 更像“动作准入控制”
- budget 更像“上下文与资源消耗控制”

二者叠加后，主路径并不是自由流动的，而是在两套约束体系下持续被塑形。

## 4. hooks 中也有一部分机制属于控制面，而不只是 side-channel

第 15 章已经说明，hooks 并不全是一个类别。从横切结构看，可以进一步区分：

- prefetch 更偏 side-channel
- post-sampling hooks 更偏 analysis side-channel
- stop hooks 则部分进入 control plane

原因在于 stop hooks 可能产生：

- blocking error
- preventContinuation
- stop summary / enforcement-like feedback

因此 stop hooks 里有一部分机制实际上扮演“运行时治理反馈点”的角色。它们不拥有主路径，但它们能把治理结果重新作用回主状态机。

这也说明 Claude Code 的 control plane 不是脱离执行面的外层配置，而是通过若干明确插槽嵌入运行时之中。

## 六、和已有文档的边界

## 1. 与第 08 章的边界

这一章必须明确区别于第 08 章。

第 08 章的角色是：

- 对整组架构研究做收束
- 把全仓库压缩成稳定心智图
- 给出总体阅读建议与最终判断

本章不是那种收尾性总结，也不是对前文逐章 recap。它只做一件更窄的事：

- 把第 13 至 17 章已经展开的运行时机制，按横切轴重新组织成一套 runtime synthesis

因此，本章不试图重新总结整个 Claude Code 仓库，也不讨论所有目录层次，只讨论运行时横切结构。

## 2. 与第 14 章的边界

本章也必须明确区别于第 14 章。

第 14 章关心的是 skills system 本身，包括：

- skills 是什么抽象
- 它们从哪里来
- frontmatter 字段影响什么
- skills 与 command / tool / plugin 的边界

本章不会重复这些内容。本章只关心 skills 在 runtime synthesis 里的位置：

- 它如何作为工作流资源进入上下文装配
- 它如何与 memory 一起构成长程上下文边界的一部分
- 它如何受 permissions、allowed-tools、来源边界约束
- 它如何通过 side-channel（如 skill improvement）与运行时发生有限反馈关系

因此，skills 在这里是 runtime cross-cutting structure 的一个构件，不是单独被再次拆开的研究对象。

## 3. 与第 13、15、16、17 章的关系

这一章和前面几章的关系，可以压缩成下面几句：

- 第 13 章解释主状态机如何推进。
- 第 15 章解释哪些增强机制附着在主状态机旁边。
- 第 16 章解释工具执行平面如何维持顺序、一致性与取消语义。
- 第 17 章解释长期上下文如何被读取、注入、发现和写回。

而本章做的是另一层工作：

- 不再追某条单一源码链路
- 而是把这些机制重新排列成执行主路径、异步旁路、长期上下文边界、治理控制面四条横切轴

因此，本章不是 recap，而是把前面几章已经确认的机制，重新投影到同一组 runtime 横切轴上。

## 七、Harness 视角

从 harness engineering 的角度看，前面几章连起来后，Claude Code 支持一种相对稳定的运行时心智模型。

## 1. 这是一个“多平面”而不是“单循环附加功能”的 harness

最稳定的模型不是：

```text
用户输入 -> 模型 -> 工具 -> 输出
```

而更接近：

```text
执行主路径：
  QueryEngine / query / tool execution / recovery

异步旁路：
  prefetch / post-sampling analysis / stop-time side work

长期上下文层：
  memory prompt / relevant memory / skills / nested discovery / write-back

控制面：
  permissions / budget / approvals / blocking feedback / gating
```

这个模型的好处是，它能解释为什么 Claude Code 在加入越来越多机制后，主路径仍然没有完全失控：因为这些机制并没有全被塞进一个函数，而是被分配到了不同平面。

## 2. 主路径负责 transition，side-channel 负责 enrichment，控制面负责 governance

如果再抽象一层，可以把整套 harness 的职责分成三句话：

- 主路径负责推进状态转换
- side-channel 负责补充、提炼、分析和收口
- 控制面负责持续施加边界与约束

这种分法比“哪些是 feature，哪些是 infra”更有解释力。因为 Claude Code 里的很多能力并不能简单按功能模块划分，而是要按运行时职责划分。

例如：

- relevant memory prefetch 不是单纯 memory feature，而是 enrichment side-channel
- stop hooks 不是单纯 hook feature，而是收口与治理插槽
- tool orchestration 不是单纯工具模块，而是主路径执行平面
- permissions 不是单纯设置模块，而是 admission control

## 3. Claude Code 更像工程化 runtime，而不是自治系统

把这些机制都看完之后，还能得到一个更稳的判断：

Claude Code 确实已经具备很强的 runtime 工程化特征，但它仍然不是一个无边界自治系统。源码反复体现出以下约束：

- 主路径与 side-channel 被区分
- side-channel 大多 fail-open 或窄写入
- 工具执行受语义化并发与取消约束
- 长期上下文读写分离
- 权限和预算持续限制主状态推进
- 某些“改进”能力只在 very narrow surface 上生效

所以更准确的 harness 心智模型是：

> 一个高度工程化、带多平面结构的 agent runtime，而不是一个可以任意自扩张、自改写的闭环自治体。

## 八、工程化启发

## 1. 做 agent runtime 时，应该先分清主路径、旁路和控制面

Claude Code 最值得借鉴的一点，是没有把所有问题都塞进“模型循环”里。相反，它把不同职责拆成：

- 主路径推进
- 异步旁路
- 长期上下文边界
- 治理控制面

这对长期演化非常重要。否则系统很容易出现两个问题：

- 所有增强都侵入主路径，导致状态机变得难以维护
- 所有治理都做成外围开关，导致关键约束无法真正影响运行时

## 2. 工具执行应被当成执行平面，而不是 I/O 附件

第 16 章支持的结论很明确：只要工具结果会回流模型，工具执行就必须被当成 runtime consistency 的一部分。

这会自然推导出一整套工程要求：

- 并发资格要有语义接口
- context 更新要避免并发乱写
- final result 和 progress 要分离
- 取消传播要可解释
- 旧尝试结果不能污染新尝试

这些要求说明，agent harness 的工具层不是命令池，而是执行平面。

## 3. 长期上下文系统必须做分层，不要把 memory、skills、summary 混成一团

从第 14、17 章连起来看，一个很明确的工程启发是：长期上下文如果不分层，运行时会迅速失控。

至少需要区分：

- 持久背景知识
- 工作流资源
- 当前 turn 的相关检索结果
- 写回阀门
- 注入与发现状态

Claude Code 当前最值得保留的不是某种具体 memory 形式，而是这种“长期上下文必须多层建模”的态度。

## 4. side-channel 应该默认可失败，但写入面必须做窄

Claude Code 的 side-channel 设计反复体现出一种成熟取向：

- prefetch 可以错过本轮，不阻塞主路径
- post-sampling hook 出错只记录
- stop hooks 虽然更硬，但仍有明确进入条件
- skill improvement / memory extraction 的写入面都很窄

这说明好的 harness 不是“让一切增强能力都强力接管”，而是：

- 分析旁路默认 fail-open
- 真正能改状态、写长期对象、阻断流程的路径必须做窄并加约束

## 5. 预算与权限应被视为运行时结构，而不是运维指标

很多系统直到后期才把预算和权限视为核心设计问题。Claude Code 的源码表明，更健康的做法是从一开始就把它们嵌进运行时：

- 预算决定上下文如何被治理
- 权限决定动作如何被放行
- 二者共同决定系统能否稳定推进

这对任何会长期运行、会调用外部工具、会维护长期上下文的 agent harness 都是关键经验。

## 本章小结

如果把本章压缩成一句话，可以说：

> 把第 13 至 17 章连起来后，Claude Code 呈现出的不是若干独立功能模块，而是一套由执行主路径、异步旁路、长期上下文边界和治理控制面共同组成的多平面 runtime；其中 tools 负责把外部动作纳入状态推进，hooks 负责分阶段旁路与收口，memory 与 skills 负责结构化上下文供给，而 budget 与 permissions 则持续塑造整个运行时的可执行边界。

从源码能稳妥支持的最终心智模型是：

```text
Claude Code runtime
不是：
  单一 agent loop + 若干附属功能

而是：
  一个多平面 harness
  - 主路径推进任务
  - side-channels 补充与分析
  - 长期上下文系统提供可控记忆与工作流资源
  - 控制面持续施加预算、权限与治理约束
```

这个模型的价值不在于总结所有细节，而在于它能帮助后续继续读源码时，更稳定地判断：

- 一个机制到底属于主路径、旁路，还是控制面
- 一个新能力是在扩展执行平面，还是在扩展长期上下文层
- 一个“增强功能”为什么没有被直接塞进 agent loop 里

这也是本章想完成的工作。

## 源码证据索引

- `src/QueryEngine.ts` — 会话 owner、turn 入口与 runtime 主骨架
- `src/query.ts` — 主状态机、prefetch、hooks、recovery、attachment 注入
- `src/services/tools/toolOrchestration.ts` / `src/services/tools/StreamingToolExecutor.ts` — 执行平面与工具编排语义
- `src/skills/loadSkillsDir.ts` / `src/skills/SkillManager.ts` — skills 作为工作流资源与动态发现层
- `src/utils/hooks/postSamplingHooks.ts` / `src/query/stopHooks.ts` — side-channel 与 turn epilogue 结构
- `src/memdir/memdir.ts` / `src/services/extractMemories/extractMemories.ts` — 长期上下文读写链路
- `src/utils/permissions/permissions.ts` — 持续作用于运行时的治理控制面

## 相关章节

- [第 13 章：主状态机与 agent loop](/claude-code-architecture/13-agent-loop-deep-dive/)
- [第 14 章：skills system 本体](/claude-code-architecture/14-skills-system-deep-dive/)
- [第 15 章：hooks 与 side-channels taxonomy](/claude-code-architecture/15-hooks-and-side-channels-deep-dive/)
- [第 16 章：工具编排与并发执行平面](/claude-code-architecture/16-tool-orchestration-and-concurrency/)
- [第 17 章：memory / persistence / extraction](/claude-code-architecture/17-memory-system-and-persistence/)
- [第 21 章：config、state 与 governance boundary 的正式展开](/claude-code-architecture/21-config-state-and-governance-boundaries/)
- [第 27 章：将本章横切结构进一步投影为总体运行时架构图](/claude-code-architecture/27-runtime-architecture-map/)
- [第 30 章：最终 runtime synthesis 与 design principles](/claude-code-architecture/30-runtime-synthesis-and-design-principles/)

{% include claude-code-architecture-nav.html %}
