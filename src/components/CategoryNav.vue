<script setup lang="ts">
defineProps<{
  categories: { name: string, anchorId: string }[]
}>()

/**
 * 锚点目录，不是筛选器——一期周刊是一份完整读物，点某个分类只应该把读者
 * 送到那个板块，而不该把其余内容藏起来。
 *
 * 用 <a href="#..."> 而不是 JS 滚动：无 JS 时依然可用，滚动行为交给 CSS 的
 * scroll-behavior，锚点偏移交给板块自己的 scroll-margin-top。
 */
</script>

<template>
  <nav class="category-nav" aria-label="板块目录">
    <a
      v-for="category in categories"
      :key="category.anchorId"
      class="nav-item tinter"
      :href="`#${category.anchorId}`"
    >
      #{{ category.name }}
    </a>
  </nav>
</template>

<style scoped>
.category-nav {
  position: sticky;
  top: var(--header-height);
  z-index: 10;
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  padding: 0.75rem 0;
  margin-bottom: 2rem;
  scrollbar-width: none;
  /* 向上延伸的阴影把吸顶后与页头之间可能露出的缝隙盖住（--header-height 是手动
     维护的常量，加上移动端地址栏收起/展开时视口的短暂抖动，缝隙宽度并不固定）。
     用 box-shadow 而不是 ::before 伪元素，是因为下面的 overflow-x: auto 会把
     overflow-y 的计算值连带变成 auto，伪元素的负 top 会被裁掉，box-shadow 不受影响。 */
  box-shadow: 0 -20px 0 0 var(--bg);
}
.category-nav::-webkit-scrollbar {
  display: none;
}

.nav-item {
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
}
</style>
