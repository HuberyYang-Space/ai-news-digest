import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/**
 * 协作文档的链接守卫。
 *
 *   pnpm check-docs
 *
 * 守三件事，对应项目/全局 CLAUDE.md 里三条会静默失效的约定：
 *   1. 相对链接指向的文件还在（改文件名时链接会烂掉，而 md 不会报错）
 *   2. 指向 README 小节的锚点还在（索引表全靠它，改标题就断，页面上看不出来）
 *   3. 提到仓库里的文件时必须写成链接，不能只套一层反引号
 *
 * 扫描范围刻意不含 docs/agents/：那是 skill 按固定格式读取的配置，
 * 里面引用的 CONTEXT.md / docs/adr/ 本来就允许尚未创建，不归本仓库的文档规范管。
 */

const ROOT = process.cwd()

const DOC_GLOBS = ['CLAUDE.md', 'CLAUDE.local.md', 'README.md']
const DOC_DIRS = ['.docs']

/** 只有「看起来像仓库文件」的反引号内容才受规则 3 约束 */
const PATH_LIKE = /^[\w@][\w./-]*\.(?:ts|tsx|js|mjs|cjs|json|ya?ml|vue|md|html|css)$/

/**
 * 规则 3 不管历史决策存档：那些文档描述的是已被取代的方案，
 * 给它们的文件名挂链接会把读者引向如今长相完全不同的代码，
 * 反而助长「照着这篇改」——而每篇开头都明写了不要照着改。
 * 规则 1、2 照常适用，存档里指向现役文档的那几条链接必须一直有效。
 */
const LINK_OPTIONAL = ['.docs/decisions/']

function git(...args: string[]): string[] {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
}

const tracked = git('ls-files')
const trackedSet = new Set(tracked)

/** 基名 → 唯一的已跟踪路径；重名的基名不参与解析，避免指错文件 */
const byBasename = new Map<string, string | null>()
for (const file of tracked) {
  const base = path.basename(file)
  byBasename.set(base, byBasename.has(base) ? null : file)
}

function docFiles(): string[] {
  const fromDirs = DOC_DIRS.flatMap(dir =>
    existsSync(path.join(ROOT, dir)) ? git('ls-files', '--cached', '--others', '--exclude-standard', dir) : [],
  )
  return [...DOC_GLOBS.filter(f => existsSync(path.join(ROOT, f))), ...fromDirs.filter(f => f.endsWith('.md'))]
}

/** GitHub 的标题锚点：去掉行内格式与标点，空格转连字符，中文原样保留 */
function slugify(heading: string): string {
  return heading
    .replace(/`|\*\*|__|\[([^\]]*)\]\([^)]*\)/g, (_, label) => label ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_ -]/gu, '')
    .replace(/ /g, '-')
}

const anchorCache = new Map<string, Set<string>>()
function anchorsOf(file: string): Set<string> {
  const cached = anchorCache.get(file)
  if (cached)
    return cached
  const set = new Set<string>()
  for (const line of readFileSync(path.join(ROOT, file), 'utf8').split('\n')) {
    const heading = /^#{1,6} (.+)$/.exec(line)
    if (heading)
      set.add(slugify(heading[1]))
  }
  anchorCache.set(file, set)
  return set
}

const problems: string[] = []
function report(file: string, line: number, message: string): void {
  problems.push(`${file}:${line}  ${message}`)
}

for (const doc of docFiles()) {
  const dir = path.dirname(doc)
  const lines = readFileSync(path.join(ROOT, doc), 'utf8').split('\n')
  let inFence = false

  lines.forEach((line, i) => {
    const lineNo = i + 1
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      return
    }
    if (inFence)
      return

    for (const [, , target] of line.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)) {
      if (/^(?:https?:|mailto:|#)/.test(target)) {
        if (target.startsWith('#') && !anchorsOf(doc).has(target.slice(1)))
          report(doc, lineNo, `锚点不存在：${target}`)
        continue
      }
      const [filePart, anchor] = target.split('#')
      const resolved = path.normalize(path.join(dir, filePart))
      if (!existsSync(path.join(ROOT, resolved))) {
        report(doc, lineNo, `链接目标不存在：${target}`)
        continue
      }
      if (anchor && resolved.endsWith('.md') && !anchorsOf(resolved).has(anchor))
        report(doc, lineNo, `锚点不存在：${target}`)
    }

    if (LINK_OPTIONAL.some(prefix => doc.startsWith(prefix)))
      return

    // 先抠掉所有链接，剩下的反引号才是「光提了文件却没给链接」的嫌疑
    const bare = line.replace(/\[[^\]]*\]\([^)]+\)/g, '')
    for (const [, token] of bare.matchAll(/`([^`]+)`/g)) {
      if (!PATH_LIKE.test(token))
        continue
      const hit = trackedSet.has(token) ? token : byBasename.get(path.basename(token))
      if (hit && (token === hit || token === path.basename(hit)))
        report(doc, lineNo, `提到了 ${hit} 却没加链接：\`${token}\``)
    }
  })
}

if (problems.length > 0) {
  console.error(`文档链接检查未通过（${problems.length} 处）：`)
  for (const problem of problems)
    console.error(`  ${problem}`)
  process.exit(1)
}

console.log(`文档链接检查通过：${docFiles().length} 个文件，0 处问题。`)
