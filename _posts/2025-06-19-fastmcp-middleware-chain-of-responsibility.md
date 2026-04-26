---
title: MCP 中间件机制正式发布：FastMCP 的「责任链」进化
date: 2025-06-19 22:36:00 +0800
categories: [Tech, Protocol]
tags: [mcp, fastmcp, middleware, json-rpc, agent-service, protocol]
---

为了让 Agent Service 具备更强的扩展性与可维护性，FastMCP 在 2.9.0 版本中正式引入了 MCP Middleware（中间件）机制。

> MCP middleware is a powerful concept that allows you to add cross-cutting functionality to your FastMCP server. Unlike traditional web middleware, MCP middleware is designed specifically for the Model Context Protocol, providing hooks for different types of MCP operations like tool calls, resource reads, and prompt requests.
{: .prompt-info }

---

## 全新中间件系统

FastMCP 现在支持构建中间件流水线，能够统一拦截、处理、修改 MCP 协议中的所有关键请求与响应，例如：

- 工具调用（Tool Calls）
- 资源读取（Resource Reads）
- Prompt 请求（Prompt Requests）

---

## 专为 MCP 协议设计

与传统 Web 中间件不同，MCP 中间件是为 Model Context Protocol（MCP）量身打造的，支持标准的 JSON-RPC 通信模型，并适配多种传输方式（如 HTTP、stdio 等）。

> 请注意哈：它不是 MCP 官方协议规范的一部分，而是 FastMCP 的专属增强机制。
{: .prompt-warning }

---

## 钩子支持（Hook）

MCP Middleware 提供了多个扩展钩子（Hook），可以在请求生命周期的不同阶段介入逻辑处理，如下例子：

- `on_call_tool`：在工具调用前拦截
- `on_read_resource`：在资源读取前处理
- `on_get_prompt`：在 Prompt 请求时注入逻辑
- `on_request`、`on_response`、`on_message` 等

---

## 嵌套挂载

中间件支持挂载在父子服务器的不同层级，形成清晰的上下文处理链，非常适合构建插件式服务架构，提供了灵活的能力。

---

## 内置和自定义中间件能力

官方提供了一系列常用中间件示例，包括：

- 日志记录（Logging）
- 耗时统计（Timing）
- 速率限制（Rate Limiting）
- 统一错误处理（Error Handling）

同时我们也可以通过 `RawMiddleware` 抽象类，实现完全自定义的中间件逻辑。

---

## 好处是什么？

### 架构更清晰：实现关注点分离

原本分散在各处的逻辑（如权限控制、日志追踪等），现在可以统一抽象为中间件模块，提高系统的模块化与可维护性。

### 安全性与稳定性提升

可用于统一处理：

- 权限控制以及鉴权
- 接口限流
- 错误兜底与日志记录

### 快速构建通用能力

例如：

- 自动上下文注入（如 token、userId）
- 请求日志追踪
- A/B 测试参数插入

### 支持构建复杂服务网络

结合挂载机制，支持构建「父中间件 + 子服务」的分层逻辑，适用于构建插件式架构。

---

## 小结

总的来说，MCP 中间件机制为 FastMCP 带来了「责任链式」的扩展架构能力，这是挺重要的一步，期待接下来的更新。

---

## 原文直达

- [FastMCP Middleware](https://gofastmcp.com/servers/middleware)
