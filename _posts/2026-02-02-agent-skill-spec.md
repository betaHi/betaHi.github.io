---
title: 动手写 Agent Skill 前，这些规范你一定要知道
date: 2026-02-02 21:48:00 +0800
categories: [Tech, AI Engineering]
tags: [agent-skill, skill-spec, claude, anthropic, skills-ref, ai-engineering]
---

之前已经写过[关于 Agent Skill 的文章]({% post_url 2025-11-30-from-prompt-to-skills %})，主要是从「能做什么」和「为什么有用」的角度来了解。

在开始动手写自己的 Agent Skill 之前，我们有必要先弄清楚它的基本规范，包括：

- 一个 Skill 最小需要包含哪些内容
- 一个用于校验规范的小工具 **skills-ref**

---

## 1. 文件夹结构

按照规范，一个 Skill 是一个目录，其最小要求是包含一个 `SKILL.md` 文件：

```text
skill-name/
└── SKILL.md          # Required
```

规范中还支持可选的辅助目录，例如 `scripts/`、`references/` 和 `assets/`，用于补充 Skill 的实现细节：

```text
my-skill/
├── SKILL.md          # Required: instructions + metadata
├── scripts/          # Optional: executable code
├── references/       # Optional: documentation
└── assets/           # Optional: templates, resources
```

---

## 2. SKILL.md 格式

`SKILL.md` 文件必须以 YAML frontmatter 开头，后面紧跟 Markdown 正文内容。

### 2.1 Frontmatter（必须）

```yaml
---
name: skill-name
description: A description of what this skill does and when to use it.
---
```

其中还支持以下可选字段：

```yaml
---
name: pdf-processing
description: Extract text and tables from PDF files, fill forms, merge documents.
license: Apache-2.0
metadata:
  author: example-org
  version: "1.0"
---
```

下面展开说下必填和可选字段。

#### 必填字段

**`name`**

- **必填字段**
- 长度限制：**1–64 个字符**
- 仅支持小写字母、数字和 `-`
- 不能以 `-` 开头或结尾，也不能出现连续的 `--`
- `name` 必须和 Skill 目录名保持一致

符合规范的例子，如：

```text
// 例子 1
name: pdf-processing

// 例子 2
name: data-analysis

// 例子 3
name: code-review
```

不符合规范的例子，如：

```text
// 例子 1
name: PDF-Processing  # 禁止使用大写字母

// 例子 2
name: -pdf  # 不能以连字符开头

// 例子 3
name: pdf--processing  # 不允许连续使用连字符
```

**`description`**

- **必填字段**
- 长度限制：**1–1024 个字符**
- 应同时说明 **这个 Skill 做什么** 以及 **在什么情况下使用**
- 建议包含一些 **具体关键词**，以便 Agent 能够更好地识别和匹配相关任务

好的例子，如：

```text
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents or when the user mentions PDFs, forms, or document extraction.
```

不好的例子，如：

```text
description: Helps with PDFs.
```

#### 可选字段

**`license`**

- **可选字段**
- 用于指定该 Skill 所适用的许可证
- 建议保持简短，通常填写 **许可证名称**

比如：

```text
license: Proprietary. LICENSE.txt has complete terms
```

**`compatibility`**

- **可选字段**
- 长度限制：**1–500 个字符**
- 仅在 Skill 对运行环境有**特定要求**时才需要填写
- 可用于说明适用的产品、所需的系统依赖、网络访问需求等

比如：

```text
// 例子 1
compatibility: Designed for Claude Code (or similar products)

// 例子 2
compatibility: Requires git, docker, jq, and access to the internet
```

对于大部分 skills 来说，不需要 **`compatibility`** 字段。

**`metadata`**

- **可选字段**
- 用于存放规范之外的自定义属性
- 以 key-value 形式存在，并且 key 和 value 都需要是字符串
- 建议 key 命名尽量唯一，避免冲突

例如：

```yaml
metadata:
  author: example-org
  version: "1.0"
```

**`allowed-tools`**

- **可选字段**
- 用于指定一组 **预先允许执行的工具列表**，各工具名称以空格分隔
- 该字段目前属于 **实验性特性**，不同 Agent 实现对它的支持情况可能存在差异

例如：

```text
allowed-tools: Bash(git:*) Bash(jq:*) Read
```

### 2.2 正文内容

YAML frontmatter 之后的 Markdown 正文用于描述 Skill 的具体指令内容。

该部分没有固定的格式限制，可以根据需要自由编写，只要能帮助 Agent 更高效地完成任务即可。

官方推荐在正文中包含以下内容：

- 分步骤的执行说明（Step-by-step instructions）
- 输入与输出示例
- 常见的边界情况或异常场景

> 需要注意的是，一旦 Agent 决定激活某个 Skill，就会 **加载整个 `SKILL.md` 文件**。因此，如果内容较长，建议将部分说明拆分到引用文件中，再通过 `references/` 等方式进行引用。
{: .prompt-warning }

---

## 3. 可选目录

**`scripts/`**

用于存放 Agent 可直接执行的代码脚本。脚本应满足以下要求：

- 尽量做到 **自包含**，或对依赖关系进行清晰说明
- 提供 **有意义的错误提示**，便于排查问题
- 能够 **优雅地处理边界情况**

可支持的脚本语言取决于具体的 Agent 实现，常见的包括 **Python、Bash 和 JavaScript**。

**`references/`**

用于存放 Agent 在需要时才会读取的补充文档，包括：

- `REFERENCE.md`：详细的技术参考说明
- `FORMS.md`：表单模板或结构化数据格式
- 领域相关的说明文件（如 `finance.md`、`legal.md` 等）

建议每个参考文件只聚焦于单一主题。由于这些文件是 **按需加载** 的，文件越小，对上下文的占用也越少。

**`assets/`**

用于存放静态资源，例如：

- 各类模板（文档模板、配置模板等）
- 图片资源（示意图、示例图片）
- 数据文件（查找表、数据结构定义、Schema 等）

---

## 4. 渐进式披露（Progressive Disclosure）

Skill 的结构应当有助于 **高效利用上下文**：

- **元数据（约 100 tokens）**：所有 Skill 在启动时都会加载 `name` 和 `description` 字段
- **指令内容（建议少于 5000 tokens）**：当 Skill 被激活时，才会加载完整的 `SKILL.md` 正文
- **资源文件（按需加载）**：只有在需要时，才会加载诸如 `scripts/`、`references/`、`assets/` 中的文件

> 建议将主要的 `SKILL.md` 控制在 **500 行以内**，把更详细的参考资料拆分到独立的文件中。
{: .prompt-tip }

---

## 5. 文件引用（File references）

在 Skill 中引用其他文件时，应当使用 **相对于 Skill 根目录的相对路径**。

例如：

```text
See [the reference guide](references/REFERENCE.md) for details.

Run the extraction script:
scripts/extract.py
```

文件引用建议保持在相对于 `SKILL.md` 的一级目录深度，避免出现过深的嵌套引用链。

---

## 6. 使用 skills-ref 进行规范校验

在了解了 Skill 的规范之后，一个问题是：

**怎么确保自己写的 Skill 真的符合规范？**

Anthropics 官方很贴心，提供了 `skills-ref` 这个参考库，主要用于帮助开发者 **校验、解析和使用 Skill**。

开源地址如下：

> [agentskills/agentskills - skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref)

`skills-ref` 用法很简单，如下：

```bash
skills-ref validate ./my-skill
```

它会帮你校验 `SKILL.md` 的 frontmatter 是否正确，同时检查命名是否符合规范。

此外，`skills-ref` 还提供了一些实用的命令：

```bash
# 读取 Skill 的元信息（输出为 JSON）
skills-ref read-properties path/to/skill

# 为 Agent Prompt 生成 <available_skills> XML
skills-ref to-prompt path/to/skill-a path/to/skill-b
```

如果你打算开始维护多个 Skill，建议把 `skills-ref` 作为必备工具使用。

---

## 参考文档

- [agentskills.io](https://agentskills.io)
- [agentskills/agentskills - skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref)
