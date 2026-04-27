<script setup lang="ts">
import { onMounted, ref } from 'vue'
// @ts-ignore
import Plotly from 'plotly.js'

const props = withDefaults(
  defineProps<{
    id: string
    z: number[][]
    x?: number[]
    y?: number[]
    xlabel?: string
    ylabel?: string
    height?: string
  }>(),
  { height: '260px' }
)

const canvas = ref<HTMLElement | null>(null)

onMounted(() => {
  const trace: any = {
    type: 'heatmap',
    z: props.z,
    colorscale: 'Viridis',
    colorbar: {
      thickness: 12,
      tickfont: { size: 9, family: 'Arial, sans-serif' },
      outlinewidth: 0,
    },
    hovertemplate: `${props.xlabel ?? 'x'}: %{x:.3g}<br>${props.ylabel ?? 'y'}: %{y:.3g}<br>value: %{z:.4g}<extra></extra>`,
  }
  if (props.x) trace.x = props.x
  if (props.y) trace.y = props.y

  Plotly.newPlot(
    canvas.value,
    [trace],
    {
      paper_bgcolor: 'white',
      plot_bgcolor: 'white',
      font: { family: 'Arial, sans-serif', size: 11 },
      margin: { l: 48, r: 64, t: 12, b: 48 },
      xaxis: {
        title: { text: props.xlabel ?? '' },
        automargin: true,
        showgrid: false,
        ticks: 'outside',
        ticklen: 4,
      },
      yaxis: {
        title: { text: props.ylabel ?? '' },
        automargin: true,
        showgrid: false,
        ticks: 'outside',
        ticklen: 4,
        scaleanchor: 'x',   // preserve R-Z aspect ratio
        scaleratio: 1,
      },
    },
    { responsive: true, useResizeHandler: true, displayModeBar: false }
  )
})
</script>

<template>
  <div :id="id" ref="canvas" :style="`width:100%;height:${height}`"></div>
</template>
