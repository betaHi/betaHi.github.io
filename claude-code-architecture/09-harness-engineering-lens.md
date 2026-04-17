---
layout: page
title: "09 Harness 工程经验综合"
permalink: /claude-code-architecture/09-harness-engineering-lens/
book_key: harness-engineering-lens
book_number: "09"
toc: true
---

## 这一章要解决的问题

这本书之所以存在，是因为 **harness engineering** 这个词指向了一个过去几年没有被很好命名的工程方向：围绕模型构建可长期运行的受控环境。Claude Code 恰好是这个方向上一份开源可读、相对成熟的样本。

这一章不讲 Claude Code 的具体模块——那是第三篇的工作。这一章做四件事：

1. 给 harness 一个基于源码的工作定义；
2. 给出一套可以用来拆解任何 agent runtime 的**观察框架（七问）**；
3. 把 Claude Code 的成熟度压成 **12 条可迁移的工程判断**；
4. 把这些判断组织成一份**迁移清单**，帮助你在自己的系统里走正确的顺序。

这一章同时综合了原书中分散在「harness lens / engineering patterns / study roadmap / cross-cutting synthesis」几章的结论。它们本来就在讲同一件事。

---

## 一、Harness 的工作定义

仅基于 Claude Code 源码归纳，harness 可以这样定义：

> **一个围绕模型构建的、受控的运行环境。它不仅负责把 prompt 发给模型，还负责定义模型能看到什么、能调用什么、调用后会发生什么、失败后怎么恢复、状态如何保存、风险如何控制、能力如何扩展、长期协作如何维持。**

按这个定义，harness 不是某个文件或某个组件，而是一整套**协作结构**。Claude Code 的 harness 至少包含：

- 清晰的 **runtime 骨架**（`QueryEngine` + `query` loop）
- 正式的 **context shaping**（system prompt、user context、memory 注入、attachment 系统）
- 受控的 **execution boundary**（tool registry + permission pipeline）
- 显式的 **side-channel plane**（prefetch、post-sampling hooks、stop hooks、extraction）
- 独立的 **governance plane**（settings、trust、policy、managed settings）
- 专门的 **long-horizon infrastructure**（memory、compact、tasks、subagent）

把 Claude Code 读成 harness，关键不是「它功能多」，而是**它把这些本来会被零散处理的问题做成了正式结构**。

---

## 二、拆解任何 agent runtime 的七问观察框架

这是这一章最可迁移的部分。如果你要研究任何一个 agent 系统——不止 Claude Code——以下七个问题是最有用的切入点。每个问题后面附上 Claude Code 里对应的源码线索，供对照。

```mermaid
flowchart LR
    Q1["定义环境"] --> Q2["构造上下文"]
    Q2 --> Q3["定义动作空间"]
    Q3 --> Q4["执行恢复"]
    Q4 --> Q5["治理接入"]
    Q5 --> Q6["辅助复杂度"]
    Q6 --> Q7["演进支持"]
```

### 1. 它怎样定义运行环境？

**关键线索**：`src/entrypoints/cli.tsx`、`src/main.tsx`、`src/entrypoints/init.ts`

入口层决定的不是「用不用 REPL」，而是：系统打算同时服务哪些产品形态（REPL、bridge、daemon、background session、remote、MCP server）、哪些初始化必须前置、哪些必须 fast-path。

**可迁移判断**：harness 的第一件事不是「想 prompt」，而是**定义执行环境**。如果一开始就把所有模式塞在一个 `main()` 里，以后再拆就很难。

### 2. 它怎样构造模型可见的上下文？

**关键线索**：`src/QueryEngine.ts`、`src/query.ts`、`src/utils/messages.ts`、`src/utils/messages/systemInit.ts`、`src/memdir/memdir.ts`

上下文不是「拼一个大 prompt」。它是 system prompt + user/system context + memory prompt + attachments + tool results + effective history 的**系统化投影**。

**可迁移判断**：**上下文不是字符串，是基础设施**。真正的 harness engineering，本质上很大一部分是 context engineering infrastructure。

### 3. 它怎样定义模型的行动空间？

**关键线索**：`src/tools.ts`、`src/Tool.ts`、`src/tools/*`、`src/services/tools/toolOrchestration.ts`

工具不是「列一个 JSON schema 给模型」。Claude Code 的 tool 要经过：编译期裁剪 → 运行期按环境启用 → 权限上下文过滤 → 最终才进入模型可见面。

**可迁移判断**：**模型的 action space 必须被结构化建模**。「暴露几个函数」和「做一个受控 tool surface」是两件事。

### 4. 它怎样把执行推进成可恢复回路？

**关键线索**：`src/QueryEngine.ts`、`src/query.ts`、`src/services/tools/StreamingToolExecutor.ts`、`src/services/tools/toolOrchestration.ts`

这里要解决的不是「一问一答」，而是：一轮任务如何持续推进、tool use 后如何继续、compact 后如何恢复、output token 不够怎么办、budget 超限怎么办。

**可迁移判断**：**恢复能力必须进入主流程，不是异常路径**。成熟 harness 的 recovery 不在 try/catch 里，而在状态机的 transition 上。

### 5. 它怎样把治理接进运行时？

**关键线索**：`src/utils/permissions/permissions.ts`、trust dialog、tool permission context、remote permission requests

治理的关键是它不是补丁层，而是主路径的一部分。Claude Code 的权限点分布在：工具暴露前（编译期）、工具注册后、模型可见前、每次调用前（`canUseTool`）、结果落地后。

**可迁移判断**：**权限不是设置页的概念，是运行时的 admission control**。这也是 Claude Code 和大多数 demo agent 最根本的差别之一。

### 6. 它怎样处理主路径之外的辅助复杂度？

**关键线索**：`src/utils/hooks/postSamplingHooks.ts`、`src/query/stopHooks.ts`、`src/services/extractMemories/extractMemories.ts`、`src/services/SessionMemory/sessionMemory.ts`

不是所有认知工作都该塞进主 query loop。某些提炼、总结、memory 写回、skill improvement 更适合放到 side-channel。但 side-channel 仍然要受权限、工具面、观测面约束。

**可迁移判断**：**side-channel 不是附属物，是正式平面**。长期协作 agent 最典型的成熟标志之一，就是这个平面被显式切出来、有自己的生命周期和权限边界。

### 7. 它怎样支持长期演化？

**关键线索**：`src/services/analytics/index.ts`、feature gates、`src/services/mcp/client.ts`、`src/skills/loadSkillsDir.ts`、`src/utils/plugins/loadPluginCommands.ts`、`src/remote/RemoteSessionManager.ts`

harness 不是封闭的运行盒子。它要**可观测、可实验、可 rollout、可扩展、可持续演化**。这意味着从第一行代码起就要有遥测、gate、扩展点、managed settings 的位置。

**可迁移判断**：**没有遥测，就没有演化**。没有 gate，就没法安全 rollout。没有扩展面，系统会在第一次外部集成需求前崩掉。

---

## 三、12 条可迁移的工程判断

这一节是本章最核心的清单。它从 Claude Code 源码里归纳，也只从能在源码中找到对应证据的观察中归纳。

### 1. 把启动性能当成架构问题，而不是优化尾活

**证据**：`src/entrypoints/cli.tsx` 的 fast-path 分流；`src/main.tsx` 顶部在模块 import 前就触发 profiling、MDM 读取、keychain prefetch；重模块用动态 import 延后加载。

**判断**：对 CLI 型 agent，启动慢会直接伤害使用体验。不要等产品做完再 profile，一开始就要区分「必须快的路径」和「可以懒加载的模块」。

### 2. 把模式分流做成明确入口层

**证据**：入口层分流 version / bridge / remote-control / daemon / background sessions / 特定 MCP server 模式。

**判断**：一旦系统会有多种运行形态（本地、后台、远程、SDK），就不要把所有逻辑塞进一个 `main()`。承认不同形态是不同产品。

### 3. 把用户入口和模型入口分开

**证据**：Claude Code 有两套系统——`commands` 对人说话，`tools` 对模型说话。

**判断**：command 和 tool 混在一起，迟早要在权限模型、后续扩展、产品语义上付出代价。

### 4. 把执行循环做成核心 runtime，而不是薄胶水

**证据**：`QueryEngine` 管 session，`query` 管 turn，compact / recovery / budgets / hooks 都进入主循环。

**判断**：很多团队把 agent 写成 `compose prompt → call model → maybe call tool → done`。Claude Code 告诉你真正的工程重心是：何时继续、何时压缩、何时恢复、何时允许工具、何时附加副作用、何时终止。这是 agent engineering 的「操作系统层」。

### 5. 把风险控制设计成主路径，而不是补丁

**证据**：trust dialog、safe env vars / full env vars 分阶段应用、`mcp.json` 审批、`CLAUDE.md` external includes 警告、permission mode、tool pre-filtering。

**判断**：强能力 agent 的风险控制不能靠文档提醒，必须进入启动流程、runtime 逻辑、配置系统、协议行为。

### 6. 上下文工程必须分层，不要混成一团

**证据**：Claude Code 明确区分 system prompt、system context、user context、message history、memory prompt、relevant memory attachments、queued attachments、skill 资源。每一层有不同的进入时机和权限边界。

**判断**：长会话 agent 一旦开始运行，上下文就不能当字符串管理。至少要分开：持久背景、工作流资源、当前 turn 的检索结果、写回阀门。

### 7. 工具系统首先是 contract design

**证据**：工具要经过编译期裁剪、运行期环境启用、权限上下文过滤、`canUseTool`、orchestration 语义化并发。

**判断**：「有几个 function calling schema」不等于有 tool system。tool system 是 contract，不是命令池。

### 8. Side-channel 默认可失败，写入面必须做窄

**证据**：prefetch 错过本轮就跳过、post-sampling hook 出错只记录、stop hooks 有明确进入条件、memory extraction 用 forked agent + 极窄工具集、skill improvement 只写 project skill 文件。

**判断**：好的 harness 不是「让一切增强能力都能强力接管」，而是：分析旁路默认 fail-open；真正能改状态、写长期对象、阻断流程的路径必须做窄并加约束。

### 9. 预算和权限是运行时控制面，不是运维指标

**证据**：token / tool result budget 会直接裁剪 messagesForQuery；compact / collapse / autocompact 会改状态机转移；`canUseTool` 决定工具是否进入实际执行；denial 会累积为会话运行态。

**判断**：预算决定上下文如何被治理，权限决定动作如何被放行，二者共同决定系统能否稳定推进。它们不是后期加的监控，是架构的一部分。

### 10. 长期上下文系统必须读写分离

**证据**：读路径（system prompt 注入 / turn 内 retrieval / nested discovery）和写路径（stop-hook extraction / forked agent / 受限工具集 / 窄写入面）被明确分开。

**判断**：如果把 memory 做成「任意读写的黑箱」，长期上下文很快会失控。正确做法是把 retrieval / injection / extraction / persistence 拆成四个有边界的阶段。

### 11. 扩展机制不要只有一种

**证据**：Claude Code 至少有四种扩展面——tools（模型动作）、skills（工作流资源）、plugins（产品功能包）、MCP（外部系统协议），再加上 bridge / remote。

**判断**：不同问题要给不同扩展面。想加模型动作用 tool，想加工作流用 skill，想加功能包用 plugin，想接外部系统用 MCP。混用会让每种扩展都变钝。

### 12. Observability 要低耦合、早可用、可替换 sink

**证据**：`src/services/analytics/index.ts` 公共 API 极薄、无依赖避免循环引用、sink 延迟 attach、早期事件排队、敏感 metadata 强类型约束。

**判断**：大型 agent 系统的日志/事件层一定要能在启动最早期就可用，且不能拖着业务代码走。没有这一层，后面的评测和 rollout 都会吃亏。

---

## 四、迁移清单：走正确的顺序

如果你想把这些判断应用到自己的系统，顺序很重要。直接「照抄完整形状」几乎一定会失败。Claude Code 自己也是分阶段长成这样的。

### 阶段一：最小 runtime 骨架

先做这几件，不做别的：

- 明确入口与模式分流
- 清楚的 session owner + turn loop
- 显式的 tool registry
- 基本的 permission gate

这一步完成后，你已经有了一个可运行的 harness，虽然很简陋。

### 阶段二：上下文工程基础设施

在骨架之上补：

- 原始历史 vs 当前 query 视图分离
- system / user context 的分开装配
- tool results 和 attachments 作为一等对象
- 简单的 memory / summary 分层（先不做 compact）

这一步完成后，你的系统开始能处理稍长的会话。

### 阶段三：长期协作层

逐步引入：

- compact / recovery
- durable memory + session memory
- async tasks / background execution
- subagent + 上下文隔离

这一步完成后，系统变成真正的长期协作 agent。

### 阶段四：平台化与可演化

最后做：

- feature gates + dynamic config
- telemetry / analytics 基础设施
- plugins / MCP 扩展面
- remote / bridge / managed settings
- controlled self-improvement 机制（见 [第 10 章](/claude-code-architecture/10-memory-evaluation-and-self-improvement/)）

这一步完成后，系统具备长期演化的能力。

**关键提醒**：不要跳阶段。跳阶段做出来的「看起来像 Claude Code」的系统，在第一次真实使用中会暴露所有被省略的边界。

---

## 五、Claude Code 比典型 demo agent 多了什么

如果要用一张对照图总结这一章：

### 典型 demo agent 的结构

```text
prompt
  → model
  → tool call
  → print result
```

### Claude Code 的实际结构

```text
entrypoint / mode dispatch
  → config / trust / policy / environment init
  → command + tool registry assembly
  → system prompt + context + memory assembly
  → QueryEngine session owner
  → query loop with orchestration / budgets / recovery
  → permissions / hooks / compact / side-channels
  → UI / remote / bridge / tasks / background execution
  → analytics / diagnostics / rollout / extensibility
```

两者不是「功能多少」的差别，是**工程化程度**的差别。这个差别，就是这一章想要帮你看懂并迁移的东西。

---

## 六、这一章之后读什么

- 想看每个子系统怎么工作：进入第三篇（13–26）
- 想看评测和受控自改进：读 [第 10 章](/claude-code-architecture/10-memory-evaluation-and-self-improvement/)
- 想要总图：跳到 [第 27 章](/claude-code-architecture/27-runtime-architecture-map/)
- 想要术语统一定义：跳到 [第 29 章](/claude-code-architecture/29-glossary-and-core-distinctions/)
- 想看最终综合原则：跳到 [第 30 章](/claude-code-architecture/30-runtime-synthesis-and-design-principles/)

## 源码证据索引

本章引用的源码已在上文「七问观察框架」和「12 条工程判断」中逐条标注。更完整的符号级索引见 [附录 A：源码证据索引](/claude-code-architecture/appendix-a-source-index/)。

## 相关章节

- [第 08 章：从产品结构到工程视角：过渡章](/claude-code-architecture/08-conclusions-and-reading-guide/)
- [第 10 章：评测基础设施与受控自改进](/claude-code-architecture/10-memory-evaluation-and-self-improvement/)
- [第 13 章：Agent Loop 深挖](/claude-code-architecture/13-agent-loop-deep-dive/)
- [第 20 章：消息与上下文装配深挖](/claude-code-architecture/20-message-and-context-assembly-deep-dive/)
- [第 27 章：总体运行时架构图](/claude-code-architecture/27-runtime-architecture-map/)
- [第 30 章：运行时综合与设计原则](/claude-code-architecture/30-runtime-synthesis-and-design-principles/)

{% include claude-code-architecture-nav.html %}
