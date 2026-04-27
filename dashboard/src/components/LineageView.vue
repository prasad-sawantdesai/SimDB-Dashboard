<script setup lang="ts">
type Item = { alias: string; uuid: { hex: string } }

defineProps<{
  parents: Item[]
  children: Item[]
  alias?: string
  server?: string | null
}>()
</script>

<template>
  <div class="d-flex align-start gap-6 flex-wrap pa-2">

    <!-- Parents -->
    <div class="d-flex flex-column gap-2" style="min-width:180px">
      <div class="d-flex align-center gap-1 mb-1">
        <span class="text-overline text-medium-emphasis">Parents</span>
        <v-tooltip location="top">
          <template #activator="{ props }">
            <v-icon v-bind="props" size="14" aria-hidden="true" color="medium-emphasis">
              mdi-information-outline
            </v-icon>
          </template>
          <span>Simulations whose outputs feed into this simulation</span>
        </v-tooltip>
      </div>
      <v-card
        v-for="p in parents"
        :key="p.uuid.hex"
        variant="outlined"
        class="pa-2"
        :href="p.uuid.hex + (server ? '?server=' + server : '')"
      >
        <div class="text-body-2 font-weight-medium text-truncate">{{ p.alias }}</div>
        <div class="text-caption text-medium-emphasis" style="font-family:monospace">
          {{ p.uuid.hex.slice(0, 8) }}…
        </div>
      </v-card>
      <span v-if="!parents.length" class="text-caption text-medium-emphasis">No parents</span>
    </div>

    <div class="d-flex align-center" style="padding-top:40px">
      <v-icon aria-hidden="true" color="medium-emphasis">mdi-arrow-right</v-icon>
    </div>

    <!-- Self -->
    <div class="d-flex flex-column gap-2" style="min-width:180px">
      <p class="text-overline text-medium-emphasis mb-1">This Simulation</p>
      <v-card variant="tonal" color="primary" class="pa-2">
        <div class="text-body-2 font-weight-medium">{{ alias ?? '—' }}</div>
      </v-card>
    </div>

    <div class="d-flex align-center" style="padding-top:40px">
      <v-icon aria-hidden="true" color="medium-emphasis">mdi-arrow-right</v-icon>
    </div>

    <!-- Children -->
    <div class="d-flex flex-column gap-2" style="min-width:180px">
      <div class="d-flex align-center gap-1 mb-1">
        <span class="text-overline text-medium-emphasis">Children</span>
        <v-tooltip location="top">
          <template #activator="{ props }">
            <v-icon v-bind="props" size="14" aria-hidden="true" color="medium-emphasis">
              mdi-information-outline
            </v-icon>
          </template>
          <span>Simulations that use this simulation's outputs as inputs</span>
        </v-tooltip>
      </div>
      <v-card
        v-for="c in children"
        :key="c.uuid.hex"
        variant="outlined"
        class="pa-2"
        :href="c.uuid.hex + (server ? '?server=' + server : '')"
      >
        <div class="text-body-2 font-weight-medium text-truncate">{{ c.alias }}</div>
        <div class="text-caption text-medium-emphasis" style="font-family:monospace">
          {{ c.uuid.hex.slice(0, 8) }}…
        </div>
      </v-card>
      <span v-if="!children.length" class="text-caption text-medium-emphasis">No children</span>
    </div>

  </div>
</template>
