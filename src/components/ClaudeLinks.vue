<script setup lang="ts">
import { CLAUDE_CATEGORY, CLAUDE_LINKS } from '../data/claude-links'

defineProps<{ anchorId: string }>()
</script>

<template>
  <section :id="anchorId" class="issue-section">
    <h2 class="category-name">
      {{ CLAUDE_CATEGORY }}
    </h2>
    <ul class="link-list">
      <li v-for="link in CLAUDE_LINKS" :key="link.href" class="link-row">
        <a class="link-name tinter" :href="link.href" target="_blank" rel="noopener noreferrer">{{ link.name }}</a>
        <span class="link-host">{{ link.host }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.issue-section {
  margin-bottom: 2.5rem;
  scroll-margin-top: calc(var(--header-height) + var(--category-nav-height) + var(--section-title-gap));
}
.category-name {
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 0.78rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--accent);
  /* 不留下外边距：这里只有两条，标题到板块横线的距离若比条目之间的分隔线大一截，
     一眼就能看出第一条被压低了。各条统一由 .link-row 的 1rem 内边距决定间距 */
  margin: 0;
  padding-bottom: var(--section-title-gap);
  border-bottom: 1px solid var(--border);
}
.link-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.link-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 0;
  border-top: 1px solid var(--border);
}
.link-row:first-child {
  border-top: none;
}
.link-name {
  color: var(--fg);
  font-weight: 700;
  font-size: 1.08rem;
  text-decoration: none;
}
.link-host {
  flex-shrink: 0;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 0.72rem;
  color: var(--muted);
  white-space: nowrap;
}
</style>
