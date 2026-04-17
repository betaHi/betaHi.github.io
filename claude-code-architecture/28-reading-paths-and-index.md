---
layout: page
title: "28 阅读路径与索引"
permalink: /claude-code-architecture/28-reading-paths-and-index/
book_key: reading-paths-and-index
book_number: "28"
toc: true
---

## 这一章的用法

这一章只做两件事：

1. **按读者角色推荐阅读路径**——你是谁，优先读哪几章
2. **按问题给出倒排索引**——你有某个具体问题，直接跳到对应章号

不做总结，不做论述。用来查的，不用来读的。

---

## 一、按读者角色的阅读路径

下表每一行对应一类读者，从左到右是推荐阅读顺序的前 6 章。

| 读者角色 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| **第一次接触，想建立整体感** | 前言 | 00 | 03 | 13 | 20 | 27 |
| **想做自己的 harness / agent runtime** | 09 | 13 | 15 | 16 | 19 | 20 |
| **想看 harness 长期演化能力** | 09 | 10 | 17 | 24 | 25 | 26 |
| **关心长期协作型 agent（memory / compact / subagent）** | 17 | 20 | 24 | 25 | 26 | 27 |
| **关心治理、权限、安全** | 06 | 21 | 22 | 15 | 10 | 27 |
| **关心工具系统与执行边界** | 02 | 16 | 22 | 19 | 13 | 27 |
| **关心 SDK / 外部协议边界** | 04 | 05 | 23 | 20 | 27 | - |
| **关心 hooks / side-channels / 自改进** | 15 | 10 | 17 | 19 | 09 | 27 |
| **只想做速查** | 27 | 28 | 29 | 附录 A | - | - |

---

## 二、按问题的倒排索引

| 问题 | 去哪一章 |
|---|---|
| **主循环长什么样？** | 03、13 |
| **一次 turn 是怎么推进的？** | 13 |
| **QueryEngine 和 `query()` 怎么分工？** | 03、13、20 |
| **system prompt / user context / system context 怎么进模型？** | 20 |
| **上下文是怎么被装配的？** | 20 |
| **memory 有哪些层？** | 17 |
| **durable memory 和 session memory 区别？** | 10、17 |
| **memory 和 compact 区别？** | 17、24、29 |
| **memory 怎么写回？** | 10、15、17 |
| **compact 是什么？什么时候触发？** | 24 |
| **effective history 指什么？** | 20、24、29 |
| **hooks 分几种？** | 15 |
| **prefetch / stop hook / post-sampling hook 分别挂在哪里？** | 13、15 |
| **tool 和 skill 有什么区别？** | 14、22、29 |
| **tool 和 command 有什么区别？** | 02、09、29 |
| **tool 和 MCP 有什么区别？** | 05、22、29 |
| **tool 执行怎么编排？** | 16 |
| **tool 执行取消怎么传播？** | 16、19 |
| **settings / config / state / bootstrap state 怎么分？** | 21、29 |
| **trust / permission / policy 怎么落地？** | 06、21、22 |
| **权限检查在主路径的哪个位置？** | 13、16、22 |
| **managed settings 是什么？** | 06、21 |
| **SDK stream 和内部消息模型区别？** | 23、20、29 |
| **recovery 是怎么实现的？** | 19、24 |
| **max_output_tokens 不够了怎么办？** | 19 |
| **prompt too long 怎么恢复？** | 19、24 |
| **后台 Bash / cron 怎么接入？** | 25 |
| **subagent 的意义？** | 26 |
| **worktree isolation 是什么？** | 26 |
| **主代理什么时候应该委托？** | 26 |
| **Claude Code 有"自进化"吗？** | 10 |
| **skillImprovement 是什么？** | 10、14、15 |
| **evaluation / telemetry / analytics 怎么做？** | 09、10 |
| **feature gate / rollout 有什么用？** | 07、09、10 |
| **启动为什么要 fast-path？** | 01、09 |
| **UI 在这里扮演什么角色？** | 04、09 |
| **Claude Code 整体架构总图？** | 27 |
| **术语（main path / side-channel / compact / effective history / plane 等）** | 29 |
| **最终能带走的设计原则？** | 30 |
| **想查某个具体源码符号在哪一章被用** | 附录 A |

---

## 三、按主题的"最小章节集"

如果你只想读某个主题的最少章节：

| 主题 | 最少读 |
|---|---|
| Harness 工程经验 | 09、30 |
| Memory 系统 | 10、17、24 |
| Hooks / Side-channels | 15、10 |
| Tool system | 16、22 |
| Context engineering | 20、24 |
| Governance | 21、22 |
| 长期协作基础设施 | 17、24、25、26 |
| 评测与自改进 | 10、09 |
| SDK / 协议边界 | 23、20 |
| 总图 | 27 |

---

## 四、章节之间的互补关系

有些章节必须配对读才有意义。下面列出最常见的几组：

- **13 + 20**：主循环 + 上下文装配。单独读 13 会缺上下文形成的机制。
- **17 + 24**：memory + compact。单独读 17 会以为 memory 就是全部上下文管理。
- **15 + 10**：side-channels + 自改进。side-channels 提供机制，自改进是其中一种应用。
- **16 + 22**：工具编排 + 执行边界。并发语义 + 权限边界必须一起看。
- **21 + 06**：治理边界深挖 + 基础图景。21 是 06 的正式展开。
- **25 + 26**：任务/后台 + 子代理。两种"不阻塞主会话"的方式，比较着看最清楚。
- **23 + 20**：SDK 协议 + 内部消息。最容易混淆的一组。

---

## 五、几个常见误区提醒

- **别把 memory / compact / summary 混成一回事**。这三者分别回答不同问题。混淆了回看 17、24、29。
- **别把 tool / skill / hook / MCP 混成一回事**。这是本书里最容易被污染的术语组。混淆了回看 14、15、22、29。
- **别把 SDK stream 当内部消息模型**。外部看到的事件流 ≠ 真实发给模型的上下文。参见 20、23。
- **别把 governance 当"配置细节"**。它是运行时控制面，参见 06、21、22。
- **别把每章当独立散文**。每章都在 27 章总图里有位置。

---

## 继续阅读

- 查总图：[第 27 章 总体运行时架构图](/claude-code-architecture/27-runtime-architecture-map/)
- 查术语：[第 29 章 术语表与核心区分](/claude-code-architecture/29-glossary-and-core-distinctions/)
- 查源码：[附录 A 源码证据索引](/claude-code-architecture/appendix-a-source-index/)

{% include claude-code-architecture-nav.html %}
