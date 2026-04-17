---
layout: page
title: Claude Code 架构研究
icon: fas fa-book
order: 5
permalink: /claude-code-architecture/
---

## 这本书在讲什么

这一部分把 Claude Code 当成一套可长期协作的 agent runtime 来研究。重点不是产品使用技巧，而是启动链路、执行循环、工具系统、上下文装配、治理控制、side-channel、后台执行与子代理隔离这些运行时结构。

## 适合谁读

这本书更适合下面这几类读者：

- 想研究 agent runtime 设计的工程师
- 对 harness engineering、执行边界、上下文治理感兴趣的读者
- 更偏好基于源码来理解系统，而不是只看功能介绍的开发者

## 怎么读

你不需要把所有章节从头到尾线性读完。

- 可以先从总览开始，建立整体心智模型。
- 然后读前面的核心章节，理解启动、执行循环、工具、状态与权限这些基础层。
- 后面的综合、索引和术语章节更适合在整体结构逐渐熟悉之后回头使用。

整套内容仍然保留原来的章节顺序与稳定链接，适合按主题跳读，也适合顺序阅读。

## 从哪里开始

- 如果你想先建立整体认识，可以从[总览](/claude-code-architecture/00-overview/)开始。
- 如果你最关心系统是怎么启动的，可以先看[启动入口与启动流程](/claude-code-architecture/01-entrypoints-and-startup/)。
- 如果你更想看最后的整体收束，可以把[运行时综合与设计原则](/claude-code-architecture/30-runtime-synthesis-and-design-principles/)放到后面再读。

## 全书目录

### 起步与导航

- [总览](/claude-code-architecture/00-overview/)
- [启动入口与启动流程](/claude-code-architecture/01-entrypoints-and-startup/)
- [命令系统与工具系统](/claude-code-architecture/02-commands-and-tools/)
- [QueryEngine 与执行循环](/claude-code-architecture/03-query-engine-and-execution-loop/)
- [UI 与交互层](/claude-code-architecture/04-ui-and-interaction/)
- [集成层与扩展机制](/claude-code-architecture/05-integrations-and-extensibility/)
- [状态、配置与权限治理](/claude-code-architecture/06-state-config-and-permissions/)
- [构建开关与产品形态塑造](/claude-code-architecture/07-build-flags-and-product-shaping/)
- [总结与阅读建议](/claude-code-architecture/08-conclusions-and-reading-guide/)

### 中层抽象与工程视角

- [Harness Engineering 视角](/claude-code-architecture/09-harness-engineering-lens/)
- [Memory、评测与自我改进](/claude-code-architecture/10-memory-evaluation-and-self-improvement/)
- [工程模式与工程化经验](/claude-code-architecture/11-engineering-patterns-and-operational-lessons/)
- [学习路线图](/claude-code-architecture/12-study-roadmap-from-this-repo/)

### 深挖章节

- [Agent Loop 深挖](/claude-code-architecture/13-agent-loop-deep-dive/)
- [Skills 系统深挖](/claude-code-architecture/14-skills-system-deep-dive/)
- [Hooks 与 Side-Channels 深挖](/claude-code-architecture/15-hooks-and-side-channels-deep-dive/)
- [工具编排与并发执行](/claude-code-architecture/16-tool-orchestration-and-concurrency/)
- [Memory 系统与持久化深挖](/claude-code-architecture/17-memory-system-and-persistence/)
- [运行时横切结构综合](/claude-code-architecture/18-runtime-cross-cutting-synthesis/)
- [恢复与错误处理深挖](/claude-code-architecture/19-recovery-and-error-handling-deep-dive/)
- [消息与上下文装配深挖](/claude-code-architecture/20-message-and-context-assembly-deep-dive/)
- [配置、状态与治理边界深挖](/claude-code-architecture/21-config-state-and-governance-boundaries/)
- [工具系统与执行边界深挖](/claude-code-architecture/22-tool-system-and-execution-boundaries/)
- [流式输出、事件协议与 SDK 边界深挖](/claude-code-architecture/23-streaming-output-event-protocol-and-sdk-boundary/)
- [会话压缩、上下文收缩与恢复边界深挖](/claude-code-architecture/24-compact-context-collapse-and-recovery-boundary/)
- [任务管理、调度与后台执行深挖](/claude-code-architecture/25-tasks-scheduling-and-background-execution/)
- [子代理、并行探索与上下文隔离深挖](/claude-code-architecture/26-subagents-parallel-exploration-and-isolation/)

### 综合、索引与收束

- [总体运行时架构图](/claude-code-architecture/27-runtime-architecture-map/)
- [阅读路径与索引](/claude-code-architecture/28-reading-paths-and-index/)
- [术语表与核心区分](/claude-code-architecture/29-glossary-and-core-distinctions/)
- [运行时综合与设计原则](/claude-code-architecture/30-runtime-synthesis-and-design-principles/)

这样即使不依赖“上一章 / 下一章”，也可以直接从首页目录跳到任意章节。