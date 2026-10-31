import { describe, expect, it } from 'vitest'

import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import {
  SRD,
  damageExpression,
  evaluateSrdCharacter,
  itemAction,
  srdByLabel
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { hunterConclave } from '@artificer-toolkit/source-data/srd/classes/hunter.js'
import { monk } from '@artificer-toolkit/source-data/srd/classes/monk.js'
import { pathOfTheBerserker } from '@artificer-toolkit/source-data/srd/classes/path-of-the-berserker.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'

/**
 * SPELLS-31.T4l2 (D156, D187a): Martial Arts is authored from core options (a Dexterity
 * alternative, a level-banded weapon die, and a monk-weapon restriction on the attacking item);
 * Retaliation and Horde Breaker are GM rulings. A homebrew style authored the same way passes the
 * class node map unchanged and reaches a Character as Martial Arts does.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(record: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

function manualOutcome(authored: FeatureAuthored) {
  const path = authored.effects?.[0]?.paths[0]
  return path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
}

/** Martial Arts re-authored under homebrew ids, as a Builder author would copy it. */
function homebrewStyle(): FeatureAuthored {
  const martialArts = srdByLabel(monk.features ?? [], 'Martial Arts')
  const rehomed = JSON.stringify(martialArts).replace(
    /00000000-0000-0000-c006-([0-9a-f]{12})/g,
    '7e57a000-0000-4000-8006-$1'
  )
  return { ...(JSON.parse(rehomed) as FeatureAuthored), label: 'Iron Palm', order: 99 }
}

describe('Martial Arts, Retaliation and Horde Breaker (SPELLS-31.T4l2)', () => {
  it('no longer lists their closed rule kinds', () => {
    for (const kind of [
      'CLASS_MONK_MARTIAL_ARTS',
      'CLASS_BERSERKER_RETALIATION',
      'CLASS_HUNTER_HORDE_BREAKER'
    ]) {
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
    }
  })

  it.each([monk, hunterConclave, pathOfTheBerserker])(
    'passes the class node map exactly as authored: $label',
    async (record) => {
      const result = await normalize(record)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(record.features)
    }
  )

  it('leaves no closed rule on Martial Arts', () => {
    expect(JSON.stringify(srdByLabel(monk.features ?? [], 'Martial Arts'))).not.toContain(
      'CLOSED_RULE'
    )
  })

  it('authors Retaliation and Horde Breaker as GM rulings', () => {
    const hordeBreaker = srdByLabel(
      srdByLabel(hunterConclave.features ?? [], "Hunter's Prey").options ?? [],
      'Horde Breaker'
    )
    for (const authored of [
      hordeBreaker,
      srdByLabel(pathOfTheBerserker.features ?? [], 'Retaliation')
    ]) {
      expect(manualOutcome(authored)).toMatchObject({ effectKind: 'MANUAL_ADJUDICATION' })
    }
  })

  it('keeps a homebrew style authored as Martial Arts exactly as authored', async () => {
    const authored = homebrewStyle()
    const result = await normalize({
      ...structuredClone(monk),
      features: [...(monk.features ?? []), authored]
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual([
      ...(monk.features ?? []),
      authored
    ])
  })

  it('gives a Character the homebrew style as it does Martial Arts', () => {
    const homebrew = homebrewStyle()
    const MONK = srdByLabel(SRD.classes, 'Monk')
    const character = evaluateSrdCharacter({
      abilities: { DEXTERITY: 16, STRENGTH: 10 },
      classes: [{ label: 'Monk', level: 5 }],
      extraFeatures: [homebrew],
      features: [
        {
          acquisitionId: 'acquired:iron-palm',
          featureId: homebrew.id,
          source: { kind: 'CLASS', classId: MONK.id, classLevel: 1 },
          timing: { kind: 'CLASS_LEVEL', classId: MONK.id, classLevel: 1 }
        }
      ]
    })
    expect(
      damageExpression(itemAction(character, 'Unarmed Strike', { attackKind: 'UNARMED' }).decision)
    ).toBe('1d6 + 3')
  })
})
