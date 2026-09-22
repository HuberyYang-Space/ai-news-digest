# CLAUDE.md

本文件只放**约束性内容**：现役禁令、跨文件的隐式契约、踩过的坑及其理由。
叙述性内容（架构取舍、算法来由、历史方案）已外放到 [`.docs/`](.docs/)，按下方索引按需读。

## 每次必读

- **每次开工** → 先读完本文件，再按「索引」读本次要动的那篇 [`.docs/`](.docs/) 文档。
- **每次提交** → 走 `/commit` skill（`~/.claude/skills/commit/SKILL.md`），不要手写 `git add` + `git commit` 绕过去。

## 索引

| 动手前 | 先读 | 不读的后果 |
|---|---|---|
| 改选取 / 聚类参数（[`src/data/build-issue.ts`](src/data/build-issue.ts)） | [`.docs/selection-algorithm.md`](.docs/selection-algorithm.md) | 把实测出来的阈值当成拍脑袋的数字改掉，页面上出现读者一眼可见的误合并 |
| 改数据流、渲染或构建管线的结构 | [`.docs/architecture.md`](.docs/architecture.md) | 破坏「纯静态 + 按路由切分数据」的性质，期数增长后首屏被全部历史期拖垮 |
| 改翻译链路 | [`.docs/decisions/2026-07-22-deepl-translation.md`](.docs/decisions/2026-07-22-deepl-translation.md) | 照着已被取代的旧方案把翻译挪回采集期，一个月内烧光 DeepL Free 额度 |
| 需要项目全貌、完整命令参数、产品行为描述 | [`README.md`](README.md) | 在第二处重写一遍事实描述，从此两份副本各自漂移 |

## Commands

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 热更新开发服务器。渲染的是 [`src/data/sample-issue.ts`](src/data/sample-issue.ts)，**不是真实内容** |
| `pnpm build` | `vite-ssg build`。**只读 `content/` 下的本地 JSON，零网络请求** |
| `pnpm preview` | 预览已构建的 `dist/` |
| `pnpm collect` | 抓取全部 RSS 源，写入当天快照。**唯一会碰 feed 的命令** |
| `pnpm publish-issue` | 出新一期，窗口是**上一期 `endDate` 到本周一 00:00 CST**（无往期时退回「上一个完整周」）。**唯一会调 DeepL 的命令** |
| `pnpm rebuild-issue <n>` | 用原始窗口重算第 `<n>` 期，调参验证用 |
| `pnpm lint` / `pnpm typecheck` | ESLint / `vue-tsc --noEmit` |
| `pnpm check-docs` | 协作文档的链接守卫（[`scripts/check-doc-links.ts`](scripts/check-doc-links.ts)），**改完任何 md 都要跑** |

参数表见 [README「快速开始」](README.md#快速开始)。

**本仓库没有测试框架。** 完成前的核实按这三条走：改选取算法 → `pnpm rebuild-issue 1 --skip-translation` 后逐条查产出 JSON；改渲染 → `pnpm build` 后 `pnpm preview`；改协作文档 → `pnpm check-docs`。

**脚本名必须是 `publish-issue`，不要改成 `publish`** —— `pnpm publish` 是 pnpm 自带的发包命令，会盖掉同名脚本。

## 禁令与契约

### 数据契约

- **不要把 `Date` 对象放进 `content/` 的 JSON 或 `initialState`。** 两者都要经 JSON 序列化跨越 SSR→客户端边界，`Date` 到浏览器里只剩字符串，原型和 `.toLocaleDateString()` 都没了；而 Vue 3 hydration 会拿现有 DOM 重跑一遍渲染函数，模板里现算日期就会抛错。所以 `IssueItem` 带的是 `formattedDate: string`，快照里的 `pubDate` 是 ISO **字符串**。新增任何构建期计算的字段都要保持 JSON-safe。

### 渲染

- **[`src/main.ts`](src/main.ts) 的 `ViteSSG(App, { routes, base }, …)` 必须传 `base`**（`import.meta.env.BASE_URL`）。站点部署在 `/ai-news-digest/` 下，不传的话 vue-router 的 history base 是 `/`，浏览器里没有路由能匹配，`RouterView` 渲染出**空白**。SSR 看起来一切正常，因为 vite-ssg 是直接按路径渲染的——这个故障只在浏览器里现形。
- **[`src/data/content-store.ts`](src/data/content-store.ts) 的路径必须从 `process.cwd()` 解析，不能用 `import.meta.url`。** SSR 构建会把该模块打进 `.vite-ssg-temp/<hash>/assets/`，相对 `import.meta.url` 的路径会落到临时目录，静默读到零期内容，页面渲染成「还没有发布任何一期」且不报错。
- **跨期导航必须用普通 `<a>`**（[`siteUrl()`](src/utils/site-url.ts)），不要换成 `RouterLink`。理由见 [`.docs/architecture.md`](.docs/architecture.md)。
- **[`src/data/sample-issue.ts`](src/data/sample-issue.ts) 只能从 `import.meta.env.DEV` 分支里动态导入。** `DEV` 是编译期常量，生产构建里被替换成 `false`，整个分支连同示例数据一起被摇树删掉。改动这里之后，`pnpm build` 后 grep 一下 `dist/assets/*.js` 确认示例数据没被打进客户端产物。
- **不要手动转义 HTML。** Vue 的 `{{ }}` 和 `:href` 在 SSR 渲染期已由 `@vue/compiler-ssr` 自动转义。

### 选取与采集

- **改 `CLUSTER_THRESHOLD` 前必须用 `pnpm rebuild-issue` 重新实测**，不要凭页面观感调。它是在 110 条真实标题上量出来的，真假区间重叠，取值取舍见 [`.docs/selection-algorithm.md`](.docs/selection-algorithm.md)。
- **聚类只和簇的代表条比较，不要改成和全部成员比较**——会产生链式合并（A≈B、B≈C ⇒ A 和 C 被并进同一簇）。
- **保持[选取](src/data/build-issue.ts)是无 I/O 的纯函数**，`pnpm rebuild-issue` 依赖这一点。
- **单源容错不能去掉**：[`fetchSource()`](src/data/fetch-sources.ts) 逐源 `try/catch`，失败记进快照的 `errors`；[`collect.ts`](scripts/collect.ts) 只在**所有**源都没返回内容时才让任务失败（那是网络/DNS 问题，不是当天没新闻）。
- **两层超时都要保留**：[`withTimeout()`](src/utils/network.ts) 在 parser 自带的 15s socket 超时之外再套一层 20s 硬竞速，专门防止某个源卡死整个 Actions 任务。

### 翻译

- **翻译只发生在出刊期，且只对入选条目。** 放在采集期会撑爆 DeepL Free 的月额度（14 源全量 ≈ 588k 字符/月，上限 500k），且每次 push 都会重跑。现在约 13k 字符/周，结果冻结进期号 JSON，**重建站点永远不重新翻译**。
- **翻译失败必须静默降级，永不 throw。** [`translate.ts`](src/data/translate.ts) 读 `process.env.DEEPL_API_KEY`，无 key / 超时 / 非 2xx / 网络错误一律 `console.warn` 后原样返回英文，这样 `pnpm build` 和 fork 都能跑通。降级结果由 `Issue.stats.translated` 透传到页面提示。
- **按板块分批调用**（每批 ≤ 24 条，远低于 DeepL 单请求 50 条上限）：一批失败只让那个板块回退英文。
- **[`sources.json`](sources.json) 里的来源名保持英文**，是品牌专名，不要翻译。
- **本地 `.env` 要在两处加载**：[`vite.config.ts`](vite.config.ts) 给 `pnpm build`/`dev` 调 `process.loadEnvFile()`，[`scripts/load-env.ts`](scripts/load-env.ts) 给 `tsx` 跑的脚本做同样的事——脚本根本不经过 Vite，少了它本地 `pnpm publish-issue` 会静默走「无 key」路径。

### 依赖与工具链

- **`@unhead/vue` 的版本必须和 `vite-ssg` 内部依赖的完全一致**（用 `pnpm why @unhead/vue` 核对）。两个实例意味着两套 head 注册表，`useHead()` 会静默失效。
- **pnpm 固定到确切版本**（`pnpm/action-setup` 写 `version: 11.15.1`，不是浮动的 `11`），**Node 固定 22**：pnpm 11.15+ 要求 Node ≥ 22.13，在 Node 20 上会让 `setup-node` 探测 pnpm 缓存时崩溃。两条都是 CI 真炸过之后才钉死的。
- pnpm 11.15+ 对 `--frozen-lockfile` 安装启用 `minimumReleaseAge` 供应链检查。若某个依赖解析到了刚发布不久的版本，CI 可能以 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` 拒绝 lockfile，哪怕几分钟前本地装得好好的。遇到就 `pnpm clean --lockfile && pnpm install` 重新解析，推送前用 `pnpm install --frozen-lockfile` 复验。
- **[`pnpm-workspace.yaml`](pnpm-workspace.yaml) 上的 `pnpm/yaml-enforce-settings` 规则要保持禁用。** 该文件存在只是为了携带 `allowBuilds: esbuild: true`（tsx 的依赖需要跑安装脚本，否则 pnpm 以 `ERR_PNPM_IGNORED_BUILDS` 中止）；启用那条规则会写入 `trustPolicy: no-downgrade`，导致 `undici-types@6.21.0`（当前钉住的 `@types/node` 的传递依赖）以 `ERR_PNPM_TRUST_DOWNGRADE` 装不上。要启用得先升 `@types/node`。
- **ESLint 忽略 `content/**`**：那是抓来的数据不是源码，feed 文本里合法地含有会触发 `no-irregular-whitespace` 的字符。
- [`lint-staged`](lint-staged.config.mjs) 里的 `vue-tsc` 要用 `bash -c` 包住，否则 lint-staged 自动追加的文件参数会让它绕过 [`tsconfig.json`](tsconfig.json)。CI 里另有一个独立的 typecheck 步骤跑在 `pnpm build` 之前。

### CI/CD

三条 workflow 的对照表见 [README「定时任务的执行机制」](README.md#定时任务的执行机制)，拆分理由见 [`.docs/architecture.md`](.docs/architecture.md)。以下是不能动的部分：

- **两个 cron 都停在第 23 分钟，不要移回 `:00`。** GitHub 在高峰期是**丢弃**定时触发而不是延后执行，整点（尤其 UTC 午夜）是最挤的时段。[`publish.yml`](.github/workflows/publish.yml) 原来的 `0 0 * * 1` 在第一个该触发的周一就没响，第 2 期是手动补发的。
- **[`deploy.yml`](.github/workflows/deploy.yml) 必须 checkout `ref: ${{ github.ref_name }}`，不是触发本次运行的 SHA。** 被 [`publish.yml`](.github/workflows/publish.yml) 调用时，新一期的 commit 是运行开始之后才推上去的，用默认 SHA 会构建出一个没有新期号的站点。
- **出刊窗口的起点必须是上一期的 `endDate`**（[`scripts/publish.ts`](scripts/publish.ts)），不能改成重算「上一个完整周」。前者能让漏掉的那周被下一次出刊顺带扫进来，后者会把跳过那周的快照永久丢弃。
- **两条写内容的 workflow 共用 `concurrency: group: content` 并在推送前 `git pull --rebase`**，不要拆开，否则会在 `main` 上撞车。
- [`deploy.yml`](.github/workflows/deploy.yml) 的 `paths-ignore: content/**` 是防构建回环的第二道保险（第一道是 GitHub 不为 `GITHUB_TOKEN` 推送的 commit 触发 workflow），不要删。

### 协作文档

- **新的方案讨论 / brainstorming 记录 / 选型对比一律写进 [`.docs/decisions/`](.docs/decisions/)，文件名 `YYYY-MM-DD-<主题>.md`。** superpowers 的 `brainstorming`、`writing-plans` 默认落盘到 `docs/superpowers/specs/`——那会在 [`docs/`](docs/)（skill 读的配置）和 [`.docs/`](.docs/)（叙述性文档）之外长出第三棵文档树，而且新方案不会出现在本文件的索引表里，下一个会话根本找不到它。
- **`.docs/decisions/` 是存档，不是现役说明。** 里面的方案一旦被后续改动取代，在文首标注「已被取代」并指向现役出处，**不要就地改写成新方案**——改写会把「当初为什么这么选」一起抹掉，而那是这批文档唯一的价值。也因为它们描述的是旧代码，`pnpm check-docs` 不要求它们给文件名挂链接。
- **改完任何 md 跑 `pnpm check-docs`。** 它守三件事：相对链接的目标还在、指向 README 小节的锚点还在、提到仓库里的文件时写成了链接。三者失效时 md 都不会报错，只会在某次有人点下去时才发现。

## Agent skills

- **Issue 跟踪**：GitHub Issues（HuberyYang-Space/ai-news-digest），走 `gh` CLI。约定见 [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)。
- **Domain docs**：单 context 布局，约定见 [`docs/agents/domain.md`](docs/agents/domain.md)。它声明的 `CONTEXT.md` 和 `docs/adr/` **目前尚未创建**，这是有意的——由 `/domain-modeling` skill 在真正有术语或决策要固化时懒生成，不要当成疏漏去补。
- [`docs/agents/`](docs/agents/) 是 skill 按固定路径读取的配置，不要迁进 [`.docs/`](.docs/)；`.docs/` 只放叙述性协作文档。
