import { unwrap } from './client'

test('unwrap returns result on success', async () => {
  const res = { data: { 'status.code': 200, status: 'success', result: [{ id: 1 }] } }
  await expect(unwrap<any>(Promise.resolve(res as any))).resolves.toEqual([{ id: 1 }])
})

test('unwrap throws server error message on failure', async () => {
  const res = { data: { 'status.code': 409, status: 'failure', error: 'Credential name already exists' } }
  await expect(unwrap<any>(Promise.resolve(res as any))).rejects.toThrow('Credential name already exists')
})
