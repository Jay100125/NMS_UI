import { render } from '@testing-library/react'
import { MetricChart } from './MetricChart'

test('renders without crashing given a series', () => {
  const { container } = render(<MetricChart title="CPU" series={[{ name: 'usage', points: [[1, 10], [2, 20]] }]} />)
  expect(container.querySelector('.highcharts-container, [data-highcharts-chart]')).toBeTruthy()
})
