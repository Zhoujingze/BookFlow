# 豆瓣图书分析与个性化推荐平台

> 一个完整的「多线程采集 → 离线清洗 → 多维分析 → 混合推荐 → 异步下发」全生命周期数据管线与全栈 Web 平台。

## 项目简介

本项目以豆瓣图书为数据源，构建了一条从网络数据抓取到个性化推荐的全链路数据管线，并配套一个带用户系统的 Web 平台，用于演示数据流转、统计分析与 AI 推荐效果。

- **数据端（Python）**：多线程爬虫 + 离线清洗管线，产出标准化的 `books_clean.json`。
- **服务端（Node.js + Express）**：消费清洗产物，提供统计分析、混合推荐、用户画像与 SSE 进度下发。
- **前端（原生 HTML/JS）**：可视化仪表盘、采集/清洗进度条、推荐结果与收藏交互。

## 技术栈

| 层 | 技术 |
|---|---|
| 采集 | Python · Requests · BeautifulSoup · ThreadPoolExecutor（多线程）|
| 清洗 | Python · chardet（编码检测）· 规则引擎 |
| 后端 | Node.js · Express · SSE（Server-Sent Events）|
| 推荐算法 | 基于内容推荐 + 协同过滤（Jaccard）+ 热度推荐（加权融合）|
| 前端 | 原生 HTML / CSS / JavaScript · EventSource |

## 目录结构

```
.
├── scraper/                # Python 数据管线
│   ├── douban_spider.py    #   多线程爬虫（8 品类并发）
│   └── cleaner.py          #   离线清洗（编码检测+规则引擎+去重）
├── server/                 # Node.js 后端
│   ├── server.js           #   Express 入口、路由、SSE
│   ├── scraper.js          #   爬虫调度（调用 Python）
│   ├── cleaner.js          #   清洗调度（调用 Python）
│   ├── analyzer.js         #   多维统计分析
│   ├── recommender.js      #   混合推荐引擎
│   └── auth.js             #   用户注册/登录
├── public/                 # 前端页面
│   ├── dashboard.html      #   仪表盘
│   ├── book-scrape.html    #   采集页（SSE 进度）
│   ├── book-clean.html     #   清洗页（SSE 进度）
│   ├── book-analyze.html   #   统计分析页
│   ├── book-recommend.html #   推荐页
│   └── js/、css/           #   静态资源
└── data/                   # 数据产物
    ├── books.csv           #   原始采集
    ├── books_clean.json    #   清洗产物（标准 JSON）
    ├── users.json          #   用户表
    ├── user_profiles.json  #   用户画像/偏好
    └── user_favorites.json #   收藏/不感兴趣行为
```

## 核心模块说明

### 1. 多线程爬虫（`scraper/douban_spider.py`）
- 目标：豆瓣图书 8 个品类 tag，采集目标 1000 条。
- 并发：`ThreadPoolExecutor(max_workers=5)`，按 tag 切分任务。
- 线程安全：3 把 `threading.Lock` 分别保护结果列表、去重集合、进度计数。
- 反爬：随机 User-Agent + 翻页随机延时（2-5s）+ 失败退避（10s）。

### 2. 离线清洗管线（`scraper/cleaner.py`）
- 编码检测：`chardet` 检测后，将 gb2312 / gbk 归并为 gb18030，解决 CSV 乱码。
- 规则引擎：`validation_rules`（噪声过滤）→ `seen_titles`（去重）→ `transform_rules`（字段归一化）。
- 产物：输出 `books_clean.json`（UTF-8），供分析与推荐统一消费。

### 3. 多维统计分析（`server/analyzer.js`）
- 支持出版社 / 作者 / 评分区间 / 品类 4 个维度聚合统计，按频次降序并限量返回。

### 4. 混合推荐引擎（`server/recommender.js`）
三路推荐加权融合：

```
Final_Score = 0.4 × Content + 0.3 × Collaborative + 0.3 × Popularity
```

- **Content**：匹配用户偏好作者 / 出版社 / 评分区间。
- **Collaborative**：基于 Jaccard 相似度计算相似用户行为。
- **Popularity**：综合评分与作者 / 出版社出现频率。
- 支持收藏 / 不感兴趣行为采集，并生成可解释的推荐理由。

### 5. 异步进度下发（SSE）
- `GET /api/scrape-progress` 与 `GET /api/clean-progress` 以 `text/event-stream` 实时推送百分比。
- 前端通过 `EventSource` 接收并更新进度条。

## 运行方式

### 安装依赖

```bash
# Node 端依赖
npm install

# Python 端依赖
pip install requests beautifulsoup4 chardet
```

### 启动服务

```bash
npm start          # 启动 Express，默认 http://localhost:3000
```

### 单独运行数据管线

```bash
npm run scrape     # 运行爬虫（python scraper/douban_spider.py）
npm run clean      # 运行清洗（python scraper/cleaner.py）
```

## 主要接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/login` `/api/register` | 用户登录 / 注册 |
| POST | `/api/scrape-books` | 触发爬虫采集 |
| GET  | `/api/scrape-progress` | SSE 爬取进度 |
| POST | `/api/clean-books` | 触发数据清洗 |
| GET  | `/api/clean-progress` | SSE 清洗进度 |
| POST | `/api/analyze-books` | 多维统计分析 |
| POST | `/api/recommend` | 混合推荐 |
| GET  | `/api/recommend/stats` | 推荐系统统计 |
| POST/DELETE | `/api/recommend/favorite` | 收藏 / 取消收藏 |
| POST | `/api/recommend/dislike` | 标记不感兴趣 |

## 数据流转图

```
豆瓣图书 ──(多线程爬虫)──▶ books.csv ──(离线清洗)──▶ books_clean.json
                                                          │
                ┌─────────────────────────────────────────┤
                ▼                                         ▼
        多维统计分析(analyzer)                     混合推荐(recommender)
                │                                         │
                └──────────────▶ 前端可视化 / 推荐结果 ◀──────┘
