// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { api } from '../_generated/api'
import { activateFixtureRun, updateFixtureRunActors } from '../../tests/fixtures/activeInitiative'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { definition, descriptor, lifecycle } from '../../tests/fixtures/maintainedEffects'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'

/** A player with Aria fighting in a Run and Borin on the bench (D236). */
async function setup() {
  const base = await setupCharacterRun()
  const draft = await base.createCharacter()
  const borin = await base.player.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.draft.id,
    mode: 'create',
    character: { ...draft.character, label: 'Borin' }
  })
  await base.player.caller.mutation(api.campaigns.assignments.assign, {
    campaignId: base.campaign.id,
    characterId: borin.character.id
  })
  const target = base.run.actors.find((actor) => actor.kind !== 'CHARACTER')
  if (!target) throw new Error('Fixture enemy actor is unavailable.')
  const campaignId = base.campaign.id
  return {
    ...base,
    campaignId,
    aria: base.character.id,
    borin: borin.character.id,
    /** The enemy holds the turn, so the Character actor is between turns. */
    activate: () =>
      base.t.run((ctx) => activateFixtureRun(ctx, base.run.id, { currentActorId: target.id })),
    switchTo: (characterId: string) =>
      base.player.caller.mutation(api.campaigns.assignments.setActive, { campaignId, characterId }),
    activeOf: () =>
      base.t.run(
        async (ctx) =>
          (
            await ctx.db
              .query('campaignCharacterAssignments')
              .withIndex('by_campaignId_userId', (q) =>
                q.eq('campaignId', campaignId).eq('userId', base.player.userId)
              )
              .collect()
          ).find(({ active }) => active)?.characterId
      ),
    readRun: () =>
      base.t.run(async (ctx) => {
        const row = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
          .unique()
        if (!row) throw new Error('Fixture Encounter Run is unavailable.')
        const state = readRunState(row)
        const actors = await readRunActors({ db: createConvexEncounterStore(ctx) }, state)
        return { state, actor: actors.find(({ id }) => id === base.actor.id)! }
      }),
    requestRows: () =>
      base.t.run((ctx) =>
        ctx.db
          .query('campaignActiveCharacterRequests')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
          .collect()
      )
  }
}

async function requested() {
  const fixture = await setup()
  await fixture.activate()
  await expect(fixture.switchTo(fixture.borin)).resolves.toEqual({ status: 'REQUESTED' })
  const [request] = await fixture.requestRows()
  if (!request) throw new Error('Expected a swap request.')
  return { ...fixture, request }
}

describe('Active Character swaps (D236)', () => {
  it('swaps a PREPARED Run actor in place on a free switch, keeping its id and seat', async () => {
    const fixture = await setup()
    const before = await fixture.readRun()
    expect(before.actor.sourceId).toBe(fixture.aria)

    await expect(fixture.switchTo(fixture.borin)).resolves.toEqual({ status: 'SWITCHED' })

    expect(await fixture.activeOf()).toBe(fixture.borin)
    const after = await fixture.readRun()
    expect(after.state.actorIds).toEqual(before.state.actorIds)
    expect(after.actor).toMatchObject({
      id: fixture.actor.id,
      kind: 'CHARACTER',
      sourceId: fixture.borin,
      label: 'Borin',
      sideId: before.actor.sideId,
      frozenState: null
    })
    expect(await fixture.requestRows()).toEqual([])
  })

  it('asks the GM while the Active Character fights, and replaces an earlier ask', async () => {
    const fixture = await requested()
    expect(await fixture.activeOf()).toBe(fixture.aria)
    expect((await fixture.readRun()).actor.sourceId).toBe(fixture.aria)
    const dto = {
      id: fixture.request.id,
      campaignId: fixture.campaignId,
      userId: fixture.player.userId,
      fromCharacterId: fixture.aria,
      fromCharacterName: 'Aria',
      toCharacterId: fixture.borin,
      toCharacterName: 'Borin',
      encounterId: fixture.run.id,
      requestedAt: fixture.request.requestedAt
    }
    await expect(
      fixture.player.caller.query(api.campaigns.activeCharacterRequests.mine, {
        campaignId: fixture.campaignId
      })
    ).resolves.toEqual(dto)
    await expect(
      fixture.owner.caller.query(api.campaigns.activeCharacterRequests.list, {
        campaignId: fixture.campaignId
      })
    ).resolves.toEqual([dto])
    await expect(
      fixture.player.caller.query(api.campaigns.activeCharacterRequests.list, {
        campaignId: fixture.campaignId
      })
    ).rejects.toThrow()

    await expect(fixture.switchTo(fixture.borin)).resolves.toEqual({ status: 'REQUESTED' })
    const rows = await fixture.requestRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).not.toBe(fixture.request.id)
  })

  it('switches and swaps the fighting actor in place when the GM approves', async () => {
    const fixture = await requested()
    const before = await fixture.readRun()

    await fixture.owner.caller.mutation(api.campaigns.activeCharacterRequests.approve, {
      campaignId: fixture.campaignId,
      requestId: fixture.request.id
    })

    expect(await fixture.activeOf()).toBe(fixture.borin)
    expect(await fixture.requestRows()).toEqual([])
    const after = await fixture.readRun()
    expect(after.state.actorIds).toEqual(before.state.actorIds)
    expect(after.state.currentActorId).toBe(before.state.currentActorId)
    expect(after.actor).toMatchObject({
      id: fixture.actor.id,
      sourceId: fixture.borin,
      label: 'Borin'
    })
  })

  it("ends the old Character's Run effects and Concentration when its actor is swapped", async () => {
    const fixture = await requested()
    const target = fixture.run.actors.find((actor) => actor.kind !== 'CHARACTER')!
    await fixture.t.run(async (ctx) => {
      const effects = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
      const stateId = crypto.randomUUID()
      await effects.createMaintainedState({
        id: stateId,
        encounterId: fixture.run.id,
        ownerActorId: fixture.actor.id,
        descriptor: descriptor(fixture.actor.id, 'TERMINATE_WHEN_EMPTY')
      })
      await effects.create({
        id: crypto.randomUUID(),
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId: fixture.run.id, targetActorId: target.id },
        definition: definition(fixture.run.id, fixture.actor.id),
        lifecycle,
        maintainedEffectStateId: stateId
      })
      await effects.create({
        id: crypto.randomUUID(),
        owner: { kind: 'CHARACTER', characterId: fixture.aria },
        definition: definition(fixture.run.id, target.id),
        lifecycle
      })
    })
    const effectRows = () =>
      fixture.t.run(async (ctx) => ({
        states: await ctx.db
          .query('encounterMaintainedEffectStates')
          .withIndex('by_encounter_owner_definition_order', (q) =>
            q.eq('encounterId', fixture.run.id)
          )
          .collect(),
        actorEffects: await ctx.db
          .query('encounterActiveRuleEffects')
          .withIndex('by_encounterId_targetActorId_id', (q) => q.eq('encounterId', fixture.run.id))
          .collect(),
        ariaEffects: await ctx.db
          .query('characterActiveRuleEffects')
          .withIndex('by_characterId_createdOrdinal_id', (q) => q.eq('characterId', fixture.aria))
          .collect()
      }))
    expect(await effectRows()).toMatchObject({
      states: [expect.anything()],
      actorEffects: [expect.anything()],
      ariaEffects: [expect.anything()]
    })

    await fixture.owner.caller.mutation(api.campaigns.activeCharacterRequests.approve, {
      campaignId: fixture.campaignId,
      requestId: fixture.request.id
    })

    expect(await effectRows()).toEqual({ states: [], actorEffects: [], ariaEffects: [] })
  })

  it('refuses an approval the player can no longer take, and lets only the GM approve', async () => {
    const fixture = await requested()
    const input = { campaignId: fixture.campaignId, requestId: fixture.request.id }
    await expect(
      fixture.player.caller.mutation(api.campaigns.activeCharacterRequests.approve, input)
    ).rejects.toThrow()
    // Drift the request cleanup cannot see: the Characters changed places behind it.
    await fixture.t.run(async (ctx) => {
      for (const row of await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', fixture.campaignId).eq('userId', fixture.player.userId)
        )
        .collect())
        await ctx.db.patch(row._id, { active: row.characterId === fixture.borin })
    })
    await expect(
      fixture.owner.caller.mutation(api.campaigns.activeCharacterRequests.approve, input)
    ).rejects.toThrow('The request no longer matches the Characters at the table.')
    expect(await fixture.requestRows()).toHaveLength(1)
  })

  it('leaves the Characters as they were when the GM declines', async () => {
    const fixture = await requested()
    await fixture.owner.caller.mutation(api.campaigns.activeCharacterRequests.decline, {
      campaignId: fixture.campaignId,
      requestId: fixture.request.id
    })
    expect(await fixture.requestRows()).toEqual([])
    expect(await fixture.activeOf()).toBe(fixture.aria)
    expect((await fixture.readRun()).actor.sourceId).toBe(fixture.aria)
    await expect(
      fixture.owner.caller.mutation(api.campaigns.activeCharacterRequests.decline, {
        campaignId: fixture.campaignId,
        requestId: fixture.request.id
      })
    ).rejects.toThrow('The request was already settled.')
  })

  it('lets the player cancel their own request', async () => {
    const fixture = await requested()
    await fixture.player.caller.mutation(api.campaigns.activeCharacterRequests.cancel, {
      campaignId: fixture.campaignId
    })
    expect(await fixture.requestRows()).toEqual([])
    await expect(
      fixture.player.caller.query(api.campaigns.activeCharacterRequests.mine, {
        campaignId: fixture.campaignId
      })
    ).resolves.toBeNull()
    expect(await fixture.activeOf()).toBe(fixture.aria)
  })

  it('drops the request when either Character leaves the Campaign', async () => {
    const fixture = await requested()
    await fixture.player.caller.mutation(api.campaigns.assignments.unassign, {
      campaignId: fixture.campaignId,
      characterId: fixture.borin
    })
    expect(await fixture.requestRows()).toEqual([])
  })

  it.each([
    ['taken out of initiative by the GM', { absence: 'GM_REMOVED' as const }],
    [
      'frozen',
      {
        frozenState: {
          currentHitPoints: 5,
          maxHitPoints: 10,
          tempHitPoints: 0,
          conditions: [],
          deathSaves: { successes: 0, failures: 0, stable: false }
        }
      }
    ]
  ])('switches freely while the Active Character is %s', async (_case, patch) => {
    const fixture = await setup()
    await fixture.activate()
    await fixture.t.run((ctx) =>
      updateFixtureRunActors(ctx, fixture.run.id, (actor) =>
        actor.id === fixture.actor.id ? { ...actor, ...patch } : actor
      )
    )
    await expect(fixture.switchTo(fixture.borin)).resolves.toEqual({ status: 'SWITCHED' })
    expect(await fixture.activeOf()).toBe(fixture.borin)
    expect(await fixture.requestRows()).toEqual([])
  })
})
