import type { SystemType } from '@/lib/types'

export const TARGET_TYPES = ['IP', 'RANGE', 'CIDR'] as const
export type TargetType = (typeof TARGET_TYPES)[number]

export const DEFAULT_PORTS: Record<SystemType, number> = { LINUX: 22, SNMP: 161, WINRM: 5985 }

const OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
const IPV4 = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`)

function ipToNum(ip: string): number {
  return ip.split('.').reduce((acc, o) => acc * 256 + Number(o), 0)
}

/** Validates the target value for its type; returns an error message or null. Matches the backend's resolveIpAddresses grammar. */
export function targetError(type: TargetType, value: string): string | null {
  const v = value.trim()
  if (!v) return 'Target is required'
  if (type === 'IP') {
    return IPV4.test(v) ? null : 'Enter a valid IPv4 address, e.g. 192.168.1.1'
  }
  if (type === 'RANGE') {
    const parts = v.split(/\s*-\s*/)
    if (parts.length !== 2 || !IPV4.test(parts[0]) || !IPV4.test(parts[1]))
      return 'Enter a range like 192.168.1.10-192.168.1.120'
    if (ipToNum(parts[0]) > ipToNum(parts[1])) return 'Range start must be ≤ end'
    return null
  }
  const [base, mask, extra] = v.split('/')
  if (extra !== undefined || !base || mask === undefined) return 'Enter CIDR like 192.168.1.0/24'
  if (!IPV4.test(base)) return 'Invalid CIDR base address'
  const bits = Number(mask)
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return 'CIDR mask must be 0-32'
  return null
}

/** Guesses the target type of a stored ip string (for edit prefill). */
export function inferTargetType(ip: string): TargetType {
  if (ip.includes('/')) return 'CIDR'
  if (ip.includes('-')) return 'RANGE'
  return 'IP'
}
