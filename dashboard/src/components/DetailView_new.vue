<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { config } from '../config'
import DataRow from './DataRow.vue'
import AuthDialog from './AuthDialog.vue'
import RowAdder from './RowAdder.vue'
import IDSFieldSearch from './IDSFieldSearch.vue'
import SimHeader from './SimHeader.vue'
import MetaGroup from './MetaGroup.vue'
import FileList from './FileList.vue'
import LineageView from './LineageView.vue'

const _showAllFields =
  typeof config.displayFields === 'string' && new String(config.displayFields).toLowerCase() === 'all'
const _displayFields = _showAllFields ? [] : [...config.displayFields]

type UUID = { hex: string }

const selectedServer = ref('')
const dialog = ref(false)
const displayHeaders = ref(config.displayHeaders)
const showAllFields = ref(_showAllFields)
const displayItems = ref(_displayFields)
const uuid = ref<UUID | undefined>()
const alias = ref<string | undefined>()
const items = ref<Data[]>([])
const outputs = ref<File[]>([])
const inputs = ref<File[]>([])
const parents = ref<Item[]>([])
const children = ref<Item[]>([])
const uploadDate = ref('')
const uploadInfo = ref('')
const token = ref('')
const authentication = ref('')
const ddVersion = ref<string | undefined>()

const activeTab = ref('fields')

// ── Sidebar metadata groups ────────────────────────────────────────────────────
const identityGroup = computed(() =>
  displayHeaders.value
    .map((h: { label: string; value: string }) => ({
      label: h.label,
      value: String(getValue(h.value) ?? '') || null,
    }))
    .filter((f: { label: string; value: string | null }) => f.value)
)

const provenanceGroup = computed(() => {
  const uploadedBy = items.value?.find((el: any) => el.element.toLowerCase() === 'uploaded_by')?.value
  const date = uploadDate.value
    ? new Date(uploadDate.value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : null
  return [
    { label: 'Uploaded by', value: uploadedBy ? String(uploadedBy) : null },
    { label: 'Upload date', value: date },
  ].filter(f => f.value)
})

const versioningGroup = computed(() =>
  [{ label: 'DD version', value: ddVersion.value ?? null }].filter(f => f.value)
)

onMounted(() => {
  const tokens = window.location.pathname.split('/')
  const params = new URLSearchParams(window.location.search)

  let aliasIdx = tokens.findIndex((el) => el === 'alias')
  if (aliasIdx >= 0) {
    alias.value = tokens.slice(aliasIdx + 1).join('/')
  } else {
    uuid.value = { hex: tokens[tokens.length - 1] }
  }

  selectedServer.value = params.get('server') || config.defaultServer

  updateAuth().then((_) => {
    if (requiresAuth() && !getToken()) {
      dialog.value = true
    } else {
      setItems('', '')
    }
    const _displayItems = window.localStorage.getItem('simdb-display-items')
    if (_displayItems) {
      displayItems.value = JSON.parse(_displayItems)
    }
  })
})

type Item = {
  alias: string
  uuid: UUID
}

type Data = { element: string; value: any }

type File = {
  uri: string
  uuid: UUID
  datetime: string
}

type AlertType = 'error' | 'success' | 'warning' | 'info' | undefined
const status = ref<{ show: boolean; text: string | null; type: AlertType }>({
  show: false,
  text: null,
  type: undefined
})

function getToken() {
  return token.value || window.sessionStorage.getItem('simdb-token-' + selectedServer.value)
}

function requiresAuth() {
  if (selectedServer.value !== null && config.serverConfig && selectedServer.value in config.serverConfig) {
    return config.serverConfig[selectedServer.value].requiresAuth;
  }
  return authentication.value !== null && authentication.value !== 'None';
}

function getValue(name: string) {
  if (name === 'server') {
    return selectedServer.value
  } else if (name === 'alias') {
    return alias.value
  } else if (name === 'uuid') {
    return uuid.value?.hex
  } else if (name === 'upload_info') {
    uploadInfo.value = items.value.find((el: any) => el.element.toLowerCase() === 'uploaded_by') ?.value || 'unknown'
    return uploadInfo.value + ', ' + new Date(uploadDate.value).toUTCString()
  } else {
    let found: any = items.value
      ? items.value.find((el: any) => el.element.toLowerCase() === name)
      : false
    return found ? found.value : null
  }
}

function addRow(name: string) {
  if (!displayItems.value.includes(name)) {
    displayItems.value.push(name)
  }
}

function removeRow() {
  displayItems.value.pop()
}

function removeSelectedRow(index: number) {
  if (index >= 0 && index < displayItems.value.length) {
    displayItems.value.splice(index, 1)
  }
}

function resetRows() {
  displayItems.value = showAllFields.value ? [] : [...config.displayFields]
}

const FIELD_LABELS: Record<string, string> = {
  'code.name': 'code name',
  'ids_properties.creation_date': 'creation date',
  'uploaded_by': 'uploaded by',
}
function labelForField(name: string): string {
  return FIELD_LABELS[name] ?? name
}

// Add this computed property to extract unique metadata elements excluding displayed items
const metadataElements = computed(() => {
  if (!items.value || items.value.length === 0) {
    return []
  }

  // Extract all metadata elements
  const allElements = items.value
    .map((item: Data) => item.element)
    .filter((element: string) => element) // Remove any null/undefined elements

  // Filter out already displayed items
  const availableElements = allElements.filter(
    (element: string) => !displayItems.value.includes(element)
  )

  // Remove duplicates and sort
  const uniqueElements = [...new Set(availableElements)].sort()

  return uniqueElements
})

function setItems(username: string, password: string) {
  status.value.show = false
  dialog.value = false
  const args: { headers: { [key: string]: any } } = { headers: {} }
  if (requiresAuth()) {
    if (getToken()) {
      args.headers['Authorization'] = 'JWT-Token ' + getToken()
    } else {
      args.headers['Authorization'] = {
        Authorization: 'Basic ' + btoa(username + ':' + password)
      }
    }
  }
  const url = config.rootAPI(decodeURIComponent(selectedServer.value))
  let sim_id = uuid.value ? uuid.value.hex : alias.value
  fetch(url + '/simulation/' + sim_id, args)
    .then((response) => response.json())
    .then((data) => {
      alias.value = data.alias
      uuid.value = data.uuid
      items.value = data.metadata
      outputs.value = data.outputs
      inputs.value = data.inputs
      parents.value = data.parents
      children.value = data.children
      uploadDate.value = data.datetime
      // Extract DD version from simulation record (field name may vary)
      ddVersion.value = data.dd_version ?? data.ids_properties_version ?? undefined
      if (showAllFields.value) {
        displayItems.value = data.metadata.map((el: any) => el.element)
      }
    })
    .catch(function (error) {
      status.value.show = true
      status.value.text = error
      status.value.type = 'error'
    })
}

function updateAuth() {
  status.value.show = false
  const url = config.rootURL(decodeURIComponent(selectedServer.value))
  return fetch(url)
    .then((response) => response.json())
    .then((data) => {
      authentication.value = data.authentication
    })
    .catch(function (error) {
      status.value.show = true
      status.value.text = error
      status.value.type = 'error'
    })
}

function showError(error: string) {
  status.value.show = true
  status.value.text = error
  status.value.type = 'error'
}
</script>

<template>
  <AuthDialog
    :server="selectedServer"
    v-model="dialog"
    @ok="setItems"
    @error="dialog = false"
  />

  <!-- Error banner -->
  <v-alert
    v-if="status.show"
    :type="status.type"
    density="compact"
    variant="tonal"
    closable
    class="ma-2"
    @click:close="status.show = false"
  >
    {{ status.text }}
  </v-alert>

  <!-- Page shell: full-height flex column -->
  <div class="d-flex flex-column" style="height:calc(100vh - var(--v-layout-top, 112px));overflow:hidden">

    <!-- ① Hero header -->
    <SimHeader
      :alias="alias"
      :uuid="uuid?.hex"
      :dd-version="ddVersion"
      :upload-date="uploadDate"
      :code-name="String(getValue('code.name') ?? '')"
    />

    <!-- ② Body: sidebar + main -->
    <div class="d-flex flex-1-1" style="min-height:0;overflow:hidden">

      <!-- Sidebar -->
      <div
        class="d-flex flex-column"
        style="
          width:260px;
          flex-shrink:0;
          border-right:1px solid rgba(0,0,0,.12);
          overflow-y:auto;
          background:#fafafa;
        "
      >
        <!-- Identity group: displayHeaders -->
        <MetaGroup
          v-if="identityGroup.length"
          title="Identity"
          :fields="identityGroup"
        />
        <v-divider v-if="identityGroup.length" />

        <!-- Provenance -->
        <MetaGroup
          v-if="provenanceGroup.length"
          title="Provenance"
          :fields="provenanceGroup"
        />
        <v-divider v-if="provenanceGroup.length" />

        <!-- Versioning -->
        <MetaGroup
          v-if="versioningGroup.length"
          title="Versioning"
          :fields="versioningGroup"
        />
        <v-divider v-if="versioningGroup.length" />

        <!-- Custom metadata rows (DataRow / RowAdder) kept for compatibility -->
        <div class="px-3 py-2" v-if="displayItems.length">
          <p
            class="text-overline text-medium-emphasis mb-2"
            style="letter-spacing:.1em;font-size:0.65rem"
          >
            Metadata
          </p>
          <v-table density="compact" class="bg-transparent">
            <tbody>
              <DataRow
                v-for="(name, index) in displayItems"
                :key="index"
                :name="labelForField(name)"
                :value="getValue(name)"
                :index="index"
                :data="items"
                :server="selectedServer"
                :meta_name="name"
                :showRemoveButton="true"
                @remove="removeSelectedRow"
              />
            </tbody>
          </v-table>
          <div v-if="!showAllFields">
            <RowAdder
              :server="selectedServer"
              :metadata="metadataElements"
              :displayedItems="displayItems"
              @add="addRow"
              @reset="resetRows"
              @error="showError"
            />
          </div>
        </div>

        <!-- File counts -->
        <v-divider />
        <div class="px-3 py-2">
          <p
            class="text-overline text-medium-emphasis mb-2"
            style="letter-spacing:.1em;font-size:0.65rem"
          >
            Files
          </p>
          <div class="d-flex flex-column gap-1">
            <div class="d-flex align-center justify-space-between">
              <span class="text-caption text-medium-emphasis">Inputs</span>
              <v-chip size="x-small" variant="tonal">{{ inputs.length }}</v-chip>
            </div>
            <div class="d-flex align-center justify-space-between">
              <span class="text-caption text-medium-emphasis">Outputs</span>
              <v-chip size="x-small" variant="tonal">{{ outputs.length }}</v-chip>
            </div>
          </div>
        </div>
      </div>

      <!-- Main: tab bar + content -->
      <div class="d-flex flex-column flex-1-1" style="min-width:0;overflow:hidden">
        <v-tabs
          v-model="activeTab"
          density="compact"
          style="border-bottom:1px solid rgba(0,0,0,.12);flex-shrink:0"
        >
          <v-tab value="fields">
            <v-icon start size="small" aria-hidden="true">mdi-chart-line</v-icon>
            Fields Explorer
          </v-tab>
          <v-tab value="inputs">
            Inputs
            <v-chip v-if="inputs.length" size="x-small" class="ml-1">{{ inputs.length }}</v-chip>
          </v-tab>
          <v-tab value="outputs">
            Outputs
            <v-chip v-if="outputs.length" size="x-small" class="ml-1">{{ outputs.length }}</v-chip>
          </v-tab>
          <v-tab value="lineage">Lineage</v-tab>
        </v-tabs>

        <v-window
          v-model="activeTab"
          class="flex-1-1"
          style="overflow-y:auto"
        >
          <v-window-item value="fields" eager class="pa-4">
            <IDSFieldSearch
              v-if="uuid?.hex"
              :sim-uuid="uuid.hex"
              :dd-version="ddVersion"
            />
            <div v-else class="text-caption text-medium-emphasis pa-2">
              UUID not available — cannot fetch IDS fields.
            </div>
          </v-window-item>

          <v-window-item value="inputs" class="pa-4">
            <FileList :files="inputs" label="Input Files" />
          </v-window-item>

          <v-window-item value="outputs" class="pa-4">
            <FileList :files="outputs" label="Output Files" />
          </v-window-item>

          <v-window-item value="lineage" class="pa-4">
            <LineageView
              :parents="parents"
              :children="children"
              :alias="alias"
              :server="selectedServer"
            />
          </v-window-item>
        </v-window>
      </div>

    </div>
  </div>
</template>
