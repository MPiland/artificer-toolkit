import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { recordMissingQueryFnReports } from './missingQueryFnReports'

const storyRead = ['convexQuery', 'spells:get', { id: 'fireball' }]

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('missing query function reports', () => {
  it('records a read that fails for want of a query function', async () => {
    const queryClient = createQueryClient()
    const reports = recordMissingQueryFnReports(queryClient)

    await expect(queryClient.fetchQuery({ queryKey: storyRead })).rejects.toThrow('Missing queryFn')

    expect(reports).toEqual([`Missing queryFn: '${JSON.stringify(storyRead)}'`])
  })

  it('ignores reads that succeed or fail for another reason', async () => {
    const queryClient = createQueryClient()
    const reports = recordMissingQueryFnReports(queryClient)

    await queryClient.fetchQuery({ queryKey: ['seeded'], queryFn: async () => 'Fireball' })
    await expect(
      queryClient.fetchQuery({
        queryKey: ['unavailable'],
        queryFn: async () => {
          throw new Error('The deployment is unavailable.')
        }
      })
    ).rejects.toThrow('The deployment is unavailable.')

    expect(reports).toEqual([])
  })
})
