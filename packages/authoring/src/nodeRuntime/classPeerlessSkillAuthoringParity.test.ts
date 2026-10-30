import { describe, expect, it } from 'vitest'

import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { collegeOfLore } from '@artificer-toolkit/source-data/srd/classes/college-of-lore.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-31.T4c1p (D187a, D198): Peerless Skill is a passive GM ruling, authored from the same
 * MANUAL_ADJUDICATION option a Builder author has on a class feature, so it and a homebrew variant
 * must pass the class node map exactly as authored.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(values: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as unknown as Record<string, unknown>
  })
}

function peerlessSkill(record: ClassAuthored): FeatureAuthored {
  const found = record.features?.find((candidate) => candidate.label === 'Peerless Skill')
  if (!found) throw new Error('The SRD record must author Peerless Skill.')
  return found
}

function rulingOutcome(authored: FeatureAuthored) {
  const path = authored.effects?.[0]?.paths[0]
  return path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
}

/** A homebrew Peerless Skill the way the Builder authors it: available earlier, adding to saves. */
function variant(): ClassAuthored {
  const record = structuredClone(collegeOfLore)
  const authored = peerlessSkill(record)
  const outcome = rulingOutcome(authored)
  if (outcome?.effectKind !== 'MANUAL_ADJUDICATION')
    throw new Error('Peerless Skill must author one GM ruling.')
  authored.availableAtLevel = 10
  outcome.instructions =
    'After you roll a saving throw, you can expend one use of Bardic Inspiration to add the die to it.'
  return record
}

describe('Peerless Skill through the class node map (D187a)', () => {
  it('authors a passive GM ruling with no closed rule', () => {
    const authored = peerlessSkill(collegeOfLore)
    expect(JSON.stringify(authored)).not.toMatch(/PEERLESS_SKILL|CLOSED_RULE/)
    expect(authored.effects?.[0]?.invocation).toMatchObject({ kind: 'PASSIVE' })
    expect(rulingOutcome(authored)).toMatchObject({
      effectKind: 'MANUAL_ADJUDICATION',
      reasonCode: 'GM_CHOICE'
    })
  })

  it('keeps the SRD College of Lore exactly as authored', async () => {
    const result = await normalize(collegeOfLore)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(collegeOfLore.features)
  })

  it('keeps a homebrew Peerless Skill the same way', async () => {
    const authored = variant()
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})
