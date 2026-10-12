import { getFunctionName } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import { getEquipmentOptions } from './options'

const optionsList = getFunctionName(api.content.equipmentOptions.list)

describe('getEquipmentOptions', () => {
  it('uses the exact System for native options without a legacy fallback', () => {
    const query = getEquipmentOptions('11111111-1111-4111-8111-111111111111')

    expect(query.queryKey).toEqual([
      'convexQuery',
      optionsList,
      { systemId: '11111111-1111-4111-8111-111111111111' }
    ])
    expect(query.queryFn).toBeUndefined()
    expect(query.enabled).not.toBe(false)
  })

  it('requests only base items for the Guided parent picker without changing other callers', () => {
    expect(getEquipmentOptions('11111111-1111-4111-8111-111111111111', true).queryKey).toEqual([
      'convexQuery',
      optionsList,
      { systemId: '11111111-1111-4111-8111-111111111111', excludeVariants: true }
    ])
    expect(getEquipmentOptions(undefined, true).enabled).toBe(false)
  })

  it('skips the native query when the System is missing', () => {
    const query = getEquipmentOptions()

    expect(query.queryKey).toEqual(['convexQuery', optionsList, 'skip'])
    expect(query.enabled).toBe(false)
    expect(query.queryFn).toBeUndefined()
  })
})
