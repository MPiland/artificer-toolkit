import { describe, expect, it } from 'vitest'

import { collectOnHitRiders } from '@artificer-toolkit/rules-runtime/character/characterOnHitRiders'
import { compiledTestSpellCast } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import { srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { OptionAuthored } from '@artificer-toolkit/shared/authored'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { warlock } from '@artificer-toolkit/source-data/srd/classes/warlock.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'

/**
 * SPELLS-31.T5i2 (D156, G4): Repelling Blast is authored from core options, a passive rider scoped
 * to the casts of named Spells whose push is an up-to forced movement. A homebrew rider scoped to
 * another Spell passes the class node map unchanged and resolves the same way.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(record: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

const spell = (label: string): SpellAuthored => srdByLabel(srdSpells, label)

const repellingBlast = (): OptionAuthored => {
  const option = warlock.features
    ?.flatMap((feature) => feature.options ?? [])
    .find((each) => each.label === 'Repelling Blast')
  if (!option) throw new Error('Repelling Blast is missing from the SRD Warlock.')
  return option
}

/** The same push, scoped to the casts of another Spell and authored under fresh identities. */
function homebrewPush(spellId: string): OptionAuthored {
  const source = repellingBlast()
  const eldritchBlastId = spell('Eldritch Blast').id
  const json = JSON.stringify({ ...source, restrictions: undefined })
  const ids = [
    ...new Set(json.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g))
  ]
  const fresh = ids
    .filter((id) => id !== eldritchBlastId)
    .reduce(
      (text, id, index) =>
        text.replaceAll(id, `7e57a000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`),
      json
    )
    .replaceAll(eldritchBlastId, spellId)
  return { ...JSON.parse(fresh), label: 'Homebrew Push' }
}

function pushes(option: OptionAuthored, cast: SpellAuthored) {
  const sourceInstanceId = `class-${cast.id}`
  const { entry } = compiledTestSpellCast({
    spell: cast,
    onHitRiders: collectOnHitRiders(
      (option.effects ?? []).map((effect) => compileEffect(effect)),
      option.id
    ),
    cast: {
      sequence: 0,
      candidateId: `CLASS:${sourceInstanceId}:${cast.id}:level:${cast.level}`,
      spellId: cast.id,
      source: { spellId: cast.id, sourceKind: 'CLASS', sourceInstanceId },
      spellLevel: cast.level,
      castMode: 'AT_WILL',
      castLevel: cast.level,
      resourceOwnerKey: null
    } as never,
    decision: { status: 'AVAILABLE', reasonCode: null } as never
  })
  const found: unknown[] = []
  JSON.stringify(entry.compilation, (_key, value: unknown) => {
    if (typeof value === 'object' && value !== null && 'effectKind' in value)
      if (value.effectKind === 'FORCED_MOVEMENT') found.push(value)
    return value
  })
  return found
}

describe('spell-scoped on-hit riders (SPELLS-31.T5i2)', () => {
  it('keeps the SRD Warlock and a homebrew push exactly as authored through the class node map', async () => {
    const withPush: ClassAuthored = {
      ...structuredClone(warlock),
      features: (warlock.features ?? []).map((feature) =>
        (feature.options ?? []).some((option) => option.id === repellingBlast().id)
          ? {
              ...feature,
              options: [...(feature.options ?? []), homebrewPush(spell('Fire Bolt').id)]
            }
          : feature
      )
    }
    for (const record of [warlock, withPush]) {
      const result = await normalize(record)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(record.features)
    }
  }, 60_000)

  it('resolves the SRD push and the homebrew push the same way, each on its own Spell', () => {
    const push = { direction: 'AWAY_FROM_SOURCE', distanceMode: 'UP_TO', amount: 10, unit: 'FEET' }
    const homebrew = homebrewPush(spell('Fire Bolt').id)
    expect(pushes(repellingBlast(), spell('Eldritch Blast'))).toMatchObject([push])
    expect(pushes(repellingBlast(), spell('Fire Bolt'))).toEqual([])
    expect(pushes(homebrew, spell('Fire Bolt'))).toMatchObject([push])
    expect(pushes(homebrew, spell('Eldritch Blast'))).toEqual([])
  })
})
