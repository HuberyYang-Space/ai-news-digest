import type { IssueSection } from './types'

/**
 * Claude 板块的固定链接。
 *
 * 这个板块曾经走正常采集，源是 claude-code 的 releases.atom，结果 003–008 期
 * 每期都是四条孤立的版本号（v2.1.2xx）：周刊一周一期，发版一天好几个，两者
 * 节奏对不上，读者点进去只看到一份 changelog。改成两个常驻入口，把「去哪儿看」
 * 交还给读者自己。
 */
export const CLAUDE_CATEGORY = 'Claude'

/**
 * 渲染用的板块列表。003–008 期的 JSON 里还固化着当初采到的发版条目，
 * 内容一经发布不可变，所以不删文件，只是不再展示。
 */
export function renderableSections(sections: IssueSection[]): IssueSection[] {
  return sections.filter(section => section.category !== CLAUDE_CATEGORY)
}

/** 锚点 id 不用 `section-${index}` 那套，因为这个板块不在期号数据里 */
export const CLAUDE_ANCHOR = 'section-claude'

export interface ClaudeLink {
  name: string
  href: string
  /** 右侧的域名提示，占位与条目列表的日期一致 */
  host: string
}

export const CLAUDE_LINKS: ClaudeLink[] = [
  { name: 'Claude 官方博客', href: 'https://claude.com/blog', host: 'claude.com' },
  { name: 'Claude Code 发版记录', href: 'https://github.com/anthropics/claude-code/releases', host: 'github.com' },
]
