# AI Weekly

[![Deploy](https://github.com/HuberyYang-Space/ai-news-digest/actions/workflows/deploy.yml/badge.svg)](https://github.com/HuberyYang-Space/ai-news-digest/actions/workflows/deploy.yml)
[![Collect Snapshot](https://github.com/HuberyYang-Space/ai-news-digest/actions/workflows/collect.yml/badge.svg)](https://github.com/HuberyYang-Space/ai-news-digest/actions/workflows/collect.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

自动出刊的 AI 周刊，形式参照 [JavaScript Weekly](https://javascriptweekly.com/)：每周一发布一期，往期永久可查。用 Vue 3 + vite-ssg 生成静态站，由 GitHub Actions 每日采集、每周出刊、自动部署。

**在线预览**：https://hub-yang.github.io/ai-news-digest/

## 功能特性

- 每周一自动出刊，`/` 是最新一期，`/issues/` 是往期列表，`/issues/N/` 永久可访问
- 聚合 13 个 AI 相关 RSS 源，按「官方/实验室」「科技媒体」「社区/独立博客」分板块，末尾固定一个「Claude」板块（官方博客 + Claude Code 发版记录），顶部锚点目录可跳转
- 同一事件的多家报道会被合并成一条并标注「另有 N 家报道」，报道家数同时作为排序信号
- 单个来源在一个板块内最多占 4 条，避免高产源霸榜
- 标题/摘要在出刊时通过 DeepL 翻译成中文并固化进当期数据，支持中英一键切换；未配置 Key 或翻译失败时降级为英文原文
- 浅色/深色/跟随系统三态主题切换，切换状态持久化到本地
- 单源抓取失败不影响采集，构建期零网络请求（详见下文「容错机制」）

## 快速开始

```bash
pnpm install               # 安装依赖
pnpm dev                   # 热更新本地开发（改样式/结构用，见下方说明）
pnpm collect               # 抓取全部 RSS 源，写入当天快照
pnpm publish-issue         # 接着上一期，出到本周一为止的新一期
pnpm build                 # 读取 content/ 生成 dist/ 静态站（不联网）
pnpm preview               # 本地预览构建产物
pnpm lint                  # ESLint 检查
pnpm typecheck             # vue-tsc 类型检查
```

`pnpm publish-issue` 的常用参数：

| 参数 | 用途 |
|---|---|
| `--recent <天数>` | 改用「最近 N 天」而不是接续上一期，冷启动出第 1 期时用 |
| `--skip-translation` | 跳过翻译，调算法时避免消耗 DeepL 额度 |
| `--dry-run` | 只打印结果，不写文件 |

还有 `pnpm rebuild-issue <期号>`，用现有快照重算某一期，专门用来调参后验证效果。

> 脚本名是 `publish-issue` 而不是 `publish`——`pnpm publish` 是 pnpm 自带的发包命令，会覆盖同名脚本。

**`pnpm dev` 用的是示例数据**：内容只在构建期从 `content/` 读取（依赖 `node:fs`），`pnpm dev` 是纯客户端渲染的开发服务器，读不到。所以 [`main.ts`](src/main.ts) 在开发模式下会退回 [`src/data/sample-issue.ts`](src/data/sample-issue.ts) 里的固定示例数据，让本地改样式/结构时不用等构建。这个兜底分支和示例数据在生产构建里会被摇树删掉。要看真实内容，用 `pnpm build` + `pnpm preview`。

本地测试翻译：在项目根目录新建 `.env`（已加入 `.gitignore`），写入 `DEEPL_API_KEY=你的密钥`。

## 工作原理

站点本身没有记忆——每次构建都是从头生成。而 RSS 是滑动窗口，高频源的 feed 里只留得住最近几小时的条目，**周一再一次性抓「过去 7 天」是抓不全的**。所以采用「每日累积原料、每周汇编成刊」的结构，用 Git 仓库当数据库：

```
每日 07:00  collect.yml   抓 14 源 × 最多 20 条（英文原文，不翻译）
                          → content/snapshots/2026-08-03.json → commit

每周一 08:00 publish.yml   读上周的 7 份快照
                          → 按链接去重 → 按发布时间过滤到本期窗口
                          → 跨源聚类 → 每类 Top 12 排序 → DeepL 翻译入选条目
                          → content/issues/003.json → commit → 构建 + 部署

代码 push    deploy.yml    只读本地 JSON 渲染全部期号，零网络请求
```

快照永久保留，因此任何时候都能用 `pnpm rebuild-issue` 拿历史原料重算某一期，验证算法调整的效果。

### 内容怎么选

排序的核心信号是「被多家媒体报道 = 重要」，所以要先把同一事件的多家报道聚成一簇。

标题相似度用 **IDF 加权的 Jaccard**，而不是朴素词面重合——`ai` 在半数标题里都出现，`hugging`、`face` 只出现在少数几条里，同等对待会让无关标题和真正的同源报道拿到一样的分数。

聚类阈值 `0.18` 是实测出来的：在 110 条真实标题上，真正的跨源同源对落在 0.155–0.187，而唯一一组误配在 0.169——**真假区间是重叠的**，不存在既不漏又不误的分界线。取 0.18 是宁可漏合，也不把两件不相干的事并成一条。代价是每期大约只合并 1~2 组。要调这个值，请先用 `pnpm rebuild-issue` 在历史期上量一遍。

排序依次看：报道家数 → 来源权重（[`sources.json`](sources.json) 里的 `priority`）→ 发布时间。之后按单源配额（每分类最多 4 条）过滤，再取每类前 12 条。

## 项目结构

```
.
├── content/                          # 数据（提交进仓库，Git 即数据库）
│   ├── snapshots/YYYY-MM-DD.json     # 每日采集的原料，英文原文
│   └── issues/00N.json               # 每期成品，中英双份，出刊后不再变动
├── scripts/
│   ├── collect.ts                    # 每日采集
│   ├── publish.ts                    # 每周出刊
│   ├── rebuild-issue.ts              # 重算指定期（调参用）
│   └── load-env.ts                   # 脚本侧加载 .env
├── src/
│   ├── main.ts                       # 入口：ViteSSG 多页 + 按路由装载数据
│   ├── data/
│   │   ├── types.ts                  # Snapshot / Issue 等数据契约
│   │   ├── page-key.ts               # provide/inject 用的 InjectionKey
│   │   ├── fetch-sources.ts          # RSS 抓取、超时、容错、HTML 实体解码
│   │   ├── build-issue.ts            # 去重/聚类/排序/选取（纯函数）
│   │   ├── assemble-issue.ts         # 选取 + 翻译，组装成一期
│   │   ├── content-store.ts          # content/ 读写（仅构建期/脚本）
│   │   ├── load-content.ts           # 按路由装载页面数据
│   │   ├── translate.ts              # DeepL 翻译，无 key / 失败时降级
│   │   ├── claude-links.ts           # Claude 板块的固定链接（不走采集）
│   │   └── sample-issue.ts           # pnpm dev 用的示例数据（会被摇树删掉）
│   ├── components/
│   │   ├── App.vue                   # 布局外壳（header + RouterView + footer）
│   │   ├── IssueView.vue             # 一期正文 + 上下期导航
│   │   ├── ArchiveView.vue           # 往期列表
│   │   ├── IssueSection.vue          # 一个分类板块
│   │   ├── IssueItem.vue             # 单条目 + 来源署名
│   │   ├── CategoryNav.vue           # 板块锚点目录
│   │   ├── ClaudeLinks.vue           # Claude 固定链接板块
│   │   ├── LangToggle.vue            # 中英文切换按钮
│   │   └── ThemeToggle.vue           # 浅色/深色/跟随系统切换按钮
│   ├── composables/
│   │   ├── use-language.ts           # 持久化语言偏好，跨组件共享
│   │   └── use-theme.ts              # 持久化主题偏好
│   ├── styles/base.css               # 全局样式（CSS 变量、reset、深色模式）
│   └── utils/
│       ├── format-date.ts            # 条目日期格式化
│       ├── site-url.ts               # 带 base 前缀的站内链接
│       └── network.ts                # 超时竞速、错误信息格式化
├── public/404.html                   # 未知路径的兜底页
├── vite.config.ts                    # 插件 + ssgOptions.includedRoutes（枚举期号路由）
├── sources.json                      # RSS 源配置（含分类与权重）
└── .github/workflows/
    ├── collect.yml                   # 每日采集 → commit
    ├── publish.yml                   # 每周出刊 → commit → 调用 deploy
    └── deploy.yml                    # 构建 → GitHub Pages + 服务器 rsync
```

## 自定义数据源

编辑 [`sources.json`](sources.json) 增删条目即可，无需改动脚本逻辑。`priority` 可选（缺省 1），用于决定同一事件由哪个源当代表条，以及排序时的优先级：

```json
{ "name": "Your Source", "url": "https://example.com/feed.xml", "category": "科技媒体", "priority": 2 }
```

分类板块按各来源在文件中首次出现的顺序展示。

## 定时任务的执行机制

三条流水线各司其职，都由 GitHub Actions 调度，无需自建服务器：

| workflow | 触发 | 动作 | 权限 |
|---|---|---|---|
| [`collect.yml`](.github/workflows/collect.yml) | 每日 cron `23 23 * * *`（北京 07:23）、手动 | `pnpm collect` → commit，不构建不部署 | `contents: write` |
| [`publish.yml`](.github/workflows/publish.yml) | 每周一 cron `23 0 * * 1`（北京 08:23）、手动 | `pnpm publish-issue` → commit → 调用 [`deploy.yml`](.github/workflows/deploy.yml) | `contents: write` + Pages |
| [`deploy.yml`](.github/workflows/deploy.yml) | push 到 `main`（忽略 `content/**`）、手动、被调用 | typecheck → build → Pages + 服务器 rsync | Pages、`id-token: write` |

几个关键点：

- **不会构建回环**：用 `GITHUB_TOKEN` 推送的 commit 不会触发任何 workflow，这是 GitHub 的内建机制；`paths-ignore: content/**` 是第二道保险。
- **[`deploy.yml`](.github/workflows/deploy.yml) 显式 checkout 分支最新提交**而不是触发本次运行的 SHA——被 [`publish.yml`](.github/workflows/publish.yml) 调用时，新一期的 commit 是运行开始之后才推上去的。
- 出刊排在当日采集之后一小时，确保用上最新一份快照。
- 两条写内容的流水线共用 `concurrency: content` 并在推送前 `git pull --rebase`，不会在 `main` 上撞车。
- [`publish.yml`](.github/workflows/publish.yml) 的手动触发支持 `recent_days` 参数，这是冷启动出第 1 期用的路径。

### 容错机制

- 每个 RSS 源单独 `try/catch`，单源失败或超时不影响本次采集；失败信息记进快照的 `errors` 字段。只有**所有**源都没返回内容时才让任务失败（那通常是网络问题，不是当天没新闻）
- 每次请求叠加两层超时：`rss-parser` 自身 15s socket 超时 + 额外一层 20s 硬超时，防止某个源长时间无响应把 Actions 任务挂死
- 翻译同样有 15s 超时；无 `DEEPL_API_KEY`、超时或接口失败都会静默降级为英文原文，并在页面上如实提示
- `pnpm build` 只读本地 JSON，不发任何网络请求，因此部署环节不会因为外部服务抖动而失败

## 技术栈

- Node.js 22（原生 ESM，`type: "module"`），`tsx` 跑 TypeScript 脚本
- [`rss-parser`](https://www.npmjs.com/package/rss-parser) 解析 RSS/Atom
- [DeepL API](https://www.deepl.com/docs-api) 做标题/摘要中文翻译
- Vue 3（`<script setup>` SFC）+ `vue-router` + [VueUse](https://vueuse.org/)
- [`vite-ssg`](https://github.com/antfu-collective/vite-ssg)（多页模式）：构建期 SSR + 客户端 hydration
- `@unhead/vue` 管理 `<title>` 等 head 内容
- Vite + TypeScript、ESLint（`@antfu/eslint-config`）、commitlint + husky（Conventional Commits）
- pnpm 作为包管理器
- 没有引入测试框架

## Contributing

欢迎提 Issue / PR。改动涉及选取算法时，用 `pnpm rebuild-issue <期号> --skip-translation` 在真实历史数据上验证效果；改动涉及渲染时，用 `pnpm build && pnpm preview` 验证。提交前确保 `pnpm typecheck` 和 `pnpm lint` 通过。

## License

[MIT](./LICENSE)
