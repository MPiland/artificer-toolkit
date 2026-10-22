import { describe, expect, it } from 'vitest'
import { getAuthoringDefaultKind } from './authoringNodeDefaultRegistry'
import { hasAuthoringDefaultKind } from './authoringNodeDefaultRegistry.testUtils'

describe('getAuthoringDefaultKind', () => {
  it.each([
    ['featureBasics', 'feature'],
    ['creatureFeature', 'feature'],
    ['creatureOption', 'option'],
    ['featureEffect', 'effect'],
    ['featureOptionActionReference', 'featureOptionActionReference'],
    ['featureRollDefinition', 'featureRollDefinition'],
    ['featureRollExpression', 'diceExpression'],
    ['characterFacetContext', 'facetContext'],
    ['nonManifestResultBlock', 'resultBlock'],
    ['shapeMeasurement', 'measurement'],
    ['vehicleString', 'string']
  ])('normalizes %s to %s', (mapId, expected) => {
    expect(getAuthoringDefaultKind(mapId)).toBe(expected)
  })

  it('rejects unregistered maps instead of creating incomplete generic rows', () => {
    expect(hasAuthoringDefaultKind('unknownMap')).toBe(false)
    expect(() => getAuthoringDefaultKind('unknownMap')).toThrow(
      'No authoring default factory is registered'
    )
  })
})
