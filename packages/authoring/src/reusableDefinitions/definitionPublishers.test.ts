import { installedDefinitionFamilyKeys } from '@artificer-toolkit/schema/systems/installedSystemSchemas'
import { describe, expect, it } from 'vitest'

import { installedDefinitionPublishers } from '../systems/installedDefinitionPublishers.js'
import { indexDefinitionPublishers } from './reusableDefinitionValidation.js'

/** QUALITY-16.T4: the service accepts the definition families the installed Systems declare. */

describe('installed reusable definition publishers', () => {
  it('index one publisher for every installed definition family', () => {
    const byFamily = indexDefinitionPublishers(
      installedDefinitionPublishers,
      installedDefinitionFamilyKeys
    )
    expect([...byFamily.keys()].sort()).toEqual([...installedDefinitionFamilyKeys].sort())
  })

  it('fail when an installed family has no publisher, has two, or a publisher is for no installed family', () => {
    const [first] = installedDefinitionPublishers
    expect(() => indexDefinitionPublishers([first], [first.familyKey, 'other-family'])).toThrow(
      'Installed reusable definition family "other-family" has no publisher.'
    )
    expect(() => indexDefinitionPublishers([first, first], installedDefinitionFamilyKeys)).toThrow(
      `Reusable definition family "${first.familyKey}" has more than one publisher.`
    )
    expect(() =>
      indexDefinitionPublishers(installedDefinitionPublishers, [first.familyKey])
    ).toThrow(/is not an installed reusable definition family\./)
  })
})
