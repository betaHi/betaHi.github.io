---
layout: page
title: Claude Code 架构研究
icon: fas fa-book
order: 5
permalink: /claude-code-architecture/
---

## 这本书在讲什么

这本书把 Claude Code 当成一份**以 harness engineering 为视角的架构观察笔记**。它不讲怎么用 Claude Code，不做源码逐行导读，也不是 agent 入门教程。它只做一件事：**把一个真实、成熟、长期演化中的 agent runtime 拆开，看它把哪些复杂度前置到了架构层，又把哪些边界做成了正式的运行时结构**——然后从中提炼可以迁移到其它系统的工程判断。

## 适合谁读

- 想研究 agent runtime 设计的工程师
- 想做自己的 harness / agent 平台的开发者
- 对长期协作型 agent 感兴趣的架构师

如果你要找的是使用技巧、prompt 经验或快速入门，这里不是最合适的资料。

## 怎么读

全书分为四篇 + 附录：

- **前言**：读者画像、本书承诺与不承诺、怎么读
- **第一篇 基础轮廓**：建立 Claude Code 的整体轮廓
- **第二篇 工程视角**：换视角——从产品模块到 runtime 工程
- **第三篇 运行时深挖**：逐个子系统展开
- **第四篇 综合与收束**：总图、索引、术语、最终原则
- **附录**：源码证据索引

不需要从头到尾顺读。下面是几条常见路径：

- 先建立整体感：`前言 → 00 → 03 → 13 → 20 → 27`
- 做自己的 harness：`09 → 13 → 15 → 16 → 19 → 20 → 24 → 26 → 30`
- 只做速查：`27（总图） → 28（索引） → 29（术语）`

## 全书目录

### [前言](/claude-code-architecture/preface/)

---

### 第一篇 · 基础轮廓

- [00 总览](/claude-code-architecture/00-overview/)
- [01 启动入口与启动流程](/claude-code-architecture/01-entrypoints-and-startup/)
- [02 命令系统与工具系统](/claude-code-architecture/02-commands-and-tools/)
- [03 QueryEngine 与执行循环](/claude-code-architecture/03-query-engine-and-execution-loop/)
- [04 UI 与交互层](/claude-code-architecture/04-ui-and-interaction/)
- [05 集成层与扩展机制](/claude-code-architecture/05-integrations-and-extensibility/)
- [06 状态、配置与权限治理](/claude-code-architecture/06-state-config-and-permissions/)
- [07 构建开关与产品形态塑造](/claude-code-architecture/07-build-flags-and-product-shaping/)

### 第二篇 · 工程视角

- [08 从产品结构到工程视角：过渡章](/claude-code-architecture/08-conclusions-and-reading-guide/)
- [09 Harness 工程经验综合](/claude-code-architecture/09-harness-engineering-lens/)
- [10 评测基础设施与受控自改进](/claude-code-architecture/10-memory-evaluation-and-self-improvement/)

### 第三篇 · 运行时深挖

- [13 Agent Loop 深挖](/claude-code-architecture/13-agent-loop-deep-dive/)
- [14 Skills 系统深挖](/claude-code-architecture/14-skills-system-deep-dive/)
- [15 Hooks 与 Side-Channels 深挖](/claude-code-architecture/15-hooks-and-side-channels-deep-dive/)
- [16 工具编排与并发执行](/claude-code-architecture/16-tool-orchestration-and-concurrency/)
- [17 Memory 系统与持久化](/claude-code-architecture/17-memory-system-and-persistence/)
- [19 恢复与错误处理深挖](/claude-code-architecture/19-recovery-and-error-handling-deep-dive/)
- [20 消息与上下文装配深挖](/claude-code-architecture/20-message-and-context-assembly-deep-dive/)
- [21 配置、状态与治理边界深挖](/claude-code-architecture/21-config-state-and-governance-boundaries/)
- [22 工具系统与执行边界深挖](/claude-code-architecture/22-tool-system-and-execution-boundaries/)
- [23 流式输出、事件协议与 SDK 边界深挖](/claude-code-architecture/23-streaming-output-event-protocol-and-sdk-boundary/)
- [24 会话压缩、上下文收缩与恢复边界深挖](/claude-code-architecture/24-compact-context-collapse-and-recovery-boundary/)
- [25 任务管理、调度与后台执行深挖](/claude-code-architecture/25-tasks-scheduling-and-background-execution/)
- [26 子代理、并行探索与上下文隔离深挖](/claude-code-architecture/26-subagents-parallel-exploration-and-isolation/)

### 第四篇 · 综合与收束

- [27 总体运行时架构图](/claude-code-architecture/27-runtime-architecture-map/)
- [28 阅读路径与索引](/claude-code-architecture/28-reading-paths-and-index/)
- [29 术语表与核心区分](/claude-code-architecture/29-glossary-and-core-distinctions/)
- [30 运行时综合与设计原则](/claude-code-architecture/30-runtime-synthesis-and-design-principles/)

### 附录

- [附录 A：源码证据索引（按符号）](/claude-code-architecture/appendix-a-source-index/)
