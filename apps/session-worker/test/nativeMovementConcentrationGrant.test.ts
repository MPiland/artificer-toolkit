import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import { SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/concentration.js'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { dependentEffectDefinition, movementRoom } from './movementRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-5.7 through a movement reaction: a Fighter's reaction attack starts its Concentration when
 * the Wolf leaves its reach, which ends the carried grants stamped with the Fighter.
 */

const FIGHTER_ACTOR_ID = testUuid(0xe00)
const FIGHTER_ID = testUuid(0xe01)
const WOLF_ID = testUuid(0xe02)
const STAMPED_ID = testUuid(0xe03)
const UNSTAMPED_ID = testUuid(0xe04)

const WOLF_START: ScenePoint = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The SRD Wolf's Bite as a Fighter Feature: an opportunity attack whose hit wards the creature it
 * hits for 1 minute while the Fighter concentrates.
 */
const reactionWard: ClassFeature = (() => {
  const bite = creatureFeature(plainWolf, 'Bite')
  const effect = bite.effects?.[0]
  const hit = effect?.paths[0]
  if (
    !effect ||
    effect.invocation.kind !== 'ACTION' ||
    effect.invocation.triggerCode === 'CHECK' ||
    !hit ||
    !('resultBlock' in hit)
  )
    throw new Error('The SRD Wolf Bite is missing.')
  return {
    ...bite,
    id: testUuid(0xe100),
    label: 'Warding Strike',
    availableAtLevel: 1,
    grants: {
      ...bite.grants,
      modifiers: [
        ...(bite.grants?.modifiers ?? []),
        {
          id: testUuid(0xe107),
          grantKind: 'MODIFIER_GRANT' as const,
          valueDomainCode: 'ATTACK_ROLL' as const,
          domain: { attackDomain: 'MELEE' as const },
          modifierKind: 'ABILITY_MODIFIER_BONUS' as const,
          scope: 'SOURCE' as const,
          selectionKind: 'GRANTED' as const,
          payload: { ability: 'STRENGTH' as const },
          order: 0
        }
      ]
    },
    effects: [
      {
        ...effect,
        id: testUuid(0xe101),
        invocation: {
          ...effect.invocation,
          activation: { code: 'REACTION' as const, amount: 1 },
          reactionMovementTrigger: {
            kind: 'MOVEMENT' as const,
            stage: 'BEFORE_LEAVE_REACH' as const,
            perceptionRequirement: null,
            eligibilityDefinitionId: DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
            movementInterruption: null
          }
        },
        paths: [
          { ...hit, id: testUuid(0xe102) },
          {
            id: testUuid(0xe103),
            order: 2,
            pathCode: 'ON_HIT' as const,
            groupType: 'SEQUENTIAL' as const,
            originKind: 'SOURCE' as const,
            selectionKind: 'FIXED' as const,
            resultBlock: {
              id: `${testUuid(0xe103)}__result`,
              resultKind: 'SEQUENCE' as const,
              maintenanceDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
              duration: { id: testUuid(0xe104), durationKind: 'MINUTE' as const, amount: 1 },
              outcomes: [
                {
                  id: testUuid(0xe105),
                  effectKind: 'APPLY_GRANT' as const,
                  grants: {
                    modifiers: [
                      {
                        id: testUuid(0xe106),
                        grantKind: 'MODIFIER_GRANT' as const,
                        valueDomainCode: 'ARMOR_CLASS' as const,
                        domain: {},
                        modifierKind: 'BONUS' as const,
                        scope: 'GLOBAL' as const,
                        selectionKind: 'GRANTED' as const,
                        payload: { valueKind: 'FIXED' as const, amount: 2 },
                        order: 1
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  }
})()

describe('a movement reaction that starts a Concentration (SPELLS-5.7)', () => {
  it('ends the carried grants stamped with its caster, keeps others, and records the caster', async () => {
    const room = await movementRoom({
      actors: [
        characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
      ],
      moverActorId: WOLF_ID,
      positions: { [FIGHTER_ACTOR_ID]: { x: 50, y: 150 }, [WOLF_ID]: WOLF_START },
      autoRoll: 'BOTH',
      characterClassFeatures: [reactionWard],
      // The Fighter's attack is a 19 and hits; every later die rolls the minimum.
      rolls: [18],
      fallbackRoll: 0,
      seed: async ({ effects, encounterId, occurredAt }) => {
        for (const [id, concentrationCasterCharacterId] of [
          [STAMPED_ID, FIGHTER_ID],
          [UNSTAMPED_ID, null]
        ] as const)
          await effects.create({
            id,
            owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: FIGHTER_ACTOR_ID },
            lifecycle: { schemaVersion: 1, remainingTicks: 3, concentrationCasterCharacterId },
            definition: dependentEffectDefinition({ encounterId, sourceActorId: FIGHTER_ACTOR_ID }),
            occurredAt
          })
      }
    })
    const before = await readRoomHistory(room.base.stub)
    expect(before.characterEffects.map(({ id }) => id).sort()).toEqual([STAMPED_ID, UNSTAMPED_ID])
    expect(before.runs[0]!.concentrationCasterCharacterIds).toEqual([])

    const moved = await room.move([WOLF_START, { x: 450, y: 150 }])
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    const pending = await room.pending()
    if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
      throw new Error(`Expected a reaction decision, got ${pending?.context.kind}.`)
    const option = pending.context.reactionTimeline[0]?.group.options[0]
    if (!option) throw new Error('The reaction decision offers no option.')
    const used = await room.respond({ kind: 'OPTION', optionId: option.optionId })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    const after = await readRoomHistory(room.base.stub)
    expect(after.maintainedStates).toHaveLength(1)
    expect(after.characterEffects.map(({ id }) => id)).toEqual([UNSTAMPED_ID])
    expect(after.runs[0]!.concentrationCasterCharacterIds).toEqual([FIGHTER_ID])
  }, 60_000)
})
