import Highcharts from 'highcharts'
// NOTE: import the *named* export. highcharts-react-official is CommonJS, and
// Vite's dev dep-bundling binds the default import to the whole module-exports
// object (a plain namespace), which React rejects as an invalid element type.
// The named `HighchartsReact` export resolves to the actual component.
import { HighchartsReact } from 'highcharts-react-official'

export function MetricChart({ title, series }: { title: string; series: { name: string; points: [number, number][] }[] }) {
  const options: Highcharts.Options = {
    title: { text: title },
    chart: { type: 'spline', height: 260 },
    xAxis: { type: 'datetime' },
    yAxis: { title: { text: undefined } },
    credits: { enabled: false },
    series: series.map((s) => ({ type: 'spline', name: s.name, data: s.points })),
  }
  return <HighchartsReact highcharts={Highcharts} options={options} />
}
