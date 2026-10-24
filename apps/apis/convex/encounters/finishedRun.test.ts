// @vitest-environment node
import { createFunctionHandle } from 'convex/server'
import { expect, it } from 'vitest'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import {
  readRunActors,
  readRunActorWithRow,
  readRunState,
  writeRunActor
} from '@artificer-toolkit/encounter-persistence/documents'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { plannedTimedCondition } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import { holdPerson } from '@artificer-toolkit/source-data/srd/spells/hold-person.js'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { createConcentrationState, setupConcentration } from '../../tests/fixtures/concentration'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { api, components, internal } from '../_generated/api'
import { endCarriedConcentration } from '../characters/sheetConcentration'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'

useLocalRoomWorker()

const droppedTables = [
  'encounterActorSnapshots',
  'encounterSpellPins',
  'encounterSceneBindings',
  'encounterActorTokenBindings',
  'encounterInitiativeRounds',
  'encounterInitiativeParticipants',
  'encounterInitiativeSides',
  'encounterRuleOccurrences',
  'encounterPendingSnapshotParts',
  'encounterReplayIndex',
  'encounterTurnMovements',
  'encounterDecisionSkips',
  'encounterActiveRuleEffects',
  'encounterMaintainedEffectStates',
  'encounterSpatialRuleEffects',
  'encounterRunCommands',
  'encounterRuleReceipts'
] as const

it('keeps only the finished view of a Run with a Character and a Creature (ADR 0035 Amendment 30)', async () => {
  const fixture = await setupConcentration('PROMPT')
  const { owner, run, t } = fixture
  await attachFixtureRoom(t, fixture.campaign.id)
  const live = await owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: run.id
  })
  expect(live.actors.map((actor) => actor.kind).sort()).toEqual(['CHARACTER', 'CREATURE'])
  // The fixture also holds a second Run, whose rows must stay untouched.
  const countRows = () =>
    t.run(async (ctx) => {
      const own = async (table: (typeof droppedTables)[number]) =>
        (await ctx.db.query(table).collect()).filter((row) => row.encounterId === run.id).length
      return {
        dropped: Object.fromEntries(
          await Promise.all(droppedTables.map(async (table) => [table, await own(table)] as const))
        ),
        runs: (await ctx.db.query('encounterRuns').collect()).length,
        actors: (await ctx.db.query('encounterRunActors').collect()).filter(
          (row) => row.encounterId === run.id
        ).length,
        sources: (await ctx.db.query('encounterSourceProjectionFacts').collect()).filter(
          (row) => row.encounterId === run.id
        ).length
      }
    })
  await t.run((ctx) =>
    ctx.db.insert('encounterSpellPins', {
      encounterId: run.id,
      spellId: crypto.randomUUID(),
      sourceRevision: 1,
      sourceVersionId: crypto.randomUUID(),
      sourceChecksum: 'a'.repeat(64),
      compilationJson: '{}'
    })
  )
  const before = await countRows()
  expect(before.dropped.encounterSpellPins).toBe(1)
  expect(before.dropped.encounterActorSnapshots).toBeGreaterThan(0)
  expect(before.dropped.encounterInitiativeRounds).toBe(1)
  expect(before.sources).toBeGreaterThan(0)

  const completed = await executeInRoom(owner.caller, {
    command: {
      type: 'COMPLETE',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: live.version
    }
  })
  expect(completed.projection.status).toBe('COMPLETED')

  expect(await countRows()).toEqual({
    dropped: Object.fromEntries(droppedTables.map((table) => [table, 0])),
    runs: before.runs,
    actors: before.actors,
    sources: before.sources
  })
  const finished = await owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: run.id
  })
  expect(finished).toEqual(completed.projection)
  const summary = (projection: typeof finished) =>
    projection.actors
      .map((actor) => ({
        id: actor.id,
        kind: actor.kind,
        label: actor.label,
        hitPoints: 'currentHitPoints' in actor ? [actor.currentHitPoints, actor.maxHitPoints] : null
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
  expect(summary(finished)).toEqual(summary(live))
  expect(summary(finished).every((actor) => actor.label.length > 0 && actor.hitPoints)).toBe(true)
  await expect(
    executeInRoom(owner.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: finished.version
      }
    })
  ).rejects.toThrow('Completed Encounters are read-only.')
}, 60_000)

it('reads a finished Run after its Character departs the Campaign (D74, D81)', async () => {
  const fixture = await setupConcentration('PROMPT')
  const { owner, player, run, t } = fixture
  await attachFixtureRoom(t, fixture.campaign.id)
  const live = await owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: run.id
  })
  const completed = await executeInRoom(owner.caller, {
    command: {
      type: 'COMPLETE',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: live.version
    }
  })
  expect(completed.projection.status).toBe('COMPLETED')
  await checkpointLiveRoom(fixture.campaign.id)
  const frozenActors = () =>
    t.run(async (ctx) =>
      (
        await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id))
          .collect()
      ).flatMap((row) => {
        const actor = readStoredRunActor(row)
        return actor.kind === 'CHARACTER'
          ? [{ id: actor.id, frozen: Boolean(actor.frozenState) }]
          : []
      })
    )
  // Completion froze every Character actor, so a later departure has nothing to read.
  expect(await frozenActors()).toEqual([{ id: expect.any(String), frozen: true }])

  await player.caller.mutation(api.campaigns.assignments.unassign, {
    campaignId: fixture.campaign.id
  })
  const finished = await owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: run.id
  })
  expect(finished).toEqual(completed.projection)
}, 60_000)

it.each([
  // Day 2, 08:00 (absolute minute 1440 + 480); 25 rounds left: 150 seconds, rounded up to 3 minutes.
  { clock: 'a Campaign clock', expiresAtCampaignMinute: 1440 + 480 + 3 },
  { clock: 'no Campaign clock', expiresAtCampaignMinute: null }
])(
  'carries a Character’s timed grants out of the Run with $clock and ends the rest with it (D99)',
  async ({ expiresAtCampaignMinute }) => {
    const fixture = await setupConcentration('PROMPT')
    const { owner, run, actor, target, character, t } = fixture
    if (expiresAtCampaignMinute !== null)
      await owner.caller.mutation(api.campaigns.clock.initialize, {
        campaignId: fixture.campaign.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        day: 2,
        minuteOfDay: 480,
        dawnMinute: 360,
        duskMinute: 1080
      })
    const seeded = await t.run(async (ctx) => {
      const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
      const grant = (holderActorId: string, lifetimeScope: 'OWNER' | 'ENCOUNTER') =>
        plannedModifierGrant({
          encounterId: run.id,
          sourceActorId: actor.id,
          holderActorId,
          lifecycle: {},
          rounds: 30,
          lifetimeScope
        }).definition
      const characterOwner = { kind: 'CHARACTER', characterId: character.id } as const
      return {
        lasting: await store.create({
          id: crypto.randomUUID(),
          owner: characterOwner,
          definition: grant(target.id, 'OWNER'),
          lifecycle: { schemaVersion: 1, remainingTicks: 25 }
        }),
        encounterOnly: await store.create({
          id: crypto.randomUUID(),
          owner: characterOwner,
          definition: grant(target.id, 'ENCOUNTER'),
          lifecycle: { schemaVersion: 1, remainingTicks: 25 }
        }),
        creature: await store.create({
          id: crypto.randomUUID(),
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId: run.id, targetActorId: actor.id },
          definition: grant(actor.id, 'ENCOUNTER'),
          lifecycle: { schemaVersion: 1, remainingTicks: 25 }
        })
      }
    })
    expect(seeded.lasting.sourceEncounterId).toBeNull()
    expect(seeded.encounterOnly.sourceEncounterId).toBe(run.id)
    await attachFixtureRoom(t, fixture.campaign.id)
    const live = await owner.caller.query(api.encounters.projectionReads.get, {
      encounterId: run.id
    })
    const completed = await executeInRoom(owner.caller, {
      command: {
        type: 'COMPLETE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: live.version
      }
    })
    expect(completed.projection.status).toBe('COMPLETED')
    await checkpointLiveRoom(fixture.campaign.id)

    const effects = await t.run(async (ctx) => ({
      character: await ctx.db
        .query('characterActiveRuleEffects')
        .withIndex('by_characterId_id', (q) => q.eq('characterId', character.id))
        .collect(),
      creature: (await ctx.db.query('encounterActiveRuleEffects').collect()).filter(
        (row) => row.encounterId === run.id
      )
    }))
    expect(effects.character.map(({ id, lifecycle }) => ({ id, lifecycle }))).toEqual([
      {
        id: seeded.lasting.id,
        lifecycle: { schemaVersion: 1, remainingTicks: null, expiresAtCampaignMinute }
      }
    ])
    expect(effects.creature).toEqual([])
  },
  60_000
)

it('carries a Character’s timed condition effect out of the Run and releases its condition when the clock reaches it (SPELLS-5.14)', async () => {
  const fixture = await setupConcentration('PROMPT')
  const { owner, player, run, actor, target, character, campaign, t } = fixture
  const paralyzed = SRD_CONDITION_TYPES.find(({ code }) => code === 'PARALYZED')
  if (!paralyzed) throw new Error('The SRD Paralyzed condition is unavailable.')
  const clock = await owner.caller.mutation(api.campaigns.clock.initialize, {
    campaignId: campaign.id,
    commandId: crypto.randomUUID(),
    expectedVersion: 0,
    day: 2,
    minuteOfDay: 480,
    dawnMinute: 360,
    duskMinute: 1080
  })
  const held = await t.run(async (ctx) => {
    const planned = plannedTimedCondition({
      encounterId: run.id,
      sourceActorId: actor.id,
      holderActorId: target.id,
      spell: holdPerson,
      lifetimeScope: 'OWNER'
    })
    return createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
      id: crypto.randomUUID(),
      owner: { kind: 'CHARACTER', characterId: character.id },
      definition: planned.definition,
      lifecycle: { schemaVersion: 1, remainingTicks: 5 }
    })
  })
  const readHeld = () =>
    t.run(async (ctx) => {
      const row = await readCharacterRow(ctx, character.id)
      if (!row) throw new Error('Character is unavailable.')
      return {
        streamVersion: row.play.streamVersion,
        conditionIds: (readCharacterRecord(row).state?.conditions ?? []).map(
          (condition) => condition.conditionTypeId
        ),
        effects: (
          await ctx.db
            .query('characterActiveRuleEffects')
            .withIndex('by_characterId_id', (q) => q.eq('characterId', character.id))
            .collect()
        ).map(({ id, lifecycle }) => ({ id, lifecycle }))
      }
    })
  await player.caller.mutation(api.characters.sheetCommands.execute, {
    id: character.id,
    command: {
      type: 'ADD_CONDITION',
      commandId: crypto.randomUUID(),
      expectedVersion: (await readHeld()).streamVersion,
      conditionTypeId: paralyzed.id
    }
  })
  await attachFixtureRoom(t, campaign.id)
  const live = await owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: run.id
  })
  await executeInRoom(owner.caller, {
    command: {
      type: 'COMPLETE',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: live.version
    }
  })
  await checkpointLiveRoom(campaign.id)

  // 5 rounds left: 30 seconds, rounded up to 1 minute after day 2, 08:00.
  expect(await readHeld()).toMatchObject({
    conditionIds: [paralyzed.id],
    effects: [
      {
        id: held.id,
        lifecycle: {
          schemaVersion: 1,
          remainingTicks: null,
          expiresAtCampaignMinute: 1440 + 480 + 1
        }
      }
    ]
  })
  await owner.caller.mutation(api.campaigns.clock.advance, {
    campaignId: campaign.id,
    commandId: crypto.randomUUID(),
    expectedVersion: clock.version,
    minutes: 1
  })
  expect(await readHeld()).toMatchObject({ conditionIds: [], effects: [] })
}, 60_000)

/** Completes a Run whose Concentration grant sits on the Character, carrying it to the Campaign clock. */
async function carryConcentrationGrantOut(casterIsCharacter: boolean) {
  const fixture = await setupConcentration('PROMPT')
  const { owner, run, actor, target, character, campaign, t } = fixture
  await owner.caller.mutation(api.campaigns.clock.initialize, {
    campaignId: campaign.id,
    commandId: crypto.randomUUID(),
    expectedVersion: 0,
    day: 2,
    minuteOfDay: 480,
    dawnMinute: 360,
    duskMinute: 1080
  })
  const casterActorId = casterIsCharacter ? target.id : actor.id
  const grant = await t.run(async (ctx) => {
    const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
    const state = await createConcentrationState(store, {
      encounterId: run.id,
      ownerActorId: casterActorId
    })
    return store.create({
      id: crypto.randomUUID(),
      owner: { kind: 'CHARACTER', characterId: character.id },
      definition: plannedModifierGrant({
        encounterId: run.id,
        sourceActorId: casterActorId,
        holderActorId: target.id,
        lifecycle: {},
        rounds: 30,
        lifetimeScope: 'OWNER'
      }).definition,
      lifecycle: { schemaVersion: 1, remainingTicks: 25 },
      maintainedEffectStateId: state.id
    })
  })
  expect(grant.sourceEncounterId).toBe(run.id)
  await attachFixtureRoom(t, campaign.id)
  const live = await owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: run.id
  })
  const completed = await executeInRoom(owner.caller, {
    command: {
      type: 'COMPLETE',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: live.version
    }
  })
  expect(completed.projection.status).toBe('COMPLETED')
  await checkpointLiveRoom(campaign.id)

  const stored = () =>
    t.run(async (ctx) =>
      (
        await ctx.db
          .query('characterActiveRuleEffects')
          .withIndex('by_characterId_id', (q) => q.eq('characterId', character.id))
          .collect()
      ).map(({ id, maintainedEffectStateId, sourceEncounterId, lifecycle }) => ({
        id,
        maintainedEffectStateId,
        sourceEncounterId,
        lifecycle
      }))
    )
  return { ...fixture, grant, stored }
}

it.each([
  { caster: 'a Character', casterIsCharacter: true },
  { caster: 'a Creature', casterIsCharacter: false }
])(
  'carries a Concentration grant cast by $caster out of the Run for the GM to end (D99, SPELLS-5.7)',
  async ({ casterIsCharacter }) => {
    const { owner, character, campaign, grant, stored } =
      await carryConcentrationGrantOut(casterIsCharacter)
    expect(await stored()).toEqual([
      {
        id: grant.id,
        maintainedEffectStateId: null,
        sourceEncounterId: null,
        lifecycle: {
          schemaVersion: 1,
          remainingTicks: null,
          concentrationCasterCharacterId: casterIsCharacter ? character.id : null,
          expiresAtCampaignMinute: 1440 + 480 + 3
        }
      }
    ])
    const sheet = await owner.caller.query(api.campaigns.characterSheet.get, {
      campaignId: campaign.id,
      characterId: character.id
    })
    expect(sheet.overview.activeGrants).toEqual([
      expect.objectContaining({
        effectId: grant.id,
        remainingTicks: null,
        expiresAtCampaignMinute: 1440 + 480 + 3
      })
    ])

    await owner.caller.mutation(api.campaigns.characterSheet.execute, {
      campaignId: campaign.id,
      characterId: character.id,
      command: {
        type: 'END_ACTIVE_EFFECT',
        commandId: crypto.randomUUID(),
        expectedVersion: sheet.meta.streamVersion,
        effectId: grant.id
      }
    })
    expect(await stored()).toEqual([])
  },
  60_000
)

it('lets the caster end a carried Concentration with no action, ending every grant it carries (SPELLS-5.11)', async () => {
  const { player, character, campaign, stored } = await carryConcentrationGrantOut(true)
  const read = () =>
    player.caller.query(api.campaigns.characterSheet.get, {
      campaignId: campaign.id,
      characterId: character.id
    })
  const sheet = await read()
  expect(sheet.overview.concentration).not.toBeNull()

  await player.caller.mutation(api.campaigns.characterSheet.execute, {
    campaignId: campaign.id,
    characterId: character.id,
    command: {
      type: 'END_CONCENTRATION',
      commandId: crypto.randomUUID(),
      expectedVersion: sheet.meta.streamVersion
    }
  })

  expect(await stored()).toEqual([])
  const ended = await read()
  expect(ended.overview.activeGrants).toEqual([])
  expect(ended.overview.concentration).toBeNull()
  await expect(
    player.caller.mutation(api.campaigns.characterSheet.execute, {
      campaignId: campaign.id,
      characterId: character.id,
      command: {
        type: 'END_CONCENTRATION',
        commandId: crypto.randomUUID(),
        expectedVersion: ended.meta.streamVersion
      }
    })
  ).rejects.toThrow()
}, 60_000)

async function addForeignPlayer(fixture: Awaited<ReturnType<typeof carryConcentrationGrantOut>>) {
  const { t, campaign } = fixture
  const user = await t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Foreign player',
          email: 'foreign@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 60000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const caller = t.withIdentity({ subject: user._id, sessionId: session._id })
  const identity = await caller.query(api.account.identity, {})
  if (!identity) throw new Error('Missing foreign player identity.')
  await t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: identity.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  return caller
}

it('refuses a foreign player and lets the GM end a carried Concentration (SPELLS-5.11)', async () => {
  const fixture = await carryConcentrationGrantOut(true)
  const { owner, character, campaign, stored } = fixture
  const foreign = await addForeignPlayer(fixture)
  const sheet = await owner.caller.query(api.campaigns.characterSheet.get, {
    campaignId: campaign.id,
    characterId: character.id
  })
  const end = (caller: typeof foreign) =>
    caller.mutation(api.campaigns.characterSheet.execute, {
      campaignId: campaign.id,
      characterId: character.id,
      command: {
        type: 'END_CONCENTRATION',
        commandId: crypto.randomUUID(),
        expectedVersion: sheet.meta.streamVersion
      }
    })

  await expect(end(foreign)).rejects.toThrow()
  expect(await stored()).toHaveLength(1)
  await end(owner.caller)
  expect(await stored()).toEqual([])
}, 60_000)

it('routes a caster to no room while no live Run holds a carried grant, and shows a foreign player nothing (SPELLS-5.11)', async () => {
  const fixture = await carryConcentrationGrantOut(true)
  const { player, character, campaign } = fixture
  const foreign = await addForeignPlayer(fixture)
  const input = { id: character.id, campaignId: campaign.id }
  expect(
    await player.caller.query(api.characters.sheetSlices.concentrationRoomRoute, input)
  ).toBeNull()
  // A party member who is not the caster's player learns nothing about the route.
  expect(await foreign.query(api.characters.sheetSlices.concentrationRoomRoute, input)).toBeNull()
}, 60_000)

it('refuses to end a Concentration the Character does not hold (SPELLS-5.11)', async () => {
  const { player, character, campaign, stored } = await carryConcentrationGrantOut(false)
  const sheet = await player.caller.query(api.campaigns.characterSheet.get, {
    campaignId: campaign.id,
    characterId: character.id
  })
  await expect(
    player.caller.mutation(api.campaigns.characterSheet.execute, {
      campaignId: campaign.id,
      characterId: character.id,
      command: {
        type: 'END_CONCENTRATION',
        commandId: crypto.randomUUID(),
        expectedVersion: sheet.meta.streamVersion
      }
    })
  ).rejects.toThrow()
  expect(await stored()).toHaveLength(1)
}, 60_000)

it('skips a holder an ACTIVE Run holds instead of refusing, leaving it to the room (SPELLS-5.11)', async () => {
  const fixture = await setupConcentration('PROMPT')
  const { run, actor, target, character, campaign, t } = fixture
  const casterId = crypto.randomUUID()
  await t.run(async (ctx) => {
    const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
    await store.create({
      id: crypto.randomUUID(),
      owner: { kind: 'CHARACTER', characterId: character.id },
      definition: plannedModifierGrant({
        encounterId: run.id,
        sourceActorId: actor.id,
        holderActorId: target.id,
        lifecycle: {},
        rounds: 30,
        lifetimeScope: 'OWNER'
      }).definition,
      lifecycle: {
        schemaVersion: 1,
        remainingTicks: null,
        concentrationCasterCharacterId: casterId,
        expiresAtCampaignMinute: 1440 + 480 + 3
      }
    })
  })
  const carried = () =>
    t.run(async (ctx) =>
      createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).listCarriedByCaster(
        casterId
      )
    )
  expect(await carried()).toHaveLength(1)
  // The Run is ACTIVE and holds the Character: Convex leaves its grant to the room.
  await t.run((ctx) =>
    endCarriedConcentration(ctx, {
      characterId: casterId,
      campaignId: campaign.id,
      occurredAt: new Date().toISOString(),
      endsSpellSummon: false
    })
  )
  expect(await carried()).toHaveLength(1)
}, 60_000)

it('refuses a carried grant whose caster column disagrees with its lifecycle (SPELLS-5.11)', async () => {
  const { character, t } = await carryConcentrationGrantOut(true)
  const otherCasterId = crypto.randomUUID()
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query('characterActiveRuleEffects')
      .withIndex('by_characterId_id', (q) => q.eq('characterId', character.id))
      .first()
    if (!row) throw new Error('Missing carried grant.')
    await ctx.db.patch(row._id, { concentrationCasterCharacterId: otherCasterId })
  })
  await expect(
    t.run(async (ctx) =>
      createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).listCarriedByCaster(
        otherCasterId
      )
    )
  ).rejects.toThrow()
}, 60_000)

const wornForm = (effectId: string, currentHitPoints: number) => ({
  effectId,
  excessDamageCarriesOver: true,
  sourceId: crypto.randomUUID(),
  sourceRevision: 1,
  snapshot: { kind: 'CREATURE', label: 'Giant Ape' },
  currentHitPoints,
  maxHitPoints: 157,
  tempHitPoints: 0
})

it('carries a Character’s creature form out of the Run with its hit points, and the next Run’s actor wears it again (D99, SPELLS-28.T4b)', async () => {
  const fixture = await setupConcentration('PROMPT')
  const { owner, run, actor, target, character, t } = fixture
  await owner.caller.mutation(api.campaigns.clock.initialize, {
    campaignId: fixture.campaign.id,
    commandId: crypto.randomUUID(),
    expectedVersion: 0,
    day: 2,
    minuteOfDay: 480,
    dawnMinute: 360,
    duskMinute: 1080
  })
  const characterOwner = { kind: 'CHARACTER', characterId: character.id } as const
  const effect = await t.run(async (ctx) => {
    const { definition } = plannedModifierGrant({
      encounterId: run.id,
      sourceActorId: actor.id,
      holderActorId: target.id,
      lifecycle: {},
      rounds: 30,
      lifetimeScope: 'OWNER'
    })
    const creatureForm = {
      kind: 'CREATURE_FORM' as const,
      formOutcomeId: 'form',
      creatureId: crypto.randomUUID(),
      excessDamageCarriesOver: true,
      retainedAbilityIds: []
    }
    const created = await createActiveRuleEffectStore({
      db: createConvexEncounterStore(ctx)
    }).create({
      id: crypto.randomUUID(),
      owner: characterOwner,
      definition: { ...definition, stateContributions: [creatureForm] },
      lifecycle: { schemaVersion: 1, remainingTicks: 25 }
    })
    const store = { db: createConvexEncounterStore(ctx) }
    const runRow = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!runRow) throw new Error('Missing Run.')
    const { row, actor: stored } = await readRunActorWithRow(store, readRunState(runRow), target.id)
    if (stored.kind !== 'CHARACTER') throw new Error('Expected the Character actor.')
    await writeRunActor(store, row._id, { ...stored, form: wornForm(created.id, 40) })
    return created
  })
  await attachFixtureRoom(t, fixture.campaign.id)
  const live = await owner.caller.query(api.encounters.projectionReads.get, { encounterId: run.id })
  await executeInRoom(owner.caller, {
    command: {
      type: 'COMPLETE',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: live.version
    }
  })
  await checkpointLiveRoom(fixture.campaign.id)

  const carried = await t.run(async (ctx) =>
    createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).list(characterOwner)
  )
  expect(carried.map(({ id, lifecycle }) => ({ id, lifecycle }))).toEqual([
    {
      id: effect.id,
      lifecycle: {
        schemaVersion: 1,
        remainingTicks: null,
        expiresAtCampaignMinute: 1440 + 480 + 3,
        carriedCreatureForm: expect.objectContaining({ currentHitPoints: 40, maxHitPoints: 157 })
      }
    }
  ])

  const blueprintId = await t.run(async (ctx) => {
    const runRow = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!runRow) throw new Error('Missing Run.')
    return readRunState(runRow).blueprintId
  })
  const next = await owner.caller.mutation(api.encounters.runs.create, {
    campaignId: fixture.campaign.id,
    blueprintId,
    commandId: crypto.randomUUID()
  })
  const resumed = await t.run(async (ctx) => {
    const nextRow = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', next.id))
      .unique()
    if (!nextRow) throw new Error('Missing next Run.')
    const state = readRunState(nextRow)
    const actors = await readRunActors({ db: createConvexEncounterStore(ctx) }, state)
    return actors.find((candidate) => candidate.kind === 'CHARACTER')
  })
  expect(resumed?.form).toMatchObject({
    effectId: effect.id,
    excessDamageCarriesOver: true,
    currentHitPoints: 40,
    maxHitPoints: 157
  })

  // Ending the form on the Sheet removes it with no carry-over left behind.
  await t.run(async (ctx) => {
    const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
    const [current] = await store.list(characterOwner)
    if (!current) throw new Error('Missing carried form effect.')
    await store.deleteCas({
      id: current.id,
      owner: characterOwner,
      expectedVersion: current.version,
      removal: 'ENDED'
    })
  })
  const afterSheetEnd = await t.run(async (ctx) =>
    createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).list(characterOwner)
  )
  expect(afterSheetEnd).toEqual([])
}, 60_000)
