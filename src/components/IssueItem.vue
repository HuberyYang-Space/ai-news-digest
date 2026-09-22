<script setup lang="ts">
import type { IssueItem } from '../data/types'
import { computed, inject } from 'vue'
import { languageKey } from '../composables/use-language'

const props = defineProps<{ item: IssueItem }>()

const language = inject(languageKey)
if (!language) {
  throw new Error('language state not found — App.vue must call provide(languageKey, ...) before mounting IssueItem')
}
const { lang } = language

const title = computed(() => lang.value === 'zh' ? props.item.titleZh : props.item.title)
const description = computed(() => lang.value === 'zh' ? props.item.descriptionZh : props.item.description)
</script>

<template>
  <li class="item">
    <div class="item-line">
      <a class="item-title tinter" :href="item.link" target="_blank" rel="noopener noreferrer">{{ title }}</a>
      <span v-if="item.formattedDate" class="item-date">{{ item.formattedDate }}</span>
    </div>
    <p v-if="description" class="item-desc">
      {{ description }}
    </p>
    <p class="item-byline">
      <span class="source">{{ item.source }}</span>
      <span v-if="item.alsoReportedBy.length" class="also">
        · 另有 {{ item.alsoReportedBy.length }} 家报道：{{ item.alsoReportedBy.join('、') }}
      </span>
    </p>
  </li>
</template>

<style scoped>
.item {
  padding: 1rem 0;
  border-top: 1px solid var(--border);
}
.item:first-child {
  border-top: none;
}
.item-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}
.item-title {
  color: var(--fg);
  font-weight: 700;
  font-size: 1.08rem;
  text-decoration: none;
}

.item-date {
  flex-shrink: 0;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  white-space: nowrap;
}
.item-desc {
  margin: 0.4rem 0 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 0.92rem;
  color: var(--muted);
  overflow-wrap: break-word;
  max-width: 65ch;
}
.item-byline {
  margin: 0.45rem 0 0;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 0.72rem;
  letter-spacing: 0.03em;
  color: var(--muted);
}
.item-byline .source {
  color: var(--accent);
}
</style>
