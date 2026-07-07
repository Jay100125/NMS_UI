import { describe, it, expect } from 'vitest'
import { targetError, DEFAULT_PORTS } from './targetSchema'

describe('targetError', () => {
  it('validates single IPs', () => {
    expect(targetError('IP', '192.168.1.1')).toBeNull()
    expect(targetError('IP', '999.1.1.1')).toBeTruthy()
    expect(targetError('IP', '192.168.1.0/24')).toBeTruthy()
  })
  it('validates ranges', () => {
    expect(targetError('RANGE', '192.168.1.10-192.168.1.120')).toBeNull()
    expect(targetError('RANGE', '192.168.1.10 - 192.168.1.120')).toBeNull()
    expect(targetError('RANGE', '192.168.1.10')).toBeTruthy()
    expect(targetError('RANGE', '192.168.1.120-192.168.1.10')).toBeTruthy() // start > end
  })
  it('validates CIDR', () => {
    expect(targetError('CIDR', '192.168.1.0/24')).toBeNull()
    expect(targetError('CIDR', '192.168.1.0/33')).toBeTruthy()
    expect(targetError('CIDR', '192.168.1.0')).toBeTruthy()
  })
})

it('default ports per type', () => {
  expect(DEFAULT_PORTS).toEqual({ LINUX: 22, SNMP: 161, WINRM: 5985 })
})
