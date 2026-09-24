import { describe, expect, it } from 'vitest'
import { getVehicle } from './queries'

describe('native Vehicle detail queries', () => {
  it('reads public aliases directly without a legacy query function', () => {
    const query = getVehicle('vehicle-public-alias')

    expect(query.queryKey).toEqual([
      'convexQuery',
      'content/details:get',
      { id: 'vehicle-public-alias', subjectKind: 'VEHICLE' }
    ])
    expect(query.queryFn).toBeUndefined()
    expect(query.select?.(null)).toBeNull()
  })

  it('keeps active and draft subscriptions separate and forwards requested metadata', () => {
    const input = {
      id: '11111111-1111-4111-8111-111111111111',
      meta: ['currencies']
    }
    const active = getVehicle({ ...input, view: 'active' })
    const draft = getVehicle({ ...input, view: 'draft' })

    expect(draft.queryKey).toEqual([
      'convexQuery',
      'content/details:get',
      { ...input, subjectKind: 'VEHICLE', view: 'draft' }
    ])
    expect(draft.queryKey).not.toEqual(active.queryKey)
    expect(() => getVehicle('')).toThrow()
  })
})
