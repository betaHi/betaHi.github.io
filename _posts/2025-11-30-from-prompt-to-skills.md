---
title: 从 Prompt 到 Skills：Claude 和 LangChain 带来的 AI 新范式
date: 2025-11-30 22:36:00 +0800
categories: [Tech, AI Engineering]
tags: [agent-skill, claude, langchain, anthropic, deep-agents, ai-engineering]
---

## 前言

当前大多数 Agent 仍然是通过 **Prompt** 来注入能力：一次性描述目标、流程和规则。但随着 Prompt 越来越长，能力越来越难复用，很快就会遇到 **能力难复用、上下文膨胀、维护成本高** 等问题。

Anthropic 推出的 **Agent Skills**，以及 LangChain 对其的支持，正是在工程层面尝试解决这个问题：

> **让 Agent 的能力从 Prompt，升级为可管理的模块。**
{: .prompt-tip }

---

## 什么是 Skill

> 一个 Skill 是一个目录，包含一个 `SKILL.md` 文件，文件中组织了指令、脚本和资源，用于赋予 Agent 额外能力。
{: .prompt-info }

![Skill 目录结构示意](/assets/img/2025-11-30_1.png)

每个 Skill 的核心文件是 **`SKILL.md`**，用于结构化描述该能力，包括：

- **名称（name）**：Skill 的标识
- **能力说明（description）**：Skill 可以完成的任务
- **使用场景（usage）**：适合调用的情况
- **操作流程（instructions）**：如何使用或调用 Skill
- **依赖信息（dependencies，可选）**：Skill 可能依赖的工具或资源

官方示例中，例如 PDF 处理 Skill（`document-skills/pdf/SKILL.md`），通过 `SKILL.md` 说明了如何让 Agent 读取、编辑和填写 PDF 文件，并附带所需资源和操作说明。这个示例清楚地表明：**Skill 是一个可调用、可管理、可复用的能力单元**。

> 注意：官方并未规定 Skill 目录必须包含特定文件，除 `SKILL.md` 外的脚本、文档、配置或示例文件都是可选的，目的是辅助 Skill 的执行和管理。
{: .prompt-warning }

---

### 1. Skill 与 Prompt 的关系

从工程角度看：

- **Prompt**：负责描述当前任务目标、上下文意图和临时约束
- **Skill**：封装稳定能力、固定流程和可复用操作

也就是说：

> Prompt 负责"调度"，Skill 负责"执行能力"。

比如，Prompt 就像你在家里对吸尘器说："**嘿，打扫下客厅**"，而 Skill 就是吸尘器实际完成扫地、避障、充电的动作：

![Prompt 与 Skill 的关系类比](/assets/img/2025-11-30_2.png)

这种设计让 Agent 的能力不再绑定于单次对话，而是成为可重复调用的模块化单元。

![Skill 作为模块化单元](/assets/img/2025-11-30_3.png)

---

### 2. Skill 的加载机制

Skills 并不会在 Agent 启动时全部加载，而是采用 **索引 → 选择 → 按需加载** 的模式：

- **索引阶段**：加载 Skill 元信息（name、description、usage）作为"能力索引表"
- **规划阶段**：Agent 根据索引判断是否需要某个 Skill
- **执行阶段**：当 Skill 被选中时，完整内容和资源才会加载到上下文

这种延迟加载机制在工程上解决了上下文膨胀、Token 消耗过高和规划执行耦合等问题。

![Skill 的索引、选择、按需加载机制](/assets/img/2025-11-30_4.png)

---

### 3. Skill 的工程价值

在 Skill 体系下，Agent 的能力首次具备了 **软件工程属性**：

- **可复用**：同一 Skill 可被多个 Agent 调用
- **可维护**：Skill 独立更新，无需修改原 Prompt
- **可共享**：团队或组织内部可建立 Skill 仓库
- **可版本化**：支持升级、回滚或灰度发布

通过 Skill，Agent 的能力从一次性文本升级为 **可管理、可演化的工程单元**。

---

## 最后

从工程角度看，Skill 模块化 AI 能力，解耦 Prompt 与执行，使 Agent 可复用、可维护、可扩展。

就像软件插件化一样，AI Agent 的能力越来越需要工程化管理，这也提醒我们，在 AI 发展时代，工程能力同样不能丢。

---

## 参考资料

- [Anthropic - Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [LangChain - Using Skills with Deep Agents](https://blog.langchain.com/using-skills-with-deep-agents/)
- [langchain-ai/deepagents - web-research SKILL.md](https://github.com/langchain-ai/deepagents/blob/master/libs/deepagents-cli/examples/skills/web-research/SKILL.md)
- [anthropics/skills - PDF SKILL.md](https://github.com/anthropics/skills/blob/main/document-skills/pdf/SKILL.md)
