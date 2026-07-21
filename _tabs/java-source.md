---
layout: page
title: Java 源码了解
icon: fab fa-java
order: 5
permalink: /java-source/
---

## 这个系列在做什么

从一个真实的报错出发，往下挖 JVM classfile 语义与构建工具链的底层机制，把"为什么会这样"讲清楚。

## 适合谁读

- 想理解 JVM classfile 语义（nestmate、desugar 等）的工程师
- 被 Android D8/R8、增量构建问题坑过、想搞懂根因的人
- 喜欢从一行错误一路反推到构建系统根因的读者

## 目录

| # | 文章 | 核心问题 |
|---|---|---|
| 01 | [从一行 D8 错误到构建系统修复：incremental desugar 与 Java nestmate 排查实录](/posts/d8-nestmate-incremental-desugar/) | 为什么 `MainActivity$2.class` 不能被孤立地交给 D8？ |
