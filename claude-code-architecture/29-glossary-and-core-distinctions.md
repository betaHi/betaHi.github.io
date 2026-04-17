---
layout: page
title: "29 术语表与核心区分"
permalink: /claude-code-architecture/29-glossary-and-core-distinctions/
book_key: glossary-and-core-distinctions
book_number: "29"
toc: true
---

## 本章目标

前面的章节已经逐步形成了一套比较稳定的分析语言。  
这些语言包括：

- main path
- side-channel
- collection point
- compact boundary
- effective history
- governance plane
- runtime substrate
- protocol projection
- durable memory
- task object
- delegated execution
- 等等

这些术语本身并不神秘，问题在于：如果不集中定义，它们就很容易变成“作者写作时顺手用的词”，而不是一套可重复使用的分析框架。

所以这一章的目标有两个：

1. **把前面已经反复使用的核心术语集中定义**
2. **把最容易混淆的概念对明确拆开**

也就是说，这一章不是新增一个新子系统，而是给全书建立：

- 统一术语表
- 核心边界对照表

第 27 章已经给出了总图，第 28 章给出了阅读路径，而本章要做的是：

- **让整套研究的语言系统稳定下来**

---

## 一、先给出总体判断

如果只基于前面章节已经稳定出现的概念来判断，这套 Claude Code 架构研究真正最需要统一的，不是名词数量，而是：

> 哪些词是在描述 runtime 中真实存在的结构边界，哪些词只是在帮助我们命名这些边界；更重要的是，许多最容易出错的理解，不是“没记住概念”，而是把两个本不相同的层面混成了一回事。

因此本章分成两部分：

1. **Glossary：核心术语**
2. **Core Distinctions：核心区分表**

第一部分回答：

- 某个词在本书里是什么意思

第二部分回答：

- 它最容易和什么搞混
- 真正关键的区别在哪里

如果把本章压缩成一句话，可以说：

- 第 27 章给出了地图
- 第 28 章给出了路线
- 第 29 章给出了语言边界

---

# Part A：Glossary

---

## 1. Interaction Plane

**定义**  
Interaction Plane 指 Claude Code 中负责输入入口、用户可见输出、UI/CLI 呈现以及 SDK/protocol 对外边界的那一层。

**它回答的问题**  
- 用户如何进入系统
- 外部消费者如何看到系统输出
- 哪些内容是对外协议，而不是内部状态

**不要把它理解成**  
- Runtime Core  
- 模型上下文层  
- 权限治理层

**相关章节**  
01, 04, 23, 27

---

## 2. Runtime Core

**定义**  
Runtime Core 指 Claude Code 中负责一次 turn 主状态推进的核心骨架，主要由 QueryEngine 与 query loop 组成。

**它回答的问题**  
- 一次 query 如何开始
- assistant / tool / tool_result 如何推进
- 什么时候继续，什么时候停止
- 何时接入旁路能力

**不要把它理解成**  
- 整个 Claude Code 系统本身  
- 所有工具与所有配置的总和

**相关章节**  
03, 13, 19, 20, 27

---

## 3. Execution Plane

**定义**  
Execution Plane 指 Claude Code 中承载“系统实际能做什么”的行动能力层，包括 tool execution、后台任务、调度与子代理委托。

**它回答的问题**  
- agent 可以执行哪些动作
- 长时工作如何推进
- 哪些工作可以被委托或并行化

**不要把它理解成**  
- 只是 Bash  
- 只是 tool registry  
- 只是 query loop 的附属品

**相关章节**  
02, 16, 22, 25, 26, 27

---

## 4. Context Plane

**定义**  
Context Plane 指 Claude Code 中负责构造模型实际可见上下文的那一层，包括 system prompt assembly、context injection、attachments、memory injection、compact boundary 与 message normalization。

**它回答的问题**  
- 模型这一轮到底看到了什么
- 历史怎样被投影成有效输入
- memory / compact / attachments 如何进入 query

**不要把它理解成**  
- 原始消息历史本身  
- UI/SDK 输出协议  
- 普通 transcript dump

**相关章节**  
17, 20, 24, 27

---

## 5. Governance Plane

**定义**  
Governance Plane 指 Claude Code 中负责 settings/config/policy/trust/permissions 等控制面的那一层，用来决定系统哪些能力可被启用、由谁决定、在什么条件下执行。

**它回答的问题**  
- 谁能配置系统
- 哪些配置来源更高优先级
- 工具能否执行
- 哪些高风险行为受治理面控制

**不要把它理解成**  
- 只是用户偏好设置  
- 单一 config 文件  
- UI 层的小交互逻辑

**相关章节**  
06, 21, 22, 27

---

## 6. Side-Channel Plane

**定义**  
Side-Channel Plane 指挂接在 Claude Code 主路径旁边、但不等于主状态转移本身的那一组机制，包括 prefetch、post-sampling hooks、stop hooks、extraction 等。

**它回答的问题**  
- 哪些能力服务主循环但不属于主循环本体
- 哪些分析/提炼/收尾逻辑在主路径之外发生
- 哪些旁路机制是正式 runtime 结构的一部分

**不要把它理解成**  
- 随意插件  
- 主循环的内部步骤  
- 任意时刻都可改写主状态机的泛化扩展系统

**相关章节**  
15, 17, 19, 27

---

## 7. Main Path

**定义**  
Main Path 指一次 query / turn 中负责 assistant → tool → tool_result → continue/stop 推进的主状态转移路径。

**它强调的不是**  
“最重要的代码”，而是：

- 真正参与状态推进的那条路径

**不要把它理解成**  
- 所有会发生的逻辑  
因为很多重要逻辑是 side-channel。

**相关章节**  
13, 15, 19, 22

---

## 8. Side-Channel

**定义**  
Side-channel 指那些服务主路径、影响主路径、但不属于主状态转移本身的并行预取、事后分析、尾部收口或受限写回机制。

**典型例子**  
- relevant memory prefetch
- post-sampling hooks
- stop-hook 阶段的 memory extraction
- skill improvement

**不要把它理解成**  
- 独立插件生态  
- 纯后台无关逻辑  
- 一定可以强控制主状态机的机制

**相关章节**  
15, 17, 19, 29

---

## 9. Collection Point

**定义**  
Collection Point 指主循环中某个明确时机，在这里旁路结果会被检查、消费、合并或决定是否跳过。

**为什么这个词重要**  
因为 Claude Code 的很多旁路能力不是“结果一出来就强塞进主路径”，而是：

- 先并行跑
- 到 collect point 再看 ready 了没有

**不要把它理解成**  
- 任意时刻的回调  
- 一个纯日志点

**相关章节**  
13, 15, 17

---

## 10. Durable Memory

**定义**  
Durable Memory 指 Claude Code 中可跨会话持久保存的 memory 结构，包括 `memdir`、`MEMORY.md` 索引和 typed memory files。

**它解决的问题**  
- 长期用户/项目/协作背景保持

**不要把它理解成**  
- 当前会话摘要  
- relevant memory retrieval 结果  
- compact summary

**相关章节**  
17, 24, 29

---

## 11. Relevant Memory

**定义**  
Relevant Memory 指与当前 user turn 相关、由 runtime 异步检索并在合适时机以 attachment 形式注入的 memory 结果。

**它强调的是**  
- 当前 turn 相关性
- 异步预取
- collect-if-ready
- 动态注入

**不要把它理解成**  
- durable memory 全集  
- memory prompt 本体

**相关章节**  
17, 20

---

## 12. Compact Boundary

**定义**  
Compact Boundary 指会话历史从原始消息阶段切换到压缩后有效历史阶段的显式 runtime 分界。

**它的关键作用**  
- 告诉后续 query 应从哪里继续
- 定义什么是当前有效历史
- 使 compact 成为状态结构操作，而不是单纯摘要

**不要把它理解成**  
- 普通摘要  
- 简单数组截断  
- 会话完全重置

**相关章节**  
20, 24, 29

---

## 13. Effective History

**定义**  
Effective History 指在 compact boundary、message filtering、normalization 等处理之后，真正对当前 query 仍然有效的消息历史投影。

**它强调的是**  
- 当前有效性
- 不是完整原始 transcript
- 是 runtime 可继续工作的历史视图

**不要把它理解成**  
- raw message history  
- durable memory  
- SDK-visible event stream

**相关章节**  
20, 24

---

## 14. Protocol Projection

**定义**  
Protocol Projection 指 Claude Code 将内部 runtime 状态、消息推进和工具事件映射为外部 SDK/stream/consumer 可见协议对象的过程与结果。

**它强调的是**  
- 对外可消费
- 稳定协议
- 与内部对象模型分离

**不要把它理解成**  
- 内部 history 直接导出  
- 模型上下文本身

**相关章节**  
23, 27, 29

---

## 15. Runtime Substrate

**定义**  
Runtime Substrate 指支持一次 Claude Code 会话持续运行所必需的底层 session-scoped runtime state 基底，典型代表是 `bootstrap/state.ts` 这一层。

**它强调的是**  
- 会话级
- 进程内
- 底层支撑
- 不等于 UI store，也不等于 durable config

**不要把它理解成**  
- 全系统唯一 state store  
- 用户设置文件

**相关章节**  
21, 27, 29

---

## 16. Task Object

**定义**  
Task Object 指 Claude Code 会话中用于表示工作项、状态、依赖、描述和进度的正式对象。

**它解决的问题**  
- 把工作推进从聊天上下文中抽出来
- 让长任务、多步骤工作有稳定追踪结构

**不要把它理解成**  
- 后台 Bash 进程本身  
- 子代理本身  
- 简单的文字 TODO

**相关章节**  
25, 29

---

## 17. Background Execution

**定义**  
Background Execution 指被移出当前 turn、异步运行并在完成时通过任务输出或通知重新接回会话的执行过程。

**它强调的是**  
- 长时工作
- 非阻塞当前 query
- 输出回收

**不要把它理解成**  
- task object  
- query loop 的正常同步工具调用

**相关章节**  
25

---

## 18. Delegated Execution

**定义**  
Delegated Execution 指主代理把某个局部问题、实现步骤、研究任务或审查任务交给独立子代理处理的执行方式。

**它强调的是**  
- 委托
- 隔离
- 局部工作单元
- 主代理仍保留综合责任

**不要把它理解成**  
- 普通工具调用  
- 完全放弃主代理理解责任

**相关章节**  
26, 29

---

## 19. Worktree Isolation

**定义**  
Worktree Isolation 指在需要文件系统/VCS 级隔离时，为子代理或并行执行分配独立 git worktree 的执行方式。

**它强调的是**  
- 文件系统级隔离
- 避免并发修改冲突
- 把上下文隔离延伸到代码工作区层

**不要把它理解成**  
- 只是 prompt context 隔离  
- 普通 branch 切换

**相关章节**  
26

---

## 20. Governance Source

**定义**  
Governance Source 指在 Claude Code 中有资格影响系统治理行为的设置来源或控制来源，例如 user settings、project settings、policy settings、managed settings 等。

**它强调的是**  
- 来源差异
- 优先级差异
- 信任等级差异

**不要把它理解成**  
- 所有 settings source 都是同权  
- 任意项目局部配置都可提升高风险权限

**相关章节**  
06, 21, 29

---

# Part B：Core Distinctions

---

## 1. Config vs Settings vs Bootstrap State vs AppState

| 概念 | 是什么 | 不是什么 | 最关键区别 |
|---|---|---|---|
| Config | durable app/project record | 全部治理逻辑 | 偏持久记录层 |
| Settings | 多来源声明式配置结果 | 运行时最终执行上下文 | 偏输入合并层 |
| Bootstrap State | session runtime substrate | UI store / durable config | 偏进程内会话底盘 |
| AppState | UI/reactive projection | 全系统唯一事实源 | 偏界面与交互状态层 |

**最关键的判断**  
这四者最容易被混成“大状态系统”，但实际上它们分属不同生命周期和职责。

**相关章节**  
06, 21, 27

---

## 2. Tool vs Command vs Skill vs Hook vs MCP

| 概念 | 是什么 | 不是什么 |
|---|---|---|
| Tool | 模型可调用的受控执行接口 | 任意内部函数 |
| Command | 用户或系统发起的命令式入口 | 模型工具 contract |
| Skill | 高层工作流/提示资产 | 低层动作接口 |
| Hook | runtime 阶段挂点 | 模型显式动作 |
| MCP | 外部能力接入来源/机制 | 单一 tool 类型 |

**最关键区别**  
- tool 是执行接口  
- command 是入口  
- skill 是高层工作流资产  
- hook 是阶段性旁路挂点  
- MCP 是外部能力来源机制

**相关章节**  
02, 14, 15, 22, 29

---

## 3. Memory vs Compact vs Summary

| 概念 | 是什么 | 不是什么 |
|---|---|---|
| Memory | 长期上下文基础设施 | 当前历史压缩 |
| Compact | 当前会话历史收缩与边界化 | durable memory |
| Summary | 内容变短的表示 | 完整 runtime 边界机制 |

**最关键区别**  
- memory 解决长期协作背景  
- compact 解决当前 session 上下文预算  
- summary 只是内容表示层手段之一

**相关章节**  
17, 24, 29

---

## 4. Internal Message History vs Effective History vs SDK Protocol Stream

| 概念 | 是什么 | 不是什么 |
|---|---|---|
| Internal Message History | runtime 内部持有的消息序列 | 外部协议 |
| Effective History | 当前 query 仍有效的历史投影 | 完整原始历史 |
| SDK Protocol Stream | 外部消费者可见的事件流 | 模型上下文本身 |

**最关键区别**  
这三者分别面向：

- 内部存储/推进
- 当前模型输入
- 外部消费输出

**相关章节**  
20, 23, 24, 29

---

## 5. Main Path vs Side-Channel

| 概念 | 是什么 | 不是什么 |
|---|---|---|
| Main Path | 主状态转移路径 | 全部逻辑 |
| Side-Channel | 服务主路径但不等于主状态转移本身的机制 | 任意外挂插件 |

**最关键区别**  
main path 决定状态推进；side-channel 在旁边提供预取、分析、收尾、提炼。

**相关章节**  
13, 15, 19

---

## 6. Task Object vs Background Execution vs Subagent

| 概念 | 是什么 | 不是什么 |
|---|---|---|
| Task Object | 工作组织对象 | 执行进程本身 |
| Background Execution | 异步执行载体 | 工作对象 |
| Subagent | 独立上下文中的认知工作单元 | 普通后台进程 |

**最关键区别**  
- task 负责组织工作  
- background execution 负责异步跑事情  
- subagent 负责带局部推理与工具使用能力地完成某项工作

**相关章节**  
25, 26, 29

---

## 7. Context Isolation vs Worktree Isolation

| 概念 | 是什么 | 不是什么 |
|---|---|---|
| Context Isolation | 独立 prompt/context window | 文件系统隔离 |
| Worktree Isolation | 独立 git 工作区 | 仅仅是新上下文 |

**最关键区别**  
前者保护认知空间，后者保护代码修改空间。

**相关章节**  
26

---

## 8. Governance Source vs Permission Context

| 概念 | 是什么 | 不是什么 |
|---|---|---|
| Governance Source | 原始配置/策略来源 | 运行时裁决对象 |
| Permission Context | 用于工具执行判断的运行时操作性上下文 | 原始 settings 原文 |

**最关键区别**  
治理来源是“规则从哪来”；permission context 是“运行时拿什么做决策”。

**相关章节**  
21, 22

---

## 9. System Prompt Assembly vs Protocol Init Message

| 概念 | 是什么 | 不是什么 |
|---|---|---|
| System Prompt Assembly | 模型输入构造 | 对外协议握手 |
| `system/init` | SDK-visible init protocol message | 模型上下文的一部分 |

**最关键区别**  
一个面向模型，一个面向外部消费者。

**相关章节**  
20, 23

---

## 10. QueryEngine vs query loop

| 概念 | 是什么 | 不是什么 |
|---|---|---|
| QueryEngine | turn 入口装配与上层桥接 | 全部 runtime 执行细节 |
| query loop | 主状态推进内核 | 对外协议层本身 |

**最关键区别**  
- QueryEngine 更偏入口装配和桥接
- query loop 更偏内部推进

**相关章节**  
03, 13, 20, 23

---

## 三、为什么这一章很重要

前面已经有很多技术结论，但如果没有这一章，整套书会有三个风险：

## 1. 术语越来越多，但边界不够稳定
章节一多，哪怕每章都写得好，术语也会慢慢漂移。  
本章的作用就是防止这种漂移。

## 2. 读者会把“相关”误认为“相同”
很多概念之所以难，不是因为它们完全陌生，而是因为它们彼此相邻：

- memory 和 compact 很像
- config 和 settings 很像
- tool 和 skill/hook/MCP 都在“做事”
- internal messages 和 protocol events 都像“消息”

本章的核心就是明确：

- 相邻，不等于相同。

## 3. 这套研究需要一套能复用到别的 agent runtime 的语言
如果这套术语只适用于 Claude Code，那价值会有限。  
但现在很多术语其实已经超出了 Claude Code 本身，能够用于分析别的 agent runtime，例如：

- main path / side-channel
- governance plane
- context plane
- compact boundary
- protocol projection
- delegated execution

这正是本章的长期价值所在。

---

## 四、Harness 视角

从 harness engineering 的角度看，本章最关键的价值是：

## 1. 帮你避免把不同生命周期对象混成一个系统
这是 agent runtime 最常见的混乱来源之一。

## 2. 帮你避免把输入面、执行面、输出面混为一谈
Claude Code 很成熟的一点，就是这些层分得比较开。

## 3. 帮你把“边界”当成一等架构对象
真正成熟的系统不是功能多，而是边界稳。

## 4. 帮你形成可迁移的分析框架
如果以后你去研究别的 agent runtime，本章很多术语仍然可继续使用。

---

## 五、工程化启发

## 1. 做架构研究时，术语表不是附属品，而是方法论资产
没有术语表，分析很容易变成“这次我这么说、下次我换个说法”。

## 2. 最该花力气定义的，不是功能名词，而是边界名词
例如：

- main path
- side-channel
- compact boundary
- protocol projection

这些词比“某个功能按钮叫什么”更重要。

## 3. 概念对照表往往比长篇解释更能防止误解
尤其是在 agent runtime 里，最致命的误解通常是把两个相邻层混成一个层。

## 4. 好的 glossary 应该既能解释当前系统，也能服务未来分析
Claude Code 这套术语如果收得好，后续不只是这本研究会受益，做别的 runtime 研究也会受益。

---

## 本章小结

如果把这一章压缩成一句话，可以说：

> 这套 Claude Code 架构研究真正需要统一的，不只是若干名词，而是一套围绕 plane、path、boundary、projection、context、governance、delegation 等概念建立起来的分析语言；而最重要的工作，不是记住这些词，而是始终分清哪些概念彼此相关但并不相同。

从本章能稳定得到的收获包括：

- Interaction / Runtime Core / Execution / Context / Governance / Side-Channel 六层总语言被固定下来；
- main path、side-channel、compact boundary、effective history、protocol projection 等核心分析词有了统一定义；
- config/settings/bootstrap state/AppState、tool/command/skill/hook/MCP、memory/compact/summary、task/background/subagent 等最容易混淆的概念被正式拆开；
- 这套研究开始拥有一套更可复用、可迁移、可持续扩展的分析框架。

## 源码证据索引

- `src/QueryEngine.ts` — Runtime Core / QueryEngine 边界代表
- `src/query.ts` — main path、transition、stop / continue 语义代表
- `src/utils/messages.ts` — message normalization 与 context projection 代表
- `src/memdir/memdir.ts` — durable memory 结构代表
- `src/utils/permissions/permissions.ts` — governance / permission decision 代表
- `src/services/tools/toolOrchestration.ts` — execution plane / tool orchestration 代表
- `src/query/stopHooks.ts` — side-channel / collection point 代表

## 相关章节

- [第 17 章：Memory system and persistence](/claude-code-architecture/17-memory-system-and-persistence/)
- [第 20 章：Message and context assembly](/claude-code-architecture/20-message-and-context-assembly-deep-dive/)
- [第 21 章：Config, state, and governance boundaries](/claude-code-architecture/21-config-state-and-governance-boundaries/)
- [第 22 章：Tool system and execution boundaries](/claude-code-architecture/22-tool-system-and-execution-boundaries/)
- [第 23 章：Streaming, event protocol, and SDK boundary](/claude-code-architecture/23-streaming-output-event-protocol-and-sdk-boundary/)
- [第 24 章：Compact, context collapse, and recovery boundary](/claude-code-architecture/24-compact-context-collapse-and-recovery-boundary/)
- [第 25 章：Tasks, scheduling, and background execution](/claude-code-architecture/25-tasks-scheduling-and-background-execution/)
- [第 26 章：Subagents, parallel exploration, and isolation](/claude-code-architecture/26-subagents-parallel-exploration-and-isolation/)
- [第 27 章：总体运行时架构图](/claude-code-architecture/27-runtime-architecture-map/)
- [第 28 章：阅读路径与索引](/claude-code-architecture/28-reading-paths-and-index/)
- [第 30 章：运行时综合与设计原则](/claude-code-architecture/30-runtime-synthesis-and-design-principles/)

{% include claude-code-architecture-nav.html %}
