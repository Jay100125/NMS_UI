import Highcharts from 'highcharts'
// Named import: highcharts-react-official is CommonJS and Vite dev binds the default
// import to the module namespace object, which React rejects as an invalid element.
import { HighchartsReact } from 'highcharts-react-official'

// Motadata-style vivid palette (Tailwind-600 in light, brighter in dark).
const LIGHT = ['#0D9488', '#F97316', '#9333EA', '#65A30D', '#DB2777', '#0891B2', '#CA8A04', '#EF4444']
const DARK = ['#14B8A6', '#FB923C', '#A855F7', '#84CC16', '#EC4899', '#06B6D4', '#EAB308', '#FF6B6B']

const FONT = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

function isDark() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// Vertical color→transparent fade — the signature elegant area fill.
function gradient(color: string) {
  return {
    linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
    stops: [
      [0, hexA(color, 0.35)],
      [1, hexA(color, 0)],
    ] as [number, string][],
  }
}

export interface ChartSeries { name: string; points: [number, number][] }

export function MetricChart({ title, series, kind = 'areaspline' }: {
  title: string
  series: ChartSeries[]
  kind?: 'areaspline' | 'spline'
}) {
  const dark = isDark()
  const palette = dark ? DARK : LIGHT
  const grid = dark ? 'rgba(23,35,54,0.8)' : 'rgba(236,241,249,0.8)'
  const axisLine = dark ? 'rgba(23,35,54,1)' : 'rgba(236,241,249,1)'
  const text = dark ? '#cad3e2' : '#1d2a3e'
  const tooltipBg = dark ? 'rgba(43,57,79,0.95)' : 'rgba(255,255,255,0.95)'
  const tooltipBorder = dark ? 'rgba(255,255,255,0.12)' : '#e3e8f2'

  const options: Highcharts.Options = {
    chart: { type: kind, height: 260, backgroundColor: 'transparent', style: { fontFamily: FONT }, spacing: [12, 8, 8, 4] },
    title: { text: title, align: 'left', style: { color: text, fontSize: '13px', fontWeight: '600' } },
    credits: { enabled: false },
    legend: {
      align: 'center',
      symbolWidth: 11,
      symbolHeight: 11,
      symbolRadius: 1,
      itemStyle: { color: text, fontWeight: 'normal', fontSize: '11px' },
      itemHoverStyle: { color: text },
    },
    xAxis: {
      type: 'datetime',
      tickLength: 0,
      lineColor: axisLine,
      gridLineColor: grid,
      labels: { style: { color: text, fontSize: '10px' } },
    },
    yAxis: {
      title: { text: undefined },
      gridLineColor: grid,
      lineColor: axisLine,
      lineWidth: 1,
      labels: { style: { color: text, fontSize: '10px' } },
    },
    tooltip: {
      shared: true,
      useHTML: true,
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      borderRadius: 10,
      borderWidth: 1,
      shadow: true,
      style: { color: text, fontFamily: FONT, fontSize: '11px' },
    },
    plotOptions: {
      series: {
        lineWidth: 2,
        animation: { duration: 300 },
        shadow: false,
        connectNulls: true,
        marker: { enabled: false, radius: 3, symbol: 'circle', states: { hover: { enabled: true } } },
      },
    },
    series: series.map((s, i) => {
      const color = palette[i % palette.length]
      return {
        type: kind,
        name: s.name,
        data: s.points,
        color,
        ...(kind === 'areaspline' ? { fillColor: gradient(color) } : {}),
      } as Highcharts.SeriesOptionsType
    }),
  }

  return <HighchartsReact highcharts={Highcharts} options={options} />
}
