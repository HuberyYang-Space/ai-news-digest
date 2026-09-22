<script setup lang="ts">
import { computed, inject, provide } from 'vue'
import { RouterView } from 'vue-router'
import { languageKey, useLanguage } from '../composables/use-language'
import { pageKey } from '../data/page-key'
import { siteUrl } from '../utils/site-url'
import GithubLink from './GithubLink.vue'
import LangToggle from './LangToggle.vue'
import ThemeToggle from './ThemeToggle.vue'

// 只实例化一次，provide 给 LangToggle 和每个 IssueItem 共用
// （useStorage 在同一文档内多实例不互相同步，见 use-language.ts 注释）。
provide(languageKey, useLanguage())

// 期号页的 next 为 null 就是最新一期（首页和 /issues/<最新期>/ 都落在这里），
// 按钮点下去原地不动，不如不出现；往期列表页自身没有期号，只要有期就给入口。
const page = inject(pageKey)
const showLatest = computed(() => {
  if (!page)
    return false
  return page.kind === 'archive'
    ? page.issues.length > 0
    : page.issue !== null && page.next !== null
})
</script>

<template>
  <header class="site-header">
    <div class="site-header-inner">
      <div class="title-group">
        <h1 class="site-title">
          <a :href="siteUrl('/')">AI 周刊</a>
        </h1>
        <span class="eyebrow">每周精选</span>
      </div>
      <div class="header-actions">
        <a v-if="showLatest" class="pill-button latest-link" :href="siteUrl('/')">最新</a>
        <LangToggle />
        <ThemeToggle />
        <GithubLink />
      </div>
    </div>
  </header>

  <div class="wrap">
    <RouterView />

    <footer>
      每周一出刊 · 聚合自 13 个 AI 相关 RSS 来源
    </footer>
  </div>
</template>

<style scoped>
.wrap {
  max-width: 700px;
  margin: 0 auto;
  /* 顶部补偿固定页头高度（+2rem 保留原设计的呼吸感），
     底部用 --pill-clearance 防止悬浮分页胶囊遮挡下面的页脚文案 */
  padding: calc(var(--header-height) + 0.5rem) 1.5rem var(--pill-clearance);
}
.site-header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  z-index: 100;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.site-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  max-width: 700px;
  margin: 0 auto;
  padding: 0.75rem 1.5rem;
}
.title-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
.eyebrow {
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  white-space: nowrap;
}
.site-title {
  margin: 0;
  font-size: 1.375rem;
  letter-spacing: -0.01em;
  white-space: nowrap;
}
.site-title a {
  color: inherit;
  text-decoration: none;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: none;
}
/* .pill-button 是按图标设计的，只有 min-width 撑着；文字态得自己给横向内边距 */
.latest-link {
  padding: 0 0.7rem;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}
footer {
  margin-top: 2.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
  text-align: center;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 0.72rem;
  color: var(--muted);
}

@media (max-width: 640px) {
  .site-header-inner {
    padding: 0.5rem 1rem;
    gap: 0.5rem;
  }
  .eyebrow {
    font-size: 0.6rem;
    letter-spacing: 0.14em;
  }
  .site-title {
    font-size: 1.05rem;
  }
  .header-actions {
    gap: 0.35rem;
  }
  .latest-link {
    padding: 0 0.5rem;
    font-size: 0.7rem;
  }
}
</style>
