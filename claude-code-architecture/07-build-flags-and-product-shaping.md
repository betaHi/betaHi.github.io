---
layout: page
title: "07 构建开关与产品形态塑造"
permalink: /claude-code-architecture/07-build-flags-and-product-shaping/
book_key: build-flags-and-product-shaping
book_number: "07"
toc: true
---

## 本章目标

这一章研究一个贯穿全仓库的重要主题：`bun:bundle` 的 `feature(...)`。重点回答：

1. 为什么这个仓库到处都是 feature gate？
2. 构建开关如何改变源码结构？
3. Claude Code 是如何从同一套代码里裁剪出不同产品形态的？

## 核心结论

Claude Code 的源码不是“固定产品的一份实现”，而是 **多产品形态的共享母体**。`feature('...')` 在这个仓库里有三层作用：

1. **构建时裁剪代码**：inactive 分支会被 dead-code elimination 去掉。
2. **定义产品边界**：哪些子系统存在，不完全由运行时决定，而是先由构建形态决定。
3. **支撑实验与内部/外部差异化**：很多能力只在特定 build、特定用户类型或特定实验特性中可见。

也就是说，feature flags 在这里不仅是“控制某个功能开不开”，而是直接参与架构分层。

## 一、从源码现象看：feature gate 无处不在

在本次调研涉及的关键文件里，几乎都能看到 `feature(...)`：

- `src/entrypoints/cli.tsx`
- `src/main.tsx`
- `src/commands.ts`
- `src/tools.ts`
- `src/query.ts`
- `src/bridge/bridgeMain.ts`
- 其他服务模块

这已经说明：feature gate 不是局部实现细节，而是全局组织代码的基础手段。

## 二、feature gate 主要控制哪些层面

### 1. 运行模式级功能

在 `cli.tsx` 中可以看到典型例子：

- `DUMP_SYSTEM_PROMPT`
- `CHICAGO_MCP`
- `DAEMON`
- `BRIDGE_MODE`
- `BG_SESSIONS`
- `TEMPLATES`

这类开关控制的是“程序有哪些一级运行模式”。

### 2. 命令级功能

在 `commands.ts` 中可见：

- `PROACTIVE`
- `KAIROS`
- `VOICE_MODE`
- `WORKFLOW_SCRIPTS`
- `TORCH`
- `BUDDY`
- `ULTRAPLAN`
- `UDS_INBOX`
- `FORK_SUBAGENT`

这类开关决定某些 slash command 是否存在。

### 3. 工具级功能

在 `tools.ts` 中可见：

- `AGENT_TRIGGERS`
- `AGENT_TRIGGERS_REMOTE`
- `MONITOR_TOOL`
- `WEB_BROWSER_TOOL`
- `WORKFLOW_SCRIPTS`
- `HISTORY_SNIP`
- `CONTEXT_COLLAPSE`
- `OVERFLOW_TEST_TOOL`
- `TERMINAL_PANEL`

这类开关决定模型可调用能力的可见面。

### 4. 执行策略级功能

在 `query.ts` 与 `main.tsx` 中可见：

- `REACTIVE_COMPACT`
- `CONTEXT_COLLAPSE`
- `HISTORY_SNIP`
- `COORDINATOR_MODE`
- `TRANSCRIPT_CLASSIFIER`

这些开关不是简单 UI feature，而会改变 agent runtime 的执行策略。

## 三、构建时裁剪的意义

### 1. 这不是普通 runtime flag

源码多处刻意写成：

```ts
const x = feature('FLAG') ? require('./x.js') : null
```

这是为了让构建器在编译阶段就把不可达代码去掉，而不只是运行时判断。

因此它带来的效果包括：

- 更小的 bundle
- 更低的 cold start 成本
- 更明确的产品边界
- 减少不该暴露能力的 accidental inclusion

### 2. 为什么要配合动态 require/import

如果只是 `if (flag) { ... }`，但模块仍静态 import，构建器就未必能完全裁剪相关依赖。源码大量配合动态 `require()`，就是为了帮助 DCE 更彻底。

这也是为什么很多文件开头有注释强调“不要重排 import”或“必须 inline feature gate”。

## 四、feature gate 如何反过来塑造架构

### 1. 子系统天然被设计成可拆卸

因为要被裁剪，很多子系统从一开始就被设计为可独立拿掉，例如：

- bridge
- daemon
- workflow scripts
- voice mode
- browser/tool 面板
- coordinator mode
- proactive / kairos

这反过来促进了模块边界清晰化。

### 2. 入口层必须做模式分流

`cli.tsx` 能做 fast-path，也和 feature gate 关系很大。因为有些模式在某些 build 根本不存在，入口就要非常清楚“当前产物支持哪些路径”。

### 3. registry 层必须可组合

无论是 `commands.ts` 还是 `tools.ts`，都像“拼装清单”，适合按 feature 把部件插入或剔除。这种 registry 风格本身就很适合多产品形态。

## 五、内外部产品差异的线索

除了 `feature(...)`，源码还经常和这些条件组合：

- `process.env.USER_TYPE === 'ant'`
- `isWorktreeModeEnabled()`
- `isAgentSwarmsEnabled()`
- `isTodoV2Enabled()`
- `isEnvTruthy(...)`

这说明真正的能力暴露条件是分层的：

```text
构建形态
  -> 用户类型
  -> 运行环境
  -> 设置与 gate
  -> 当前 session mode
```

其中 feature gate 是最外层的“存在性条件”。

## 六、对代码阅读的影响

### 1. 不能把“看到的源码”当成“所有用户都能用到的功能”

很多模块虽然在仓库里存在，但可能：

- 只对内部 build 生效
- 只在特定实验中启用
- 只在某些平台或用户类型里存在

所以读源码时必须区分：

- **代码存在**
- **当前 build 是否包含**
- **运行时是否启用**

### 2. registry 文件尤其重要

`commands.ts` 和 `tools.ts` 不是简单导出列表，而是判断“哪些功能真正进入产品”的关键节点。要理解某 feature 是否进入产品，优先看 registry 而不是只看某个子目录存在与否。

## 七、设计取舍分析

### 1. 为什么不是全靠运行时设置

如果全靠运行时设置：

- bundle 变大
- 非目标用户也能携带无关代码
- 某些内部能力更容易意外暴露
- 启动时要加载更多无关模块

构建时裁剪更适合这种大平台型仓库。

### 2. 为什么 feature gate 会渗透到这么多文件

因为它控制的不只是 UI 按钮，而是：

- 入口模式
- 命令集合
- 工具集合
- 执行策略
- 扩展机制

这些都属于架构层，而不是叶子功能。

### 3. 代价是什么

代价是：

- 阅读难度上升
- 代码路径更多
- 测试矩阵更复杂
- 不熟悉工程的人容易误判某能力是否真实存在于产品中

但对 Anthropic 这样要维护多形态产品的团队来说，这是可接受甚至必要的复杂度。

## 关键文件

- `src/entrypoints/cli.tsx`
- `src/main.tsx`
- `src/commands.ts`
- `src/tools.ts`
- `src/query.ts`
- 以及各种 feature-gated 子模块

## 本章小结

在 Claude Code 里，`feature(...)` 不是装饰性的开关，而是架构骨架的一部分：

- 决定哪些子系统被编译进来
- 决定哪些入口、命令、工具、执行策略存在
- 让同一份源码能够塑造成不同产品形态

理解这一点之后，才能正确理解为什么这个仓库既像一个产品，又像一个平台母体。

## Harness 视角

从 harness engineering 角度，feature gate 不是附加开关，而是 harness 形态塑造器。它决定某些入口、命令、工具、执行策略乃至整类子系统是否存在，因此直接影响模型能处在什么运行环境里、能看到什么 action surface、系统具备什么恢复与扩展能力。

这意味着 Claude Code 的 harness 不是一个固定盒子，而是一个可裁剪的母体。不同 build 下，真正存在的 harness 边界并不完全相同。

## 工程化启发

第一条经验是：当 agent 产品能力多、风险高、用户群复杂时，feature gate 要进入架构层，而不是只做 UI 开关。构建期裁剪、运行期 rollout、动态配置和回滚路径要一起考虑。

第二条经验是：为了支持可裁剪形态，子系统边界必须足够清楚。Claude Code 在入口层、registry 层和执行策略层广泛使用 feature gate，反过来也逼着这些模块保持可插拔和低耦合。

{% include claude-code-architecture-nav.html %}
