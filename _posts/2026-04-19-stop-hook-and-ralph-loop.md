---
title: Agent 循环控制原理解析：Stop Hook 与 Ralph Loop
date: 2026-04-19 21:58:00 +0800
categories: [Tech, AI Engineering]
tags: [stop-hook, ralph-loop, claude-code, codex, agent, ai-engineering]
---

最近有位读者问起 Ralph Loop 和 Stop Hook，我顺便来整理这个话题。

这个话题我将分为两篇：这篇主要是 Stop Hook 和 Ralph Loop 的原理解析，下一篇会讨论如何结合这些机制，设计一个长周期运行的 Agent 循环。

---

## 先了解两个概念

**Stop Hook**

Claude Code / Codex CLI 的 hooks 系统中的一类事件。触发时机是：模型本轮不再发起工具调用、准备结束当前 turn 的那一刻。Hook 脚本可以通过返回值决定是真的停下，还是把一段反馈注入回会话、让模型继续跑下一轮。

**Ralph Loop**

来自 `snarktank/ralph` 仓库的一种工程模式：让 agent 在"生成 → 外部验证 → 反馈 → 再生成"的循环里迭代推进，直到任务完成或触及边界。名字后来被 Anthropic 插件市场的 `ralph-loop` 插件沿用，指代这一类"由外部机制决定 agent 何时停下"的循环控制策略。具体可以看我之前写的一篇：[从 Prompt 到 Ralph Loop：一文了解 AI 的循环编程]({% post_url 2026-01-20-from-prompt-to-ralph-loop %})。

> Stop Hook 是机制，Ralph Loop 是用这个机制搭出来的循环形态——下面三层讲的就是同一个循环思路，在 Shell / Plugin / Runtime 三个不同层级的落地。
{: .prompt-tip }

---

## 层级一：基于 Shell 的外部控制循环（以 ralph.sh 为例）

在这方面，GitHub 上一个名为 `snarktank/ralph` 的 Bash 脚本仓库提供了一个非常直观的样本。它的核心逻辑 `ralph.sh` 建立在系统最外层的 Shell 循环上：

```bash
for i in $(seq 1 $MAX_ITERATIONS); do
  OUTPUT=$(claude --print < CLAUDE.md)

  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    exit 0
  fi
done
exit 1
```

在它配套的 `CLAUDE.md` Prompt 里有这样一段话：

> "If ALL stories are complete and passing, reply with: `<promise>COMPLETE</promise>`"
>
> "If there are still stories with passes: false, end your response normally (another iteration will pick up the next story)."

这是一种外挂式的控制策略：

- **隔离的会话流**：依靠外层 `for` 循环触发，每轮都是一个全新的会话进程，状态传递必须通过读写系统文件和 Git 记录完成
- **提示词约定的停止信号**：停止标识 `<promise>COMPLETE</promise>` 是通过 Prompt 约定产生，属于"内层协议"，由外部的 `grep` 验证

这个实现把循环控制权放在外部脚本，而不是交给模型判断。但这种方案存在两个主要局限：

1. 每次重新运行都会带来全量构建上下文的性能与 Token 开销
2. 单纯依赖 `grep` 进行文本匹配的判定方式，在面对大语言模型多变的输出格式时不够稳定

---

## 层级二：基于 Plugin 层的会话流拦截（以 Ralph-loop 为例）

当业务无法忍受反复冷启动的开销时，处理便下沉至插件系统。Anthropic 插件市场中的 `ralph-loop` 插件页明确提到其实现方式：

> *"intercepts session exits via a stop hook"*

其大致控制流为：

1. 用户启动长会话，例如 `/ralph-loop "任务需求" --completion-promise "DONE"`
2. 当单轮回合结束、Claude 准备退出会话前，Plugin 内部的 Stop Hook 介入
3. 若输出中未包含约定的 completion promise 字符串、且未达最大迭代次数，Hook 阻止本次退出并触发下一轮迭代
4. 用户可通过 `/cancel-ralph` 命令终止循环，其实现方式是删除本地 loop state 文件

此时 Plugin 层的 Stop Hook 对应"外层干预动作"，`ralph.sh` 脚本里的 `<promise>COMPLETE</promise>` 对应"内层文本协议"——两者处在同一问题的不同层次。

---

## 层级三：基于核心 Runtime 的原生收口流（以 Codex 与 Claude Code 为例）

前两个层级仍未解决一个根本问题：判断终止依然依赖不够稳定的文本字符串匹配。到了工程化更为完备的 Codex CLI 及 Claude Code 阶段，Stop Hook 脱离了"强行拦截文本退出"的定位，上升成为了核心状态机（State Machine）的**原生运转节点**。

以 `codex-rs` 的源码实现为例，Hook 触发逻辑的判定基础是：

```rust
let needs_follow_up = model_needs_follow_up || has_pending_input;

// 当 LLM 不再发起任何工具调用行为时，准许触发 Stop Hook 机制
if !needs_follow_up {
    let stop_outcome = sess.hooks().run_stop(stop_request).await;

    if stop_outcome.should_block {
        // 将 continuation prompt 以 role="user" 的 message 注入会话
        sess.record_conversation_items(...).await;
        stop_hook_active = true;
        continue; // 继续流转主循环
    }
}
```

这里确立了两个机制转变：

**脱离文本依赖结构化触发**

系统不再扫描输出流里是否包含 `"COMPLETE"` 或 `"DONE"`。触发 Stop Hook 的条件纯粹是 `needs_follow_up == false`——即模型本轮不再发起工具调用，与输出文本内容无关。

**以 User 角色注入反馈**

当外部验证失败并返回 `Block` 状态时，错误信息会被封装为 `role: "user"` 注入上下文。从模型视角看，这等同于收到一条新的用户消息。

Claude Code 则在 `handleStopHooks(...)` 中把这一阶段组织为明确的 turn epilogue，将状态提取（`extract memories`）、长期沉淀（`auto dream`）等收尾动作统一收口；同时在 API error 场景下显式跳过 stop hooks，以避免形成 "error → hook blocking → retry → error" 的死循环。

以 Runtime 层面的 Stop Hook 机制为例，其完整的循环执行与停止判断流程如下：

![Runtime 层 Stop Hook 循环执行与停止判断流程](/assets/img/2026-04-19_1.png)

---

## 结语：控制架构边界的演化

将三种处理策略横向剖析，这不仅是简单的方案迭代，更是软件工程对大模型边界的精细划分：

1. **外部脚本 + 文本协议**：Shell 循环读取模型输出，用 `grep` 匹配约定字符串判断终止（Shell 等级）
2. **插件层会话拦截**：在 session exit 处通过 Stop Hook 拦截，结合 completion promise 和迭代上限决定是否续跑（Plugin 等级）
3. **Runtime 原生状态机节点**：以 `needs_follow_up == false` 这种结构化行为信号作为触发条件，由外部验证和工程工具作为判定依据（Runtime 等级）

Agent 自主循环的演变，反映了系统在逐步将"判定权"从模型生成的非确定性中剥离，交回到更为严谨的工程验证系统手中的过程。

---

## 参考资料

- [snarktank/ralph](https://github.com/snarktank/ralph)
- [Ralph Loop 插件页](https://claude.com/plugins/ralph-loop)
- [Codex CLI 仓库](https://github.com/openai/codex)
- [Claude Code 仓库架构研究 · 第 15 章 Hooks 与 Side-Channels](https://betahi.github.io/claude-code-architecture/15-hooks-and-side-channels-deep-dive/)
