import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { characterSheetCommandInputDtoSchema } from '@artificer-toolkit/schema/api/characterSheetCommands'
import {
  encounterGmProjectionDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { SRD_BASIC_ACTION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { sourceImportBatches } from '../content/importBatches'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
  SRD_REACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  SRD_ATHLETICS_SKILL_ID,
  SRD_CONDITION_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import {
  attachRoomWorker,
  checkpointLiveRoom,
  checkpointRoom,
  closeRoom,
  executeInRoom,
  queueRoomRolls,
  readRoomEncounterSession,
  readRoomRollCards,
  readRoomTimeline,
  seedRoomContentSnapshots,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import {
  seededSrdCreature,
  importSeededSrdCreatureSenses,
  seededSrdPinnedSources
} from '../../tests/fixtures/srdCreatures'
import { api, internal } from '../_generated/api'
import { readCharacterRow } from '../characters/stateDocuments'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'

function srdId(entries: readonly { id: string; code: string }[], code: string) {
  const entry = entries.find((candidate) => candidate.code === code)
  if (!entry) throw new Error(`The SRD ${code} is missing.`)
  return entry.id
}
const conditionId = (code: string) => srdId(SRD_CONDITION_TYPES, code)

useLocalRoomWorker()
afterEach(() => {
  vi.unstubAllEnvs()
})

/** The room's next dice, as 0-based faces in request order. */
function rollFaces(base: Fixture, faces: readonly number[]) {
  return queueRoomRolls(base.campaign.id, { rolls: [...faces] })
}

/**
 * The seeded SRD Creature attacking the player's Character in an Assisted Run. The GM rolls the
 * Creature's dice automatically; the player's Character rolls its own saves (D19).
 */
async function setup(input: {
  creature: string
  feature: string
  conditionCodes?: readonly string[]
  /** The grip of a versatile weapon attack, which is its own action. */
  grip?: 'ONE_HANDED' | 'TWO_HANDED'
  playerAutoRoll: boolean
  /** The Creature's current hit points, when not its maximum. */
  creatureHitPoints?: number
  /** Hides the Creature from players, as a hidden token. */
  hidden?: boolean
  /** Seeds the SRD basic actions (Help) into the Run's content. */
  basicActions?: boolean
}) {
  const base = await setupCharacterRun()
  await attachRoomWorker(base.t)
  await setAutoRollDice(base.t, base.owner.userId, true)
  await setAutoRollDice(base.t, base.player.userId, input.playerAutoRoll)
  const creature = seededSrdCreature(input.creature)
  const conditionIds = (input.conditionCodes ?? []).map(conditionId)
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_RULE_STATE_DEFINITIONS.filter(
      (definition) =>
        definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID ||
        // A Creature's own reactions (Parry) are listed with its actions, priced by its reaction.
        definition.id === SRD_REACTION_ALLOWANCE_DEFINITION_ID ||
        conditionIds.includes(definition.id) ||
        // A basic action's holder restrictions read whether the actor can act.
        (input.basicActions === true && definition.id === SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID)
    )
  })
  await importSeededSrdCreatureSenses(base.t, creature)
  if (input.basicActions)
    for (const definitions of sourceImportBatches(SRD_BASIC_ACTION_DEFINITIONS))
      await base.t.mutation(internal.content.import.importDefinitions, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitions
      })
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature }),
      ...seededSrdPinnedSources(creature).map(importedSubject)
    ]
  })
  await seedRoomContentSnapshots(base.campaign.id)
  const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: base.campaign.gameSystemId,
    name: `${input.creature} fixture`,
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE', sourceId: creature.id }]
  })
  const run = await base.owner.caller.mutation(api.encounters.runs.create, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const actor = run.actors.find((candidate) => candidate.kind === 'CREATURE')
  const target = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
  if (!actor || !target) throw new Error('The SRD attack fixture actors are missing.')
  const featureId = creature.features.find((feature) => feature.label === input.feature)?.id
  const actionId = await base.t.run(async (ctx) => {
    await activateFixtureRun(
      ctx,
      run.id,
      { automationMode: 'ASSISTED', round: 1, currentActorId: actor.id },
      [actor.id, target.id]
    )
    const actorRow = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
      .unique()
    if (!actorRow) throw new Error('The SRD attack fixture Creature is missing.')
    const actorState = await readTestActor(ctx, actorRow)
    if (input.creatureHitPoints !== undefined || input.hidden) {
      const adjusted = {
        ...actorState,
        ...(input.creatureHitPoints === undefined
          ? {}
          : { currentHitPoints: input.creatureHitPoints }),
        public: !input.hidden
      }
      await writeRunActor({ db: createConvexEncounterStore(ctx) }, actorRow._id, adjusted)
    }
    return discoverEncounterFeatureActionCapabilities({
      spells: new Map(),
      actor: actorState,
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map(({ id }) => id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
    }).find(
      (capability) =>
        capability.ownerFeatureId === featureId && capability.grip === (input.grip ?? null)
    )?.actionId
  })
  if (!actionId) throw new Error(`The seeded ${input.creature} ${input.feature} is not an action.`)
  return {
    ...base,
    run,
    target,
    command: {
      type: 'RESOLVE_ACTION' as const,
      acceptedWieldConflict: null,
      // No Scene is bound, so the attack's reach can't be measured (D11).
      acknowledgedWarnings: ['TARGET_RANGE_UNCHECKED' as const],
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: run.version,
      actorId: actor.id,
      target: { kind: 'ACTOR' as const, actorId: target.id },
      actionId,
      optionalCombatIntent: null,
      sceneContext: null
    }
  }
}

type Fixture = Awaited<ReturnType<typeof setup>>

/**
 * The Character target as the table sees it after a checkpoint. The room holds the settled receipt
 * (D85) and sends members no part of it, so a settled action is read from what the table sees: the
 * target's hit points and conditions, the roll cards and the Character's published effects.
 */
async function targetAfter(base: Fixture) {
  await checkpointRoom(base.campaign.id)
  const projection = await base.owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: base.run.id
  })
  const actor = encounterGmProjectionDtoSchema
    .parse(projection)
    .actors.find((candidate) => candidate.id === base.target.id)
  if (!actor) throw new Error('The projected Character target is missing.')
  return actor
}

async function damageTaken(base: Fixture) {
  return base.target.currentHitPoints - (await targetAfter(base)).currentHitPoints
}

async function expectConditions(base: Fixture, codes: readonly string[]) {
  expect(await targetAfter(base)).toMatchObject({
    conditions: expect.arrayContaining(
      codes.map((code) => expect.objectContaining({ conditionTypeId: conditionId(code) }))
    )
  })
}

/** The active effects the room published for the Character. */
async function characterEffects(base: Fixture) {
  await checkpointLiveRoom(base.campaign.id)
  return base.t.run((ctx) =>
    createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).list({
      kind: 'CHARACTER',
      characterId: base.character.id
    })
  )
}

function answerSave(base: Fixture, result: EncounterCommandResultDto, face: number) {
  const pending = result.occurrence?.pending
  if (pending?.kind !== 'D20_EVIDENCE') throw new Error('Expected the Character’s save prompt.')
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: result.projection.version,
      correlationId: null,
      occurrenceId: result.occurrence!.occurrenceId,
      expectedOccurrenceVersion: result.occurrence!.occurrenceVersion,
      resolution: {
        kind: 'ENTER_DICE' as const,
        requestId: pending.request.requestId,
        rawFaces: pending.request.rollMode === 'NORMAL' ? [face] : [face, face],
        rollMode: pending.request.rollMode
      }
    }
  }
}

/** The Wight hits the Character for 6 necrotic and its Life Drain save fails (D62). */
async function lifeDrainCharacter(input: { hidden: boolean }) {
  const base = await setup({
    creature: 'Wight',
    feature: 'Life Drain',
    playerAutoRoll: false,
    hidden: input.hidden
  })
  // A natural 19 hits for 1d6 + 2 necrotic, the die rolling 4; the Character's save waits on its player.
  await rollFaces(base, [18, 3])
  const pending = await executeInRoom(base.owner.caller, { command: base.command })
  const answered = await executeInRoom(base.player.caller, answerSave(base, pending, 1))
  expect(answered.occurrence?.status).toBe('COMPLETE')
  await checkpointRoom(base.campaign.id)
  return { base, answered }
}
// Rider receipts and applied outputs live in the room's history:
// see apps/session-worker/test/nativeRoomHitRiders.test.ts.
describe('seeded SRD Creature hit riders in the room', () => {
  it('deals both damage parts of the Hell Hound’s Bite on one hit', async () => {
    const base = await setup({ creature: 'Hell Hound', feature: 'Bite', playerAutoRoll: true })
    // A natural 19 hits; every damage die rolls 1: 1 + 3 piercing and 1 + 1 fire.
    await rollFaces(base, [18, 0, 0, 0])
    const result = await executeInRoom(base.owner.caller, { command: base.command })
    expect(result.occurrence?.status).toBe('COMPLETE')
    expect(await damageTaken(base)).toBe(4 + 2)
  }, 30000)

  it('rolls every damage die of the Hell Hound’s Bite twice on a critical hit', async () => {
    const base = await setup({ creature: 'Hell Hound', feature: 'Bite', playerAutoRoll: true })
    // A natural 20: 2d8 + 3 piercing and 4d6 fire, every die rolling 1.
    await rollFaces(base, [19, 0, 0, 0, 0, 0, 0])
    const result = await executeInRoom(base.owner.caller, { command: base.command })
    expect(result.occurrence?.status).toBe('COMPLETE')
    const cards = await readRoomRollCards(base.owner.caller, base.campaign.id)
    expect(cards.find((card) => card.source.kind === 'ATTACK')?.evidence.terms[0]?.rolls).toEqual([
      20
    ])
    // Cards one command posts at the same instant list in the order of their random IDs.
    expect(
      cards
        .filter((card) => card.source.kind === 'DAMAGE')
        .map((card) => card.evidence.total)
        .sort((a, b) => a - b)
    ).toEqual([4, 2 + 3])
    expect(await damageTaken(base)).toBe(2 + 3 + 4)
  }, 30000)

  it('hits with the Aboleth’s newly authored Tentacle (D60)', async () => {
    const base = await setup({ creature: 'Aboleth', feature: 'Tentacle', playerAutoRoll: true })
    // A natural 19 hits; 2d6 + 5 bludgeoning with both dice rolling 1.
    await rollFaces(base, [18, 0, 0])
    const result = await executeInRoom(base.owner.caller, { command: base.command })
    expect(result.occurrence?.status).toBe('COMPLETE')
    const cards = await readRoomRollCards(base.owner.caller, base.campaign.id)
    expect(cards.find((card) => card.source.kind === 'ATTACK')?.evidence.terms[0]?.rolls).toEqual([
      19
    ])
    expect(await damageTaken(base)).toBe(7)
  }, 30000)

  it('hits with the new Swarm of Ravens’ Beaks, which add no ability modifier (D60)', async () => {
    const base = await setup({
      creature: 'Swarm of Ravens',
      feature: 'Beaks',
      playerAutoRoll: true
    })
    // A natural 19 hits; 2d6 piercing with both dice rolling 1.
    await rollFaces(base, [18, 0, 0])
    const result = await executeInRoom(base.owner.caller, { command: base.command })
    expect(result.occurrence?.status).toBe('COMPLETE')
    expect(await damageTaken(base)).toBe(2)
  }, 30000)

  it('bites a creature in the Swarm of Rats’ space for half dice once it has half of its hit points or fewer (D61)', async () => {
    const bites = (creatureHitPoints: number) =>
      setup({
        creature: 'Swarm of Rats',
        feature: 'Bites',
        playerAutoRoll: true,
        creatureHitPoints
      })
    // Reach 0 ft.; a natural 19 hits for 2d6 piercing, or 1d6 at 12 of 24 hit points or fewer.
    const full = await bites(13)
    await rollFaces(full, [18, 2, 3])
    const fullResult = await executeInRoom(full.owner.caller, { command: full.command })
    expect(fullResult.occurrence?.status).toBe('COMPLETE')
    expect(await damageTaken(full)).toBe(3 + 4)
    const half = await bites(12)
    await rollFaces(half, [18, 2])
    const halfResult = await executeInRoom(half.owner.caller, { command: half.command })
    expect(halfResult.occurrence?.status).toBe('COMPLETE')
    expect(await damageTaken(half)).toBe(3)
  }, 60000)

  it('routes the Giant Spider’s poison save to the Character’s player, then halves on a success', async () => {
    const base = await setup({ creature: 'Giant Spider', feature: 'Bite', playerAutoRoll: false })
    // The GM auto-rolls the hit and its piercing damage; the Character's save waits on its player.
    await rollFaces(base, [18, 0])
    const pending = await executeInRoom(base.owner.caller, { command: base.command })
    expect(pending.occurrence).toMatchObject({
      status: 'PENDING',
      pending: { kind: 'D20_EVIDENCE', rollerActorId: base.command.target.actorId }
    })
    const session = await readRoomEncounterSession(base.player.caller, base.campaign.id, {
      timeline: false
    })
    expect(session.held ? session.state.pending : null).toMatchObject({
      kind: 'D20_EVIDENCE',
      rollerActorId: base.command.target.actorId
    })
    // A natural 20 saves against DC 11; the poison dice roll 2 and 2, halved to 2.
    await rollFaces(base, [1, 1])
    const answered = await executeInRoom(base.player.caller, answerSave(base, pending, 20))
    expect(answered.occurrence?.status).toBe('COMPLETE')
    expect(await damageTaken(base)).toBe(4 + 2)
  }, 30000)

  it('auto-rolls the Character’s save when its player auto-rolls, taking full poison on a failure', async () => {
    const base = await setup({ creature: 'Giant Spider', feature: 'Bite', playerAutoRoll: true })
    // Hit, 1 + 3 piercing, then a natural 1 fails the save: 1 + 1 poison.
    await rollFaces(base, [18, 0, 0, 0, 0])
    const result = await executeInRoom(base.owner.caller, { command: base.command })
    expect(result.occurrence?.status).toBe('COMPLETE')
    expect(await damageTaken(base)).toBe(4 + 2)
  }, 30000)

  it('knocks the Character prone when it fails its save against the Mastiff’s Bite', async () => {
    const base = await setup({
      creature: 'Mastiff',
      feature: 'Bite',
      conditionCodes: ['PRONE'],
      playerAutoRoll: false
    })
    await rollFaces(base, [18, 0])
    const pending = await executeInRoom(base.owner.caller, { command: base.command })
    const answered = await executeInRoom(base.player.caller, answerSave(base, pending, 1))
    expect(answered.occurrence?.status).toBe('COMPLETE')
    await expectConditions(base, ['PRONE'])
  }, 30000)

  it('deals the Spider’s poison only when the Character fails its save', async () => {
    const base = await setup({ creature: 'Spider', feature: 'Bite', playerAutoRoll: false })
    // A natural 19 hits for a fixed 1 piercing; the Character's save waits on its player.
    await rollFaces(base, [18])
    const pending = await executeInRoom(base.owner.caller, { command: base.command })
    await rollFaces(base, [2])
    const answered = await executeInRoom(base.player.caller, answerSave(base, pending, 1))
    expect(answered.occurrence?.status).toBe('COMPLETE')
    expect(await damageTaken(base)).toBe(1 + 3)
  }, 30000)

  it('paralyzes the Character with a repeating save when it fails against the Ghoul’s Claws', async () => {
    const base = await setup({
      creature: 'Ghoul',
      feature: 'Claws',
      conditionCodes: ['PARALYZED'],
      playerAutoRoll: false
    })
    await rollFaces(base, [18, 0, 0])
    const pending = await executeInRoom(base.owner.caller, { command: base.command })
    const answered = await executeInRoom(base.player.caller, answerSave(base, pending, 1))
    expect(answered.occurrence?.status).toBe('COMPLETE')
    await expectConditions(base, ['PARALYZED'])
    expect(await characterEffects(base)).toHaveLength(1)
  }, 30000)

  it('hits with the Ogre’s Greatclub for its printed damage through its held Equipment (D62, M9)', async () => {
    const base = await setup({ creature: 'Ogre', feature: 'Greatclub', playerAutoRoll: true })
    // A natural 19 hits; 2d8 + 4 bludgeoning (the Equipment alone deals 1d8) with both dice rolling 1.
    await rollFaces(base, [18, 0, 0])
    const result = await executeInRoom(base.owner.caller, { command: base.command })
    expect(result.occurrence?.status).toBe('COMPLETE')
    expect(await damageTaken(base)).toBe(6)
  }, 30000)

  it('grapples and restrains the Character with one hit of the Giant Toad’s Bite (D62, M9)', async () => {
    const base = await setup({
      creature: 'Giant Toad',
      feature: 'Bite',
      conditionCodes: ['GRAPPLED', 'RESTRAINED'],
      playerAutoRoll: true
    })
    // A natural 19 hits; 1d10 + 2 piercing and 1d10 poison, both dice rolling 1.
    await rollFaces(base, [18, 0, 0])
    const result = await executeInRoom(base.owner.caller, { command: base.command })
    expect(result.occurrence?.status).toBe('COMPLETE')
    expect(await damageTaken(base)).toBe(3 + 1)
    await expectConditions(base, ['GRAPPLED', 'RESTRAINED'])
  }, 30000)

  it('poisons the Character for 1 minute when it fails its save against the Homunculus’s Bite (D62.2)', async () => {
    const base = await setup({
      creature: 'Homunculus',
      feature: 'Bite',
      conditionCodes: ['POISONED'],
      playerAutoRoll: false
    })
    // A natural 19 hits for a fixed 1 piercing; the Character's save waits on its player.
    await rollFaces(base, [18])
    const pending = await executeInRoom(base.owner.caller, { command: base.command })
    const answered = await executeInRoom(base.player.caller, answerSave(base, pending, 1))
    expect(answered.occurrence?.status).toBe('COMPLETE')
    await expectConditions(base, ['POISONED'])
    // One active effect times the poison: 10 of the Character's turns, with no repeated save.
    expect(await characterEffects(base)).toMatchObject([
      {
        definition: {
          recurrence: {
            recurrenceStage: 'END_OF_TURN',
            expiration: { kind: 'TICKS', initialRemaining: 10 }
          }
        }
      }
    ])
  }, 30000)

  it('names a visible attacker’s Life Drain on the player’s Sheet (D62)', async () => {
    const { base } = await lifeDrainCharacter({ hidden: false })
    const drained = await base.player.caller.query(api.characters.sheet.get, {
      id: base.character.id
    })
    expect(drained?.overview.maxHitPointsReductions).toEqual([
      expect.objectContaining({ label: 'Life Drain', sourceHidden: false, amount: 6 })
    ])
  }, 30000)
  it('drains the Character’s hit point maximum with the Wight’s Life Drain until a long rest (D62)', async () => {
    const { base, answered } = await lifeDrainCharacter({ hidden: true })
    expect(answered.occurrence?.status).toBe('COMPLETE')
    expect(await damageTaken(base)).toBe(6)
    const maximum = base.target.maxHitPoints
    expect((await targetAfter(base)).maxHitPoints).toBe(maximum - 6)
    // The reduction's amount and recovery tags reach the Sheet (read back below) and the effect store.
    expect(await characterEffects(base)).toHaveLength(1)
    const [drain] = await characterEffects(base)
    // The attack's Feature label is frozen onto the reduction and read back by the Sheet.
    expect(drain?.definition).toMatchObject({
      stateContributions: [
        expect.objectContaining({
          kind: 'HIT_POINT_MAXIMUM_REDUCTION',
          sourceLabel: 'Life Drain',
          sourceHidden: true
        })
      ]
    })
    const drained = await base.player.caller.query(api.characters.sheet.get, {
      id: base.character.id
    })
    // A hidden Wight: the player's Sheet names neither the attack nor the Creature.
    expect(JSON.stringify(drained)).not.toMatch(/Wight|Life Drain/i)
    expect(JSON.stringify(drained)).not.toContain(base.command.actorId)
    const playerEncounter = await base.player.caller.query(api.encounters.projectionReads.get, {
      encounterId: base.run.id
    })
    expect(playerEncounter.actors.map((actor) => actor.id)).not.toContain(base.command.actorId)
    expect(drained?.overview.maxHitPointsReductions).toEqual([
      {
        id: drain?.id,
        label: null,
        sourceHidden: true,
        amount: 6,
        recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM', 'LONG_REST']
      }
    ])
    // The GM's view of the same Sheet keeps the frozen label.
    const gmView = await base.owner.caller.query(api.campaigns.characterSheet.get, {
      campaignId: base.campaign.id,
      characterId: base.character.id
    })
    expect(gmView.overview.maxHitPointsReductions).toEqual([
      {
        id: drain?.id,
        label: 'Life Drain',
        sourceHidden: true,
        amount: 6,
        recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM', 'LONG_REST']
      }
    ])

    // A long rest ends the reduction and restores every hit point. The Character rests once the
    // table's room releases it.
    await closeRoom(base.campaign.id)
    const streamVersion = await base.t.run(async (ctx) => {
      const row = await readCharacterRow(ctx, base.character.id)
      if (!row) throw new Error('The Life Drain Character is missing.')
      return row.play.streamVersion
    })
    const input = {
      restKind: 'LONG' as const,
      expectedVersion: streamVersion,
      selectedHitDice: [],
      resetMaximumHitPointModifier: false,
      healingMode: 'AUTOMATIC' as const,
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: [],
      requestRoll: false as const
    }
    const preview = await base.player.caller.query(api.characters.rest.preview, {
      id: base.character.id,
      input
    })
    const rested = await base.player.caller.mutation(api.characters.sheetCommands.execute, {
      id: base.character.id,
      command: characterSheetCommandInputDtoSchema.parse({
        ...input,
        type: 'COMPLETE_REST',
        commandId: crypto.randomUUID(),
        previewFingerprint: preview.previewFingerprint
      })
    })
    expect(rested).not.toHaveProperty('sheet')
    const restedSheet = (await base.player.caller.query(api.characters.sheet.get, {
      id: rested.characterId
    }))!
    expect(await characterEffects(base)).toEqual([])
    expect(restedSheet.overview).toMatchObject({
      currentHitPoints: maximum,
      maxHitPoints: maximum
    })
  }, 30000)

  it('offers the Erinyes’ Longsword one- and two-handed and resolves the chosen grip', async () => {
    const base = await setup({
      creature: 'Erinyes',
      feature: 'Longsword',
      grip: 'TWO_HANDED',
      playerAutoRoll: true
    })
    const choices = await base.owner.caller.query(api.encounters.actionChoices.get, {
      encounterId: base.run.id,
      expectedVersion: base.command.expectedVersion,
      actorId: base.command.actorId
    })
    const longswords = (choices?.actions ?? []).filter((action) => action.grip !== null)
    expect(longswords.map((action) => action.grip?.value).sort()).toEqual([
      'ONE_HANDED',
      'TWO_HANDED'
    ])
    expect(new Set(longswords.map((action) => action.grip?.attackKey)).size).toBe(1)
    expect(longswords.find((action) => action.grip?.value === 'TWO_HANDED')?.id).toBe(
      base.command.actionId
    )
    // A natural 19 hits; the two-handed d10 rolls 10 (a d8 could not): 10 + 4 slashing, then 3d8
    // poison rolling 1s.
    await rollFaces(base, [18, 9, 0, 0, 0])
    const result = await executeInRoom(base.owner.caller, { command: base.command })
    expect(result.occurrence?.status).toBe('COMPLETE')
    // The Character's hit points clamp the applied damage, so the dealt amounts read off the cards.
    const cards = await readRoomRollCards(base.owner.caller, base.campaign.id)
    expect(
      cards
        .filter((card) => card.source.kind === 'DAMAGE')
        .map((card) => card.evidence.total)
        .sort((a, b) => a - b)
    ).toEqual([3, 10 + 4])
  }, 30000)

  describe('escaping the Giant Toad’s grapple (ATTACK-7.3)', () => {
    /** The Toad grapples and restrains the Character, whose turn comes next. */
    /** `beforeAdvance` acts on the Toad's turn after its bite and returns the Run's new version. */
    async function grappledOnItsTurn({
      hidden = false,
      basicActions = false,
      beforeAdvance
    }: {
      hidden?: boolean
      basicActions?: boolean
      beforeAdvance?: (base: Fixture, version: number) => Promise<number>
    } = {}) {
      const base = await setup({
        creature: 'Giant Toad',
        feature: 'Bite',
        conditionCodes: ['GRAPPLED', 'RESTRAINED'],
        playerAutoRoll: false,
        hidden,
        basicActions
      })
      // A natural 19 hits; both damage dice roll 1.
      await rollFaces(base, [18, 0, 0])
      const bitten = await executeInRoom(base.owner.caller, { command: base.command })
      expect(bitten.occurrence?.status).toBe('COMPLETE')
      const advanced = await executeInRoom(base.owner.caller, {
        command: {
          type: 'ADVANCE_TURN',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: beforeAdvance
            ? await beforeAdvance(base, bitten.projection.version)
            : bitten.projection.version
        }
      })
      await checkpointRoom(base.campaign.id)
      return { base, version: advanced.projection.version }
    }

    /** The relationship effects holding the Character. */
    async function holds(base: Fixture) {
      return (await characterEffects(base)).filter(({ definition }) =>
        definition.stateContributions.some(({ kind }) => kind === 'ACTOR_RELATIONSHIP')
      )
    }

    async function escapeChoice(base: Fixture, version: number) {
      const choices = await base.player.caller.query(api.encounters.actionChoices.get, {
        encounterId: base.run.id,
        expectedVersion: version,
        actorId: base.target.id
      })
      return choices?.escapes ?? []
    }

    it('offers the escape with its DC and checks, and answering the d20 frees the Character', async () => {
      const { base, version } = await grappledOnItsTurn()
      const [hold] = await holds(base)
      expect(hold).toBeDefined()
      const escapes = await escapeChoice(base, version)
      expect(escapes).toMatchObject([
        {
          activeEffectId: hold!.id,
          label: 'Escape from Giant Toad',
          dc: 13,
          actionCost: 'ACTION',
          checks: expect.arrayContaining([
            expect.objectContaining({
              checkDefinitionId: SRD_ATHLETICS_SKILL_ID,
              label: 'Strength (Athletics)'
            })
          ])
        }
      ])
      expect(escapes[0]!.checks).toHaveLength(2)

      const prompted = await executeInRoom(base.player.caller, {
        command: {
          type: 'ESCAPE',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: version,
          actorId: base.target.id,
          activeEffectId: hold!.id,
          checkDefinitionId: SRD_ATHLETICS_SKILL_ID,
          acknowledgedWarnings: []
        }
      })
      expect(prompted.occurrence?.pending).toMatchObject({
        kind: 'D20_EVIDENCE',
        trigger: { kind: 'BASIC_ACTION_CHECK', actionLabel: 'Escape', dc: 13 }
      })
      // Still held until the player's d20 settles the check.
      expect(await holds(base)).toHaveLength(1)

      const freed = await executeInRoom(base.player.caller, answerSave(base, prompted, 20))
      expect(freed.occurrence?.status).toBe('COMPLETE')
      await checkpointRoom(base.campaign.id)
      expect(await holds(base)).toEqual([])
      expect((await targetAfter(base)).conditions).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ conditionTypeId: conditionId('GRAPPLED') })
        ])
      )
      expect((await targetAfter(base)).conditions).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ conditionTypeId: conditionId('RESTRAINED') })
        ])
      )
      // The player's answer is the newest entry; the escape it settled sits just before it.
      const entries = await readRoomTimeline(base.owner.caller, base.campaign.id)
      expect(entries[1]).toMatchObject({ commandType: 'ESCAPE', label: 'Escape' })
      expect(await escapeChoice(base, freed.projection.version)).toEqual([])
    }, 60000)

    /**
     * The Toad Helps the Character after its bite; both warnings are overridden, since the Toad is
     * hostile to the Character and has no Action left.
     */
    async function toadHelps(toadBase: Fixture, bittenVersion: number) {
      await checkpointRoom(toadBase.campaign.id)
      const help = (
        await toadBase.owner.caller.query(api.encounters.actionChoices.get, {
          encounterId: toadBase.run.id,
          expectedVersion: bittenVersion,
          actorId: toadBase.command.actorId
        })
      )?.basicActionChoices.find(({ label }) => label === 'Help')
      if (!help) throw new Error('The Toad is not offered Help.')
      const helped = await executeInRoom(toadBase.owner.caller, {
        command: {
          type: 'RESOLVE_ACTION',
          acceptedWieldConflict: null,
          acknowledgedWarnings: ['TARGET_DISPOSITION', 'ACTION_ECONOMY_UNAVAILABLE'],
          encounterId: toadBase.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: bittenVersion,
          actorId: toadBase.command.actorId,
          actionId: help.id,
          target: { kind: 'ACTOR', actorId: toadBase.target.id },
          optionalCombatIntent: null,
          sceneContext: null
        }
      })
      return helped.projection.version
    }

    /** The Help grants holding the Character. */
    async function helps(base: Fixture) {
      return (await characterEffects(base)).filter(({ definition }) =>
        definition.stateContributions.some(({ kind }) => kind === 'MODIFIER_GRANT')
      )
    }

    function escapeAthletics(base: Fixture, version: number, activeEffectId: string) {
      return {
        command: {
          type: 'ESCAPE' as const,
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: version,
          actorId: base.target.id,
          activeEffectId,
          checkDefinitionId: SRD_ATHLETICS_SKILL_ID,
          acknowledgedWarnings: []
        }
      }
    }

    it('rolls a Helped escape with advantage and uses the Help up (ATTACK-18)', async () => {
      const { base, version } = await grappledOnItsTurn({
        basicActions: true,
        beforeAdvance: toadHelps
      })
      expect(await helps(base)).toHaveLength(1)
      const [hold] = await holds(base)

      const prompted = await executeInRoom(
        base.player.caller,
        escapeAthletics(base, version, hold!.id)
      )
      expect(prompted.occurrence?.pending).toMatchObject({
        kind: 'D20_EVIDENCE',
        request: { rollMode: 'ADVANTAGE' }
      })
      // The check starts the roll, so the Help is used up whatever the d20 shows.
      expect(await helps(base)).toEqual([])
      // The used-up Help still names the advantage it gave.
      await checkpointRoom(base.campaign.id)
      await expect(
        base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: base.run.id
        })
      ).resolves.toMatchObject({
        request: { rollMode: 'ADVANTAGE', derivedRollModeReasons: ['Help'] }
      })
      await executeInRoom(base.player.caller, answerSave(base, prompted, 20))
      await checkpointRoom(base.campaign.id)
      expect(await holds(base)).toEqual([])
    }, 60000)

    it("the GM's undo of a failed Helped escape gives the Help back exactly (ATTACK-18)", async () => {
      const { base, version } = await grappledOnItsTurn({
        basicActions: true,
        beforeAdvance: toadHelps
      })
      const helpedBefore = await helps(base)
      expect(helpedBefore).toHaveLength(1)
      const [hold] = await holds(base)
      const prompted = await executeInRoom(
        base.player.caller,
        escapeAthletics(base, version, hold!.id)
      )
      const failed = await executeInRoom(base.player.caller, answerSave(base, prompted, 1))
      expect(failed.occurrence?.status).toBe('COMPLETE')
      expect(await helps(base)).toEqual([])

      await executeInRoom(base.owner.caller, {
        command: {
          type: 'REVERT_LAST_ACTION',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: failed.projection.version
        }
      })
      expect(await helps(base)).toEqual(helpedBefore)
      expect(await holds(base)).toHaveLength(1)
    }, 60000)
    it('does not name a grappler the player cannot see (D100)', async () => {
      const { base, version } = await grappledOnItsTurn({ hidden: true })
      expect(await escapeChoice(base, version)).toMatchObject([{ label: 'Escape a grapple' }])
      const gmChoices = await base.owner.caller.query(api.encounters.actionChoices.get, {
        encounterId: base.run.id,
        expectedVersion: version,
        actorId: base.target.id
      })
      expect(gmChoices?.escapes).toMatchObject([{ label: 'Escape from Giant Toad' }])
    }, 60000)

    it('keeps the grapple when the d20 misses, and spends the Action', async () => {
      const { base, version } = await grappledOnItsTurn()
      const [hold] = await holds(base)
      const prompted = await executeInRoom(base.player.caller, {
        command: {
          type: 'ESCAPE',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: version,
          actorId: base.target.id,
          activeEffectId: hold!.id,
          checkDefinitionId: SRD_ATHLETICS_SKILL_ID,
          acknowledgedWarnings: []
        }
      })
      const failed = await executeInRoom(base.player.caller, answerSave(base, prompted, 1))
      expect(failed.occurrence?.status).toBe('COMPLETE')
      await checkpointRoom(base.campaign.id)
      expect(await holds(base)).toHaveLength(1)
      expect((await targetAfter(base)).conditions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ conditionTypeId: conditionId('GRAPPLED') })
        ])
      )
    }, 60000)
  })
})
