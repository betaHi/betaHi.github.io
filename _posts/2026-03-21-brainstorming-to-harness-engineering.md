---
title: Brainstorming 之后，还缺什么？从 Superpowers 到 Harness Engineering 的一次观察
date: 2026-03-21 16:40:00 +0800
categories: [Tech, AI Engineering]
tags: [ai-coding, spec-driven, harness-engineering, superpowers, kiro, openai]
---

最近这段时间，我持续用了 Superpowers。它给我留下印象最深的，不是代码生成本身，而是其中的 `brainstorming`。

Superpowers 在 README 里对自己的定位是：

> "A complete software development workflow for your coding agents, built on top of a set of composable 'skills' and some initial instructions that make sure your agent uses them."

它对 workflow 的描述也很明确，不是直接从 prompt 进入 coding，而是先经过一系列前置环节：

> "brainstorming"  
> "using-git-worktrees"  
> "writing-plans"  
> "subagent-driven-development or executing-plans"  
> "test-driven-development"  
> "requesting-code-review"  
> "finishing-a-development-branch"

如果只看这个顺序，其实已经能看出一个很强的工程倾向。重点不在"让 agent 更快写"，而在"让 agent 不要过早开始写"。

Superpowers 在 "How it works" 里还有一句更直接的话：

> "As soon as it sees that you're building something, it doesn't just jump into trying to write code. Instead, it steps back and asks you what you're really trying to do."

这里最值得注意的，不是它"会问问题"，而是它明确反对一件事——"it doesn't just jump into trying to write code"。

这其实对应了一个在 AI coding 里很常见、但又经常被忽略的问题。很多失败不是因为模型不会实现，而是因为实现开始得太早。需求还没澄清，约束还没显式化，验收条件也没有固定，agent 已经开始产出代码了。

如果用工程一点的话来说，这里暴露出的首先不是 `implementation gap`，而是 `problem framing gap`。而 `brainstorming` 的作用，更像是在把自然语言需求往一个更接近 `spec` 的方向推进。

## 从 brainstorming 到 spec

如果只把 `brainstorming` 理解成"一个对话体验更好的功能"，其实会低估它。

从 Superpowers 自己的描述来看，它想做的不是单点增强，而是把编码前的工程动作重新拉回工作流。README 里这样写：

> "Once it's teased a spec out of the conversation, it shows it to you in chunks short enough to actually read and digest."

这里有一个非常关键的动作：从对话中"tease a spec out"——它要做的并不只是继续聊天，而是把 conversation 转成 spec。哪怕这个 spec 不是重型文档，也至少意味着：目标、约束、边界和方向要先被说清楚。

这也是我为什么更愿意把它放在 `Spec-Driven Development` 的框架里看，而不是简单归类成"一个好用的 AI 插件"。

这个判断不只出现在 Superpowers 身上，Kiro 的表述也在强化同一件事。

Kiro 首页最直接的产品描述就是：

> "Tame complexity with spec-driven development, advanced steering, and custom agents"

它把从 prompt 到执行的过程拆成了几步：自然语言先变成结构化 requirements，再生成架构设计，最后拆解为与需求逐条对应的离散任务。官方博客里的表述更完整：

> "From single prompt to requirements"  
> "Technical design based on requirements"  
> "Implement tasks"  
> "Catch issues before they ship with hooks"

趋势已经很清楚了。新一代 agent 工具开始系统性地反对 `prompt -> code` 的单跳模式，转而强调 requirements、design、tasks 和 hooks 之间的衔接。

Kiro 介绍文章里还有一段话，直接点出了为什么 spec 变得重要：

> "It's fun and feels like magic. But getting it to production requires more. What assumptions did the model make when building it? You guided the agent throughout, but those decisions aren't documented. Requirements are fuzzy and you can't tell if the application meets them."

这段话有两个重点。

第一，原型阶段的"magic"并不等于生产级开发。  
第二，问题不只是代码写出来没有，而是决策有没有沉淀、需求是否清晰、结果是否可验证。

所以，不管是 Superpowers 的 `brainstorming`，还是 Kiro 的 `spec-driven development`，它们都在处理同一个前置问题：不要让 agent 在一个模糊输入上高速运行。

## 但 spec 不是终点

不过，只讲到 spec 还不够。

即便 requirements 更清楚了，design 被展开了，tasks 也拆好了，agent 仍然可能在执行阶段出问题。它可能看不懂 repo 结构，不知道哪份文档是最新事实；可能能改代码，但看不到应用运行状态；也可能没有办法稳定地验证修复、发现回归、遵守架构边界。

也就是说，spec 解决的是"该做什么"的一部分问题，但没有自动解决"如何稳定地把事情做对"。

OpenAI 关于 `Harness Engineering` 的文章，讨论的正是这后一层。

文章一开头就把工程师角色变化讲得很明确：

> "Humans steer. Agents execute."

接着又给出一个更完整的定义：

> "...the team's primary job is no longer to write code, but to design environments, specify intent, and build feedback loops that allow Codex agents to do reliable work."

拆开来看，这个定义覆盖了四个关键动作：design environments、specify intent、build feedback loops，最终指向 do reliable work。文章关心的已经不只是 prompt 或 spec，而是 agent 工作所依赖的完整系统——它把"可靠性"问题放到了环境、约束和反馈的层面，而不是只放在模型本身。

OpenAI 在文中的几个具体判断进一步撑起了这个方向。比如知识组织上，repo 的 `docs/` 目录被当作 system of record；可理解性上，"Agent legibility is the goal"；而关于知识边界，有一句话尤其值得记住：

> "From the agent's point of view, anything it can't access in-context while running effectively doesn't exist."

关于工程纪律的落点：

> "What's become clear: building software still demands discipline, but the discipline shows up more in the scaffolding rather than the code."

这两句话点出了一个很实际的问题。今天大多数团队在尝试 AI coding 时，投入最多精力的仍然是 prompt 层面的调优，但真正决定 agent 能否稳定工作的，往往是那些更"基础设施"级别的东西：文档是否机器可读、测试能否自动跑通、架构规则有没有 lint 或 hook 兜底。这些不是新问题，但在 agent 参与之后，它们从"最好有"变成了"必须有"。

## 这三者其实在回答同一条链路上的不同问题

把 Superpowers、Kiro 和 Harness Engineering 放在一起看，它们并不是三个孤立话题，而是在回答同一条链路上的不同问题。

Superpowers 更关注工程入口。它的 `brainstorming` 对应的是：在编码之前，先把问题讲清楚。

Kiro 更关注 spec 的结构化落地。它把 requirements、design、tasks、hooks 做成产品能力，让 spec 不只是讨论产物，而是执行入口。

Harness Engineering 更进一步，开始讨论 agent 如何在复杂工程环境里稳定工作。也就是：repo 如何组织，文档如何维护，工具如何接入，规则如何机械约束，验证如何形成反馈闭环。

如果一定要把这条链路压缩成一句话，大概可以写成：

`brainstorming` 解决的是规格形成。  
`spec-driven workflow` 解决的是执行编排。  
`harness engineering` 解决的是长期可靠性。

这个递进关系，比简单地比较哪一个工具"更强"，更接近问题本质。

## 一个更有用的五层框架

如果继续往下抽象，我会更愿意用一个五层模型来理解今天的 AI 开发系统：

1. `Intent layer`
2. `Spec layer`
3. `Plan layer`
4. `Harness layer`
5. `Execution layer`

`Intent layer` 是原始意图，也就是用户真正要解决的问题。

`Spec layer` 是把意图转成工程输入。Superpowers 的 `brainstorming`，核心就在这里。它不是直接进入 implementation，而是先"tease a spec out of the conversation"。

`Plan layer` 是把 spec 转成任务序列。Kiro 对 requirements、design、tasks 的强调，本质上是在强化这一层，让 spec 与执行之间存在更稳定的桥接。

`Harness layer` 是让 agent 可持续工作的系统环境。OpenAI 文中的关键词基本都属于这一层：`system of record`、`legibility`、`feedback loops`、`mechanical enforcement`。

`Execution layer` 才是大家最熟悉的部分，也就是写代码、跑测试、调试、修复、提交。

如果用这个框架去看，会发现一个现象很明显：大家表面上还在讨论生成能力，但真正开始拉开差距的，其实已经越来越是 `Spec layer` 和 `Harness layer`。

这也是为什么 OpenAI 那篇文章会把重心放在环境、文档、工具、规则和反馈上，而不是只谈代码生成效率。

不过这个框架也暴露出当前的断裂点。Spec layer 到 Plan layer 的转换，今天仍然高度依赖模型自身的推理能力，缺乏稳定的结构化桥接；而 Harness layer 的建设成本不低，对于小团队或早期项目来说，过重的 harness 可能反而成为负担。这五层不是每一层都需要同等投入，关键是识别当前瓶颈在哪一层，把有限的工程精力放对位置。

## 结尾

写到这里，再回到最初那个问题：`brainstorming` 之后，还缺什么？

如果只从使用体验看，答案似乎是更多能力。但从工程角度看，答案更具体：缺的不是再强一点的生成，缺的是一个更完整的工程系统。

这个系统至少包括更清晰的 spec、更稳定的 plan、更可访问的知识、更可见的工具环境、更明确的架构约束，以及更闭环的自动化验证。这些并不是新的软件工程原则，但在 agent 参与开发之后，它们的地位明显前移了。原因不复杂：对人类工程师来说，很多隐含上下文可以靠经验补足；对 agent 来说，凡是看不见、读不到、测不了、约束不了的东西，几乎都不构成稳定前提。

所以 AI 编程的真正变化，可能不是"软件工程被替代"，而是"软件工程的重心被重新分配"——discipline 越来越多地落在代码之外的结构上。

当然，这个方向也有它的张力。Spec 和 harness 的前置投入并非没有代价：过重的流程可能拖慢探索性开发，过多的约束可能限制 agent 的自主性。对不同规模的团队、不同阶段的项目，平衡点并不相同。

但至少有一件事正在变得清楚：

从不加区分的 `prompt -> code`，  
到强调规格形成的 `spec-driven workflow`，  
再到强调环境、约束和反馈回路的 `harness engineering`。

AI 编程下一阶段真正值得关注的，不再只是模型生成能力，而是工程系统能力。

## 参考链接

- [Superpowers - GitHub](https://github.com/obra/superpowers)
- [OpenAI - Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)
- [Kiro 官网](https://kiro.dev/)
- [Kiro - Introducing Kiro](https://kiro.dev/blog/introducing-kiro/)
