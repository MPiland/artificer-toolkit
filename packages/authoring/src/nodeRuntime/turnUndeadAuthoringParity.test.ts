import { describe, expect, it } from 'vitest'

import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import {
  evaluateSrdCharacter,
  srdByLabel,
  srdFeature
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { cleric } from '@artificer-toolkit/source-data/srd/classes/cleric.js'
import { oathOfDevotion } from '@artificer-toolkit/source-data/srd/classes/oath-of-devotion.js'
import { creatureTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'

/**
 * SPELLS-31.T4m (D156): Turn Undead and Turn the Unholy are authored from generic options: an area
 * Wisdom save limited to creature types, a Channel Divinity charge, a 1-minute failed-save block
 * and the turned behavior as a GM ruling (T2l2). Destroy Undead (SPELLS-31.T4m2, D202) is a
 * challenge rating gated kill on Turn Undead's failed save, and its own row is description only.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(record: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

const turnedBlock = (record: ClassAuthored, label: string) => {
  const effect = srdByLabel(record.features ?? [], label).effects?.[0]
  const path = effect?.paths[0]
  if (!effect || path?.selectionKind !== 'FIXED') throw new Error(`${label} has no fixed path.`)
  return { effect, block: path.resultBlock }
}

describe('Turn Undead and Turn the Unholy authored from generic options (SPELLS-31.T4m)', () => {
  it('no longer lists their closed rule kinds, nor Destroy Undead', () => {
    expect(CLOSED_RULE_KIND).not.toHaveProperty('CLASS_CLERIC_CHANNEL_DIVINITY_TURN_UNDEAD')
    expect(CLOSED_RULE_KIND).not.toHaveProperty('CLASS_OATH_OF_DEVOTION_TURN_THE_UNHOLY')
    expect(CLOSED_RULE_KIND).not.toHaveProperty('CLASS_CLERIC_DESTROY_UNDEAD')
  })

  it('authors Destroy Undead as a level scaled challenge rating gate around a kill on the failed save', () => {
    const { effect } = turnedBlock(cleric, 'Channel Divinity')
    const [turned, destroy] = effect.paths
    if (turned?.selectionKind !== 'FIXED' || destroy?.selectionKind !== 'FIXED')
      throw new Error('Turn Undead needs two fixed failed-save paths.')
    expect(turned.resultBlock.gate).toBeUndefined()
    expect(destroy.pathCode).toBe('ON_SAVE_FAIL')
    expect(destroy.resultBlock.outcomes).toMatchObject([{ effectKind: 'KILL' }])
    expect(destroy.resultBlock.gate).toMatchObject({
      kind: 'TARGET_CHALLENGE_RATING_AT_MOST',
      scaling: { scalingSource: 'CLASS_LEVEL' }
    })
    const gate = destroy.resultBlock.gate
    expect(
      gate?.kind === 'TARGET_CHALLENGE_RATING_AT_MOST' &&
        gate.scaling?.breakpoints.map(({ level, value }) => [level, value.maxChallengeRating])
    ).toEqual([
      [5, 0.5],
      [8, 1],
      [11, 2],
      [14, 3],
      [17, 4]
    ])
  })

  it('leaves the Destroy Undead row description only', () => {
    expect(srdByLabel(cleric.features ?? [], 'Destroy Undead').effects).toBeUndefined()
  })

  it.each([cleric, oathOfDevotion])(
    'passes the class node map exactly as authored: $label',
    async (record) => {
      const result = await normalize(record)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(record.features)
    }
  )

  it.each([
    [cleric, 'Channel Divinity', ['UNDEAD']],
    [oathOfDevotion, 'Channel Divinity: Turn the Unholy', ['FIEND', 'UNDEAD']]
  ] as const)('limits %s %s to its creature types with a turned ruling', (record, label, types) => {
    const { effect, block } = turnedBlock(record, label)
    expect(effect.invocation).toMatchObject({
      kind: 'ACTION',
      targeting: {
        selectionKind: 'AREA_CONTENTS',
        allowedCreatureTypeIds: types.map((code) => creatureTypeId(code))
      }
    })
    expect(block.duration).toMatchObject({ durationKind: 'MINUTE', amount: 1 })
    expect(block.outcomes).toMatchObject([
      { effectKind: 'MANUAL_ADJUDICATION', reasonCode: 'GM_CHOICE', label: 'Turned' }
    ])
  })

  it('makes Turn Undead a Channel Divinity action a level 2 Cleric can take', () => {
    const character = evaluateSrdCharacter({
      classes: [{ label: 'Cleric', level: 2 }],
      features: [
        srdFeature({
          owner: 'CLASS',
          classLabel: 'Cleric',
          featureLabel: 'Channel Divinity',
          level: 2
        })
      ]
    })
    const turn = character.entryPoints.find(
      ({ effectId }) => effectId === turnedBlock(cleric, 'Channel Divinity').effect.id
    )
    expect(turn?.compiledEffect.invocation).toMatchObject({
      kind: 'ACTION',
      activation: { code: 'ACTION', amount: 1 },
      resourceUse: { cost: 1 }
    })
  })
})
