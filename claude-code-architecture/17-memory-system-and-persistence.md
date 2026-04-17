---
layout: page
title: "17 Memory 系统与持久化深挖"
permalink: /claude-code-architecture/17-memory-system-and-persistence/
book_key: memory-system-and-persistence
book_number: "17"
toc: true
---

## 本章目标

这一章专门研究 Claude Code 里的 memory system，尽量沿着源码链路回答几个更具体的问题：

1. Claude Code 中有哪些 memory 相关入口？
2. 哪些属于 prompt 注入，哪些属于 prefetch，哪些属于 stop-hook 提取，哪些属于 file-based persistence？
3. `QueryEngine`、`query loop`、memory prompt、nested memory paths 是怎样连接起来的？
4. 这套 memory 更像会话辅助上下文，还是长期用户建模？
5. 从源码能得出的最稳妥判断是什么？

这一章的边界也需要先讲清楚：

- 这里主要讨论 **runtime memory lifecycle、retrieval、extraction 与 persistence**；
- 不重新展开第 06 章已经覆盖的 state / config / trust / permission 总览；
- 也不重讲第 14 章的 skills 系统本体，只在 memory 与 runtime 注入/提取发生关系时提到。

## 一、先给出总体判断

如果只基于当前源码做判断，我会把 Claude Code 的 memory system 概括成：

> 一套由 file-based durable memory、turn 内相关 memory 预取、prompt 注入、以及 stop-hook 路径下的 memory 提取共同组成的长期上下文子系统；它服务于当前会话推进，但又明显超出了单次会话摘要的范围。

如果再拆细一点，可以把它理解成四层：

1. **持久 memory 存储层**：`memdir` 目录、`MEMORY.md` 索引、typed memory files
2. **retrieval / discovery 层**：relevant memory、nested memory、loaded paths、prefetch
3. **prompt injection 层**：memory prompt 被拼进 system prompt / attachment 路径
4. **提取与写回层**：stop-hook 之后的 durable memory extraction

这说明 Claude Code 的 memory 不是“顺手记几句聊天摘要”，而是一层相对完整的长期上下文基础设施。

但它也不是一个完全自治、自动扩张的知识库，因为源码里同样能看到很强的边界：

- 存储类型被限定
- 写入面被限定
- 提取走 side-channel
- 运行时注入仍由主循环控制

## 二、memory 的入口有哪些

## 1. file-based durable memory：`memdir`

从 `src/memdir/memdir.ts` 可以直接看到，Claude Code 把 durable memory 设计成目录式结构，而不是塞进某个单一数据库或巨大 markdown 文件。

最关键的特征包括：

- memory 目录有统一入口 `MEMORY.md`
- `MEMORY.md` 只是索引，不应直接承载 memory 内容
- 每条 memory 要写到独立文件中
- memory 必须带 frontmatter
- memory 被限制为 `user / feedback / project / reference` 四类

这里最重要的不是“存成文件”这件事本身，而是它表达的结构：

- durable memory 被视为长期可维护知识，而不是临时缓存
- 类型系统本身就是约束
- 索引和正文分离，说明它更像可演化知识库而不是 transcript dump

## 2. prompt 注入入口：memory 会进入 system prompt 构建

第 10 章已经指出 `loadMemoryPrompt()` 会参与 system prompt 构建；第 13 章则说明 `QueryEngine.submitMessage()` 在拼装 system prompt parts 时会在特定条件下把 memory prompt 注入进去。

因此 memory 的第一条 runtime 入口不是 attachment，而是：

- **system prompt assembly**

这点很关键，因为它说明 durable memory 并不是在模型回复后才被考虑，而是在当前 turn 真正发起查询前就已经可能影响模型可见上下文。

## 3. turn 内 retrieval / prefetch 入口：relevant memory

`query.ts` 中又有另一条不同的入口：

- `startRelevantMemoryPrefetch(...)`

这条链路和 system prompt 注入不同，它强调的是：

- 在 user turn 内启动 relevant memory retrieval
- 与主模型 streaming / tool execution 并行
- 在 collect point 上如果 ready 就转成 attachments 注入，否则跳过，下一轮再说

因此 Claude Code 的 memory 并不是“启动前一次性全灌给模型”，而是既有：

- query 前的静态/半静态 memory prompt
- 又有 turn 内按相关性预取的动态 memory attachments

## 4. stop-hook 路径下的 extraction 入口

第 10 章已经梳理过 `src/services/extractMemories/extractMemories.ts`：durable memory extraction 不是主 agent 顺手写，而是在 query 正常结束后的 stop-hook side-channel 里，用 forked agent、受限工具集去完成。

所以从生命周期上说，memory 还有一条重要入口是：

- **turn 结束后的 durable extraction/write-back**

这说明 memory 系统不仅负责“读”，还负责“从对话中提炼长期可保留信息”。

## 三、这几类入口分别对应什么职责

## 1. memory prompt 更像长期背景注入

通过 system prompt 进入当前 query 的 memory，更接近：

- 用户画像
- 协作偏好
- 项目背景
- 外部参考资源线索

这些内容的特点是：

- 不一定由当前 turn 立即触发
- 更像长期稳定背景
- 适合作为 query 前置上下文

因此这层 memory 更接近 durable context，而不是即时检索结果。

## 2. relevant memory prefetch 更像 turn 内按需补充上下文

`startRelevantMemoryPrefetch(...)` 体现的不是“把所有长期记忆都重新载入”，而是：

- 对当前 turn 可能相关的 memory 做异步检索
- 在合适时机作为 attachment 注入
- 如果没赶上当前 collect point，也不阻塞当前 turn

所以它更像：

- retrieval-augmented context 补充
- 而不是持久 memory 本体

## 3. extraction 更像 durable memory 的写回阀门

stop-hook 路径下的 extraction 并不等于“把所有对话自动存档”。第 10 章已经说明它有几个很强的边界：

- 走 forked agent
- 共享父 prompt cache
- 允许的工具集很小
- Edit/Write 只能碰 auto-memory 路径
- Bash 仅允许只读命令

因此 extraction 在这个系统里的角色更准确地说是：

- 一个受限写回阀门
- 而不是开放式数据落盘通道

## 四、`QueryEngine`、`query loop` 与 memory 是怎么连起来的

## 1. `QueryEngine` 负责在 turn 入口拼 memory prompt

第 13 章已经说明，`QueryEngine.submitMessage()` 会做：

- 读取 system prompt parts
- 在特定条件下调用 `loadMemoryPrompt()`
- 把这些系统片段拼装后交给 `query()`

所以从职责分层上看：

- `QueryEngine` 负责会话入口处的 memory prompt 装配
- `query()` 负责 turn 内动态 retrieval / attachments / stop hooks

这和 QueryEngine / query 的总体分工是对齐的。

## 2. `query()` 负责 relevant memory prefetch 与 attachment 注入

`queryLoop()` 开头启动 relevant memory prefetch；在工具执行后，又会把 prefetched results 转成 attachments 注入。

这说明 memory retrieval 不是静态预处理，而是和工具、queue、skill discovery 一样，属于 turn 内动态吸收的新上下文。

也就是说，memory 在 Claude Code 中至少以两种方式进入主循环：

- 作为 query 前 system prompt 片段
- 作为 turn 内 attachment 注入

## 3. stop hooks 负责 turn 结束后的 memory extraction

当没有 `needsFollowUp` 时，`query.ts` 进入 `handleStopHooks(...)`。其中会调用：

- `extract memories`

这一点很关键，因为它表明 durable memory extraction 不是在 query 过程中同步进行，而是：

- 在主任务自然结束后
- 走 side-channel
- 与 stop hooks 并列归入 turn 尾部收口机制

这让 memory 的写回不会污染主线程任务推进，也和第 15 章对 side-channel 的分析相互呼应。

## 五、nested memory、relevant memory、loaded paths 各代表什么

## 1. relevant memory：当前 turn 的相关 memory 检索结果

从 `startRelevantMemoryPrefetch(...)` 的命名和使用位置看，relevant memory 的重点在：

- 与当前 user turn 的相关性
- 异步预取
- collect-if-ready
- 以 attachment 形式注入

因此它代表的是：

- 当前 turn 的动态相关 memory 视图

而不是 durable memory 全集。

## 2. nested memory：按路径逐步发现的局部 memory

第 13 章提到 `QueryEngine` 内部还保存：

- `loadedNestedMemoryPaths`

这和 skills 的 nested discovery 很像，说明 Claude Code 不只是有全局 memory，还支持在路径/目录层级上逐步发现更局部的 memory source。

这类 state 的意义不是“记住内容本身”，而是记住：

- 哪些 nested memory path 已经被发现并加载过
- 避免同一 turn / 会话里重复注入
- 让 memory discovery 成为可控的渐进过程，而不是每轮全量扫盘

## 3. loaded paths：更像 memory/discovery 状态，而不是 memory 内容

无论是 `loadedNestedMemoryPaths`，还是相关的 path tracking，本质上都不是 memory data 本身，而是：

- retrieval / discovery bookkeeping state

这很重要，因为它说明 Claude Code 在 memory 子系统里同样区分了：

- data 本体
- 发现状态
- 注入状态
- 写回状态

如果这些状态不分开，长会话里的 memory 行为很容易失控。

## 六、这套系统更像什么，不像什么

## 1. 它更像长期上下文基础设施，而不只是聊天摘要

如果只看 session summary，很容易误以为 Claude Code 的 memory 只是“长会话压缩”。但从 durable memory、typed memory、relevant prefetch、stop-hook extraction 连起来看，更稳妥的判断是：

- 它是一套长期上下文基础设施
- session summary 只是其中一层

## 2. 它也不像完全开放的知识库存取系统

虽然 durable memory 是 file-based 的，但当前源码边界很清楚：

- 类型受限
- 索引受限
- 写入面受限
- 提取走 side-channel
- memory prompt / attachment 注入仍受主循环治理

所以它不像一个随意读写、自动膨胀的开放知识库。

## 3. 它既不是纯会话态，也不是完全独立于会话

memory 和会话的关系大致是：

- durable memory 超出单会话生命周期
- relevant memory retrieval 又紧密依赖当前 user turn
- extraction 则基于当前 turn 的对话结果决定是否写回 durable memory

因此它不是单纯“会话态”，也不是脱离会话独立运行的后台系统，而是：

- **由长期存储、当前 turn 相关性和 stop-hook 写回共同耦合的混合系统**

## 七、源码链路下几个更稳的判断

## 1. Claude Code 把 memory 明确分层了

至少从现有源码和文档脉络，可以稳定区分：

- durable memory（`memdir` / typed memory）
- session memory / compact-related memory
- relevant memory retrieval
- stop-hook memory extraction

这一点很重要，因为 memory engineering 最容易失败的地方，就是把长期偏好、当前摘要、当前检索结果、UI state 混在一起。

## 2. durable memory 的写回被刻意做成受限 side-channel

这不是一个小实现细节，而是架构判断：

- durable memory extraction 没有放进主 query 路径
- 而是放到 stop-hook 后的 forked / limited execution path

这说明团队很清楚：长期写回如果和主任务推进强耦合，会显著增加复杂度与风险。

## 3. retrieval 与 injection 是 runtime 动态行为，不是静态配置

`startRelevantMemoryPrefetch(...)`、attachment 注入、nested memory path tracking 一起说明：

- memory 进入模型上下文，不是“启动时配好就结束”
- 而是运行中按 turn、按路径、按相关性逐步发生

所以 memory 在这里更接近 runtime subsystem，而不是一段静态 prompt 配置。

## 4. 这套系统明显偏向“协作与个性化记忆”，而不是世界知识记忆

四类 typed memory：

- `user`
- `feedback`
- `project`
- `reference`

它们都更偏：

- 用户是谁
- 用户喜欢怎么协作
- 当前项目背景是什么
- 哪些外部资源值得记住

这说明 Claude Code 的 memory 目标不是做通用知识库，而是做：

- 持续协作中的长期上下文保持

## 八、和已有文档的边界

## 1. 与第 06 章的边界

第 06 章讨论的是：

- state / settings / trust / permissions
- 这些治理层怎样塑造 runtime 边界

本章不重复这些治理层总览，只在它们直接影响 memory 控制流时提及。重点不在“配置系统怎么工作”，而在：

- memory 数据如何存
- 如何取
- 何时注入
- 何时提取
- 如何写回

## 2. 与第 10 章的边界

第 10 章把 memory、评测、自我改进放在同一章里，强调的是：

- memory 在更大的 self-improvement / recovery 体系里扮演什么角色
- 它对 harness engineering 的启发是什么

本章则把 memory 单独拆出来，尽量只讲 memory 子系统本体：

- durable memory 结构
- retrieval / prefetch
- prompt injection
- stop-hook extraction
- persistence 边界

可以理解为：

- `10` 更偏“大图景中的 memory”
- 本章更偏“memory system 自身的机制与边界”

## 3. 与第 13 章的边界

第 13 章关心的是：

- memory prefetch / attachments 怎样挂进 turn loop

本章则进一步问：

- memory 为什么会有 prefetch
- durable memory 与 relevant memory 的关系是什么
- loaded paths / nested memory state 在表示什么
- extraction 和 persistence 的写回面在哪里

也就是说：

- `13` 讲 memory 怎样参与 loop
- 本章讲 memory 本身是什么系统

## 4. 与第 14 章的边界

第 14 章讨论的是 skills system。本章只有在 memory 与 skill runtime 注入/提取发生关系时才提 skills，不会重复：

- skills 数据模型
- skills 加载来源
- frontmatter 语义
- `skillImprovement` 的主体分析

因此本章中的 skills 只作为 runtime 相关上下文的一部分出现，而不是研究对象本身。

## 1. memory 不应只有一种形态

当前源码最清楚地说明了一点：memory 至少要分成：

- durable memory
- session / summary memory
- relevant retrieval memory
- stop-hook extraction path

只有这样，系统才能同时兼顾：

- 长期个性化
- 当前任务连续性
- 上下文窗口限制
- 安全的长期写回

## 2. 长期写回最好走 side-channel

Claude Code 没把 durable memory 写回塞进主任务路径，而是放到 stop-hook + forked agent + restricted tools 的组合里。这种设计非常成熟，因为它把：

- 主任务推进
- 长期记忆提炼
- 写回权限控制

三件事清楚地拆开了。

## 3. retrieval 最好和注入解耦

relevant memory prefetch 的 collect-if-ready 语义说明：

- retrieval 可以异步进行
- injection 由主循环决定是否、何时发生

这比“检索一完成就强行塞进上下文”更稳定，也更容易控制 token 预算和时机。

## 4. memory 的价值主要在持续协作，不在做万能数据库

当前 typed memory 的分类很能说明产品目标：Claude Code 想保留的是长期协作中的有效背景，而不是试图把所有见过的信息都转成永久知识。

这是一种更现实、也更容易做好的 memory 产品路线。

## 1. memory engineering 的第一步是先分层

如果 durable memory、summary memory、retrieval results、UI state 不分层，后面多半会出现：

- 注入重复
- 写回失控
- token 浪费
- 概念边界混乱

Claude Code 当前最可取的地方，就是至少在架构上把这些层拆开了。

## 2. 写回面倾向于做窄

长期 memory 最危险的不是“记不住”，而是“乱记”。Claude Code 通过：

- typed memory
- index/content 分离
- stop-hook side-channel
- restricted tool set

把 durable write-back 做得相对克制。这比“让主 agent 直接写长期记忆”稳得多。

## 3. retrieval 的非阻塞设计很重要

relevant memory prefetch 体现了一个成熟思路：

- 没赶上这轮 collect point，就下轮再说
- 不要为了 memory 检索把整个主 turn 卡住

对 agent runtime 来说，这种 non-blocking retrieval 往往比“每次都检全再说”更符合真实产品需求。

## 4. 长期 memory 的目标应该是协作连续性

typed memory 的四类已经隐含了一个很好的产品判断：长期记忆最值得保留的，是会影响后续协作质量的信息，而不是一般性世界知识。

这对做 coding agent、research agent、workflow agent 都很有参考价值。

## 本章小结

如果把这一章压缩成一句话，可以说：

> Claude Code 的 memory system 不是单一摘要功能，而是一套由 durable memory、runtime retrieval、prompt/attachment 注入、以及 stop-hook 写回共同组成的长期上下文基础设施。

从源码能得出的倾向性结论包括：

- durable memory 采用 file-based、typed、indexed 的结构，而不是随意聊天缓存；
- memory 既会在 query 前作为 prompt 片段进入上下文，也会在 turn 内以 relevant memory attachments 的形式动态注入；
- durable extraction 明显走受限 side-channel，而不是主路径同步写回；
- `loadedNestedMemoryPaths` 这类状态说明 memory discovery 本身也是 runtime 的一部分；
- 整套系统更偏持续协作中的长期上下文保持，而不是通用知识库。

## 源码证据索引

- `src/memdir/memdir.ts` — durable memory 的 file-based / typed / indexed 结构
- `src/QueryEngine.ts` — memory prompt 参与 system prompt assembly 的入口
- `src/query.ts` — relevant memory prefetch 与 attachment 注入时机
- `src/utils/attachments.ts` — relevant memory prefetch 与 attachment 生成
- `src/services/extractMemories/extractMemories.ts` — stop-hook 后的 durable memory extraction/write-back

## 相关章节

- [第 15 章：hooks 与 side-channels](/claude-code-architecture/15-hooks-and-side-channels-deep-dive/)
- [第 20 章：message/context assembly](/claude-code-architecture/20-message-and-context-assembly-deep-dive/)
- [第 24 章：compact / context collapse / recovery boundary](/claude-code-architecture/24-compact-context-collapse-and-recovery-boundary/)
- [第 27 章：总体运行时架构图](/claude-code-architecture/27-runtime-architecture-map/)
- [第 29 章：术语表与核心区分](/claude-code-architecture/29-glossary-and-core-distinctions/)

{% include claude-code-architecture-nav.html %}
