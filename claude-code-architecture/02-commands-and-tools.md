---
layout: page
title: "02 命令系统与工具系统"
permalink: /claude-code-architecture/02-commands-and-tools/
book_key: commands-and-tools
book_number: "02"
toc: true
---

# Claude Code 仓库架构研究：02 命令系统与工具系统

## 本章目标

这一章分析 Claude Code 中最重要的两套“能力入口”：

- 用户侧的 **命令系统**
- 模型侧的 **工具系统**

重点回答：

1. 为什么系统要同时存在 command 和 tool 两层抽象？
2. 两者如何注册、裁剪、启用和过滤？
3. 这套结构如何支撑 Claude Code 成为 agent 平台？

## 核心结论

Claude Code 明显采用了“双接口架构”：

- **commands** 面向人类用户，承载产品级语义和显式交互入口
- **tools** 面向模型，承载可执行能力和 runtime 能力边界

两者不是重复关系，而是两种不同受众的 API：

- Command 更像“前台菜单与操作入口”
- Tool 更像“模型运行时可调用的系统调用面”

从源码上看：

- `src/commands.ts` 是 command 注册中心
- `src/tools.ts` 是 tool 注册中心
- 两者都受到 feature flag、用户类型、运行模式、权限上下文等条件影响

## 一、命令系统：`src/commands.ts`

### 1. 命令系统的角色

命令系统对应用户在 CLI 中输入的 slash commands。比如：

- `/config`
- `/mcp`
- `/review`
- `/tasks`
- `/plan`
- `/permissions`
- `/theme`
- `/skills`

它的本质不是“模型执行能力”，而是产品工作流入口。

### 2. 注册方式

`src/commands.ts` 顶部显式导入大量命令模块，例如：

- `./commands/config/index.js`
- `./commands/mcp/index.js`
- `./commands/review.js`
- `./commands/tasks/index.js`
- `./commands/branch/index.js`
- `./commands/plugin/index.js`
- `./commands/agents/index.js`

然后在 `COMMANDS` 数组里统一组合。

这个设计的意义在于：

- command registry 是集中定义的
- 命令是否出现，是主程序显式控制的
- 用户可见功能列表因此容易做 feature gating 和模式过滤

### 3. 条件命令与内部命令

`commands.ts` 中大量使用 `feature('...') ? require(...) : null`。这意味着：

- 某些命令只在特定 build 中存在
- 某些命令只对内部用户开放
- 某些命令只在特定实验特性开启时出现

例如源码里可见：

- `PROACTIVE`
- `KAIROS`
- `BRIDGE_MODE`
- `VOICE_MODE`
- `WORKFLOW_SCRIPTS`
- `TORCH`
- `BUDDY`

同时还有 `INTERNAL_ONLY_COMMANDS` 这样的分组，表明命令集合本身就带有产品版本边界。

### 4. 动态来源：skill / plugin / builtin plugin

命令并不都来自源码硬编码：

- `getSkillDirCommands()`：从 skill 目录加载命令
- `getBundledSkills()`：bundled skill
- `getBuiltinPluginSkillCommands()`：内建 plugin 提供命令/skill
- `getPluginCommands()` / `getPluginSkills()`：第三方 plugin 扩展

也就是说，command registry 实际上是：

```text
内建命令
+ bundled skills 转换的命令
+ 内建插件命令
+ 外部插件命令
```

command 系统因此不只是“静态命令表”，而是一个扩展汇聚点。

## 二、工具系统：`src/tools.ts`

### 1. 工具系统的角色

如果命令系统面向用户，那么工具系统面向模型。它决定 assistant 在一次 query 里到底能调用哪些能力。

`src/tools.ts` 的 `getAllBaseTools()` 是关键入口。它返回理论上当前环境中“所有可能可用的 tool 列表”。

### 2. 基础工具集合

从 `getAllBaseTools()` 可以看到大量关键工具：

- `AgentTool`
- `BashTool`
- `FileReadTool`
- `FileEditTool`
- `FileWriteTool`
- `GlobTool`
- `GrepTool`
- `NotebookEditTool`
- `WebFetchTool`
- `WebSearchTool`
- `SkillTool`
- `EnterPlanModeTool` / `ExitPlanModeV2Tool`
- `TaskCreateTool` / `TaskGetTool` / `TaskUpdateTool` / `TaskListTool`
- `EnterWorktreeTool` / `ExitWorktreeTool`
- `AskUserQuestionTool`
- `LSPTool`
- `ListMcpResourcesTool` / `ReadMcpResourceTool`
- `ToolSearchTool`

这些工具合起来，构成 Claude Code 的 agent 执行平面。

### 3. 条件工具与环境裁剪

工具系统和命令系统一样，也存在大量条件加载。例如：

- `SleepTool` 仅在 `PROACTIVE` / `KAIROS`
- cron tools 仅在 `AGENT_TRIGGERS`
- `WebBrowserTool` 仅在 `WEB_BROWSER_TOOL`
- `WorkflowTool` 仅在 `WORKFLOW_SCRIPTS`
- `ConfigTool` / `TungstenTool` 仅 ant user
- `PowerShellTool` 受平台与开关控制

这说明 tool registry 是一个“理论全集”，实际暴露给模型之前会继续被收缩。

## 三、为什么 commands 和 tools 必须分开

### 1. 受众不同

- command 由人主动触发
- tool 由模型在 agent runtime 内按上下文自主调用

这两类接口的交互语义完全不同。

### 2. 生命周期不同

- 命令通常是 session 级、UI 级、产品操作级入口
- 工具通常是单轮推理中的执行动作

例如：

- `/config` 是用户想修改配置
- `Read` / `Edit` / `Bash` 是模型在完成任务时调用的原子能力

### 3. 安全与权限边界不同

tool 天然涉及：

- permission context
- allow/deny rule
- prompt-based approval
- runtime filtering

而 command 更多是显式用户意图，不一定走同样的权限判断模型。

### 4. 可组合性不同

tool 是 agent orchestration 的基本积木。

例如一次 agent 任务可能这样流转：

```text
Read -> Grep -> Read -> Edit -> Bash(test) -> TaskUpdate
```

这些都不适合建模为 slash commands。

## 四、工具系统的过滤机制

### 1. `getAllBaseTools()` 不是最终暴露集合

源码注释已经明确：

- `getAllBaseTools()` 返回当前环境下可能可用的全部工具
- 后面还要根据 permission context 和 deny rule 过滤

也就是说，模型看到的工具列表是 **动态上下文相关** 的，不是编译后静态固定的。

### 2. blanket deny 过滤

`tools.ts` 后半段说明：

- 若 permission context 中存在对某 tool 的 blanket deny rule
- 该工具会在模型看到之前被移除

这个设计很重要，因为它不是“模型调用后再拒绝”，而是“根本不让模型看到它”。

这会降低：

- 不必要的工具试探
- 无效 tool planning
- 模型对不可用工具的依赖

### 3. 模式开关参与暴露面

tool 暴露面还受以下因素影响：

- worktree mode
- LSP 是否启用
- agent swarms 是否启用
- todo v2 是否启用
- embedded search tools 是否存在
- environment 是否支持 powershell

因此工具能力集合是：

```text
编译期 feature flag
+ 运行期环境条件
+ 用户类型
+ 权限上下文
+ 当前模式
```

共同决定的。

## 五、技能与插件如何进入命令/工具体系

### 1. skills 是 markdown 驱动的高层工作流

`src/skills/loadSkillsDir.ts` 表明 skills 通过 markdown + frontmatter 加载，支持：

- `description`
- `whenToUse`
- `allowedTools`
- `model`
- `hooks`
- `executionContext`
- `agent`
- `effort`
- `shell`

这说明 skill 不是普通文档，而是带元数据的“工作流资源”。

### 2. plugin 也能带 commands / skills

`src/utils/plugins/loadPluginCommands.ts` 表明 plugin markdown 文件可以递归收集，并转换成 command/skill。并且 skill 目录可以通过 `skill.md` 形成目录级技能。

因此 plugin 并不只是加载 JS 模块，而是可以通过 markdown/frontmatter 这套机制定义高层功能入口。

### 3. 命令与 skill 的边界

可以这样理解：

- command 更接近用户显式触发的入口
- skill 更接近模型工作流提示模板
- plugin 可以给两边都扩展

这让系统具有明显的“平台化”特征。

## 六、命令系统与工具系统的配合关系

在运行时，二者通常以这条链协作：

```text
用户输入 slash command
  -> command 解析成某种产品动作/提示
  -> 进入 QueryEngine / query 流程
  -> 模型在运行中调用 tools
```

例如一个命令可能：

- 改变模式
- 注入提示词
- 打开 UI 面板
- 发起一次高层任务

而真正完成任务时，模型再通过 tools 执行细粒度操作。

## 七、设计取舍分析

### 1. 为什么 command registry 集中而不是自动发现

集中注册能带来：

- 更强的产品控制力
- 更清晰的 feature-gating
- 更容易做内部/外部构建差异化

### 2. 为什么 tool registry 要区分“全集”和“最终可用集”

因为工具可用性高度依赖运行态：

- 当前模式
- 当前权限
- 当前环境
- 当前用户类型

如果直接写成静态列表，会让 permission 与 product policy 难以表达。

### 3. 为什么 skill 使用 markdown/frontmatter

这显然是为了降低扩展成本：

- 易于编辑
- 易于分发
- 易于通过目录结构组织
- 不要求每个 skill 都写 JS/TS

## 关键文件

- `src/commands.ts`
- `src/tools.ts`
- `src/Tool.ts`
- `src/skills/loadSkillsDir.ts`
- `src/utils/plugins/loadPluginCommands.ts`

## 本章小结

Claude Code 通过 **commands + tools** 这套双接口架构，把“人类操作入口”和“模型执行能力”明确分开：

- command 负责产品层语义
- tool 负责 agent runtime 能力
- skills / plugins 进一步扩展二者

这种设计让系统既能像一个可用的 CLI 产品，又能像一个可组合的 agent 平台。

## Harness 视角

从 harness engineering 角度，这一章对应的是 action surface 设计。Claude Code 没有把“用户入口”和“模型入口”混成一套接口，而是用 `src/commands.ts` 和 `src/tools.ts` 把两者明确分开：command 对人说话，tool 对模型说话。这样的双接口架构让 harness 的前台控制面和模型行动面彼此解耦。

更重要的是，tool surface 并不是静态全集。构建开关、运行环境、用户类型、权限上下文、deny rules 会共同决定模型最终能看到什么工具。这正是成熟 harness 的特征：行动空间必须被显式注册、显式裁剪、显式授权。

## 工程化启发

第一条经验是把 action surface 做成 registry，而不是散落在各处的隐式能力。集中注册更利于 feature gating、权限治理和产品差异化。

第二条经验是权限最好前置到“暴露阶段”而不是只在“调用阶段”拒绝。Claude Code 通过 blanket deny 在模型看到工具前就裁掉它们，减少无效试探、降低 token 浪费，也让行为更稳定。

{% include claude-code-architecture-nav.html %}
