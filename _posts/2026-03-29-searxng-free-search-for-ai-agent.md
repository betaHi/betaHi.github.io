---
title: 从 0 到 1：给 OpenClaw / Claude Code 接上免费搜索引擎
date: 2026-03-29 09:44:00 +0800
categories: [Tech, Tools]
tags: [searxng, docker, self-hosted, search-engine, ai-agent, openclaw, skill]
---

接入 OpenClaw 的人都知道，光有大模型不够，你的 Agent 还得能 **联网搜索**。

一搜“AI Agent 搜索方案”，满屏都是 Tavily、Brave Search、Exa 这类服务。先注册，后拿 Key，再看额度和价格。

但还有一条路：自己部署一个 SearXNG，先把 Agent 的搜索能力接起来。

今天这篇文章主要讲三件事：

1. 对比主流搜索方案的**真实成本**
2. 用 **Docker 一键部署** SearXNG
3. 接入你的 AI Agent，让它能去查东西



## 一、先算一笔账：主流搜索方案到底要花多少钱？

**这里放写作时能在官方公开页面查到的价格**

| 方案 | 免费额度 | 超出价格 | 需要 API Key | 数据来源 |
|------|---------|---------|-------------|---------|
| **Tavily** | 1,000 API credits / 月 | $0.008 / credit | 需要 | 自有爬虫 |
| **Brave Search API** | 每月 $5 免费 credits | Search: $5 / 1000 requests | 需要 | 自有索引 |
| **Exa Search** | 1,000 requests / 月 | Search: $7 / 1000 requests | 需要 | 神经搜索 |
| **Google Custom Search** | 100次/天 | $5 / 1000 queries | 需要 | Google |
| **SearXNG** | 无按次计费 | 软件本身开源免费 | 不需要 | Google+Bing+Brave+DDG |


商业搜索 API 都有自己的免费额度，但 Agent 真跑起来以后，搜索通常不是偶尔调用一次，而是会反复调用的基础能力。

**SearXNG 的优势，不是零成本，而是不按调用次数线性收费。** 因为它不是一个 API 服务，而是你自己部署的搜索引擎，软件本身开源免费，但机器、网络和维护成本还是要自己承担。


## 二、SearXNG 是什么？为什么免费？

### 原理很简单

```
你的 Agent → SearXNG（你的服务器上） → Google/Bing/Brave/DDG...
                                        ↓
                                    聚合结果返回
```

SearXNG 是一个**元搜索引擎（Meta Search Engine）**：
- 它不自己爬网页
- 它把你的搜索请求**同时发给多个搜索引擎**
- 然后把结果**聚合、去重、排序**后返回

### 为什么免费？

- 开源项目（GitHub 上长期活跃）
- 部署在你自己的服务器上
- 通过正常的搜索请求获取结果，不走付费 API
- 没有中间商赚差价

### 它的优势

- 免费
- 不需要 API Key
- 多个数据源
- 注重隐私

当然，你需要一台服务器（哪怕最便宜的 VPS 就够），以及 5 分钟时间。


## 三、5 分钟部署：Docker 一键启动

### 前提条件

- 一台 Linux 服务器（云服务器、树莓派、WSL 都行）
- 已安装 Docker

### Step 1：创建配置文件

```bash
mkdir -p ~/searxng
```

生成密钥：

```bash
openssl rand -hex 32
```

创建 `~/searxng/settings.yml`：

```yaml
use_default_settings: true

server:
  secret_key: "你生成的密钥粘贴到这里"
  limiter: false

search:
  formats:
    - html
    - json
```

> `formats` 里一定要加 `json`，否则 API 调用会报错

### Step 2：一键启动

```bash
docker run -d \
  --restart unless-stopped \
  -p 8080:8080 \
  -v ~/searxng:/etc/searxng \
  --name searxng \
  searxng/searxng
```

### Step 3：验证

```bash
curl "http://localhost:8080/search?q=hello&format=json"
```

看到 JSON 格式的搜索结果，那说明跑通了


## 四、接入 OpenClaw：让你的小虾米学会搜索

### 方式一：HTTP 调用

```python
import requests, json

def search(query, lang="zh"):
    url = "http://localhost:8080/search"
    params = {"q": query, "format": "json", "language": lang}
    resp = requests.get(url, params=params, timeout=10)
    results = resp.json().get("results", [])[:5]
    return results
```

### 方式二：Skill 方式

如果你用 OpenClaw 作为 Agent 框架，可以直接写一个搜索 Skill：

```markdown
# SKILL.md
---
name: searxng-search
description: Search the web via local SearXNG
---

执行搜索：
curl -s "http://localhost:8080/search?q=<query>&format=json"
```

Agent 就能自动调用搜索了。

### 方式三：配合 Claude Code / Copilot CLI

在 AGENTS.md 或系统 prompt 里告诉 Agent：

```
搜索时使用：curl "http://localhost:8080/search?q={query}&format=json"
```

任何支持工具调用的 Agent 都能用。

### 方式四：直接调用现成的 CLI

还有一种更省事的接法：如果你已经在用 Gemini、GitHub Copilot 这类带搜索或工具能力的 CLI，也可以直接调用它们现成的能力。

现在有些工具已经支持通过 ACP 暴露能力，这样 Agent 不一定非要自己再接一层搜索服务。当然这条路更偏工具集成，和本文讲的自建 SearXNG 不是一回事，这里就不展开了。



## 五、实测搜索质量：部署完到底好不好用？

我拿几类常见查询简单试了一下，主要看它能不能把结果拉回来，以及结果够不够用。

### 测试一：中文热点搜索

**Query: "2026年 AI Agent 发展趋势"**

```
1. [知乎] 15篇AI Agent研报，看懂2026年Agentic AI行业全景
   → 来源: Google
2. [新浪] 2026年AI Agent全面爆发：从概念验证到产业重构
   → 来源: Brave
3. [iKala] 2026企业如何布局AI Agent？5大技术趋势
   → 来源: Google
4. [36氪] 2026年AI Agent六大趋势揭秘
   → 来源: AOL
5. [新浪] AI医疗行业多智能体协作与全流程闭环
   → 来源: Brave
```

能搜到知乎、36氪、新浪这类中文站点，至少说明中文内容不是短板。就我这次测试看，结果也算比较全。

### 测试二：GitHub C++ Trending

**Query: "GitHub trending C++ repositories"**

```
1. FreeCAD/FreeCAD — 开源参数化3D建模工具
   → 来源: Google
2. google/benchmark — Google 出品的C++微基准测试库
   → 来源: Google
3. google/filament — Google 实时物理渲染引擎
   → 来源: Google
4. CollaboraOnline/online — 在线协作办公套件
   → 来源: Google
5. HailToDodongo/pyrite64 — N64模拟器
   → 来源: Google
6. catchorg/Catch2 — 现代C++单元测试框架
   → 来源: Google
```

这类技术查询也能用，热门仓库和相关项目基本能搜出来。对 Agent 来说，这种结果已经足够拿来做后续筛选或总结。

### 测试三：实时新闻搜索

**Query: "微博热搜 今日"**

```
1. [今日热榜] 全站热榜汇聚全网热搜
2. [微博] 热搜榜实时数据
3. [热搜引擎] 2026-03-27 微博热搜词云
4. [今日热榜] 微博热搜榜实时排名
```

这类偏实时的查询也能拉到结果，但具体时效性还是会受上游搜索源影响。

### 测试四：英文技术搜索

**Query: "Agent Client Protocol ACP"**

```
1. [agentclientprotocol.org] Official ACP documentation
2. [GitHub] ACP compatible agents list
3. [docs.github.com] Copilot CLI ACP server reference
```

英文技术搜索也比较稳，官方文档通常能排在靠前位置。

> 一句话：如果你的目标是给 Agent 补一条可用的搜索能力，SearXNG 基本够用。中文内容、英文技术资料、实时信息都能覆盖，但速度和稳定性还是会受具体引擎与网络环境影响。



## 六、进阶玩法：榨干 SearXNG 的全部能力

### 1. 搜索语法：像 Google 高级搜索一样用

SearXNG 支持丰富的搜索语法，用 `!` 前缀指定引擎或分类：

```bash
# 指定引擎搜索
!google AI Agent           # 只用 Google
!bing AI Agent             # 只用 Bing
!ddg AI Agent              # 只用 DuckDuckGo
!wikipedia 量子计算         # 只搜维基百科

# 指定分类搜索
!images 猫咪               # 只搜图片
!videos Python教程          # 只搜视频
!news 今日热点              # 只搜新闻
!map 长城                 # 只搜地图

# 多引擎组合
!google !bing AI Agent     # 同时搜 Google 和 Bing
```

还支持语言筛选：

```bash
:zh AI Agent              # 只要中文结果
:en AI Agent              # 只要英文结果
:ja AI Agent              # 只要日文结果
```

### 2. API 参数大全

通过 URL 参数精确控制搜索行为：

```bash
# 基础搜索
/search?q=关键词&format=json

# 指定引擎
/search?q=关键词&format=json&engines=google,brave,duckduckgo

# 指定语言
/search?q=关键词&format=json&language=zh

# 时间过滤
/search?q=关键词&format=json&time_range=day    # 24小时内
/search?q=关键词&format=json&time_range=month  # 一个月内
/search?q=关键词&format=json&time_range=year   # 一年内

# 指定分类
/search?q=关键词&format=json&categories=images  # 图片
/search?q=关键词&format=json&categories=news    # 新闻
/search?q=关键词&format=json&categories=videos  # 视频

# 分页
/search?q=关键词&format=json&pageno=2           # 第2页
```

### 3. 优化 settings.yml 配置

默认配置够用，但以下优化能让体验更好：

```yaml
use_default_settings: true

server:
  secret_key: "你的密钥"
  limiter: false              # 自用关掉限流
  image_proxy: true           # 代理图片，保护隐私

search:
  safe_search: 0              # 关闭安全搜索过滤
  autocomplete: "google"      # 自动补全用 Google
  default_lang: "zh"          # 默认中文
  formats:
    - html
    - json

# 出站请求优化
outgoing:
  request_timeout: 5.0        # 超时时间（默认3秒可能太短）
  pool_connections: 200       # 连接池大小
  pool_maxsize: 20            # 保持连接数
  enable_http2: true          # 开启 HTTP/2，更快

# 如果在国内服务器，可以配代理
#  proxies:
#    all://:
#      - socks5://127.0.0.1:1080
```

### 4. 内置插件

SearXNG 自带实用插件，在 settings.yml 中启用：

```yaml
plugins:
  - name: Hash plugin          # 输入 "sha256 hello" 直接算哈希
    enabled: true
  - name: Calculator           # 输入数学表达式直接计算
    enabled: true
  - name: Unit converter plugin # 单位换算：输入 "100 km to miles"
    enabled: true
  - name: Tracker URL remover   # 自动清除追踪参数
    enabled: true
  - name: Open Access DOI rewrite  # 学术论文自动跳转开放获取版本
    enabled: true
```

### 5. 搜狗微信搜索

在中文搜索场景里，SearXNG 可以接入 `sogou_wechat`，用来搜微信公众号文章：

```bash
# 搜微信公众号文章
curl "http://localhost:8080/search?q=CodeAgent+Claude&format=json&engines=sogou_wechat"
```

这也是它在中文内容检索里一个比较特别的点。不过能不能稳定拿到结果，还是要看实例配置、网络环境和上游搜索源状态。

### 6. 搭配 Perplexica = 免费版 Perplexity

[Perplexica](https://github.com/ItzCrazyKns/Perplexica) 是 Perplexity 的开源平替：

```
SearXNG（搜索） + Ollama（本地LLM） = Perplexica（AI搜索问答）
```

如果你把它和 Ollama 之类的本地模型一起用，确实能搭出一套更偏私有化的 AI 搜索体验，支持多种模式：
- 普通搜索模式
- 写作助手模式
- 学术搜索模式
- YouTube 搜索模式

### 7. DuckDuckGo Bangs 快捷跳转

SearXNG 支持 DuckDuckGo 的 `!!bang` 语法，直接跳转到目标网站搜索，比如：

```bash
!!gh SearXNG              # 直接跳到 GitHub 搜索
!!yt Python教程            # 直接跳到 YouTube 搜索
!!wfr Paris               # 直接跳到法语维基百科
!!npm express             # 直接跳到 npm 搜索
```


## 七、常见问题

**Q: 会被搜索引擎封 IP 吗？**

A: 有这个可能，尤其是在高频调用或某些搜索源风控更严的时候。自用、低频场景通常问题不大；如果调用频率高，建议开启 limiter 或加代理。

**Q: 速度比 Tavily 慢怎么办？**

A: SearXNG 需要同时请求多个搜索引擎再聚合，天然比单源 API 慢。可以通过 `engines` 参数限定只用 1-2 个引擎来加速。

**Q: 能搜到最新的内容吗？**

A: 大多数时候可以。因为底层接的就是 Google、Bing 等搜索引擎，所以时效性通常不会差太多，但还是会受实例配置、网络环境和上游搜索源状态影响。

**Q: 服务器配置要求？**

A: 要求不高。1核1G 的最小 VPS 通常就能跑，Docker 镜像本身也不大。



## 总结

| 你的需求 | 推荐方案 |
|---------|---------|
| 低边际成本、可自建 | **SearXNG** |
| 极致速度、不差钱 | Tavily |
| 不想部署、免费够用 | DuckDuckGo（无需 Key） |
| 中文搜索 + 微信文章 | **SearXNG + sogou_wechat** |

如果你在做 AI Agent，SearXNG 是比较推荐的搜索方案。



## 附：开箱即用的搜索 Skill

如果你不想手动配置，我已经把完整的 SearXNG 搜索 Skill 开源了，支持自动部署、中日韩搜索、AI 总结：

> GitHub: [betaHi/openclaw-searxng-search](https://github.com/betaHi/openclaw-searxng-search)


## 参考文档

**官方文档**

1. [SearXNG 官方文档](https://docs.searxng.org/)
2. [SearXNG Search API](https://docs.searxng.org/dev/search_api.html)
3. [SearXNG Configured Engines](https://docs.searxng.org/user/configured_engines.html)
4. [SearXNG GitHub 仓库](https://github.com/searxng/searxng)
5. [OpenClaw 搜索工具文档](https://docs.openclaw.ai/tools/web)
6. [Perplexica](https://github.com/ItzCrazyKns/Perplexica)

**价格参考**

下面这些链接里，价格相关信息以各官网写作时公开页面为准。

1. [Tavily 定价](https://tavily.com/pricing)
2. [Brave Search API 定价](https://brave.com/search/api/)
3. [Exa 定价](https://exa.ai/pricing)
4. [Google Custom Search JSON API 定价](https://developers.google.com/custom-search/v1/overview)
