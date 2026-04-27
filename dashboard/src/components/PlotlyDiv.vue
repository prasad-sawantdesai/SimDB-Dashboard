<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
// @ts-ignore
import Plotly from 'plotly.js'

type Trace = { name: string; x?: number[]; y: number[] }

const props = defineProps<{
  id: string
  title: string
  traces: Trace[]
  xlabel: string
  ylabel: string
  width: string
  height: string
}>()

const canvas = ref<HTMLElement | null>(null)

let style = computed(() => {
  return `width:${props.width};height:${props.height};`
})

onMounted(() => {
  const axisStyle = {
    showgrid: true,
    gridcolor: '#e5e5e5',
    gridwidth: 1,
    zeroline: true,
    zerolinecolor: '#bbbbbb',
    zerolinewidth: 1,
    showline: true,
    linecolor: '#444444',
    linewidth: 1.5,
    ticks: 'outside',
    ticklen: 5,
    tickwidth: 1.5,
    tickcolor: '#444444',
    tickfont: { family: 'Arial, sans-serif', size: 11, color: '#222222' },
    titlefont: { family: 'Arial, sans-serif', size: 12, color: '#111111' },
    automargin: true,
  }

  const plotTraces = props.traces.map(t => ({ mode: 'lines', ...t }))

  let layout: { [key: string]: any } = {
    paper_bgcolor: 'white',
    plot_bgcolor: 'white',
    font: { family: 'Arial, sans-serif', size: 12, color: '#222222' },
    margin: { l: 56, r: 16, t: 28, b: 60 },
    xaxis: { ...axisStyle, title: { text: props.xlabel } },
    yaxis: { ...axisStyle, title: { text: props.ylabel } },
  }
  if (props.traces.length > 1) {
    layout['showlegend'] = true
    layout['legend'] = {
      x: 1.02, xanchor: 'left', y: 1,
      bgcolor: 'rgba(255,255,255,0.85)',
      bordercolor: '#cccccc',
      borderwidth: 1,
      font: { size: 11 },
    }
  }
  Plotly.newPlot(canvas.value, plotTraces, layout, { responsive: true, displayModeBar: true, useResizeHandler: true })
})
</script>

<template>
  <div :id="id" :style="style" ref="canvas"></div>
</template>
