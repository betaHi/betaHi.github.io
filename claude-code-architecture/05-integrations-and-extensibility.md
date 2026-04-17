---
layout: page
title: "05 集成层与扩展机制"
permalink: /claude-code-architecture/05-integrations-and-extensibility/
book_key: integrations-and-extensibility
book_number: "05"
toc: true
---

# Claude Code 仓库架构研究：05 集成层与扩展机制

## 本章目标

这一章研究 Claude Code 为什么不是一个封闭的本地 CLI，而是一套可外接、可扩展、可远程控制的平台。重点包括：

- MCP
- LSP
- skills
- plugins
- bridge
- remote sessions

## 核心结论

Claude Code 的扩展与集成层非常厚，至少由五类机制组成：

1. **MCP**：接入外部 server、tool、resource
2. **LSP**：为代码理解和编辑增强语义能力
3. **skills**：用 markdown/frontmatter 定义高层工作流资源
4. **plugins**：用外部包与 markdown 定义扩展命令/技能/能力
5. **bridge / remote**：把本地 CLI 扩展为远程会话节点和桥接端点

这五类机制组合后，Claude Code 才真正从“本地终端助手”变成“可组合 agent 平台”。

## 一、MCP：外部能力接入总线

### 1. `src/services/mcp/client.ts` 的角色

这个文件很大，且 import 面非常广：

- `@modelcontextprotocol/sdk` client 与多种 transport
- tool / prompt / resource schema
- auth、oauth、proxy、mTLS、websocket
- MCP tool / auth tool / resource tool
- output truncation、binary persistence、elicitation hooks

这已经说明 MCP 不是一个附属功能，而是平台级子系统。

### 2. 支持多种 transport

从源码可见支持：

- SSE transport
- stdio transport
- streamable HTTP transport
- websocket transport
- SDK control transport

这意味着 Claude Code 把 MCP 看作一种通用能力接入协议，而不是只支持某一种宿主环境。

### 3. MCP 不只是 tool，还有 resource / prompt / auth

文件中涉及：

- List tools
- List resources
- List prompts
- auth provider
- elicitation
- session expiry

这说明 MCP 在 Claude Code 中不是单纯“第三方工具调用”，而是一整套外部上下文与能力协作框架。

### 4. 运行时考虑很多工程细节

源码里对 MCP 专门处理了：

- OAuth token refresh
- 401 / unauthorized 处理
- session expired 检测
- mTLS / proxy / websocket TLS options
- 输出裁剪与大结果持久化
- image resize/downsample
- Unicode sanitize

这些都表明：MCP 在实际产品中被视为高风险、高复杂度集成点，因此有厚实的工程包裹层。

## 二、LSP：代码语义增强层

### 1. `src/services/lsp/manager.ts` 的定位

LSP manager 采用明显的 singleton + async init 模式：

- `lspManagerInstance`
- `initializationState`
- `initializationPromise`
- generation counter 防止过时初始化结果覆盖状态

这说明 LSP 不是必须路径，但又需要在生命周期上被稳定管理。

### 2. 初始化是后台进行的

`initializeLspServerManager()`：

- 非 bare mode 才启用
- 创建 manager 实例
- 异步执行 `.initialize()`
- 成功后注册被动通知处理器
- 失败则清空实例并记录 error

这里的取舍很清晰：

- 不阻塞主程序启动
- 但保留后续等待或重试能力

### 3. LSP 与插件刷新联动

源码注释还提到 plugin refresh 后需要重新初始化 LSP，以避免 plugin LSP server 在早期缓存为空的问题。这说明：

- LSP server 配置部分来自 plugin
- LSP 子系统和 plugin 子系统是联动的

## 三、skills：高层工作流扩展

### 1. skill 的存储形态

`src/skills/loadSkillsDir.ts` 说明 skills 主要以 markdown + frontmatter 形式存在，而不是都写成 TS 代码。

frontmatter 支持的元数据很多：

- 名称、描述、whenToUse
- allowedTools
- model
- hooks
- effort
- shell
- executionContext
- user-invocable

这说明 skills 更像是“可执行的工作流说明书”。

### 2. skill 的加载来源很多

从 `LoadedFrom` 类型可见，skills 可以来自：

- `skills`
- `plugin`
- `managed`
- `bundled`
- `mcp`

说明 skill 不是本地目录专属特性，而是一种统一抽象，外部系统也可以贡献 skill。

### 3. skill 还支持路径与 hooks 约束

`parseSkillPaths()`、`parseHooksFromFrontmatter()` 表明 skill 可以附带：

- 路径作用域
- hooks 行为

这意味着 skill 并不是纯 prompt 片段，它具备相当程度的上下文约束能力。

## 四、plugins：包级扩展机制

### 1. plugin 能带命令和技能

`src/utils/plugins/loadPluginCommands.ts` 显示 plugin markdown 会被递归扫描，然后转换为 commands / skills。

其命名机制支持：

- plugin name
- namespace
- skill directory
- `skill.md`

也就是说，plugin 扩展不局限于 JS API，而是支持内容式扩展。

### 2. skill directory 是目录级能力单元

当目录中存在 `skill.md` 时，该目录被视为一个 skill 单元，而不是简单把目录下所有 markdown 都独立当命令。这个设计很适合组织较复杂的插件化工作流。

### 3. plugin 扩展的优势

这种基于 markdown/frontmatter 的插件内容模型，具备几个明显优点：

- 可读性高
- 适合分发
- 不必让每个扩展都写 JS 逻辑
- 易于在命令与技能之间共享结构

## 五、Bridge：本地 CLI 与远程控制/CCR 的桥接层

### 1. `src/bridge/bridgeMain.ts` 的角色

bridgeMain 相关代码揭示它不仅是“转发器”，而是一个完整的桥接运行时，涉及：

- API client
- token refresh scheduler
- session spawn
- timeout watchdog
- heartbeat
- worktree creation/removal
- session title 管理
- capacity wake
- multiple session spawn gate

这表明 bridge 是 Claude Code 的一级运行模式，而不是外围插件。

### 2. bridge 可管理多个会话

从源码可见：

- `activeSessions`
- `sessionStartTimes`
- `sessionWorkIds`
- `sessionWorktrees`
- `capacityWake`

说明 bridge loop 需要长期管理一组 session，而不是一次性 proxy 请求。

### 3. bridge 与 worktree 深度集成

bridge 会创建和清理 session worktree，说明远程工作项与本地 repo 隔离执行环境之间有直接耦合。

这也解释了为什么 worktree 在这个仓库里不是边缘功能。

## 六、RemoteSession：远程会话管理

### 1. `src/remote/RemoteSessionManager.ts`

这个类负责：

- 通过 WebSocket 订阅远程 session 消息
- 通过 HTTP 发送用户消息
- 管理 permission request / response
- 处理 reconnect / disconnect

### 2. 远程控制消息不只是对话消息

源码区分了：

- `SDKMessage`
- `SDKControlRequest`
- `SDKControlResponse`
- `SDKControlCancelRequest`

尤其 `can_use_tool` 这类 control request 表明：

远程会话并不是“只同步对话文本”，而是把权限控制流也同步过来。

### 3. viewerOnly 模式

配置中还有 `viewerOnly`，表示纯观察者模式：

- 不发送中断
- 不更新 session title
- 关闭某些 reconnect/interaction 行为

这说明 remote session 被设计为可支持不同交互等级的客户端。

## 七、这些扩展机制如何配合

从架构上看，可以把扩展与集成层理解为三圈：

### 第一圈：本地增强

- skills
- plugins
- LSP

它们主要增强本地 Claude Code 的功能和工作流。

### 第二圈：外部能力接入

- MCP

它让 Claude Code 能访问外部系统、资源和工具。

### 第三圈：跨进程/跨设备/跨环境协作

- bridge
- remote session

它们让 Claude Code 不再局限于本地当前终端，而能接入远程控制与会话同步场景。

## 八、设计取舍分析

### 1. 为什么 skills 要走 markdown/frontmatter

这降低了扩展门槛，也让工作流定义更像“配置 + 内容”，而不是只能用代码扩展。

### 2. 为什么 MCP 需要厚重的 client 层

因为它面对的是外部系统，不可控因素很多：

- auth
- transport
- session expiry
- 大输出
- 二进制内容
- 资源与 prompt 类型差异

这些不能交给上层随意处理，必须在接入层统一兜住。

### 3. 为什么 bridge / remote 要成为独立子系统

因为它们改变的是部署形态和交互边界，不是局部 feature：

- 本地 CLI 变成 remote node
- 会话跨设备同步
- 权限决策跨通道传递
- 甚至涉及 child session 生命周期与 worktree 管理

## 关键文件

- `src/services/mcp/client.ts`
- `src/services/lsp/manager.ts`
- `src/skills/loadSkillsDir.ts`
- `src/utils/plugins/loadPluginCommands.ts`
- `src/bridge/bridgeMain.ts`
- `src/remote/RemoteSessionManager.ts`

## 本章小结

Claude Code 的扩展层不是“加几个插件点”这么简单，而是形成了完整的平台能力：

- MCP 负责外部能力接入
- LSP 负责代码语义增强
- skills / plugins 负责内容式扩展
- bridge / remote 负责跨进程与远程控制

这使它能够从本地 REPL 演化成可外接、可分发、可远程协作的 agent 平台。

## Harness 视角

从 harness engineering 角度，这一章讲的是 harness 如何从单机运行盒子长成平台。MCP、LSP、skills、plugins、bridge、remote 并不是同一种扩展点，而是作用在不同层：tool/resource 协议接入、代码语义增强、工作流模板、产品扩展包、跨进程桥接、远程会话同步。

这里最有价值的点是“扩展机制不止一种”。Claude Code 没把所有问题都做成 plugin，而是给不同问题提供不同接入面，这让 harness 更容易长期演化。

## 工程化启发

第一条经验是为不同扩展需求设计不同边界。想加模型动作、工作流、外部协议接入、远程会话管理，本来就是不同问题，不该强行压成一种抽象。

第二条经验是外部集成必须有厚接入层。`src/services/mcp/client.ts` 对 auth、transport、session expiry、output truncation 的处理说明：真正产品化时，最难的往往不是“接上协议”，而是把外部不确定性工程化地兜住。

{% include claude-code-architecture-nav.html %}
