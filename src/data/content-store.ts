import type { DateWindow } from './build-issue'
import type { Issue, IssueSummary, Snapshot, SnapshotItem } from './types'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { renderableSections } from './claude-links'

/**
 * content/ 的读写。**仅限构建期/脚本使用**——依赖 node:fs，绝不能进客户端
 * bundle（引用方必须走动态 import，见 src/data/load-content.ts）。
 */

// 用 cwd 而不是 import.meta.url 定位仓库根：SSR 构建会把这个模块打包进
// .vite-ssg-temp/<hash>/assets/ 下，相对 import.meta.url 往上数就落到了临时
// 目录里，content/ 一个文件都读不到（页面会静默渲染成「还没有发布任何一期」）。
// pnpm 脚本和 vite 构建都从仓库根运行，cwd 是可靠的。
const REPO_ROOT = process.cwd()
const SNAPSHOTS_DIR = join(REPO_ROOT, 'content/snapshots')
const ISSUES_DIR = join(REPO_ROOT, 'content/issues')

const DAY_MS = 24 * 60 * 60 * 1000
const CST_OFFSET_MS = 8 * 60 * 60 * 1000

/** 北京时间的 YYYY-MM-DD，快照文件名用它 */
export function cstDateStamp(date: Date = new Date()): string {
  return new Date(date.getTime() + CST_OFFSET_MS).toISOString().slice(0, 10)
}

export async function writeSnapshot(snapshot: Snapshot, date: Date = new Date()): Promise<string> {
  await mkdir(SNAPSHOTS_DIR, { recursive: true })
  const path = join(SNAPSHOTS_DIR, `${cstDateStamp(date)}.json`)
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  return path
}

async function listSnapshotFiles(): Promise<string[]> {
  if (!existsSync(SNAPSHOTS_DIR))
    return []
  const entries = await readdir(SNAPSHOTS_DIR)
  return entries.filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort()
}

/**
 * 读取窗口内的全部快照条目。
 *
 * 文件名按北京时间日期命名，但一份快照里装的是抓取那一刻 feed 里的内容，
 * 发布时间可能早于文件名日期。所以文件范围往两头各放宽一天，真正的窗口
 * 过滤交给 selectIssueItems 按每条的 pubDate 做。
 */
export async function readSnapshotItems(window: DateWindow): Promise<SnapshotItem[]> {
  const from = cstDateStamp(new Date(new Date(window.start).getTime() - DAY_MS))
  const to = cstDateStamp(new Date(new Date(window.end).getTime() + 2 * DAY_MS))

  const files = (await listSnapshotFiles()).filter((name) => {
    const stamp = name.slice(0, 10)
    return stamp >= from && stamp <= to
  })

  const items: SnapshotItem[] = []
  for (const file of files) {
    const raw = await readFile(join(SNAPSHOTS_DIR, file), 'utf8')
    const snapshot = JSON.parse(raw) as Snapshot
    items.push(...snapshot.items)
  }

  return items
}

function issueFileName(number: number): string {
  return `${String(number).padStart(3, '0')}.json`
}

async function listIssueFiles(): Promise<string[]> {
  if (!existsSync(ISSUES_DIR))
    return []
  const entries = await readdir(ISSUES_DIR)
  return entries.filter(name => /^\d+\.json$/.test(name))
}

export async function writeIssue(issue: Issue): Promise<string> {
  await mkdir(ISSUES_DIR, { recursive: true })
  const path = join(ISSUES_DIR, issueFileName(issue.number))
  await writeFile(path, `${JSON.stringify(issue, null, 2)}\n`, 'utf8')
  return path
}

export async function readIssue(number: number): Promise<Issue | null> {
  const path = join(ISSUES_DIR, issueFileName(number))
  if (!existsSync(path))
    return null
  return JSON.parse(await readFile(path, 'utf8')) as Issue
}

/** 全部期号，从新到旧 */
export async function listIssueNumbers(): Promise<number[]> {
  const files = await listIssueFiles()
  return files
    .map(name => Number.parseInt(name, 10))
    .filter(number => Number.isInteger(number))
    .sort((a, b) => b - a)
}

export async function nextIssueNumber(): Promise<number> {
  const numbers = await listIssueNumbers()
  return (numbers[0] ?? 0) + 1
}

/** 往期列表用的轻量摘要，不含正文 */
export async function listIssueSummaries(): Promise<IssueSummary[]> {
  const numbers = await listIssueNumbers()
  const summaries: IssueSummary[] = []

  for (const number of numbers) {
    const issue = await readIssue(number)
    if (!issue)
      continue
    summaries.push({
      number: issue.number,
      startDate: issue.startDate,
      endDate: issue.endDate,
      dateLabel: issue.dateLabel,
      publishedAt: issue.publishedAt,
      itemCount: renderableSections(issue.sections)
        .reduce((count, section) => count + section.items.length, 0),
    })
  }

  return summaries
}
