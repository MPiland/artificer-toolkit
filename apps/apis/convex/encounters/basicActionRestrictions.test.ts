import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  EncounterActionChoicesResponseDto,
  GetEncounterActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { FacetDto } from '@artificer-toolkit/schema/shared/facet'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { shieldWood } from '@artificer-toolkit/source-data/srd/equipment/shield-wood.js'
import { SRD_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  domainRejection,
  playerControlFixture,
  type PlayerControlFixture,
  type PlayerControlLoadout
} from '../../tests/fixtures/playerControl'
import {
  attachFixtureRoom,
  readRoomTimeline,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { internal } from '../_generated/api'
import { sourceImportBatches } from '../content/importBatches'

const actionChoices = makeFunctionReference<
  'query',
  GetEncounterActionChoicesInputDto,
  EncounterActionChoicesResponseDto
>('encounters/actionChoices:get')

const useAnObject = SRD_BASIC_ACTION_DEFINITIONS.find(
  ({ id }) => id === SRD_BASIC_ACTION_IDS.USE_AN_OBJECT
)
if (useAnObject?.document.kind !== 'BASIC_ACTION') throw new Error('Missing Use an Object fixture.')
const useAnObjectEffectId = useAnObject.document.effects[0]!.id

/** One OR-group holding one AND-ed holder predicate, the way a basic action's restrictions are authored. */
function restrictedTo(
  seed: number,
  predicateCode: 'FREE_HAND' | 'CAN_ACT'
): FacetDto {
  const id = (offset: number) => `00000000-0000-4000-8000-0000000e${seed}0${offset}`
  return {
    id: id(0),
    groups: [
      {
        id: id(1),
        order: 1,
        contexts: [
          {
            id: id(2),
            order: 1,
            subject: 'CHARACTER',
            conditions: [
              { id: id(3), order: 1, kind: 'PREDICATE', constraint: 'INCLUDE', predicateCode }
            ]
          }
        ]
      }
    ]
  } as FacetDto
}

/** A System-authored copy of Use an Object under its own identity, taken only by actors meeting `restrictions`. */
function restrictedAction(seed: number, label: string, restrictions: FacetDto) {
  const document = {
    ...useAnObject!.document,
    id: `00000000-0000-4000-8000-0000000b${seed}00`,
    restrictions
  }
  return {
    ...useAnObject!,
    id: document.id,
    label,
    document,
    checksum: checksumRuleDocument(document)
  }
}

const needsFreeHand = restrictedAction(10, 'Pull Free', restrictedTo(10, 'FREE_HAND'))
const needsToAct = restrictedAction(20, 'Steady Hands', restrictedTo(20, 'CAN_ACT'))

/** Both hands full: a club in the main hand and a shield in the off hand (D107). */
const handsFull: PlayerControlLoadout = [
  { id: '00000000-0000-4000-8000-0000000e0001', equipment: club, useState: 'MAIN_HAND' },
  { id: '00000000-0000-4000-8000-0000000e0002', equipment: shieldWood, useState: 'OFF_HAND' }
]

/** The player-control Run with the System's catalogue plus the two restricted authored actions. */
async function restrictedActionFixture(loadout?: PlayerControlLoadout) {
  const base = await playerControlFixture({ loadout })
  for (const definitions of sourceImportBatches([
    ...SRD_RULE_STATE_DEFINITIONS,
    ...SRD_BASIC_ACTION_DEFINITIONS,
    needsFreeHand,
    needsToAct
  ]))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
    })
  await attachFixtureRoom(base.t, base.campaign.id)
  return base
}

async function offeredLabels(base: PlayerControlFixture, actorId: string) {
  const choices = await base.owner.caller.query(actionChoices, {
    encounterId: base.run.id,
    expectedVersion: await base.version(),
    actorId
  })
  return choices?.basicActionChoices.map(({ label }) => label) ?? []
}

/** RESOLVE_ACTION for an authored basic action by identity, whether or not the actor is offered it. */
async function resolveByIdentity(
  base: PlayerControlFixture,
  actorId: string,
  definition: typeof needsFreeHand
): Promise<ResolveEncounterActionInputDto> {
  return {
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await base.version(),
    actorId,
    target: { kind: 'ACTOR', actorId },
    actionId: encounterBasicActionId(actorId, definition.id, useAnObjectEffectId),
    optionalCombatIntent: null,
    sceneContext: null
  }
}

describe('basic action restrictions (ATTACK-18 slice E)', () => {
  useLocalRoomWorker()

  it('offers a FREE_HAND action to a Creature only while a hand is free', async () => {
    const full = await restrictedActionFixture(handsFull)
    expect(await offeredLabels(full, full.companion.id)).not.toContain('Pull Free')
    const free = await restrictedActionFixture()
    expect(await offeredLabels(free, free.companion.id)).toContain('Pull Free')
  }, 30000)

  it('offers a FREE_HAND action to a Character with free hands', async () => {
    const base = await restrictedActionFixture()
    await base.gm({
      type: 'SET_CURRENT_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await base.version(),
      actorId: base.character.id
    })
    expect(await offeredLabels(base, base.character.id)).toEqual(
      expect.arrayContaining(['Dash', 'Pull Free', 'Steady Hands'])
    )
  }, 30000)

  it('offers an unrestricted action to every actor, even with both hands full', async () => {
    const base = await restrictedActionFixture(handsFull)
    const labels = await offeredLabels(base, base.companion.id)
    expect(labels).toEqual(expect.arrayContaining(['Dash', 'Dodge', 'Use an Object']))
  }, 30000)

  it('evaluates a restriction on another facet predicate the same way', async () => {
    const base = await restrictedActionFixture()
    expect(await offeredLabels(base, base.companion.id)).toContain('Steady Hands')
    const incapacitated = srdSystemRecord.conditionTypes.find(
      ({ label }) => label === 'Incapacitated'
    )
    if (!incapacitated) throw new Error('Missing Incapacitated condition fixture.')
    await base.gm({
      type: 'UPDATE_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await base.version(),
      actorId: base.companion.id,
      conditions: [incapacitated.id]
    })
    expect(await offeredLabels(base, base.companion.id)).not.toContain('Steady Hands')
  }, 30000)

  it('refuses to resolve a FREE_HAND action while both hands are full', async () => {
    const base = await restrictedActionFixture(handsFull)
    await expect(
      domainRejection(base.gm(await resolveByIdentity(base, base.companion.id, needsFreeHand)))
    ).resolves.toMatchObject({
      reason: 'SOURCE_REQUIREMENTS_NOT_MET',
      message: "This actor doesn't meet the requirements to take that action."
    })
  }, 30000)

  it('offers, resolves, logs and undoes an authored basic action', async () => {
    const base = await restrictedActionFixture()
    expect(await offeredLabels(base, base.companion.id)).toContain('Pull Free')
    const before = await base.version()
    const result = await base.gm(await resolveByIdentity(base, base.companion.id, needsFreeHand))
    expect(result.projection.version).toBe(before + 1)
    const [entry] = await readRoomTimeline(base.owner.caller, base.campaign.id)
    expect(entry).toMatchObject({ commandType: 'RESOLVE_ACTION', label: 'Pull Free' })
    await base.gm({
      type: 'REVERT_LAST_ACTION',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await base.version()
    })
    const [reverted] = await readRoomTimeline(base.owner.caller, base.campaign.id)
    expect(reverted).toMatchObject({ commandType: 'REVERT_LAST_ACTION' })
  }, 30000)
})
