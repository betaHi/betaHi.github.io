---
title: Skills 与 Prompts、MCP 以及 Subagents 之间的对比说明
date: 2025-12-26 16:49:00 +0800
categories: [Tech, AI Engineering]
tags: [agent-skill, prompts, mcp, subagents, claude, ai-engineering]
---

> Skills 正在成为一种越来越强大的工具，用于创建自定义的 AI 工作流和智能代理。但它们在 Claude 技术栈中处于什么位置？本文将解释在不同场景下应该使用哪种工具，以及它们是如何协同工作的。
{: .prompt-info }

## 智能代理构建模块

---

### 1. 什么是 Skills

Skills 是包含指令、脚本和资源的文件夹，Claude 会在任务相关时动态发现并加载它们。

> 你可以把 Skills 理解为专项训练手册，让 Claude 在特定领域具备专业能力——从处理 Excel 表格，到遵循你所在组织的品牌规范。
{: .prompt-tip }

![Skills 概念示意](/assets/img/2025-12-26_1.png)

#### Skills 如何工作

- 当 Claude 遇到一个任务时，它会扫描可用的 Skills 来寻找相关匹配
- Skills 采用"渐进式披露"（progressive disclosure）机制：首先加载元数据（约 100 个 token），仅提供足够的信息，让 Claude 判断某个 Skill 是否相关
- 当确实需要时，才会加载完整指令（少于 5k tokens），而随附的文件或脚本则只在实际需要时才会被加载

**原理上来说：**

> Skills 利用 Claude 的虚拟机（VM）环境，提供了超越仅靠 prompts 所能实现的能力。Claude 运行在一个可访问文件系统的虚拟机中，使得 Skills 可以以目录的形式存在，内部包含指令、可执行代码和参考资料，其组织方式就像你为新团队成员准备的一份入职指南。
>
> 这种基于文件系统的架构支持渐进式披露：Claude 会按需分阶段加载信息，而不是一开始就一次性占用全部上下文。

#### 什么时候使用 Skills

**当你需要持续、高效地执行某些专业化任务时，应选择使用 Skills。它们非常适合以下场景：**

- **组织级工作流**：品牌规范、合规流程、文档模板
- **领域专业能力**：Excel 公式、PDF 处理、数据分析
- **个人偏好**：笔记体系、编码模式、研究方法

**例子**：创建一个品牌规范的 Skill，其中包含你公司的配色方案、字体排版规则以及版式规范。当 Claude 创建演示文稿或文档时，它会自动应用这些标准，而无需你每次都重新说明。

> 参考示例：
> - 品牌规范的 Skill：[brand-guidelines/SKILL.md](https://github.com/anthropics/skills/blob/main/skills/brand-guidelines/SKILL.md)
> - 更多例子：[anthropics/skills](https://github.com/anthropics/skills/blob/main/skills)
{: .prompt-info }

---

### 2. 什么是 Prompts

Prompts 是你在对话过程中以自然语言提供给 Claude 等 Agent 的指令。

> Prompt 是短暂的、对话式的、即时响应的——你在当下提供上下文和方向。
{: .prompt-tip }

#### 什么时候使用 Prompts

- **一次性请求**：例如「总结这篇文章」
- **对话中的即时调整**：例如「把语气改得更专业一些」
- **即时上下文处理**：例如「分析这份数据并找出趋势」
- **临时指令**：例如「把内容格式化成项目符号列表」

> **小提示（Pro-tip）**：Prompts 是你与 Claude 交互的主要方式，但它们不会在不同对话之间持久保存。对于需要反复使用的工作流或专业知识，建议将这些 prompts 整理成 **Skills 指令**。
{: .prompt-tip }

#### 那么，什么时候可以用 Skills 来替代呢

如果你发现自己在多个对话中反复输入同样的 prompt，那么就该考虑创建一个 Skill 了。比如把「将这份分析整理为包含执行摘要、关键发现和建议的格式」这样的重复性指令，转化为 Skills。这样可以避免你每次都重新解释流程，并确保执行结果的一致性。

---

### 3. 什么是 Subagents

> Subagents 是专门化的 AI 助手，拥有各自独立的上下文窗口、自定义的系统提示词以及特定的工具权限。它能够独立处理具体任务，并将结果返回给主代理。
{: .prompt-info }

#### Subagents 是如何工作的

每个 subagent 都使用独立的配置运行——你可以定义它负责什么工作、如何解决问题，以及它可以访问哪些工具。Claude 会根据各个 subagent 的描述，自动将任务委派给合适的 subagent；你也可以显式指定使用某一个特定的 subagent。

**在以下场景中适合使用 subagents：**

- **任务专业化**：代码审查、测试生成、安全审计
- **上下文管理**：将主对话保持在核心问题上，把专业化工作交给 subagent
- **并行处理**：多个 subagent 可以同时处理不同方面的任务
- **工具权限限制**：将某些 subagent 的操作限制在安全范围内（例如只读访问）

#### 什么时候可以用 Skills 来替代

- 如果多个 Agent 或多个对话都需要同一类专业能力——例如安全审查流程或数据分析方法——应当创建一个 Skill，而不是把这些知识分别构建进各个 subagent 中。Skills 具有可移植性和可复用性，而 subagent 则是为特定工作流量身定制的
- 当你希望一种任何 Agent 都可以使用的专业能力时，使用 Skills
- 当你需要具备特定工具权限和上下文隔离的独立任务执行时，则使用 subagents

**当然，subagent 可以像主 agent 一样访问并使用 Skills。**

> 这使得强大的组合成为可能：由专门化的 subagent 来复用可移植的专业能力。
{: .prompt-info }

**例如**，你的文档编写 subagent 则可以使用 `technical-writing` Skill，对 API 文档进行统一、一致的格式化。

![Subagent 与 Skill 组合使用](/assets/img/2025-12-26_2.png)

---

### 4. 什么是 MCP

![MCP 架构示意](/assets/img/2025-12-26_3.png)

> 模型上下文协议（Model Context Protocol，MCP）是一种开放标准，用于将 AI 助手连接到数据所在的外部系统——包括内容存储库、业务工具、数据库以及开发环境。
{: .prompt-info }

#### MCP 如何工作

MCP 提供了一种连接到工具和数据源的标准化方式。我们无需为每一种数据源单独构建定制化集成，而是只需基于一个统一的协议进行开发。

MCP 服务器负责对外暴露数据和能力；MCP 客户端则通过该协议连接这些服务器。

#### 什么时候使用 MCP

- **访问外部数据**：Google Drive、Slack、GitHub、各类数据库
- **使用业务工具**：CRM 系统、项目管理平台
- **连接开发环境**：本地文件、IDE、版本控制系统
- **集成自定义系统**：自有的工具和数据源

> 例如：通过 MCP 将 Claude 连接到你的 Google Drive。这样一来，Claude 就可以搜索文档、读取文件并引用内部知识，而无需手动上传；这种连接是持久的，并且会自动保持更新。

#### 什么时候可以用 Skills 来替代

MCP 负责将 Claude 连接到数据；Skills 则教会 Claude 如何使用这些数据。

- 如果你是在说明如何使用某个工具或遵循某些流程——例如「查询我们的数据库时，务必先按日期范围进行过滤」或「按指定公式格式化 Excel 报表」——这属于 Skill
- 如果你需要 Claude 先能够访问数据库或 Excel 文件本身，那就是 MCP 的职责

> **两者应结合使用：MCP 负责连接能力，Skills 负责流程化知识。**
{: .prompt-tip }

---

## 它们如何配合工作

---

### 1. 对比：如何选择合适的工具

![Skills / Prompts / MCP / Subagents 对比矩阵](/assets/img/2025-12-26_4.png)

### 2. 一个示例

> **智能代理工作流：研究型代理（Research Agent）**
{: .prompt-info }

#### Step 1

创建 Project。

#### Step 2：通过 MCP 连接数据源

启用 MCP 服务器：

- **Google Drive**（用于访问共享的研究文档）
- **GitHub**（用于审查竞争对手的开源仓库）
- **网页搜索**（用于获取实时的市场信息）

#### Step 3：创建 Skills

创建一个名为 `competitive-analysis` 的 Skill。

#### Step 4：配置 subagent

创建专门化的 subagents：

- subagent：`market-researcher`
- subagent：`technical-analyst`

#### Step 5：激活 Research Agent

现在，当你向 Claude 提出这样的请求时：

> 分析我们前三大竞争对手是如何定位他们最新的 AI 功能，并找出我们可以利用的空白点

接下来会发生的事情是：

- **加载 Project 上下文**：Claude 访问你已上传的研究文档，并遵循项目级指令
- **激活 MCP 连接**：Claude 搜索你的 Google Drive 中最新的竞争对手简报，并拉取 GitHub 数据
- **启用 Skills**：`competitive-analysis` Skill 提供分析框架
- **执行 subagent**：`market-researcher` 负责收集行业数据，`technical-analyst` 负责审查技术实现
- **Prompts 进行细化**：通过对话补充引导，例如：「尤其关注医疗行业的企业级客户」

---

## 参考文档

- [Claude Code Docs - Sub-agents](https://code.claude.com/docs/en/sub-agents)
- [anthropics/skills](https://github.com/anthropics/skills/blob/main/skills)
- [Claude Blog - Skills Explained](https://claude.com/blog/skills-explained)
- [Claude Platform Docs - Agent Skills Overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
