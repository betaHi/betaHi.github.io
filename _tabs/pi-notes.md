---
layout: page
title: Pi 学习笔记
icon: fas fa-graduation-cap
order: 6
permalink: /pi-notes/
---

## 这个系列在做什么

把一个开源 LLM agent harness（[pi](https://pi.dev)，`@earendil-works/pi-coding-agent`）从最小例子拆到完整工程设计

## 适合谁读

- 想理解 agent harness 的工程师
- 准备自己写一个 wrapper 或 harness 的开发者
- 看过 N 篇"用 30 行代码写一个 agent"之后还想往下挖一层的人

## 目录

| # | 文章 | 核心问题 |
|---|---|---|
| 01 | [用最小例子看 agent runtime 的事件流](/posts/pi-step-zero-event-stream/) | agent loop 长什么样？turn 是什么？ |
| 02 | [Agent loop 与 turn：一次 prompt 为什么会拆成 4 趟](/posts/pi-agent-loop-and-turn/) | 一次 prompt 为什么会拆成多个 turn？ |
| 03 | [Provider 抽象与统一事件协议](/posts/pi-provider-abstraction/) | 不同厂商的流格式怎么统一成一套事件？ |
