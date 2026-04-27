<script setup lang="ts">
import { ref, computed } from 'vue'

type SimFile = { uri: string; uuid: { hex: string }; datetime?: string }

const props = defineProps<{
  files: SimFile[]
  label: string
}>()

const sortAsc = ref(false)
const searchText = ref('')

const filtered = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  const base = q
    ? props.files.filter(f => f.uri.toLowerCase().includes(q))
    : [...props.files]
  return base.sort((a, b) =>
    sortAsc.value ? a.uri.localeCompare(b.uri) : b.uri.localeCompare(a.uri)
  )
})
</script>

<template>
  <div>
    <div class="d-flex align-center gap-2 mb-3">
      <v-text-field
        v-model="searchText"
        density="compact"
        variant="outlined"
        placeholder="Filter URIs…"
        prepend-inner-icon="mdi-magnify"
        hide-details
        clearable
        style="max-width:400px"
      />
      <span class="text-caption text-medium-emphasis ml-auto">
        {{ filtered.length }} file{{ filtered.length !== 1 ? 's' : '' }}
      </span>
    </div>

    <v-card v-if="filtered.length" variant="outlined">
      <v-table density="compact">
        <thead>
          <tr>
            <th
              style="cursor:pointer;user-select:none"
              @click="sortAsc = !sortAsc"
            >
              URI
              <v-icon size="14" aria-hidden="true">
                {{ sortAsc ? 'mdi-arrow-up' : 'mdi-arrow-down' }}
              </v-icon>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in filtered" :key="f.uuid.hex">
            <td style="font-family:monospace;font-size:0.82rem;word-break:break-all">
              {{ f.uri }}
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <div v-else class="text-body-2 text-medium-emphasis pa-2">
      {{ searchText ? 'No URIs match your filter.' : 'No ' + label.toLowerCase() + '.' }}
    </div>
  </div>
</template>
