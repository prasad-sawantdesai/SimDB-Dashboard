<!-- IDSFieldSearch.vue
  Search IMAS DD fields via GET /simulation/<uuid>/fields/search?q=...
  LLM-semantic, simulation-specific — only fields that exist in this simulation,
  with concrete array indices and shape already resolved.
-->
<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { config } from '../config'
import PlotlyLoader from './PlotlyLoader.vue'
import PlotlyHeatmap from './PlotlyHeatmap.vue'
import draggable from 'vuedraggable'

// ── Types ─────────────────────────────────────────────────────────────────────
type DDPath = {
  path: string
  ids: string
  dtype: string
  units: string
  description: string
  shape?: number[]
  score?: number
  // statistics from fields/search
  min?: number
  max?: number
  mean?: number
  std?: number
  n_elements?: number
  is_monotonic?: boolean
  value?: string | number   // present for 0D scalars
}

type RecentField = {
  path: string        // normalised API path
  dtype: string
  units: string
  description: string
}

type PlotEntry = {
  path: string
  label: string
  loading: boolean
  error: string | null
  value: any | null
  xValue: any | null    // 1D: x-axis data; 2D: dim1 (R)
  xValue2: any | null  // 2D only: dim2 (Z)
  xLabel: string
  yLabel: string
  xLabel2: string      // 2D only: label for dim2 axis
}

// ── Props ─────────────────────────────────────────────────────────────────────
const props = defineProps<{
  simUuid: string
  ddVersion?: string
}>()

// ── API base URL ─────────────────────────────────────────────────────────────
const base = computed(() => config.rootAPI(config.defaultServer))

// ── State ─────────────────────────────────────────────────────────────────────
const results       = ref<DDPath[]>([])
const searchLoading = ref(false)
const plotEntries   = ref<PlotEntry[]>([])
const selectedItem  = ref<DDPath | null>(null)
const inputText     = ref('')                 // v-model:search on the autocomplete
const currentSearchText = ref('')             // tracks typed text
const menuOpen      = ref(false)
let hasSearched     = false  // true once the user has pressed Enter and a search ran

// ── Recent fields — persisted per simulation in localStorage ─────────────────
const RECENT_KEY = computed(() => `simdb:recent-fields:${props.simUuid}`)
const recentFields = ref<RecentField[]>([])
const recentOpen   = ref(true)

function loadRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY.value)
    recentFields.value = raw ? JSON.parse(raw) : []
  } catch { recentFields.value = [] }
}
function saveToRecent(apiPath: string, dd: { dtype: string; units: string; description: string }) {
  const entry: RecentField = { path: apiPath, dtype: dd.dtype, units: dd.units, description: dd.description }
  const list = recentFields.value.filter(r => r.path !== apiPath)
  list.unshift(entry)
  recentFields.value = list.slice(0, 15)
  try { localStorage.setItem(RECENT_KEY.value, JSON.stringify(recentFields.value)) } catch { /* quota */ }
}
function removeRecent(path: string) {
  recentFields.value = recentFields.value.filter(r => r.path !== path)
  try { localStorage.setItem(RECENT_KEY.value, JSON.stringify(recentFields.value)) } catch { /* quota */ }
}
function selectRecent(r: RecentField) {
  // Skip if already plotted
  if (plotEntries.value.some(e => e.path === r.path)) return
  const synthetic: DDPath = { path: r.path, ids: r.path.split('/')[0], dtype: r.dtype, units: r.units, description: r.description }
  addFieldWithPath(synthetic, r.path)
}
loadRecent()


// ── no-data hint ──────────────────────────────────────────────────────────────
const noDataText = computed(() => {
  if (searchLoading.value) return 'Searching…'
  if (!currentSearchText.value.trim()) return 'Describe a quantity, or type/paste a path and press Enter'
  if (!hasSearched) return 'Press Enter to search, or Enter a path to fetch directly'
  return 'No fields found — try different keywords'
})

// ── Search — GET /simulation/<uuid>/fields/search?q=... ──────────────────────
// Enter on a path-like string (contains '/') fetches directly.
// Enter on natural language runs the LLM search.
function onSearch(text: string | null) {
  currentSearchText.value = text ?? ''
  // Clear stale results and reset search state when input is cleared
  if (!text?.trim()) { results.value = []; hasSearched = false }
}

function onEnter() {
  const text = currentSearchText.value.trim()
  if (!text) return
  if (plotEntries.value.some(e => e.path === normalisePath(text))) return
  if (text.includes('/')) {
    // Looks like an IMAS path — fetch it directly without searching
    const synthetic: DDPath = { path: text, ids: text.split('/')[0], dtype: '', units: '', description: '' }
    selectedItem.value = null
    inputText.value = ''
    results.value = []
    addFieldWithPath(synthetic, text)
  } else {
    searchFields(text)
  }
}

async function searchFields(text: string) {
  hasSearched = true
  searchLoading.value = true
  results.value = []
  try {
    const resp = await fetch(
      `${base.value}/simulation/${props.simUuid}/fields/search?q=${encodeURIComponent(text)}&limit=50`
    )
    if (resp.ok) {
      const data = await resp.json()
      results.value = data.results ?? []
      if (results.value.length) nextTick(() => { menuOpen.value = true })
    }
  } catch { /* network error — leave results empty */ }
  finally { searchLoading.value = false }
}

// ── Selection ─────────────────────────────────────────────────────────────────────
// fields/search returns paths with concrete indices (e.g. profiles_1d[0]),
// so we can fetch immediately after normalising.
function onSelect(dd: DDPath | null) {
  if (!dd) return
  selectedItem.value = null
  inputText.value = ''
  results.value = []
  addFieldWithPath(dd, dd.path)
}

// /data API expects slash-index form: profiles_1d[0]/x → profiles_1d/0/x
function normalisePath(path: string): string {
  return path.replace(/\[(\d*)\]/g, (_, idx) => '/' + (idx || '0'))
}

// ── Fetch IMAS data — GET /simulation/<uuid>/data?path=... ────────────────────

// Returns "leaf [units]" or just "leaf" when units is empty.
function axisLabel(apiPath: string, units: string = ''): string {
  const leaf = apiPath.split('/').filter(s => !/^\d+$/.test(s)).pop() ?? apiPath
  return units ? `${leaf} [${units}]` : leaf
}

async function addFieldWithPath(dd: DDPath, resolvedPath: string) {
  // Always normalise — converts any bracket notation ([0], []) to slash segments (/0/)
  // regardless of whether path came from catalogue, semantic results, or manual edit.
  const apiPath = normalisePath(resolvedPath)
  const entry: PlotEntry = {
    path: apiPath, label: apiPath,
    loading: true, error: null, value: null, xValue: null, xValue2: null,
    xLabel: 'index',
    yLabel: axisLabel(apiPath, dd.units),
    xLabel2: 'index',
  }
  plotEntries.value.push(entry)
  const idx = plotEntries.value.length - 1

  try {
    let resp: Response
    try {
      resp = await fetch(
        `${base.value}/simulation/${props.simUuid}/data?path=${encodeURIComponent(apiPath)}`
      )
    } catch {
      throw new Error(`Cannot reach SimDB server at ${base.value}`)
    }
    if (!resp.ok) {
      let msg = `HTTP ${resp.status}`
      try {
        const body = await resp.json()
        if (body?.error) msg = body.error
      } catch { /* non-JSON error body — keep HTTP status */ }
      throw new Error(msg)
    }
    const data = await resp.json()
    plotEntries.value[idx].value = data.value

    if (is2DValue(data.value)) {
      // 2D heatmap: fetch dim1 (returned as coordinate) and infer dim2 = .../dim2
      const dim1Path: string = data.coordinate ?? ''
      const dim2Path: string = dim1Path.replace(/dim1$/, 'dim2')
      if (dim1Path) {
        const [r1, r2] = await Promise.all([
          fetch(`${base.value}/simulation/${props.simUuid}/data?path=${encodeURIComponent(dim1Path)}`),
          dim2Path !== dim1Path
            ? fetch(`${base.value}/simulation/${props.simUuid}/data?path=${encodeURIComponent(dim2Path)}`)
            : Promise.resolve(null),
        ])
        if (r1.ok) {
          plotEntries.value[idx].xValue  = (await r1.json()).value
          plotEntries.value[idx].xLabel  = axisLabel(dim1Path)
        }
        if (r2 && r2.ok) {
          plotEntries.value[idx].xValue2 = (await r2.json()).value
          plotEntries.value[idx].xLabel2 = axisLabel(dim2Path)
        }
      }
    } else {
      // 1D: use the DD coordinate returned by the server. Fall back to <ids>/time.
      const coordPath: string = data.coordinate ?? (apiPath.split('/')[0] + '/time')
      if (coordPath !== apiPath) {
        const cResp = await fetch(
          `${base.value}/simulation/${props.simUuid}/data?path=${encodeURIComponent(coordPath)}`
        )
        if (cResp.ok) {
          plotEntries.value[idx].xValue = (await cResp.json()).value
          plotEntries.value[idx].xLabel = axisLabel(coordPath)
        }
      }
    }
  } catch (e: any) {
    plotEntries.value[idx].error = e.message ?? 'Fetch failed'
  } finally {
    plotEntries.value[idx].loading = false
    if (!plotEntries.value[idx].error) saveToRecent(apiPath, dd)
  }
}

function removeEntry(idx: number) { plotEntries.value.splice(idx, 1) }

// ── 2D detection ──────────────────────────────────────────────────────────────
function is2DValue(v: any): boolean {
  return Array.isArray(v) && v.length > 0 && Array.isArray(v[0])
}
function is2D(entry: PlotEntry): boolean {
  return is2DValue(entry.value)
}

// ── Decode numpy.ndarray ──────────────────────────────────────────────────────
function decodeNumpyArray(v: any): number[] | null {
  if (!v) return null
  if (Array.isArray(v)) return v
  if (v._type !== 'numpy.ndarray') return null
  const bytes = window.atob(v.bytes)
  const buf = new ArrayBuffer(bytes.length)
  const dv2 = new DataView(buf)
  for (let i = 0; i < bytes.length; i++) dv2.setUint8(i, bytes.charCodeAt(i))
  if (v.dtype === 'float64') return Array.from(new Float64Array(buf))
  if (v.dtype === 'float32') return Array.from(new Float32Array(buf))
  if (v.dtype === 'int32')   return Array.from(new Int32Array(buf))
  return null
}

function getTraces(entry: PlotEntry) {
  const y = decodeNumpyArray(entry.value)
  const x = decodeNumpyArray(entry.xValue)
  if (!y) return []
  const trace: any = { y, name: entry.label, mode: 'lines' }
  // Only attach x when lengths match — mismatched x (e.g. time vs spatial index)
  // would make Plotly render a single point instead of the full array.
  if (x && x.length === y.length) trace.x = x
  return [trace]
}

function isPlottable(entry: PlotEntry) {
  const arr = decodeNumpyArray(entry.value)
  return arr !== null && arr.length >= 5
}

// For short arrays (1-4 values) or scalars — display as a compact value table
function isShortArray(entry: PlotEntry) {
  const arr = decodeNumpyArray(entry.value)
  return arr !== null && arr.length > 0 && arr.length < 5
}

function shortArrayRows(entry: PlotEntry) {
  const y = decodeNumpyArray(entry.value)!
  const x = decodeNumpyArray(entry.xValue)
  return y.map((val, i) => ({
    x: x && x.length === y.length ? x[i] : i,
    y: val,
  }))
}

function scalarDisplay(entry: PlotEntry) {
  if (!entry.value && entry.value !== 0) return 'No data'
  if (typeof entry.value === 'number') return String(entry.value)
  if (typeof entry.value === 'string') return entry.value
  return String(entry.value)
}

function dtypeBadgeColor(dtype: string) {
  if (dtype.includes('FLT')) return 'blue-darken-3'
  if (dtype.includes('INT')) return 'green-darken-3'
  if (dtype.includes('CPX')) return 'purple-darken-3'
  return 'grey-darken-2'
}

// Format a stat number compactly: 1.23e+19 → "1.23e+19", 12900 → "12900"
function fmtStat(v: number | undefined): string {
  if (v === undefined || v === null) return ''
  if (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-2 && v !== 0)) {
    return v.toExponential(2)
  }
  return v.toPrecision(4).replace(/\.?0+$/, '')
}

const cols = 3  // fixed 3-column plot grid

// Compact display label that preserves indices, e.g.
// core_profiles/profiles_1d/0/ion/1/temperature -> profiles_1d[0]/ion[1]/temperature
function shortLabel(path: string): string {
  const parts = path.split('/').filter(Boolean)
  const segments: string[] = []

  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      if (segments.length) segments[segments.length - 1] += `[${part}]`
      else segments.push(`[${part}]`)
    } else {
      segments.push(part)
    }
  }

  return segments.slice(-3).join('/')
}
</script>

<template>
  <v-card variant="outlined" class="mt-4" style="overflow:hidden">
    <!-- Header -->
    <div class="d-flex align-center px-3 py-2 gap-2" style="border-bottom:1px solid rgba(0,0,0,.1)">
      <span class="text-subtitle-1 font-weight-medium">Explore IDS Fields</span>
      <v-progress-circular
        v-if="searchLoading"
        indeterminate size="14" width="2"
        class="ml-1"
        aria-label="Searching…"
      />
      <v-spacer />

      <v-btn
        v-if="plotEntries.length"
        size="small"
        variant="text"
        color="error"
        aria-label="Clear all plots"
        @click="plotEntries = []"
      >Clear all</v-btn>
    </div>

    <!-- Body: left search pane + right plot grid -->
    <div class="d-flex" style="min-height:400px">

      <!-- ── Left: search + active fields list ───────────────────────────── -->
      <div
        style="width:350px;flex-shrink:0;border-right:1px solid rgba(0,0,0,.1);overflow-y:auto;background:#fafafa"
        class="d-flex flex-column"
      >
        <div class="pa-3">


          <v-autocomplete
            v-model="selectedItem"
            v-model:menu="menuOpen"
            v-model:search="inputText"
            :items="results"
            item-title="path"
            :return-object="true"
            :loading="searchLoading"
            density="compact"
            variant="outlined"
            placeholder="Search fields in this simulation…"
            prepend-inner-icon="mdi-magnify"
            no-filter
            clearable
            :no-data-text="noDataText"
            hint="Enter to search (natural language) or fetch (path)"
            persistent-hint
            @update:search="onSearch"
            @update:model-value="onSelect"
            @keydown.enter.prevent="onEnter"
          >
            <template #item="{ item, props: itemProps }">
              <v-list-item v-bind="itemProps" :title="undefined" :subtitle="undefined">
                <template #prepend>
                  <v-chip
                    :color="dtypeBadgeColor(item.raw.dtype)"
                    size="x-small"
                    label
                    class="mr-2"
                    style="font-family:monospace;min-width:58px;justify-content:center"
                  >{{ item.raw.dtype }}</v-chip>
                </template>
                <v-list-item-title style="font-family:monospace;font-size:0.82rem">
                  {{ item.raw.path }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-truncate" style="max-width:200px">
                  {{ item.raw.description }}
                </v-list-item-subtitle>
                <!-- Statistics row for numeric arrays -->
                <div
                  v-if="item.raw.min !== undefined"
                  class="d-flex align-center gap-2 mt-1"
                  style="font-size:0.75rem;font-variant-numeric:tabular-nums"
                >
                  <span class="text-medium-emphasis">min</span>
                  <span>{{ fmtStat(item.raw.min) }}</span>
                  <span class="text-medium-emphasis">max</span>
                  <span>{{ fmtStat(item.raw.max) }}</span>
                  <span class="text-medium-emphasis">mean</span>
                  <span>{{ fmtStat(item.raw.mean) }}</span>
                  <span v-if="item.raw.units" class="text-disabled">{{ item.raw.units }}</span>
                  <span v-if="item.raw.shape?.length" class="text-disabled ml-1">[{{ item.raw.shape.join(' × ') }}]</span>
                </div>
                <!-- Scalar value -->
                <div
                  v-else-if="item.raw.value !== undefined"
                  class="d-flex align-center gap-2 mt-1"
                  style="font-size:0.75rem"
                >
                  <span class="text-medium-emphasis">value</span>
                  <span style="font-family:monospace">{{ item.raw.value }}</span>
                  <span v-if="item.raw.units" class="text-disabled">{{ item.raw.units }}</span>
                </div>
              </v-list-item>
            </template>
          </v-autocomplete>

          <!-- Recent fields -->
          <div v-if="recentFields.length" class="mt-3">
            <div
              class="d-flex align-center gap-1 mb-1"
              style="cursor:pointer"
              @click="recentOpen = !recentOpen"
            >
              <v-icon size="12" aria-hidden="true" style="color:rgba(0,0,0,.4)">
                {{ recentOpen ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
              </v-icon>
              <span class="text-overline text-medium-emphasis" style="font-size:0.65rem;letter-spacing:.1em;user-select:none">
                Recent ({{ recentFields.length }})
              </span>
            </div>
            <div v-if="recentOpen">
              <div
                v-for="r in recentFields"
                :key="r.path"
                class="d-flex align-center gap-1 py-1 px-1 rounded recent-row"
                style="cursor:pointer"
                :title="r.description || r.path"
                @click="selectRecent(r)"
              >
                <v-chip
                  v-if="r.dtype"
                  :color="dtypeBadgeColor(r.dtype)"
                  size="x-small"
                  label
                  class="flex-shrink-0"
                  style="font-family:monospace;font-size:0.65rem;height:16px;padding:0 4px"
                >{{ r.dtype.replace('FLT_','F').replace('INT_','I').replace('_0D','0D').replace('_1D','1D').replace('_2D','2D') }}</v-chip>
                <span
                  class="text-caption text-truncate flex-1-1"
                  style="font-family:monospace;font-size:0.72rem;min-width:0"
                >{{ shortLabel(r.path) }}</span>
                <v-btn
                  icon
                  size="x-small"
                  variant="text"
                  color="grey"
                  :aria-label="'Remove ' + r.path + ' from recent'"
                  @click.stop="removeRecent(r.path)"
                >
                  <v-icon size="10" aria-hidden="true">mdi-close</v-icon>
                </v-btn>
              </div>
            </div>
          </div>

          <!-- Active fields list -->
          <div v-if="plotEntries.length" class="mt-3">
            <p class="text-overline text-medium-emphasis mb-1" style="font-size:0.65rem;letter-spacing:.1em">
              Active ({{ plotEntries.length }})
            </p>
            <div
              v-for="(entry, idx) in plotEntries"
              :key="entry.path"
              class="d-flex align-center gap-1 py-1 px-1 rounded"
              style="cursor:default"
            >
              <v-icon
                size="12"
                aria-hidden="true"
                :color="entry.loading ? 'grey' : entry.error ? 'error' : 'success'"
                class="flex-shrink-0"
              >
                {{ entry.loading ? 'mdi-dots-horizontal' : entry.error ? 'mdi-alert-circle-outline' : 'mdi-chart-line' }}
              </v-icon>
              <span
                class="text-caption text-truncate flex-1-1"
                style="font-family:monospace;min-width:0"
                :title="entry.path"
              >{{ shortLabel(entry.path) }}</span>
              <v-btn
                icon
                size="x-small"
                variant="text"
                color="error"
                :aria-label="'Remove ' + entry.path"
                @click="removeEntry(idx)"
              >
                <v-icon size="12" aria-hidden="true">mdi-close</v-icon>
              </v-btn>
            </div>
          </div>

          <!-- Empty state -->
          <div v-else class="mt-4 text-caption text-medium-emphasis text-center pa-2">
            Search for a field and select it to plot
          </div>
        </div>
      </div>

      <!-- ── Right: plot grid ─────────────────────────────────────────────── -->
      <div class="flex-1-1 overflow-y-auto pa-3" style="min-width:0" aria-live="polite" aria-atomic="false">
        <draggable
          v-if="plotEntries.length"
          v-model="plotEntries"
          item-key="path"
          handle=".drag-handle"
          :animation="150"
          ghost-class="drag-ghost"
          :style="`display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:12px`"
        >
          <template #item="{ element: entry, index: idx }">
          <v-card
            variant="outlined"
            style="background:white"
          >
            <v-card-title class="text-body-2 d-flex align-center justify-space-between pa-2 pb-1">
              <v-icon
                class="drag-handle flex-shrink-0 mr-1"
                size="14"
                aria-hidden="true"
                style="cursor:grab;color:rgba(0,0,0,.3)"
              >mdi-drag-vertical</v-icon>
              <span
                class="text-truncate flex-1-1"
                style="font-family:monospace;font-size:0.80rem;min-width:0"
                :title="entry.path"
              >{{ shortLabel(entry.path) }}</span>
              <v-btn
                icon
                size="x-small"
                variant="text"
                color="error"
                :aria-label="'Remove ' + entry.path"
                @click="removeEntry(idx)"
              >
                <v-icon size="14" aria-hidden="true">mdi-close</v-icon>
              </v-btn>
            </v-card-title>
            <v-card-text class="pa-1 pt-0">
              <div v-if="entry.loading" class="d-flex align-center py-4 justify-center">
                <v-progress-circular indeterminate size="20" width="2" class="mr-2" />
                <span class="text-caption">Fetching…</span>
              </div>
              <v-alert v-else-if="entry.error" type="error" density="compact" variant="tonal">
                {{ entry.error }}
              </v-alert>
              <template v-else-if="is2D(entry)">
                <PlotlyHeatmap
                  :id="'ids-heatmap-' + idx"
                  :z="entry.value"
                  :x="entry.xValue ?? undefined"
                  :y="entry.xValue2 ?? undefined"
                  :xlabel="entry.xLabel"
                  :ylabel="entry.xLabel2"
                  height="280px"
                />
              </template>
              <template v-else-if="isPlottable(entry)">
                <PlotlyLoader
                  :id="'ids-plot-' + idx"
                  :traces="getTraces(entry)"
                  :ylabel="entry.yLabel"
                  :xlabel="entry.xLabel"
                  width="100%"
                  height="240px"
                />
              </template>
              <template v-else-if="isShortArray(entry)">
                <v-table density="compact" class="mt-1" style="font-family:monospace;font-size:0.82rem">
                  <thead>
                    <tr>
                      <th>{{ entry.xLabel }}</th>
                      <th>{{ entry.yLabel }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in shortArrayRows(entry)" :key="row.x">
                      <td style="font-variant-numeric:tabular-nums">{{ typeof row.x === 'number' ? row.x.toPrecision(6) : row.x }}</td>
                      <td style="font-variant-numeric:tabular-nums">{{ typeof row.y === 'number' ? row.y.toPrecision(6) : row.y }}</td>
                    </tr>
                  </tbody>
                </v-table>
              </template>
              <div v-else class="text-body-2 font-weight-medium pa-1" style="font-family:monospace">
                {{ scalarDisplay(entry) }}
                <span v-if="entry.yLabel" class="text-caption text-disabled ml-1">{{ entry.yLabel.match(/\[(.+)\]/)?.[1] }}</span>
              </div>
            </v-card-text>
          </v-card>
          </template>
        </draggable>

        <div v-else class="d-flex align-center justify-center text-caption text-medium-emphasis" style="height:200px">
          No fields selected — use the search panel on the left
        </div>
      </div>

    </div>
  </v-card>
</template>

<style scoped>
.drag-ghost { opacity: 0.4; background: #e3f2fd !important; }
.drag-handle:active { cursor: grabbing; }
.recent-row:hover { background: rgba(0,0,0,.05); }
</style>
