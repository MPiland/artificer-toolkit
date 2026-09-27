import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { prepareSrdImport } from '@artificer-toolkit/source-data/srd/import.js'
import { SRD_ABILITIES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { planNativeEncounterActionMechanics } from '../encounterActionMechanicsPlan.js'
import { prepareEncounterActionMechanics } from '../encounterActionMechanicsPreparation.js'
import { resolveEncounterActionSource } from '../encounterActionSources.js'
import { discoverEncounterFeatureActionCapabilities } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { dnd5eAttackKind } from '../systems/dnd5e/attackKind.js'
import {
  createSrdRulesRuntime,
  srdCreatureActor,
  srdCreatureTarget,
  srdEncounterState,
  testUuid,
  TIMESTAMP
} from './dnd5eSrdEncounter.js'
import {
  SRD_CREATURE_ATTACK_UNSUPPORTED,
  type SrdCreatureAttackUnsupportedReason
} from './srdCreatureAttackSweepAllowlist.js'

const ACTOR_ID = testUuid(0xa1)
const TARGET_ID = testUuid(0xa2)
const OCCURRENCE_ID = testUuid(0xe007)
const COMMAND_ID = testUuid(0xe008)
/** 0-based die faces: 15 on the d20 (a hit on the Ogre's AC 11, never a critical), mid-range damage. */
const D20_FACE = 15
const scriptedRandom = (maxExclusive: number) =>
  maxExclusive === 20 ? D20_FACE - 1 : Math.floor(maxExclusive / 2)

/** The seeded SRD Creatures, validated the way Blueprint creation reads them. */
const creatures = prepareSrdImport()
  .subjects.filter((subject) => subject.subjectKind === 'CREATURE')
  .map((subject) => creatureAuthoredDtoSchema.parse(subject.document) as CreatureAuthored)

type Feature = NonNullable<CreatureAuthored['features']>[number]

interface AttackUnit {
  effectId: string
  label: string
  owner: Feature
  option: Feature | null
  attackBonus: number
}

function attackUnits(creature: CreatureAuthored): AttackUnit[] {
  return (creature.features ?? []).flatMap((owner) =>
    [
      { option: null, source: owner },
      ...(owner.options ?? []).map((option) => ({ option, source: option }))
    ].flatMap(({ option, source }) => {
      const label = `${creature.label}: ${option ? `${owner.label} > ` : ''}${source.label}`
      return (source.effects ?? [])
        .filter(
          (effect) =>
            effect.invocation.kind === 'ACTION' &&
            dnd5eAttackKind(effect.invocation.triggerCode ?? '') !== null
        )
        .map((effect) => {
          const attackRoll = source.rollDefinitions?.find((roll) => roll.kind === 'ATTACK')
          if (!attackRoll) throw new Error(`${label} authors no ATTACK roll.`)
          return {
            effectId: effect.id,
            label,
            owner,
            option,
            attackBonus: attackRoll.expression.modifier
          }
        })
    })
  )
}

function unsupportedReason(
  unit: AttackUnit,
  stage: 'DISCOVERY' | 'PREPARE' | 'EXECUTE' | 'PLAN',
  error: unknown
): SrdCreatureAttackUnsupportedReason | `UNEXPECTED ${string}` {
  const message = error instanceof Error ? error.message : String(error)
  if (stage === 'DISCOVERY' && /Equipment/.test(message)) return 'EQUIPMENT_BASE_DAMAGE'
  if (/paths must be unique direct outcomes/.test(message)) return 'SEQUENTIAL_PATHS'
  if (/unsupported bounded shape/.test(message)) {
    return unit.owner.section === 'LEGENDARY_ACTION' ? 'LEGENDARY_OPTION' : 'SPECIAL_RANGE'
  }
  if (/outcome is not supported/.test(message)) return 'OUTCOME_KIND'
  return `UNEXPECTED ${stage}: ${message}`
}

describe('SRD Creature attack sweep', () => {
  it('prepares, executes and plans every SRD Creature attack, except the shrinking allowlist', async () => {
    const runtime = await createSrdRulesRuntime()
    const ogre = creatures.find((creature) => creature.label === 'Ogre')
    if (!ogre) throw new Error('The SRD Ogre is missing.')
    const target = srdCreatureActor({ id: TARGET_ID, creature: ogre })
    const failures: Record<string, string> = {}
    /** Every working attack hits the Ogre with the scripted face plus its authored attack bonus. */
    const hits: Record<string, { total: number | undefined; resultPath: string | undefined }> = {}
    const expectedHits: typeof hits = {}
    const effectIds = new Set<string>()

    for (const creature of creatures) {
      const units = attackUnits(creature)
      if (units.length === 0) continue
      for (const unit of units) {
        if (effectIds.has(unit.effectId)) throw new Error(`${unit.label} repeats its Effect id.`)
        effectIds.add(unit.effectId)
      }
      const actor = srdCreatureActor({ id: ACTOR_ID, creature })
      const actors = [actor, target]
      let capabilities: ReturnType<typeof discoverEncounterFeatureActionCapabilities>
      try {
        capabilities = discoverEncounterFeatureActionCapabilities({
          actor,
          conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
          abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code }))
        })
      } catch (error) {
        for (const unit of units) {
          failures[unit.effectId] = unsupportedReason(unit, 'DISCOVERY', error)
        }
        continue
      }
      const state = srdEncounterState({ actors, currentActorId: actor.id })
      const movementTargets = new Map(actors.map((entry) => [entry.id, srdCreatureTarget(entry)]))

      for (const unit of units) {
        const capability = capabilities.find(
          (entry) =>
            entry.effectId === unit.effectId &&
            entry.ownerFeatureId === unit.owner.id &&
            entry.featureOptionId === (unit.option?.id ?? null)
        )
        if (!capability) {
          failures[unit.effectId] = `UNEXPECTED DISCOVERY: ${unit.label} is not an action.`
          continue
        }
        let stage: 'PREPARE' | 'EXECUTE' | 'PLAN' = 'PREPARE'
        try {
          const prepared = await prepareEncounterActionMechanics({
            state,
            actor,
            target,
            actors,
            actionId: capability.actionId,
            wieldConflictAcceptance: { kind: 'PROMPTED', accepted: null },
            overridable: true,
            movementTargets,
            loadSource: async (input) =>
              resolveEncounterActionSource({ ...input, system: srdSystemRecord }),
            loadRelationshipFacts: async () => []
          })
          stage = 'EXECUTE'
          const executed = await executeNativeActionGraphs({
            runtime,
            adapter: prepared.adapter,
            plan: prepared.plan,
            occurrenceId: OCCURRENCE_ID,
            binding: prepared.binding,
            afterTest: async () => undefined,
            random: scriptedRandom
          })
          stage = 'PLAN'
          planNativeEncounterActionMechanics(
            {
              prepared,
              encounterId: prepared.state.id,
              expectedEncounterVersion: prepared.state.version,
              occurrenceId: OCCURRENCE_ID,
              sourceCommandId: COMMAND_ID,
              commandId: COMMAND_ID,
              occurredAt: TIMESTAMP,
              applications: executed.applications
            },
            testUuid(0xe004)
          )
          hits[unit.effectId] = {
            total: executed.d20?.total,
            resultPath: executed.d20?.resultPath
          }
          expectedHits[unit.effectId] = { total: D20_FACE + unit.attackBonus, resultPath: 'ON_HIT' }
        } catch (error) {
          failures[unit.effectId] = unsupportedReason(unit, stage, error)
        }
      }
    }

    expect(effectIds.size).toBe(514)
    expect(failures).toEqual(SRD_CREATURE_ATTACK_UNSUPPORTED)
    expect(hits).toEqual(expectedHits)
  }, 600_000)
})
