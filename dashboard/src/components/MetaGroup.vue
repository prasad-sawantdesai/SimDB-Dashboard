<script setup lang="ts">
defineProps<{
  title: string
  fields: { label: string; value?: string | null }[]
}>()
</script>

<template>
  <div class="px-3 py-2">
    <p
      class="text-overline text-medium-emphasis mb-2"
      style="letter-spacing:.1em;font-size:0.65rem"
    >
      {{ title }}
    </p>
    <div
      v-for="f in fields"
      :key="f.label"
      class="d-flex align-start py-1 gap-2"
    >
      <span
        class="text-caption text-medium-emphasis"
        style="min-width:82px;flex-shrink:0;line-height:1.4rem"
      >{{ f.label }}</span>
      <span
        class="text-body-2"
        style="word-break:break-word;line-height:1.4rem"
      >{{ f.value ?? '—' }}</span>
    </div>
  </div>
</template>
