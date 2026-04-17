---
layout: page
title: "23 流式输出、事件协议与 SDK 边界深挖"
permalink: /claude-code-architecture/23-streaming-output-event-protocol-and-sdk-boundary/
book_key: streaming-output-event-protocol-and-sdk-boundary
book_number: "23"
toc: true
---

## 23 流式输出、事件协议与 SDK 边界深挖

这一章聚焦 Claude Code 里另一个很关键、但很容易被误解成“只是输出格式”的部分：

- **streaming output**
- **事件协议**
- **SDK 边界**

如果前几章已经把 query loop、message/context assembly、hooks、memory、tool system 这些内部运行机制拆开了，那么这一章要进一步回答：

1. Claude Code 内部的消息状态，怎样变成外部可消费的流式事件？
2. CLI / SDK / 外部调用方看到的 event protocol，和模型真实上下文之间是什么关系？
3. `system/init`、assistant message、tool use、result event 这些协议对象属于 runtime 哪一层？
4. 为什么 Claude Code 要把内部消息模型与外部 SDK 协议明确分开？

这一章的重点不是重复第 20 章里 message assembly 本体，而是专门讨论：

- **内部运行态消息**
- **外部流式协议**
- **二者之间的边界转换**

---

### 一、先给出总体判断

如果只基于当前源码做判断，我会把 Claude Code 的流式输出与 SDK 边界概括成：

> 一套由内部 query/message runtime、增量事件投影、system/init 协议消息、以及 SDK-facing stream contract 共同组成的外部化层；它并不等于模型上下文本身，而是对内部状态推进的结构化对外映射。

更具体地说，可以稳定拆成四层：

1. **内部消息与状态推进层**：query loop 内部的 message state、assistant/tool/result 流转
2. **streaming emission 层**：在 query 执行过程中持续产出事件
3. **SDK/protocol mapping 层**：把内部对象映射成外部可消费的消息协议
4. **consumer boundary 层**：CLI、SDK 调用方、外部集成只看见协议面，而不是全部内部实现

这个分层很重要，因为它说明 Claude Code 的“流式输出”并不是：

- 直接把模型 token 原封不动吐给外部
- 也不是把内部 message 数组直接 serialize 出去
- 更不是 SDK 和 runtime 共用同一个对象模型

而是：

- **内部状态推进 → 协议映射 → 对外流式投影**

---

### 二、为什么必须把“内部消息”与“外部协议”分开

#### 1. 内部消息服务于 runtime 推进，外部协议服务于消费端稳定性

Claude Code 的内部 message/state 主要解决的是：

- 当前 query 怎样推进
- assistant / tool / tool_result 怎样串联
- compact boundary 怎样影响历史
- attachments 怎样进入上下文
- recovery / stop hooks 怎样影响后续状态

但外部 consumer 真正关心的通常不是这些内部细节，而是：

- 会话什么时候初始化
- assistant 输出了什么
- 工具调用了什么
- 当前 turn 是否结束
- 如何稳定地增量消费这些变化

因此：

- **内部 message model** 更偏 runtime correctness
- **外部 protocol model** 更偏 integration stability

这两个目标不同，所以不能强行共用一个对象模型。

#### 2. 直接暴露内部状态会让外部边界失控

如果 CLI/SDK 直接消费内部 message state，会立刻遇到很多问题：

- 内部虚拟消息是否应该暴露？
- synthetic error 是否属于协议？
- compact/snipped 边界是否要透出？
- attachment message 的内部形态是否稳定？
- 某些 bookkeeping message 是否应对外可见？

这些都说明 runtime 内部对象并不天然适合做 public protocol。

Claude Code 把这层边界单独做出来，本质上是在保护：

- 协议稳定性
- 内部实现可演化性
- 外部集成的兼容性

---

### 三、`system/init` 的意义：协议起点，不是模型上下文

#### 1. `buildSystemInitMessage(...)` 暴露的是 protocol metadata

前面已经看到 `src/utils/messages/systemInit.ts` 里的：

- `buildSystemInitMessage(inputs: SystemInitInputs): SDKMessage`

这个点非常关键，因为它清楚说明 Claude Code 在 turn / session 对外输出时，会显式构造一类：

- `system/init`

协议消息。

它的意义不是：

- 给模型补充上下文
- 作为 query 的一部分送进模型
- 替代 system prompt

而是：

- 对 SDK/CLI/外部消费者说明当前运行环境、初始化信息、协议信息

因此 `system/init` 从一开始就告诉我们：

- **SDK-visible stream != model-visible context**

#### 2. system/init 是 runtime 外化的握手消息

从架构角度看，`system/init` 更像：

- 外部消费者和 Claude Code runtime 之间的握手起点

它起的作用类似于：

- “下面我要开始发一个结构化事件流了”
- “这是这一轮/这一会话的初始化元信息”

这是一种很成熟的协议设计，因为它避免让消费方必须靠猜测去理解后续消息语义。

---

### 四、流式输出到底在流什么

#### 1. 它流的不是“纯 token”，而是结构化运行时事件

很多人会把 streaming 理解成“模型 token 一边出来一边显示”。但从 Claude Code 的整体架构看，更稳妥的理解是：

- 它流的是 **runtime event projection**

这些事件可能包含：

- assistant 内容增量
- tool use 事件
- tool result 事件
- system/init
- 结束或状态切换相关信号

也就是说，Claude Code 的 streaming 更像：

- **结构化 agent event stream**

而不是单纯 token transport。

#### 2. token streaming 只是其中一个子层

模型 token 当然仍然重要，因为 assistant 文本生成本身是流式的。但 Claude Code 运行时不只处理文本：

- 还要处理工具调用
- 还要处理 query 状态推进
- 还要处理 SDK 可见协议对象
- 还要处理 system / assistant / tool 不同语义

因此 token streaming 只是更大 streaming architecture 里的一个局部。

---

### 五、QueryEngine 在这里扮演什么角色

#### 1. QueryEngine 是内部 query runtime 与外部协议流之间的上层桥

前面章节已经说明，`QueryEngine.submitMessage()` 做了几件关键事情：

- 装配 system prompt
- 准备 user/system context
- 发起 `query(...)`
- 产出 `buildSystemInitMessage(...)`
- 将内部 query 产物进一步映射到外部流

这意味着 QueryEngine 不只是“开始一次 query”的入口，它还是：

- **internal runtime → external stream protocol** 的桥

#### 2. QueryEngine 负责把内部执行包装成可消费的会话流

如果没有 QueryEngine 这一层，外部 SDK 可能必须直接理解：

- query loop 细节
- message normalization 时机
- stop hooks 行为
- tool result 内部格式
- compact 边界后的历史投影

这显然不适合作为公开集成接口。

所以 QueryEngine 的另一个重要职责，就是把这些内部复杂性包装成更稳定的流式协议输出。

---

### 六、为什么协议消息不能等于 message history

#### 1. history 是 runtime 记忆结构，protocol 是外部观察结构

message history 的职责是：

- 作为后续模型轮次的输入基础
- 承载 assistant/tool/result 的历史关系
- 支持 compact / recovery / replay / follow-up

但 protocol message 的职责是：

- 向外部消费者报告“刚刚发生了什么”
- 让外部系统做显示、日志、集成、自动化处理

所以：

- history 更像内部记忆结构
- protocol 更像外部观察结构

二者天然不是一回事。

#### 2. protocol 允许按消费需求重组信息

为了对外更稳定，协议层通常会：

- 合并内部细节
- 重命名语义
- 补充初始化信息
- 省略内部 bookkeeping
- 把一次内部状态推进投影成多条外部事件

这也是为什么 Claude Code 需要专门的 mapping 层，而不是直接导出 history。

---

### 七、tool use / tool result 在协议层的意义

#### 1. 工具调用一旦进入协议层，就不再只是内部执行细节

在 query loop 内部，tool use 是主状态机的一部分；但一旦映射到 SDK/stream protocol，它又变成：

- 外部消费者可观察的 agent 行为事件

这很重要，因为它意味着外部系统可以理解：

- assistant 何时决定调用工具
- 调用了什么工具
- 工具返回了什么
- 何时恢复为 assistant 后续响应

因此 tool use / result 在协议层的价值，不是执行本身，而是：

- **让 agent 的行动过程具备可观察性**

#### 2. 这也是为什么 Claude Code 的 streaming 比单纯文本更像 agent protocol

如果流里只有文本，外部系统永远无法可靠理解：

- 哪段文本是模型自然语言
- 哪次停顿是工具调用
- 当前是不是执行中间态
- 什么时候可以把结果视为完整 turn

而结构化 tool event 让这些状态变得可区分。

---

### 八、SDK 边界真正保护的是什么

#### 1. 保护 runtime 内部实现可变

只要内部 message/state 没被直接当成 public API，Claude Code 团队就能继续演化：

- history 存储方式
- compact 机制
- attachment 注入形式
- virtual/synthetic messages
- internal bookkeeping shape

而不必立刻破坏 SDK 调用方。

所以 SDK boundary 首先保护的是：

- **内部实现演化自由度**

#### 2. 保护外部协议稳定性

相反，外部 SDK 消费方需要的是：

- 可预测的事件类型
- 稳定的消息顺序语义
- 清楚的初始化/结束边界
- 可文档化的消息 contract

这意味着协议层的抽象目标不是“最完整”，而是“最稳定、最可消费”。

#### 3. 保护多消费端适配能力

CLI、桌面端、SDK、外部自动化系统，它们的需求并不完全一样。但只要中间有一层结构化 protocol，就可以：

- 在同一 runtime 之上支持多个消费端
- 各端共享同一事件语义
- 避免每个消费端都直接绑定内部实现

---

### 九、流式协议和前面章节的关系

#### 1. 与第 20 章的关系：20 讲“上下文装配”，本章讲“结果外化”

第 20 章的重点是：

- 模型调用前，消息与上下文怎样被拼装

本章的重点则是：

- query 运行之后，内部推进怎样被映射成外部 stream protocol

也就是说：

- `20` 解决输入面
- `23` 解决输出面

#### 2. 与第 22 章的关系：22 讲工具执行，本章讲工具事件如何对外呈现

第 22 章里工具调用属于主状态机的执行面；本章进一步强调：

- 同一工具调用一旦进入 SDK 流，就会变成外部可观察事件

所以：

- `22` 讲执行
- `23` 讲可观察性与协议投影

#### 3. 与 hooks/memory 章节的关系：它们多半属于内部 runtime 机制，不一定直接等价为协议事件

这也有助于理解为什么 Claude Code 没把所有 runtime 机制都暴露成外部事件：外部协议关注的是稳定的消费面，而不是把每个内部 side-channel 都公开。

---

### 十、源码链路下几个更稳的判断

#### 1. Claude Code 明确区分了 model-visible context 与 SDK-visible stream

`system/init` 的存在，以及 QueryEngine 的映射职责，都清楚说明这两者不是同一个平面。

#### 2. 外部 stream 是内部运行时状态的结构化投影，而不是原样导出

这包括 assistant 内容、tool 事件、初始化信息等，都经过协议化处理后才对外暴露。

#### 3. QueryEngine 不只是 query 发起器，也是协议桥接层

它连接了：

- system prompt assembly
- query runtime
- SDK-facing event stream

这是它在整个架构里的一个核心位置。

#### 4. SDK boundary 的价值不在“包装一下”，而在隔离内部演化和外部稳定 contract

这其实是整套 agent runtime 能长期演化的基础之一。

---

### 十一、Harness 视角

从 harness engineering 的角度看，这部分设计很值得重视。

#### 1. agent runtime 最好区分“内部状态模型”和“外部事件模型”

内部状态为了 correctness 和效率服务，外部事件为了稳定集成服务。把两者分开，后续会省掉大量兼容性灾难。

#### 2. 不要把 streaming 理解成 token transport

对 agent 系统来说，真正有价值的 streaming 往往是：

- assistant 增量
- tool 事件
- 状态切换
- 初始化/完成信号

也就是结构化事件流，而不是纯文本管道。

#### 3. 初始化协议消息非常重要

像 `system/init` 这样的握手消息，看似普通，实际上决定了消费方是否能稳健地理解整条流。

#### 4. 可观察性应以协议面提供，而不是暴露全部内部对象

这能同时保留：

- 外部调试/集成能力
- 内部实现演化自由度

---

### 十二、工程化启发

#### 1. 对外协议要围绕消费稳定性设计，而不是围绕内部数据结构偷懒导出

内部对象方便不代表适合公开。协议应该是面向消费者需求设计的投影层。

#### 2. streaming event 最好结构化，而不是全靠文本猜

尤其在带工具调用的 agent runtime 里，结构化事件几乎是必须的。

#### 3. 初始化、增量、结束三类边界最好显式编码

否则消费方会靠推测拼装状态，最终非常脆弱。

#### 4. query engine 之上最好有一层 protocol adapter

Claude Code 的整体形态说明，这层桥接非常值钱，尤其当系统同时服务 CLI、SDK、桌面端和其他外部集成时。

---

## 本章小结

如果把这一章压缩成一句话，可以说：

> Claude Code 的流式输出与 SDK 边界，不是把内部消息原样吐给外部，而是把 query runtime 的状态推进、assistant/tool 事件和初始化元信息，映射成一套可消费、可集成、可稳定演化的结构化事件协议。

从源码脉络能稳妥得出的结论包括：

- `system/init` 属于外部协议握手面，而不是模型上下文本身；
- QueryEngine 不只是 query 入口，也是 internal runtime 到 SDK stream 的桥接层；
- 外部事件流是内部状态推进的协议化投影，而不是 history 的直接导出；
- tool use / tool result 在协议层承担的是可观察性职责；
- SDK boundary 的核心价值是隔离内部实现演化与外部消费稳定性。

## 源码证据索引

- `src/QueryEngine.ts` — query 入口、system prompt 装配、SDK stream 桥接
- `src/utils/messages/systemInit.ts` — `system/init` 协议消息构造
- `src/query.ts` — assistant/tool/result 的内部推进来源
- `src/utils/messages.ts` — internal history / effective history 的消息处理边界

## 相关章节

- [第 04 章：UI and interaction](/claude-code-architecture/04-ui-and-interaction/)
- [第 05 章：integrations and extensibility](/claude-code-architecture/05-integrations-and-extensibility/)
- [第 20 章：message/context assembly](/claude-code-architecture/20-message-and-context-assembly-deep-dive/)
- [第 22 章：tool system 与执行边界](/claude-code-architecture/22-tool-system-and-execution-boundaries/)
- [第 27 章：Runtime Architecture Map](/claude-code-architecture/27-runtime-architecture-map/)
- [第 29 章：Glossary and Core Distinctions](/claude-code-architecture/29-glossary-and-core-distinctions/)

{% include claude-code-architecture-nav.html %}
