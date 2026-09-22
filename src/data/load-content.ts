import type { PageData } from './page-key'
import type { Issue } from './types'
import { renderableSections } from './claude-links'
import { listIssueNumbers, listIssueSummaries, readIssue } from './content-store'

/**
 * 构建期按路由装载页面数据。**仅 SSR 调用**——依赖 content-store 的 node:fs，
 * 必须经由 main.ts 里的动态 import 引入，否则 Node 内置模块会漏进客户端 bundle。
 */

/** 从 /issues/12/ 里取出 12；不是期号页则返回 null */
function issueNumberFromPath(routePath: string): number | null {
  const matched = /^\/issues\/(\d+)\/?$/.exec(routePath)
  if (!matched)
    return null
  const number = Number.parseInt(matched[1]!, 10)
  return Number.isInteger(number) ? number : null
}

/**
 * stats 必须跟着实际渲染的板块走，否则页面会自称「本期 38 条」却只列出 34 条。
 * collected 是当初的候选总数，属于出刊过程的事实，不随展示口径变。
 */
function forRendering(issue: Issue | null): Issue | null {
  if (!issue)
    return null

  const sections = renderableSections(issue.sections)
  if (sections.length === issue.sections.length)
    return issue

  const items = sections.flatMap(section => section.items)
  return {
    ...issue,
    sections,
    stats: {
      ...issue.stats,
      published: items.length,
      sourceCount: new Set(items.map(item => item.source)).size,
    },
  }
}

export async function loadPageData(routePath: string): Promise<PageData> {
  const path = routePath.replace(/\/+$/, '') || '/'

  if (path === '/issues')
    return { kind: 'archive', issues: await listIssueSummaries() }

  // 期号从大到小
  const numbers = await listIssueNumbers()
  const requested = issueNumberFromPath(routePath)
  // 首页 = 最新一期
  const number = requested ?? numbers[0] ?? null

  if (number === null)
    return { kind: 'issue', issue: null, prev: null, next: null, total: 0 }

  const index = numbers.indexOf(number)
  return {
    kind: 'issue',
    issue: forRendering(await readIssue(number)),
    // numbers 是降序，所以「下一期」在前面、「上一期」在后面
    next: index > 0 ? numbers[index - 1]! : null,
    prev: index >= 0 && index < numbers.length - 1 ? numbers[index + 1]! : null,
    total: numbers.length,
  }
}
