---
layout: page
title: "06 状态、配置与权限治理"
permalink: /claude-code-architecture/06-state-config-and-permissions/
book_key: state-config-and-permissions
book_number: "06"
toc: true
---

# Claude Code 仓库架构研究：06 状态、配置与权限治理

## 本章目标

这一章聚焦 Claude Code 中那些“不直接产出功能，但决定系统是否可控”的部分：

- 运行时状态
- UI 状态
- 配置系统
- 权限体系
- 信任边界

## 核心结论

Claude Code 并不是“模型 + 工具”直接裸连，而是在中间放了大量治理层：

1. **双层状态模型**：`bootstrap/state.ts` 与 `AppStateStore.ts` 分别承载底层运行态与前台应用态。
2. **配置系统是演化式的**：设置有 schema、source、migration、managed settings。
3. **权限不是单次判定，而是整套上下文系统**：工具是否暴露、是否可调用、是否需用户确认，都由权限体系动态决定。
4. **trust 是一级安全边界**：工作区信任、CLAUDE.md 外部引用、mcp.json 审批都在正式执行前处理。

## 一、为什么状态是两层的

### 1. `src/bootstrap/state.ts`：底层运行态

这个文件非常长，而且注释直接警告“不要轻易往这里加更多状态”。这说明它承载的是全局关键状态，而不是随手放点临时变量。

从字段看，它包含：

- `originalCwd` / `projectRoot` / `cwd`
- `sessionId` / `parentSessionId`
- 各类 telemetry counter
- cost / API 时长 / tool 时长
- model usage
- trust / persistence / session flags
- scheduled tasks / session cron tasks
- invoked skills
- system prompt section cache
- allowed channels / additional directories
- prompt cache 相关 latch
- last request / last API completion timestamp

可以看出，bootstrap state 更偏：

- 跨模块共享的底层运行时事实
- 需要在 UI 之外长期存在的数据
- 需要被 SDK/headless/桥接等路径共同访问的数据

### 2. `src/state/AppStateStore.ts`：前台产品状态

与 bootstrap state 相比，AppState 更偏前台交互与呈现，例如：

- 当前 view / footer selection
- remote connection status
- bridge 状态
- tasks / foregrounded task / agent registry
- mcp clients/tools/resources
- plugin 启用状态与错误
- notifications / elicitation queue
- prompt suggestion
- tungsten / bagel / companion 之类 UI 面板状态

可以说：

- bootstrap state 管“系统正在发生什么”
- AppState 管“前台要怎么表达它”

### 3. 这种拆法的价值

如果所有状态都进 React store，会有几个问题：

- headless / SDK 路径不方便共用
- 很多底层状态与 UI 生命周期绑定过深
- session 元信息和产品显示状态混杂

拆成两层后，底层 runtime 更稳，UI 也更易演进。

## 二、配置系统：不是简单读 JSON

### 1. 配置在启动最早期就启用

`src/entrypoints/init.ts` 中一开始就执行：

- `enableConfigs()`
- `applySafeConfigEnvironmentVariables()`

这说明配置系统对运行行为影响很大，必须在很多模块真正工作之前准备好。

### 2. 配置来源是分层的

从 `main.tsx`、`skills/loadSkillsDir.ts` 和 settings 相关工具可以看出，设置来源不止一种，至少包括：

- user settings
- project settings
- policy/managed settings
- CLI flags
- inline settings
- remote managed settings

这意味着 Claude Code 的 settings 不是“一个文件说了算”，而是要做 source merge 和优先级处理。

### 3. 演化式迁移

`main.tsx` 导入多个 migration：

- 模型名迁移
- bypass permission 配置迁移
- auto update 配置迁移
- remote control 配置迁移

这说明仓库长期演进中很重视配置兼容，不希望旧用户配置在版本升级后直接失效。

## 三、trust：安全边界前置

### 1. trust dialog 独立于 tool permission

`interactiveHelpers.tsx` 明确写了：

- trust dialog 在 interactive session 中总会出现（除特殊模式）
- bypassPermissions 只影响工具权限，不影响 workspace trust

这是很重要的边界划分。

也就是说：

- **trust** 解决“这个工作区值不值得信任”
- **permission mode** 解决“在已信任环境里工具能否直接执行”

### 2. trust 后才应用完整环境变量

启动时只应用 safe env vars；trust 建立后才 `applyConfigEnvironmentVariables()`。这说明项目显式防范了“来自不可信工作区配置的危险环境变量”过早生效。

### 3. trust 后才进行若干敏感行为

例如：

- 初始化某些 telemetry 相关行为
- 预取 system context
- 批准外部 includes
- 跟踪 repo path mapping

这表明 trust 是很多系统的前置条件，而不是单纯 UI 提示。

## 四、权限体系：不是单一 allow/deny 开关

### 1. tools 暴露前就会先过滤

`src/tools.ts` 提到 blanket deny rule 会在模型看到工具前就把工具移除。说明权限控制的一部分发生在 **tool discovery 阶段**，而不只是 tool invocation 阶段。

### 2. 权限上下文被显式建模

在多处代码中可以看到：

- `ToolPermissionContext`
- `canUseTool`
- `initializeToolPermissionContext`
- `PermissionMode`
- `PERMISSION_MODES`

这说明权限系统是一个上下文对象，不是简单函数。

### 3. 权限模式影响行为方式

从 `main.tsx` 和交互逻辑推断，权限模式至少会影响：

- 是否自动允许某些工具
- 是否需要用户弹窗确认
- bypassPermissions 与 auto mode 下的差异
- 哪些“危险权限”会被 strip 或 remove

### 4. 远程场景里权限还能跨通道传输

`RemoteSessionManager.ts` 里的 `can_use_tool` control request 表明：

- 工具权限请求可从远程会话发到本地/客户端
- 用户响应再回传到远端

这意味着权限模型已经被提升为协议级概念，而不是仅本地 UI 交互。

## 五、MCP 与外部配置审批

### 1. mcp.json server approval

`interactiveHelpers.tsx` 中的 `handleMcpjsonServerApprovals(root)` 说明：来自配置文件的 MCP server 并不会自动无条件启用，而要经过审批流程。

### 2. CLAUDE.md external includes warning

同样地，CLAUDE.md 外部 include 也要在 setup 流程中提醒/批准。

这进一步说明 Claude Code 非常重视“配置文件可能带来外部影响”的问题。

## 六、状态、权限、配置如何汇合到 runtime

在运行时，这三者是交织在一起的：

```text
settings / policy / flags
  -> 决定 mode 与 feature
  -> 影响 tool permission context
  -> 影响 commands / tools / plugins / skills 的加载
  -> 影响 UI setup 流程
  -> 影响 QueryEngine 的执行边界
```

换言之，runtime 并非一个裸 agent loop，而是被配置与治理层包住的。

## 七、为什么治理层这么厚

### 1. 这是一个会读写本地系统的 agent

Claude Code 具备：

- 文件读写
- shell 执行
- 网络访问
- Git 操作
- 外部服务调用
- 插件与 MCP 扩展

只要这些能力并存，就必须有厚治理层，否则产品不可控。

### 2. 项目面向多种用户环境

从源码能看出它需要适应：

- 普通本地交互
- 企业/受管环境
- remote mode
- IDE bridge
- plugin / MCP 扩展环境

这意味着必须支持：

- policy limits
- remote managed settings
- trust gating
- structured permissions

### 3. 配置会长期演进

migrations 的存在说明，项目团队不假设“所有用户都在干净环境下从零开始”。它需要在长期迭代中保持升级路径。

## 八、设计取舍分析

### 1. 为什么把 trust 与 permission 分开

因为这两个问题本来就不同：

- trust：能不能相信这个工作区来源
- permission：在可信工作区里，这个 tool 是否可以执行

混在一起会让安全语义混乱。

### 2. 为什么 bootstrap state 允许非常多元的数据

因为它必须支撑：

- 主线程 UI
- headless SDK
- compaction / prompt caching
- hooks / telemetry
- cron / teams / sessions

这是平台运行态，不是单一页面状态。

### 3. 为什么权限控制要包含“隐藏工具”这一步

因为只在调用时 deny，会导致模型不断尝试不可用工具，既浪费 token，也降低行为稳定性。提前裁掉暴露面更符合 agent runtime 设计。

## 关键文件

- `src/bootstrap/state.ts`
- `src/state/AppStateStore.ts`
- `src/entrypoints/init.ts`
- `src/interactiveHelpers.tsx`
- `src/utils/permissions/`（由引用可见其重要性）
- `src/migrations/`
- `src/schemas/`

## 本章小结

Claude Code 的治理层相当厚实，主要体现在：

- 双层状态模型
- 分来源、可迁移的配置系统
- trust 与 permission 分离的安全模型
- 远程/扩展环境下仍然成立的权限协议

这些机制共同保证：Claude Code 虽然是强能力 agent 工具，但不是“无边界地直接跑”。

## Harness 视角

从 harness engineering 角度，这一章讲的是控制面。Claude Code 的 harness 不只是告诉模型“你能做什么”，还明确区分了 trust、permission、state、settings、managed policy 这些不同层次的边界。`bootstrap/state.ts`、`AppStateStore.ts`、`interactiveHelpers.tsx` 和权限上下文一起构成了运行环境的治理骨架。

尤其值得注意的是 trust 与 permission 的分离：trust 决定工作区是否可信，permission 决定在可信环境里哪些动作可直接执行。这个分层让安全语义更稳定，也更适合远程和企业场景。

## 工程化启发

第一条经验是风险控制必须进入主路径。安全 env vars、trust dialog、mcp.json 审批、CLAUDE.md external include 警告、tool pre-filtering 都说明成熟 agent 产品不能把治理留到最后补。

第二条经验是配置系统要按长期演化来设计。只要系统会升级、会进入受管环境、会支持多来源 settings，就需要 schema、migration、source priority 和 policy overrides；否则产品化后很快会失控。

{% include claude-code-architecture-nav.html %}
