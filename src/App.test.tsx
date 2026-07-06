import { render, screen } from '@testing-library/react'
import App from './App'

test('renders app root', () => {
  render(<App />)
  expect(screen.getByText(/lite-nms/i)).toBeInTheDocument()
})
