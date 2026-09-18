# SPEC：新闻标题/摘要中文翻译（DeepL Free API）

> **状态：已实现，且实现细节已被后续改动取代。**
>
> 本文档是 2026-07-22 那次规划讨论的结论记录，写下时尚未动代码。保留它是为了记住
> 「为什么选 DeepL Free、为什么静态文案硬编码不走 API、为什么失败要静默降级」这几个
> 决策的来由——这些理由至今成立。
>
> ⚠️ 下文「实现细节」一节描述的是**当时**的方案：翻译发生在采集期的 `fetchSource()` 里。
> 后来因为 DeepL Free 每月 50 万字符额度不够，翻译被整体挪到了出刊期、只对入选条目执行，
> 相关文件（`sample-digest.ts`、`daily-digest.yml`）也已不存在。
> **现役的翻译链路以 [`CLAUDE.md`](../../CLAUDE.md) 的「翻译」一节为准，不要照着本文改代码。**

## 背景 / 目标

当前抓取到的 AI 新闻标题、摘要都是英文原文。目标是让页面主体内容显示中文，翻译服务使用 **DeepL 免费版 API**（用户会自行注册拿 key，接受非"零配置"方案以换取更好的翻译质量和更稳定的额度）。同时，页面上的静态英文文案（日期行、页头、页脚、空状态提示）也一起汉化，保持整页语言体验一致。

翻译只能发生在**构建期**（`main.ts` 的 `import.meta.env.SSR` 分支内，和 RSS 抓取同一个地方）——运行时是纯静态站点，没有后端可以调用带密钥的 API。

## 已确认的决策

通过讨论确认了以下两点（对应 AskUserQuestion 的回答）：

1. **翻译服务：DeepL Free API**（用户自行注册 key），而不是 MyMemory / Google 非官方接口等零配置方案——优先翻译质量和稳定性。
2. **静态 UI 文案一起汉化**（日期行、页头 "Wire Digest"/"Daily AI Digest"、页脚聚合文案、空状态提示），不是只翻译新闻标题/摘要。

## 关键设计决策

1. **静态 UI 文案不走翻译 API，直接硬编码中文**：页头、页脚、空状态提示、`<title>` 都是已知的固定字符串，翻译成中文写死在 `.vue` 文件里即可，不需要为它们消耗 DeepL 额度或引入构建期请求失败的风险。
2. **日期本地化用 `Intl`，不用翻译 API**：`toLocaleDateString('zh-CN', …)` 免费获得中文日期格式，无需网络请求。
3. **只有 `FeedItem.title` / `FeedItem.description` 需要真正的翻译**，因为这两个字段的内容来自 RSS，事先不可知。
4. **来源名称（`sources.json` 里的 `name`，如 "OpenAI Blog"）保持英文不翻译**——它们是品牌专有名词，硬翻译容易出怪异结果，中文科技媒体聚合站通常也保留英文源名。
5. **翻译失败要优雅降级，不能拖垮构建**：无 key、网络失败、超时、DeepL 配额耗尽等情况下，该来源的条目直接回退显示英文原文，构建照常成功——延续现有"单个 RSS 源失败不影响整体构建"的哲学（见 `fetch-sources.ts` 里 `fetchSource` 的 try/catch 设计）。
6. **无 `DEEPL_API_KEY` 时直接跳过翻译**（返回原文），不报错——这样在没配置 secret 的 fork/本地环境里 `pnpm build` 依然能跑通，只是内容仍是英文。

## 实现细节

### 1. 新增 `src/utils/network.ts`
把 `fetch-sources.ts` 里现有的 `withTimeout()` 和 `errorMessage()` 抽出来，两个文件（RSS 抓取、翻译）都要用同一套超时/报错格式化逻辑，避免重复。

### 2. 新增 `src/data/translate.ts`
- 导出 `translateTexts(texts: string[]): Promise<string[]>`。
- 从 `process.env.DEEPL_API_KEY` 读取密钥；未设置时直接原样返回 `texts`。
- 过滤空字符串（`description` 可能为 `''`）后，用 Node 22 全局 `fetch()`（无需新增依赖）以 `POST` 方式调用 `https://api-free.deepl.com/v2/translate`：
  - Header：`Authorization: DeepL-Auth-Key ${apiKey}`
  - Body（`application/x-www-form-urlencoded`）：多个 `text` 字段（一次请求批量翻译一个来源的全部标题+摘要，最多 10 条，远低于 DeepL 单请求 50 条上限）、`target_lang`、`source_lang=EN`。
  - `target_lang` 具体取值（`ZH` 还是 `ZH-HANS`）在实现时对照 DeepL 最新文档确认一次，写成一个具名常量方便调整。
- 用共享的 `withTimeout()` 包一层超时（如 15s），配合 fetch-sources.ts 现有的 20s 单源超时预算。
- 任何失败（无 key、超时、非 2xx、网络错误）一律 `catch`，`console.warn` 记录，返回原始 `texts`——调用方无需关心失败细节，函数保证"要么翻译成功，要么原样返回"，永不 throw。
- DeepL 按请求顺序返回 `translations` 数组，直接按下标对应回填即可，不需要额外的分隔符/对齐逻辑。

### 3. 接入 `src/data/fetch-sources.ts`
在 `fetchSource()` 构建完 `items`（标题、描述都已是最终英文文本，描述已按 `DESCRIPTION_MAX_LENGTH` 截断）之后：
```ts
const texts = items.flatMap(item => [item.title, item.description])
const translated = await translateTexts(texts)
items.forEach((item, i) => {
  item.title = translated[i * 2] || item.title
  item.description = translated[i * 2 + 1] || item.description
})
```
这一步仍在现有 `try` 块内，但因为 `translateTexts` 永不 throw，不会误伤外层"整源失败"的错误处理。

`fetchAllSources()` 里 `dateLabel` 的 `toLocaleDateString('en-US', …)` 改成 `'zh-CN'`。

### 4. `src/utils/format-date.ts`
`toLocaleDateString('en-US', …)` → `'zh-CN'`，格式选项不变（月/日/年）。

### 5. `src/components/App.vue`
- eyebrow "Wire Digest" → 中文（如"每日快讯"）
- `<h1>` "Daily AI Digest" → 中文（如"AI 日报"）
- `useHead` 的 `<title>` 模板同步改中文
- 空状态 "No articles could be fetched today." → 中文
- `footerText` 计算属性里的英文模板（"Aggregated from N sources... source(s) unavailable"）→ 中文模板，保留动态数字插值逻辑不变

### 6. `src/data/sample-digest.ts`
`pnpm dev` 用的硬编码示例数据同步替换成中文占位文本（标题、摘要、`dateLabel`、`formattedDate`、示例来源名），让本地开发预览的观感和生产一致；这是硬编码常量，不涉及任何 API 调用，符合现有"dev 模式零网络请求"的设计。

### 7. API Key 管理
- `.gitignore` 新增 `.env` / `.env.local` / `.env.*.local`。
- 新增 `.env.example`，内容为 `DEEPL_API_KEY=` 加一行注释说明去 DeepL 官网注册免费版 API key。
- `.github/workflows/daily-digest.yml`：给 `pnpm build` 步骤加 `env: { DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }} }`。
- **需要人工完成、无法由 Claude Code 代劳的部分**：
  1. 去 DeepL 官网注册 Free API，拿到 key（免费版每月 50 万字符额度，key 以 `:fx` 结尾，对应 `api-free.deepl.com` 这个 endpoint）。
  2. 把 key 加到 GitHub 仓库 Settings → Secrets → Actions，命名为 `DEEPL_API_KEY`。
  3. 本地想跑真实翻译验证的话，在项目根目录建 `.env`，写入同名变量。
  在 secret 配置好之前，CI 构建会一直成功，但内容保持英文（走的是"无 key 跳过翻译"的降级路径）。

### 8. 更新 `CLAUDE.md`（项目文档）
在 Architecture 部分补充：翻译发生在 `fetchSource()` 里、`translate.ts` 的职责、`DEEPL_API_KEY` 环境变量要求、无 key/失败时的降级行为，让后续改动者一眼就能看懂这条路径，不用重新读代码。

## 涉及文件一览

| 文件 | 改动 |
|---|---|
| `src/utils/network.ts` | 新增，`withTimeout`/`errorMessage` |
| `src/data/translate.ts` | 新增，DeepL 调用 + 降级逻辑 |
| `src/data/fetch-sources.ts` | 接入翻译、日期 locale 改 zh-CN、改用共享 network 工具 |
| `src/utils/format-date.ts` | locale 改 zh-CN |
| `src/components/App.vue` | 静态文案汉化 |
| `src/data/sample-digest.ts` | 示例数据汉化 |
| `.gitignore` | 忽略 `.env*` |
| `.env.example` | 新增 |
| `.github/workflows/daily-digest.yml` | 传入 `DEEPL_API_KEY` secret |
| `CLAUDE.md` | 文档同步 |

## 验证方式

1. `pnpm lint` 通过。
2. 本地建 `.env` 填入真实 key，跑 `pnpm build && pnpm preview`，浏览器里确认：标题/摘要是中文、日期行是中文格式、页头页脚空状态都是中文。
3. 验证降级路径：临时清空/删掉 `.env` 里的 `DEEPL_API_KEY` 再跑一次 `pnpm build`，确认构建依然成功、内容回退成英文、控制台能看到警告日志。
4. `grep` 一下 `dist/assets/*.js`，确认 `DEEPL_API_KEY` 明文和 DeepL 请求逻辑没有被打进客户端 bundle（沿用 CLAUDE.md 里对 `sample-digest.ts` 摇树验证的同款做法，这里额外多一层"密钥不能泄露到客户端"的意义）。
