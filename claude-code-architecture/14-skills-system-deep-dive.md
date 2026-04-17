---
layout: page
title: "14 Skills 系统深挖"
permalink: /claude-code-architecture/14-skills-system-deep-dive/
book_key: skills-system-deep-dive
book_number: "14"
toc: true
---

## 本章目标

这一章专门研究 Claude Code 里的 skills 系统，尽量基于源码而不是预设印象，回答几个更具体的问题：

1. skill 在这个仓库里到底是什么？
2. skills 从哪里来，怎样进入系统？
3. frontmatter 各字段会影响什么？
4. skills 与 command / tool / plugin 的边界在哪里？
5. `skillImprovement` 到底代表什么程度的“自改进”？

```mermaid
flowchart LR
  A[启动时注册] --> B[prefetch 相关 skill]
  B --> C[turn 内发现]
  C --> D[attachment 注入]
  D --> E[模型使用]
  E --> F[post-sampling 反馈]
```

## 一、先给出总体判断

如果只基于当前源码做判断，我会把 Claude Code 的 skill 概括成：

> 一种以 markdown + frontmatter 为载体、可被系统加载为 `prompt` 型 command、可附带工具约束与执行元数据、可由本地目录 / plugin / bundled / managed / mcp 多来源提供的工作流资源抽象。

它和 `05-integrations-and-extensibility.md` 的关系是：

- `05` 把 skills 放在扩展层总览里讨论
- 本章单独下钻 skill 的数据模型、加载链路、frontmatter 语义与运行时边界

它不像普通文档，因为它会进入运行时；
它也不像底层 tool，因为它本身不直接执行系统动作；
它也不完全等于 plugin，因为 plugin 只是其中一种来源。

更接近的说法是：

- **skill 是工作流级 prompt resource**
- 但它已经带有一部分 DSL / 元数据系统的味道

## 二、skills 在仓库里是什么

## 1. 代码层面，skill 被加载成 `Command`

在 `src/skills/loadSkillsDir.ts` 中，核心动作并不是“读文档”，而是把 skill 变成一个 `Command`。

`createSkillCommand(...)` 最终返回的是：

- `type: 'prompt'`
- `name`
- `description`
- `allowedTools`
- `whenToUse`
- `model`
- `disableModelInvocation`
- `userInvocable`
- `context`
- `agent`
- `effort`
- `paths`
- `hooks`
- `getPromptForCommand(...)`

这非常重要，因为它说明：

- skill 在系统里的第一等身份不是“文件”，而是 **prompt command object**
- skill 会和其他命令一起进入命令系统
- 调用 skill 本质上是在运行一个带元数据的 prompt-producing command

## 2. skill 的内容由 markdown body + frontmatter 共同组成

在 `parseSkillFrontmatterFields(...)` 中可以看到 frontmatter 解析的字段包括：

- `name`
- `description`
- `allowed-tools`
- `argument-hint`
- `arguments`
- `when_to_use`
- `version`
- `model`
- `disable-model-invocation`
- `user-invocable`
- `hooks`
- `context`
- `agent`
- `effort`
- `shell`

而 markdown body 则作为最终 prompt 内容主体。

也就是说：

- **frontmatter 负责元数据与运行约束**
- **markdown body 负责实际工作流说明**

## 3. `getPromptForCommand()` 说明 skill 在调用时才真正展开

skill command 的 `getPromptForCommand(args, toolUseContext)` 会动态做这些事情：

1. 把 skill base dir 写进 prompt 前缀
2. 做参数替换 `substituteArguments(...)`
3. 替换 `${CLAUDE_SKILL_DIR}`
4. 替换 `${CLAUDE_SESSION_ID}`
5. 如果不是 MCP skill，还会执行 prompt 中的 shell snippets

这说明 skill 不是“加载时就已经固化”的文本，而是 **调用时按上下文展开** 的资源。

## 三、skills 从哪里来

## 1. 本地 skills 目录

`getSkillDirCommands(cwd)` 会加载：

- managed skills dir
- user skills dir
- project skills dirs
- `--add-dir` 对应的 additional dirs

对应来源被标记为：

- `managed`
- `userSettings`
- `projectSettings`

本地 skill 目录使用的主要格式是：

```text
skill-name/
  SKILL.md
```

源码明确写了：

- `/skills/` 目录只支持目录格式 `skill-name/SKILL.md`
- 单个 markdown 文件在 `/skills/` 下不作为技能加载

## 2. legacy `/commands/` 目录

`loadSkillsFromCommandsDir(...)` 还兼容老式 `/commands/` 目录中的 markdown command/skill。

这里支持两种格式：

- 目录形式 `.../SKILL.md`
- 单个 `.md` 文件

这说明当前仓库里 skills 系统并不是一次性重写出来的，而是从旧 command 生态演化来的。

## 3. plugin skills

`src/utils/plugins/loadPluginCommands.ts` 中可以看到：

- plugin 既可以提供 command
- 也可以提供 skill
- plugin 的 skillsPath / skillsPaths 会被递归扫描
- skill 目录里的 `SKILL.md` 会被转成 plugin source 的 `prompt` command

并且 skill 名字会自动 namespaced，例如：

- `pluginName:skillName`
- 或更深层 `pluginName:namespace:skillName`

所以 plugin 不是 skill 的替代物，而是 **skill 的分发与命名空间来源之一**。

## 4. bundled / mcp / managed 来源

`LoadedFrom` 类型中还明确列出了：

- `bundled`
- `mcp`
- `managed`

这说明 Claude Code 把 skill 当成统一抽象，不同来源只是同一抽象的不同供给路径。

特别值得注意的是 MCP skills：

- MCP skills 也能通过 `createSkillCommand` 路径接入
- 但 `getPromptForCommand()` 中明确禁止对 MCP skills 执行 inline shell commands

这说明远程 skills 被视为不可信来源，有单独安全边界。

## 四、frontmatter 各字段实际影响什么

## 1. `allowed-tools`

这是最关键的字段之一。

在 `createSkillCommand().getPromptForCommand()` 中，执行 prompt shell commands 时会临时把：

- `alwaysAllowRules.command = allowedTools`

注入到 tool permission context 中。

这说明 `allowed-tools` 不只是文档说明，而是会影响：

- skill 执行时 prompt 内 shell command 的权限语义
- skill 被系统视为允许使用哪些工具

## 2. `model`

`model` 会经过 `parseUserSpecifiedModel(...)` 解析。

它的含义不是直接“替换底层模型调用实现”，而是 skill 作为 command 被调用时，向上层 runtime 提供偏好的模型配置。

## 3. `hooks`

`parseHooksFromFrontmatter(...)` 会用 `HooksSchema()` 做验证。

这说明 skill 可以自带 hook 配置，而不是只能依赖全局 hooks。

也就是说，skill 本身可以成为某些 hook 行为的作用范围与配置承载点。

## 4. `context`

这里只认：

- `fork`

也就是 `executionContext: 'fork'`。

这个字段很关键，因为它说明某些 skill 可以要求在 forked context 下执行，而不是内联进当前主线程。

这超出了“prompt 模板”的范围。

## 5. `agent`

skill frontmatter 可以带 `agent`。

这说明 skill 还能和 agent selection / subagent 执行策略发生关系，不只是文本提示。

## 6. `effort`

`effort` 通过 `parseEffortValue(...)` 解析。

说明 skill 可以把“任务投入强度”变成显式元数据，而不是完全靠 prompt 描述。

## 7. `shell`

`shell` 会经过 `parseShellFrontmatter(...)` 校验，并传给 `executeShellCommandsInPrompt(...)`。

这表明 skill 允许在 prompt 展开阶段执行受控 shell 片段，但这不是无条件发生的：

- 仅非 MCP skill
- 仍依赖工具权限与上下文

## 8. `paths`

`parseSkillPaths(...)` 会把 frontmatter 的 paths 转成 gitignore-style patterns。

这些 path patterns 进一步用于：

- conditional skill activation

也就是说，skill 可以不是“总是可见”的，而是：

- 只有当用户操作了某些路径时才被激活

这是一种很有意思的上下文感知技能发现机制。

## 五、skills 如何进入系统

## 1. 启动时加载一批 unconditional skills

`getSkillDirCommands(cwd)` 会先加载全量 skill，再分成：

- unconditional skills
- conditional skills

unconditional skills 直接返回给系统。

## 2. conditional skills 会暂存，等路径触发后激活

带 `paths` 的 skill 不会立刻都暴露给模型，而是先放在：

- `conditionalSkills`

之后通过：

- `activateConditionalSkillsForPaths(filePaths, cwd)`

在命中文件路径时激活，并转移到：

- `dynamicSkills`

这说明 Claude Code 的 skills 不是静态全集，而是有一部分具备 **按文件上下文逐步显现** 的行为。

## 3. 文件操作还能触发动态 skills 目录发现

`discoverSkillDirsForPaths(...)` 会从文件路径往上走，寻找嵌套的 `.claude/skills` 目录。

找到后通过 `addSkillDirectories(...)` 加载，并发出 `skillsLoaded.emit()`。

这意味着 Claude Code 支持一种很强的“近场 skill 发现”机制：

- 你操作哪个子目录
- 系统就可能发现那个子目录附近的新 skills

这比“启动时一次性扫完所有技能”更灵活，也更贴近大仓库分层工作流。

## 六、skills 与 command / tool / plugin 的边界

## 1. skill 不是 tool

这一点从类型上就很清楚：

- tool 是 `Tool`
- skill 最终被加载成 `type: 'prompt'` 的 `Command`

tool 的职责是执行动作；
skill 的职责是生成工作流 prompt 与约束。

所以 skill 更接近“工作流入口”，不是“原子能力”。

## 2. skill 也不是普通 slash command

虽然 skill 会进入命令系统，但和普通 built-in slash commands 还是不同：

- built-in command 更偏产品功能入口
- skill command 更偏可复用工作流资源

换句话说：

- command 是用户入口层抽象
- skill 是 command 体系中的一类特殊资源型入口

## 3. plugin 不是 skill，但可以承载 skill

plugin 提供的是包级分发、命名空间和额外来源。

skill 则是其中某种可加载内容。

所以二者关系更像：

- plugin 是容器 / 发行渠道
- skill 是容器里的工作流资源

## 4. skill 也不只是 prompt 模板

如果它只是 prompt 模板，就不该拥有这些特征：

- `allowed-tools`
- `hooks`
- `context: fork`
- `agent`
- `effort`
- dynamic activation by paths
- plugin / managed / mcp 多来源统一加载

因此更准确的说法是：

> skill 是“带运行时元数据的 prompt resource”。

## 七、`skillImprovement` 说明了什么

`src/utils/hooks/skillImprovement.ts` 很值得看，因为它展示了 skills 系统和“受控改进”怎样结合。

## 1. 它不是无条件一直运行

`initSkillImprovement()` 明确要求：

- `feature('SKILL_IMPROVEMENT')`
- GrowthBook gate `tengu_copper_panda`

同时 `shouldRun(context)` 还要求：

- `querySource === 'repl_main_thread'`
- 当前存在 project skill
- 每累计 `TURN_BATCH_SIZE = 5` 个 user messages 才分析一次

所以这不是默认全面开启的自改进机制，而是 gated、限频、限场景的 side-channel。

## 2. 它分析的是“最近消息是否包含可泛化偏好”

hook 会把：

- 当前 project skill 定义
- 最近一批 user/assistant messages

送给一个小模型，让它判断：

- 用户是否提出了应该永久写进 skill 的偏好/纠正/新步骤

输出形式是：

- `<updates>[...]</updates>`
- 每项包含 `section / change / reason`

这本质上不是自动改任意系统代码，而是：

- 从交互中抽取 skill-level 改进建议

## 3. 自动应用也有明确边界

`applySkillImprovement(skillName, updates)` 只会：

- 读取 `.claude/skills/<name>/SKILL.md`
- 调小模型重写该 skill 文件
- 要求保留 frontmatter 和整体结构
- 输出完整更新文件
- 然后写回技能文件

所以它的改写面非常窄：

- 只限 project skill 文件
- 不是任意源码
- 不是系统核心 runtime

因此更准确的说法应该是：

> Claude Code 在 skills 上展示了一种局部、受限、可解释的自改进机制。

## 八、从源码能得出的最稳妥判断

## 1. skills 更像工作流资源层

证据主要有：

- 以 markdown body 为主要内容
- 以 frontmatter 承载执行元数据
- 被加载成 prompt command
- 不直接执行动作，而是指导动作

所以 skill 的主身份不是 plugin、不是 tool，而是工作流资源层。

## 2. 但它已经带有轻量 DSL 的味道

因为它拥有：

- 参数替换
- session variables
- plugin variables
- shell interpolation
- model / effort / hooks / context / paths 等元数据

这使它不再只是静态模板，而是接近一种轻量 workflow DSL。

## 3. skills 是 Claude Code 扩展面中非常“高层”的一层

如果把扩展面分层，大致会是：

- tool：原子动作
- command：用户入口
- skill：可复用工作流资源
- plugin：分发/命名空间/打包容器
- MCP：外部协议级接入

在这个结构里，skill 处在比 tool 更高、比 plugin 更具体的位置。

## 九、和已有文档的边界

与 `05-integrations-and-extensibility.md` 相比，本章新增的重点主要是：

- skill 最终怎样被收敛成 `type: 'prompt'` 的 command
- local / legacy commands dir / plugin / managed / bundled / mcp 这些来源怎样统一到同一抽象
- `allowed-tools`、`hooks`、`context`、`agent`、`effort`、`shell`、`paths` 这些 frontmatter 字段到底影响什么
- conditional skills、dynamic skills、nested skill dir discovery 这些运行时激活机制
- `skillImprovement` 为什么更像受控 skill-level rewrite，而不是泛化的系统自改写

因此这章不是在重复 `05` 的扩展层总览，而是在把 skills 作为一个独立子系统单独拆开。

## 本章小结

如果把这一章压缩成一句话，就是：

> Claude Code 的 skill 不是普通 prompt 模板，也不是底层工具，而是一层带运行时元数据的工作流资源系统；它既是扩展面，也是把用户经验沉淀成可复用流程的载体。

这也是为什么从这个仓库学习时，skills 值得被单独当成一个系统来研究。

## 源码证据索引

- `src/skills/loadSkillsDir.ts` — skill 目录扫描、frontmatter 解析、`createSkillCommand(...)`
- `src/utils/plugins/loadPluginCommands.ts` — plugin skills 的递归加载与命名空间化
- `src/commands/types.ts` — skill 最终收敛为 `type: 'prompt'` 的 command 抽象
- `src/utils/hooks/skillImprovement.ts` — skill-level improvement 的 gated side-channel 实现
- `src/skills/SkillManager.ts` — conditional skills、dynamic skills、nested skill dir discovery

## 相关章节

- [第 05 章：integrations / extensibility 总览中的 skills 位置](/claude-code-architecture/05-integrations-and-extensibility/)
- [第 15 章：`skillImprovement` 作为 post-sampling side-channel 的 runtime 接入](/claude-code-architecture/15-hooks-and-side-channels-deep-dive/)
- [第 18 章：skills 作为长期工作流资源进入运行时横切结构](/claude-code-architecture/18-runtime-cross-cutting-synthesis/)
- [第 22 章：skills 与 tool / command / MCP 的执行边界区别](/claude-code-architecture/22-tool-system-and-execution-boundaries/)
- [第 26 章：skills 与 subagent / context isolation 的关联](/claude-code-architecture/26-subagents-parallel-exploration-and-isolation/)
- [第 29 章：skill / command / tool / plugin / MCP 等术语边界](/claude-code-architecture/29-glossary-and-core-distinctions/)

{% include claude-code-architecture-nav.html %}

{% include mermaid.html %}
