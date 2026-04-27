<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  alias?: string
  uuid?: string
  ddVersion?: string
  uploadDate?: string
  codeName?: string
}>()

const formattedDate = computed(() => {
  if (!props.uploadDate) return ''
  try {
    return new Date(props.uploadDate).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch { return props.uploadDate }
})

function copyUuid() {
  if (props.uuid) navigator.clipboard.writeText(props.uuid)
}
</script>

<template>
  <div
    class="d-flex align-center gap-3 pa-3"
    style="
      border-bottom: 1px solid rgba(0,0,0,.12);
      background: #fff;
      position: sticky;
      top: var(--v-layout-top, 0px);
      z-index: 4;
    "
  >
    <v-btn
      variant="text"
      size="small"
      href="/dashboard"
      prepend-icon="mdi-arrow-left"
      aria-label="Back to search"
    >
      Search
    </v-btn>

    <v-divider vertical style="height:24px;align-self:center" />

    <div class="d-flex flex-column" style="flex:1;min-width:0">
      <h1 class="text-subtitle-1 font-weight-bold text-truncate mb-0">
        {{ alias ?? uuid ?? 'Simulation' }}
      </h1>
      <div class="d-flex align-center flex-wrap gap-2 mt-1">
        <v-chip
          v-if="uuid"
          size="x-small"
          variant="tonal"
          style="font-family:monospace;cursor:pointer"
          title="Click to copy UUID"
          @click="copyUuid"
        >{{ uuid.slice(0, 8) }}…</v-chip>
        <span v-if="codeName" class="text-caption text-medium-emphasis">{{ codeName }}</span>
        <span v-if="ddVersion"  class="text-caption text-medium-emphasis">DD {{ ddVersion }}</span>
        <span v-if="formattedDate" class="text-caption text-medium-emphasis">{{ formattedDate }}</span>
      </div>
    </div>

    <v-btn
      v-if="uuid"
      size="small"
      variant="outlined"
      prepend-icon="mdi-content-copy"
      aria-label="Copy simulation UUID to clipboard"
      @click="copyUuid"
    >
      Copy UUID
    </v-btn>
  </div>
</template>
