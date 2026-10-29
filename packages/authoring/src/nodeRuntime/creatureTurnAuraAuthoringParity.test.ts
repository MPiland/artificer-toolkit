import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { darkmantle } from '@artificer-toolkit/source-data/srd/creatures/darkmantle.js'
import { djinni } from '@artificer-toolkit/source-data/srd/creatures/djinni.js'
import { drider } from '@artificer-toolkit/source-data/srd/creatures/drider.js'
import { hezrou } from '@artificer-toolkit/source-data/srd/creatures/hezrou.js'
import { kraken } from '@artificer-toolkit/source-data/srd/creatures/kraken.js'
import { pitFiend } from '@artificer-toolkit/source-data/srd/creatures/pit-fiend.js'
import { seaHag } from '@artificer-toolkit/source-data/srd/creatures/sea-hag.js'
import { tarrasque } from '@artificer-toolkit/source-data/srd/creatures/tarrasque.js'
import { treant } from '@artificer-toolkit/source-data/srd/creatures/treant.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33.T4pr (D156): Fear Aura, Stench and Horrific Appearance are one passive start-of-turn
 * save aura on the creature's token; Darkness Aura is a concentration zone around the darkmantle;
 * Siege Monster, Web Walker and the Whirlwind's carry-and-end rider ship as GM rulings. Each creature
 * passes the creature node map exactly as authored, and the seven closed rule kinds are gone.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

const conditionId = (code: string) =>
  srdSystemRecord.conditionTypes.find((condition) => condition.code === code)?.id

async function expectAuthoringParity(creature: CreatureAuthored) {
  const result = await normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
  expect(result.clearedPaths).toEqual([])
  expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
}

function feature(creature: CreatureAuthored, label: string) {
  const found = creature.features?.find((candidate) => candidate.label === label)
  if (!found) throw new Error(`The creature must author ${label}.`)
  return found
}

/** The zone a creature's start-of-turn aura keeps, and its one component. */
function auraZone(creature: CreatureAuthored, label: string) {
  const path = feature(creature, label).effects?.[0]?.paths[0]
  const zone = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
  const component =
    zone?.effectKind === 'MANIFEST' && zone.manifestKind === 'ZONE'
      ? zone.components?.[0]
      : undefined
  if (zone?.effectKind !== 'MANIFEST' || !component)
    throw new Error(`${label} must author one zone component.`)
  return { zone, component }
}

const behaviorPaths = (creature: CreatureAuthored, label: string) =>
  auraZone(creature, label).component.behaviors?.[0]?.paths ?? []

const outcomeKinds = (
  creature: CreatureAuthored,
  label: string,
  pathCode: 'ON_SAVE_FAIL' | 'ON_SAVE_SUCCESS'
) => {
  const path = behaviorPaths(creature, label).find((candidate) => candidate.pathCode === pathCode)
  return path?.selectionKind === 'FIXED'
    ? path.resultBlock.outcomes.map(({ effectKind }) => effectKind)
    : []
}

const CLOSED_RULE_PATTERN =
  /PIT_FIEND_FEAR_AURA|HEZROU_STENCH|SEA_HAG_HORRIFIC_APPEARANCE|DARKMANTLE_DARKNESS_AURA|SIEGE_MONSTER|WEB_WALKER|DJINNI_CREATE_WHIRLWIND/

describe('Creature start-of-turn auras and the rulings around them (D156)', () => {
  it('leaves no closed rule for the seven features', () => {
    for (const creature of [
      pitFiend,
      hezrou,
      seaHag,
      darkmantle,
      kraken,
      tarrasque,
      treant,
      drider,
      djinni
    ])
      expect(JSON.stringify(creature.features)).not.toMatch(CLOSED_RULE_PATTERN)
  })

  it.each([
    { creature: pitFiend, label: 'Fear Aura', radius: 20, condition: 'FRIGHTENED', dc: 21 },
    { creature: hezrou, label: 'Stench', radius: 10, condition: 'POISONED', dc: 14 },
    { creature: seaHag, label: 'Horrific Appearance', radius: 30, condition: 'FRIGHTENED', dc: 11 }
  ])(
    'keeps $label a source zone caught at the start of a turn, with the 24-hour immunity',
    async ({ creature, label, radius, condition, dc }) => {
      expect(conditionId(condition)).toBeDefined()
      const { zone, component } = auraZone(creature, label)
      expect(zone).toMatchObject({
        attachmentKind: 'SOURCE',
        shape: { shapeKind: 'SPHERE', radius: { amount: radius, unit: 'FEET' } }
      })
      expect(component.interactionKinds).toEqual(['START_TURN_IN_SPACE'])
      expect(component.behaviors?.[0]?.invocation).toMatchObject({
        triggerCode: 'SAVING_THROW',
        savingThrow: { dcMethod: 'FIXED_DC', baseDc: dc }
      })
      expect(outcomeKinds(creature, label, 'ON_SAVE_FAIL')[0]).toBe('CONDITION')
      expect(outcomeKinds(creature, label, 'ON_SAVE_SUCCESS')).toEqual(['SOURCE_IMMUNITY'])
      await expectAuthoringParity(creature)
    }
  )

  it('ends Fear Aura and Stench at the start of the creature’s next turn', () => {
    for (const [creature, label] of [
      [pitFiend, 'Fear Aura'],
      [hezrou, 'Stench']
    ] as const) {
      const fail = behaviorPaths(creature, label).find((path) => path.pathCode === 'ON_SAVE_FAIL')
      expect(fail?.selectionKind === 'FIXED' && fail.resultBlock).toMatchObject({
        duration: { durationKind: 'ROUND', amount: 1 },
        lifecycle: { turnAnchor: { actor: 'TARGET', boundary: 'START_OF_TURN' } }
      })
    }
  })

  it('makes Horrific Appearance a minute of fear, repeated with disadvantage in sight, for those who see the hag', () => {
    const { component } = auraZone(seaHag, 'Horrific Appearance')
    expect(component.requiredSight).toEqual(['OCCUPANT_SEES_SOURCE'])
    const fail = behaviorPaths(seaHag, 'Horrific Appearance').find(
      (path) => path.pathCode === 'ON_SAVE_FAIL'
    )
    const block = fail?.selectionKind === 'FIXED' ? fail.resultBlock : undefined
    expect(block?.duration).toMatchObject({ durationKind: 'MINUTE', amount: 1 })
    expect(block?.outcomes.map(({ effectKind }) => effectKind)).toEqual([
      'CONDITION',
      'FOLLOW_UP_SAVE'
    ])
    expect(block?.outcomes[1]).toMatchObject({
      timing: 'TARGET_TURN_END',
      repeatRollInfluence: { influence: 'DISADVANTAGE' }
    })
  })

  it('keeps a homebrew aura with another radius, condition and save the same way', async () => {
    const authored = structuredClone(hezrou)
    const { zone, component } = auraZone(authored, 'Stench')
    if (zone.shape?.shapeKind !== 'SPHERE') throw new Error('Stench must author a sphere.')
    zone.shape = { ...zone.shape, radius: { amount: 15, unit: 'FEET' } }
    const invocation = component.behaviors?.[0]?.invocation
    if (invocation?.triggerCode !== 'SAVING_THROW') throw new Error('Stench must author a save.')
    invocation.savingThrow = {
      id: invocation.savingThrow.id,
      dcMethod: 'FIXED_DC',
      abilityDefinitionId: invocation.savingThrow.abilityDefinitionId,
      baseDc: 17
    }
    await expectAuthoringParity(authored)
  })

  it('keeps Darkness Aura a bonus-action concentration zone around the darkmantle, once a day', async () => {
    const darkness = feature(darkmantle, 'Darkness Aura (1/Day)')
    const effect = darkness.effects?.[0]
    const path = effect?.paths[0]
    const block = path?.selectionKind === 'FIXED' ? path.resultBlock : undefined
    expect(effect?.invocation).toMatchObject({
      kind: 'ACTION',
      activation: { code: 'BONUS_ACTION' }
    })
    expect(darkness.charges).toMatchObject({ amount: 1, resetKind: 'LONG_REST' })
    expect(block).toMatchObject({
      duration: { durationKind: 'MINUTE', amount: 10 },
      maintenanceDefinitionId: expect.any(String)
    })
    expect(block?.outcomes[0]).toMatchObject({
      manifestKind: 'ZONE',
      attachmentKind: 'SOURCE',
      shape: { shapeKind: 'SPHERE', radius: { amount: 15, unit: 'FEET' } }
    })
    await expectAuthoringParity(darkmantle)
  })

  it.each([
    { creature: kraken, label: 'Siege Monster' },
    { creature: tarrasque, label: 'Siege Monster' },
    { creature: treant, label: 'Siege Monster' },
    { creature: drider, label: 'Web Walker' }
  ])('ships $label on the $creature.label as a GM ruling', async ({ creature, label }) => {
    const path = feature(creature, label).effects?.[0]?.paths[0]
    expect(path?.selectionKind === 'FIXED' && path.resultBlock.outcomes[0]).toMatchObject({
      effectKind: 'MANUAL_ADJUDICATION'
    })
    await expectAuthoringParity(creature)
  })

  it('keeps the Whirlwind’s restraint and escape check, and rules its carry and end', async () => {
    const path = feature(djinni, 'Create Whirlwind').effects?.[0]?.paths[0]
    const outcomes = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []
    expect(outcomes.map(({ effectKind }) => effectKind)).toEqual([
      'CONDITION',
      'FOLLOW_UP_CHECK',
      'MANUAL_ADJUDICATION'
    ])
    await expectAuthoringParity(djinni)
  })
})
