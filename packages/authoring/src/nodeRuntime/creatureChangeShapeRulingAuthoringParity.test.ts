import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { adultBronzeDragon } from '@artificer-toolkit/source-data/srd/creatures/adult-bronze-dragon.js'
import { couatl } from '@artificer-toolkit/source-data/srd/creatures/couatl.js'
import { deva } from '@artificer-toolkit/source-data/srd/creatures/deva.js'
import { imp } from '@artificer-toolkit/source-data/srd/creatures/imp.js'
import { mimic } from '@artificer-toolkit/source-data/srd/creatures/mimic.js'
import { nightHag } from '@artificer-toolkit/source-data/srd/creatures/night-hag.js'
import { oni } from '@artificer-toolkit/source-data/srd/creatures/oni.js'
import { quasit } from '@artificer-toolkit/source-data/srd/creatures/quasit.js'
import { succubusIncubus } from '@artificer-toolkit/source-data/srd/creatures/succubus-incubus.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T4s1 (D156, D187a): Change Shape and Shapechanger are GM rulings on an ACTION/SELF effect.
 * A form swap replaces the creature's hit points and statistics, which these keep, so the stat-overlay
 * form stays a future enhancement. Each creature must pass its node map exactly as authored, and the
 * nine closed rule kinds are gone.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

const CREATURES: [string, CreatureAuthored, string][] = [
  ['Couatl', couatl, 'Change Shape'],
  ['Deva', deva, 'Change Shape'],
  ['Imp', imp, 'Shapechanger'],
  ['Mimic', mimic, 'Shapechanger'],
  ['Oni', oni, 'Change Shape'],
  ['Quasit', quasit, 'Shapechanger'],
  ['Succubus/Incubus', succubusIncubus, 'Shapechanger'],
  ['Night Hag', nightHag, 'Change Shape'],
  ['Adult Bronze Dragon', adultBronzeDragon, 'Change Shape']
]

describe('Change Shape and Shapechanger as GM rulings (D187a)', () => {
  it.each(CREATURES)('%s authors the action as one ruling', (_name, creature, label) => {
    const feature = creature.features?.find((candidate) => candidate.label === label)
    const effect = feature?.effects?.[0]
    expect(effect?.invocation).toMatchObject({ kind: 'ACTION', triggerCode: 'ACTIVATED' })
    const outcomes = (effect?.paths ?? []).flatMap((path) =>
      path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []
    )
    expect(outcomes).toHaveLength(1)
    expect(outcomes[0]).toMatchObject({
      effectKind: 'MANUAL_ADJUDICATION',
      reasonCode: 'GM_CHOICE'
    })
  })

  it.each(CREATURES)(
    'keeps %s exactly as authored through the creature node map',
    async (_name, creature) => {
      const result = await normalizeNodeRuntimeValues(reader, {
        mapId: 'creature',
        systemId: srdSystemRecord.id,
        values: structuredClone(creature) as unknown as Record<string, unknown>
      })
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    }
  )

  it('no longer lists the nine Change Shape closed rule kinds', () => {
    for (const kind of [
      'CREATURE_COUATL_CHANGE_SHAPE',
      'CREATURE_DEVA_CHANGE_SHAPE',
      'CREATURE_IMP_SHAPECHANGER',
      'CREATURE_MIMIC_SHAPECHANGER',
      'CREATURE_ONI_SHAPECHANGER',
      'CREATURE_QUASIT_SHAPECHANGER',
      'CREATURE_SUCCUBUS_INCUBUS_SHAPECHANGER',
      'DRAGON_CHANGE_SHAPE',
      'NIGHT_HAG_CHANGE_SHAPE'
    ])
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
  })
})
