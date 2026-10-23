import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { describe, expect, it } from 'vitest'

import { prepareNativeActionEffectsPlan } from '../encounterActionEffects.js'
import { effectRepeatTrigger } from '../encounterEffectRepeatSave.js'
import {
  executeTargetBoundActiveRuleEffectWithPause,
  resumeTargetBoundActiveRuleEffectWithPause
} from '../targetBoundActiveRuleEffectExecutor.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  ENCOUNTER_ID,
  createSrdRulesRuntime,
  creatureFeature,
  srdCondition,
  srdCreatureActor,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'
import {
  prepareCreatureAction,
  settleCreatureAction,
  srdAbilityId
} from './encounterCreatureAction.js'

const VAMPIRE_ID = testUuid(0x2300)
const HOLDER_ID = testUuid(0x2301)
const ALLY_ID = testUuid(0x2302)
const STRANGER_ID = testUuid(0x2303)
const CHARMED = srdCondition('Charmed')
const WISDOM = srdAbilityId('WISDOM')
const DAY_TURNS = 24 * 600

const vampire = srdByLabel(SRD.creatures, 'Vampire')

/** The Vampire's Charm against the seeded Ogre (Wisdom 7: -2); a d20 face of 0 fails DC 17. */
async function charm(creature: CreatureAuthored, face: number) {
  const prepared = await prepareCreatureAction({
    actor: srdCreatureActor({ id: VAMPIRE_ID, creature }),
    target: srdCreatureActor({ id: HOLDER_ID, creature: srdByLabel(SRD.creatures, 'Ogre') }),
    featureId: creatureFeature(creature, 'Charm').id,
    overridable: true
  })
  const { execution } = await settleCreatureAction({ prepared, rolls: [face] })
  const { recurringEffect } = prepareNativeActionEffectsPlan({
    prepared,
    execution,
    occurrenceId: testUuid(0x2304),
    commandId: testUuid(0x2305),
    activeEffectsByActorId: new Map()
  })
  return recurringEffect
}

/** Replaces the ids of the Charm effect's own nodes, leaving every vocabulary reference intact. */
function reIdentified(creature: CreatureAuthored): CreatureAuthored {
  const ids = new Map<string, string>()
  const remap = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(remap)
    if (typeof value !== 'object' || value === null) return value
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        if (key !== 'id' || typeof entry !== 'string') return [key, remap(entry)]
        if (!ids.has(entry)) ids.set(entry, testUuid(0x2400 + ids.size))
        return [key, ids.get(entry)]
      })
    )
  }
  return {
    ...creature,
    features: creature.features?.map((feature) =>
      feature.label === 'Charm'
        ? { ...feature, effects: remap(feature.effects) as typeof feature.effects }
        : feature
    )
  }
}

async function plannedCharm(creature: CreatureAuthored) {
  const planned = await charm(creature, 0)
  if (!planned) throw new Error('The failed save planned no Charm effect.')
  return planned
}

describe('Vampire Charm authored from core options (SPELLS-33.T6e2, D176)', () => {
  it('is authored with no closed rule left', () => {
    expect(Object.keys(CLOSED_RULE_KIND)).not.toContain('CREATURE_VAMPIRE_CHARM')
    const charmFeature = creatureFeature(vampire, 'Charm')
    expect(JSON.stringify(charmFeature.effects)).not.toContain('CLOSED_RULE')
  })

  it('holds Charmed for 24 hours, repeating the save only when the source side harms it', async () => {
    const { definition } = await plannedCharm(vampire)
    expect(definition.recurrence).toMatchObject({
      expiration: { kind: 'TICKS', initialRemaining: DAY_TURNS },
      repeatTriggers: [{ event: 'DAMAGE_TAKEN', by: 'SOURCE_SIDE', damageTypeIds: null }]
    })
    expect(definition.stateContributions).toMatchObject([
      { kind: 'CONDITION_OWNERSHIP', conditionId: CHARMED }
    ])
    expect(definition.adapterFacts).toMatchObject({
      'dnd5e.active-effect-repeat-save-triggers-only': true
    })
  })

  it('does not apply Charm on a made save', async () => {
    expect(await charm(vampire, 19)).toBeNull()
  })

  it('plays like the same Charm authored with its own ids', async () => {
    const [srd, authored] = await Promise.all([
      plannedCharm(vampire),
      plannedCharm(reIdentified(vampire))
    ])
    expect(authored.definition.recurrence).toEqual(srd.definition.recurrence)
    expect(authored.definition.stateContributions).toEqual(srd.definition.stateContributions)
    expect(authored.definition.adapterFacts).toEqual(srd.definition.adapterFacts)
  })

  describe('the repeat trigger', () => {
    const held = async () => ({
      ...activeEffect({
        id: testUuid(0x2306),
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: HOLDER_ID },
        createdOrdinal: 1,
        sourceActorId: VAMPIRE_ID,
        stateContributions: [
          { kind: 'CONDITION_OWNERSHIP', conditionId: CHARMED, baselinePresent: false }
        ]
      }),
      definition: (await plannedCharm(vampire)).definition
    })
    const damage = (damagerActorId: string | null) => ({
      damagerActorId,
      damageTypeId: null,
      dispositions: new Map([
        [VAMPIRE_ID, 'HOSTILE' as const],
        [ALLY_ID, 'HOSTILE' as const],
        [STRANGER_ID, 'FRIENDLY' as const]
      ])
    })

    it('fires on damage from the vampire or its companions', async () => {
      const effect = await held()
      expect(effectRepeatTrigger(effect, damage(VAMPIRE_ID))).toMatchObject({ by: 'SOURCE_SIDE' })
      expect(effectRepeatTrigger(effect, damage(ALLY_ID))).toMatchObject({ by: 'SOURCE_SIDE' })
    })

    it('does not fire on third-party or unattributed damage', async () => {
      const effect = await held()
      expect(effectRepeatTrigger(effect, damage(STRANGER_ID))).toBeUndefined()
      expect(effectRepeatTrigger(effect, damage(null))).toBeUndefined()
    })
  })

  describe('the held effect', () => {
    /** One kernel run of the planned Charm on a holder with a +0 Wisdom save. */
    async function run(options: { remainingTicks: number; onTrigger: boolean }) {
      const { definition } = await plannedCharm(vampire)
      const lifecycle = { schemaVersion: 1 as const, remainingTicks: options.remainingTicks }
      const input = {
        activeEffectId: testUuid(0x2307),
        activeEffectVersion: 1,
        definition,
        lifecycle,
        lifecycleChecksum: checksumRuleDocument(lifecycle),
        occurrenceId: testUuid(0x2308),
        targetActorId: HOLDER_ID,
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        targetScalarValues: {},
        targetConditionIds: [CHARMED],
        targetDerivedFacts: {
          savingThrowDefinitions: [
            { abilityDefinitionId: WISDOM, modifier: 0, rollMode: 'NORMAL', contributors: [] }
          ]
        },
        defenses: [],
        onTrigger: options.onTrigger,
        runtime: createSrdRulesRuntime()
      } as const
      return { input, result: await executeTargetBoundActiveRuleEffectWithPause(input) }
    }

    it('rolls no save at the end of the holder’s turn', async () => {
      const { result } = await run({ remainingTicks: DAY_TURNS, onTrigger: false })
      expect(result).not.toHaveProperty('continuation')
      expect(result).toMatchObject({ terminal: false, applications: [] })
    })

    it('still expires when the 24 hours run out', async () => {
      const { result } = await run({ remainingTicks: 1, onTrigger: false })
      expect(result).not.toHaveProperty('continuation')
      expect(result).toMatchObject({ terminal: true })
      expect('applications' in result && result.applications.map((entry) => entry.kind)).toEqual([
        'CONDITION_REMOVE'
      ])
    })

    it('asks the holder for its save when a trigger fires, and a made save ends the charm', async () => {
      const { input, result } = await run({ remainingTicks: DAY_TURNS, onTrigger: true })
      if (!('continuation' in result)) throw new Error('The holder is asked for its save.')
      const resumed = await resumeTargetBoundActiveRuleEffectWithPause({
        ...input,
        continuation: result.continuation,
        resolution: {
          requestId: result.continuation.request.requestId,
          rawFaces: [20],
          rollMode: 'NORMAL',
          keep: 'FIRST',
          addedDice: []
        }
      })
      if ('continuation' in resumed) throw new Error('The save resolves in one roll.')
      expect(resumed).toMatchObject({ terminal: true })
      expect(resumed.applications.map((entry) => entry.kind)).toEqual(['CONDITION_REMOVE'])
    })

    it('keeps the charm on a failed triggered save', async () => {
      const { input, result } = await run({ remainingTicks: DAY_TURNS, onTrigger: true })
      if (!('continuation' in result)) throw new Error('The holder is asked for its save.')
      const resumed = await resumeTargetBoundActiveRuleEffectWithPause({
        ...input,
        continuation: result.continuation,
        resolution: {
          requestId: result.continuation.request.requestId,
          rawFaces: [1],
          rollMode: 'NORMAL',
          keep: 'FIRST',
          addedDice: []
        }
      })
      if ('continuation' in resumed) throw new Error('The save resolves in one roll.')
      expect(resumed).toMatchObject({ terminal: false, applications: [] })
    })
  })
})
