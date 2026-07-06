import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

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
