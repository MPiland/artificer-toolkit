import { beforeAll, describe, expect, it } from 'vitest'
import {
  planEncounterMeleeRetaliation,
  selectMeleeRetaliationContacts
} from '@artificer-toolkit/rules-runtime/encounterMeleeRetaliation'
import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  CAMPAIGN_ID,
  createSrdRulesRuntime,
  ENCOUNTER_ID,
  srdCreatureActor,
  srdCreatureTarget,
  SRD_SYSTEM_ID,
  srdEncounterState,
  testUuid
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import { placedFireShield } from '@artificer-toolkit/rules-runtime/testing/fireShieldZoneFixture'
import {
  SLEEP_CONDITION_ID,
  sleepEffectOn
} from '@artificer-toolkit/rules-runtime/testing/sleepEffectFixture'
import {
  GM_USER_ID,
  GOBLIN_ID,
  GOBLIN_TOKEN_ID,
  OCCURRENCE_ID,
  SCENE_ID,
  source,
  SOURCE_ID,
  SOURCE_TOKEN_ID
} from '@artificer-toolkit/rules-runtime/testing/encounterTurnZoneFixture'

import { createActiveRuleEffectStore } from '../effectStore.js'
import { insertRunActor, readRunActor } from '../documents.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import {
  persistEncounterMechanicsBatchPlan,
  readEncounterMechanicsBatchTarget
} from '../mechanicsBatchPersistence.js'
import {
  persistEncounterMeleeRetaliation,
  readMeleeRetaliationScene
} from '../meleeRetaliationPersistence.js'
import type { EncounterCharacterWriteTransaction } from '../ports.js'
import { createSpatialRuleEffectStore } from '../spatialEffectStore.js'

const OCCURRED_AT = '2026-10-17T00:00:00.000Z'
const COMMAND_ID = '00000000-0000-4000-8000-0000000c0002'
const tokens = [
  { id: GOBLIN_TOKEN_ID, position: { x: 1100, y: 350 }, width: 100, height: 100 },
  { id: SOURCE_TOKEN_ID, position: { x: 1000, y: 350 }, width: 100, height: 100 }
]

let runtime: RulesRuntimeService
beforeAll(() => {
  runtime = createSrdRulesRuntime()
})

/**
 * The attacker (asleep under a real Sleep effect, or not) is burnt when the creature it hit answers
 * with a Fire Shield, all stored in a memory store: the plan and the persistence both run real
 * product code.
 */
async function attackerBurnt(options: { creature: string; asleep: boolean }) {
  const asleep = srdCreatureActor({
    id: GOBLIN_ID,
    creature: srdByLabel(SRD.creatures, options.creature),
    conditionIds: options.asleep ? [SLEEP_CONDITION_ID] : []
  })
  const actors = [asleep, source]
  const state = srdEncounterState({ actors, currentActorId: GOBLIN_ID })
  const memory = createMemoryEncounterStore()
  // The only cast: the host ports are the platform, and the wider port surface is unused here.
  const ctx = {
    db: memory.store,
    ports: {
      requireIdentity: async () => ({ userId: GM_USER_ID }),
      requireCampaignAuthority: async () => ({
        campaign: {
          id: CAMPAIGN_ID,
          status: 'ACTIVE',
          gameSystemId: SRD_SYSTEM_ID,
          ownerUserId: GM_USER_ID
        }
      })
    }
  } as unknown as EncounterCharacterWriteTransaction
  const run = encounterRunStateSchema.parse(state)
  await memory.store.insert('encounterRuns', {
    id: run.id,
    campaignId: CAMPAIGN_ID,
    gameSystemId: SRD_SYSTEM_ID,
    status: run.status,
    version: run.version,
    stateJson: JSON.stringify(run),
    stateChecksum: checksumCanonicalJson(run),
    createCommandId: COMMAND_ID,
    createCommandFingerprint: 'b'.repeat(64),
    concentrationCasterCharacterIds: [],
    createdAt: OCCURRED_AT,
    updatedAt: OCCURRED_AT
  })
  for (const actor of actors) await insertRunActor(ctx, actor)
  await memory.store.insert('encounterSceneBindings', {
    encounterId: ENCOUNTER_ID,
    campaignId: CAMPAIGN_ID,
    sceneId: SCENE_ID,
    commandId: COMMAND_ID,
    commandFingerprint: 'a'.repeat(64),
    createdAt: OCCURRED_AT
  })
  for (const [tokenId, actorId] of [
    [GOBLIN_TOKEN_ID, GOBLIN_ID],
    [SOURCE_TOKEN_ID, SOURCE_ID]
  ] as const)
    await memory.store.insert('encounterActorTokenBindings', {
      actorId,
      encounterId: ENCOUNTER_ID,
      sceneId: SCENE_ID,
      tokenId
    })
  const scope = await createSpatialRuleEffectStore(ctx).scope({
    encounterId: ENCOUNTER_ID,
    sceneId: SCENE_ID
  })
  if (!scope) throw new Error('The Scene must be bound.')
  const { id, definition, lifecycle, placement, spatialState } = placedFireShield({
    seed: 0x3c0,
    sourceActorId: SOURCE_ID,
    sourceTokenId: SOURCE_TOKEN_ID,
    sceneId: SCENE_ID
  })
  await scope.create({ id, definition, lifecycle, placement, spatialState })
  const effects = createActiveRuleEffectStore(ctx)
  const sleeper = options.asleep
    ? sleepEffectOn({
        encounterId: ENCOUNTER_ID,
        id: testUuid(0x3d2),
        sourceActorId: SOURCE_ID,
        holder: asleep
      })
    : null
  if (sleeper)
    await effects.create({
      id: sleeper.id,
      owner: sleeper.owner,
      definition: sleeper.definition,
      lifecycle: sleeper.lifecycle
    })
  const scene = await readMeleeRetaliationScene(
    ctx,
    { state, attackerActorId: GOBLIN_ID, hitActorId: SOURCE_ID },
    async () => tokens
  )
  const selected = selectMeleeRetaliationContacts({
    actors,
    attacker: scene!.attacker,
    hit: scene!.hit,
    effects: await scope.list()
  })!
  const { evidence } = await planEncounterMeleeRetaliation({
    selected,
    attacker: srdCreatureTarget(asleep, sleeper ? [sleeper] : []),
    encounter: state,
    occurrenceId: OCCURRENCE_ID,
    sourceCommandId: testUuid(0x3b0),
    occurredAt: OCCURRED_AT,
    userId: GM_USER_ID,
    runtime,
    random: () => 0,
    damageEnds: {
      turnActorId: state.currentActorId,
      dispositions: new Map(actors.map(({ id: actorId, disposition }) => [actorId, disposition]))
    }
  })
  const persist = () =>
    persistEncounterMeleeRetaliation(
      ctx,
      {
        state,
        initialActors: actors,
        attacker: asleep,
        scene,
        evidence,
        occurrenceId: OCCURRENCE_ID,
        sourceCommandId: testUuid(0x3b0),
        occurredAt: OCCURRED_AT
      },
      {
        applyMechanics: async (batch) => {
          const target = await readEncounterMechanicsBatchTarget(ctx, {
            ...batch,
            expectedCharacterStreamVersion: null
          })
          return persistEncounterMechanicsBatchPlan(ctx, target, {
            actor: target.actor,
            character: null,
            plan: planEncounterMechanicsBatch({
              batch: target.input,
              actor: target.actor,
              userId: target.userId
            })
          })
        }
      }
    )
  return { ctx, state, effects, sleeper, evidence, persist }
}

describe('persisting a melee retaliation that ends the attacker’s effects (SPELLS-33.T6e4)', () => {
  it('deletes the sleep the shield’s damage ends and releases the condition it held', async () => {
    const { ctx, state, effects, sleeper, persist } = await attackerBurnt({
      creature: 'Goblin',
      asleep: true
    })
    const settled = await persist()

    expect(await effects.list(sleeper!.owner)).toEqual([])
    const stored = await readRunActor(ctx, state, GOBLIN_ID)
    expect(stored).toEqual(settled)
    expect(stored.kind === 'CHARACTER' ? null : stored.conditions).toEqual([])
  })
})

describe('persisting a melee retaliation that gives the attacker a timed grant (SPELLS-33.T6e3b)', () => {
  it('creates the grant the planned evidence names when the shield’s fire meets Aversion of Fire', async () => {
    const { effects, evidence, persist } = await attackerBurnt({
      creature: 'Flesh Golem',
      asleep: false
    })
    expect(evidence.grantEffectTransitions).toHaveLength(1)

    await persist()

    const held = await effects.list({
      kind: 'ENCOUNTER_ACTOR',
      encounterId: ENCOUNTER_ID,
      targetActorId: GOBLIN_ID
    })
    expect(held.map(({ id }) => id)).toEqual(
      evidence.grantEffectTransitions.map(({ activeEffectId }) => activeEffectId)
    )
  })

  it('refuses a settlement whose recorded grants no longer match the held effects', async () => {
    const { evidence, persist } = await attackerBurnt({ creature: 'Flesh Golem', asleep: false })
    evidence.grantEffectTransitions.length = 0

    await expect(persist()).rejects.toThrow('Melee retaliation grants differ from its plan.')
  })

  it('gives a creature without the feature no grant', async () => {
    const { evidence } = await attackerBurnt({ creature: 'Goblin', asleep: false })
    expect(evidence.grantEffectTransitions).toEqual([])
  })
})
