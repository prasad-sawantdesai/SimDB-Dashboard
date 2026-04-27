<!-- eslint-disable no-prototype-builtins -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { to_i32_array, to_f32_array, to_f64_array } from '../common'
import { config } from '../config'
import PlotlyLoader from './PlotlyLoader.vue'

type MetaData = {
  element: string
  value: any
}

type Simulation = {
  alias: string
  uuid: string
  items: MetaData[]
  outputs: string
  inputs: string
}

type PlotData = {
  x?: number[]
  y: number[]
  name: string
}

const props = defineProps<{
  name: string
  simulations: Simulation[]
  uuids: string[]
  index: number
  loaded: boolean
  server: string
}>()

const emit = defineEmits(['remove'])

// Data fetched from the /data endpoint: uuid → value
const fetchedData = ref<Record<string, any>>({})
const fetchedXData = ref<Record<string, any>>({})

/** Convert dot-notation path to slash-notation expected by the /data endpoint.
 *  e.g. "core_profiles.time" → "core_profiles/time"
 */
function nameToPath(name: string): string {
  return name.replaceAll('.', '/')
}

async function fetchForUUID(uuid: string, path: string): Promise<any> {
  const url =
    config.dataAPI + '/v' + config.api_version +
    '/simulation/' + uuid + '/data?path=' + encodeURIComponent(path)
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('HTTP ' + resp.status)
  const data = await resp.json()
  return data.value
}

async function fetchAllData() {
  if (!props.loaded || !props.uuids.length) return

  const path = nameToPath(props.name)
  const timePath = path.split('/')[0] + '/time'

  const newData: Record<string, any> = {}
  const newXData: Record<string, any> = {}

  await Promise.all(
    props.uuids.map(async (uuid) => {
      try {
        newData[uuid] = await fetchForUUID(uuid, path)
        if (path !== timePath) {
          try {
            newXData[uuid] = await fetchForUUID(uuid, timePath)
          } catch {
            // time not available for this simulation
          }
        }
      } catch {
        // fetch failed – will fall back to metadata values
      }
    })
  )

  fetchedData.value = newData
  fetchedXData.value = newXData
}

watch(() => props.loaded, (val) => { if (val) fetchAllData() }, { immediate: true })
watch(() => props.name, () => {
  fetchedData.value = {}
  fetchedXData.value = {}
  if (props.loaded) fetchAllData()
})

function getTraces(name: string): PlotData[] {
  return props.uuids.map((uuid) => {
    const simulation = props.simulations.find((sim) => sim.uuid === uuid)
    const value = getValue(simulation, name)
    if (simulation === undefined || processValue(value) === 'No data available.') {
      return { y: [], name: '' }
    }

    const isArrayValue = Array.isArray(value) || value?._type === 'numpy.ndarray'

    if (!isArrayValue) {
      return {
        y: [value],
        x: [0],
        name: simulation?.alias || simulation?.uuid
      }
    } else {
      const data: PlotData = {
        y: processValue(value),
        name: simulation?.alias || simulation?.uuid
      }
      const xdata = getXData(simulation, name)
      if (xdata) data['x'] = xdata
      return data
    }
  })
}

function getValue(simulation: Simulation | undefined, name: string) {
  if (!simulation) return null
  // Prefer data fetched from the /data endpoint
  if (Object.hasOwn(fetchedData.value, simulation.uuid)) {
    return fetchedData.value[simulation.uuid]
  }
  // Fall back to simulation metadata
  const item = simulation.items.find((el) => el.element === name)
  return item != null ? item.value : null
}

function getXData(simulation: Simulation, name: string) {
  // Prefer fetched time data
  if (Object.hasOwn(fetchedXData.value, simulation.uuid)) {
    return processValue(fetchedXData.value[simulation.uuid])
  }
  // Fall back to metadata
  const root = name.split('.')[0]
  const item = simulation?.items.find((el) => el.element === root + '.time')
  return item?.value ? processValue(item.value) : null
}

function processValue(value: any) {
  if (value === null || value === undefined) {
    return 'No data available.'
  }
  // Plain JS array returned by the /data endpoint
  if (Array.isArray(value)) {
    return value
  }
  // Legacy numpy.ndarray format from metadata endpoint
  if (value.hasOwnProperty('_type') && value._type === 'numpy.ndarray') {
    if (value.dtype === 'int32') {
      return to_i32_array(value.bytes)
    } else if (value.dtype === 'float32') {
      return to_f32_array(value.bytes)
    } else if (value.dtype === 'float64') {
      return to_f64_array(value.bytes)
    } else {
      return 'Unknown data type: ' + value.dtype
    }
  }
  return value
}

function isArray(name: string) {
  // Check data fetched from /data endpoint first (reactive – re-checks after fetch)
  const hasFetchedArray = props.uuids.some((uuid) => {
    const v = fetchedData.value[uuid]
    return Array.isArray(v) || v?._type === 'numpy.ndarray'
  })
  if (hasFetchedArray) return true
  // Fall back to metadata check (supports old API behaviour)
  return props.simulations
    .map((sim) => sim.items.find((el) => el.element === name)?.value)
    .some((value) => value && value.hasOwnProperty('_type') && value._type === 'numpy.ndarray')
}

function handleRemove() {
  emit('remove', props.index)
}
</script>

<template>
  <tr v-if="isArray(name)">
    <td style="min-width: 20em">{{ name.toLabel() }}</td>
    <td :colspan="simulations.length">
      <v-container class="ml-0">
        <PlotlyLoader
          v-if="loaded"
          :id="'plot' + index"
          :traces="getTraces(name)"
          :ylabel="name"
          xlabel="time"
          width="800px"
          height="600px"
        >
        </PlotlyLoader>
      </v-container>
    </td>
    <td style="width: 1em; text-align: center;">
      <v-btn
        icon
        size="x-small"
        variant="text"
        color="error"        
        title="Remove metadata"
        @click="handleRemove"
      >
        <v-icon size="large">mdi-minus-box</v-icon>
      </v-btn>
    </td>
  </tr>
</template>
