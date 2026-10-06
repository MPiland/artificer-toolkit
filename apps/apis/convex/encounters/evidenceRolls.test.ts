import { api } from '../_generated/api'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import type {
  ResolveRuleOccurrenceInputDto,
  RollRuleEvidenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import {
  domainRejection,
  playerControlFixture,
  setActorControllers,
  storeRunAutomationMode,
  type PlayerControlFixture
} from '../../tests/fixtures/playerControl'
import {
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  RoomCommandRefusal,
  readEncounterHistory,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { setGmRollVisibility } from '../../tests/fixtures/rollPreferences'

type D20Pending = Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'D20_EVIDENCE' }>
type Caller = Pick<PlayerControlFixture['owner'], 'caller'>

/** Typed from the shared contract: the generated API predates `rollerActorId`. */
const pendingRuleOccurrence = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')

/** The pending decision Convex serves, which is current only after the room checkpoints. */
async function readPending(base: PlayerControlFixture, member: Caller) {
  await checkpointLiveRoom(base.campaign.id)
  return member.caller.query(pendingRuleOccurrence, { encounterId: base.run.id })
}

async function d20Pending(base: PlayerControlFixture, member: Caller): Promise<D20Pending> {
  const pending = await readPending(base, member)
  if (pending?.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 roll prompt.')
  return pending
}

function rollDice(
  base: PlayerControlFixture,
  member: Caller,
  pending: D20Pending,
  rollMode: RollRuleEvidenceInputDto['rollMode'] = null
) {
  return executeInRoom(member.caller, {
    command: {
      type: 'ROLL_RULE_EVIDENCE',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      requestId: pending.request.requestId,
      rollMode
    }
  })
}

function settle(
  base: PlayerControlFixture,
  member: Caller,
  pending: D20Pending,
  resolution: ResolveRuleOccurrenceInputDto['resolution']
) {
  return executeInRoom(member.caller, {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      correlationId: null,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      resolution
    }
  })
}

function evidenceRoll(result: EncounterCommandResultDto) {
  if (!result.evidenceRoll) throw new Error('Expected an app roll.')
  return result.evidenceRoll
}

describe('Encounter roll prompts', () => {
  useLocalRoomWorker()

  it('routes a creature save against a player action to the GM, who rolls twice and settles the latest roll', async () => {
    const base = await playerControlFixture({ bite: 'SAVE', promptRolls: true })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    const started = await executeInRoom(base.other.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    // The player sees the action waiting, but the enemy's save belongs to the GM.
    expect(started.occurrence).toMatchObject({ status: 'PENDING', pending: null })
    await expect(readPending(base, base.other)).resolves.toBeNull()
    const pending = await d20Pending(base, base.owner)
    expect(pending.rollerActorId).toBe(base.enemy.id)
    await expect(domainRejection(rollDice(base, base.other, pending))).resolves.toMatchObject({
      reason: 'DECISION_NOT_PENDING'
    })

    // "Roll dice" twice: each attempt is recorded and logged, and nothing settles.
    const first = await rollDice(base, base.owner, pending)
    const second = await rollDice(base, base.owner, pending)
    expect(first.occurrence).toMatchObject({ status: 'PENDING', pending })
    expect([evidenceRoll(first).attempt, evidenceRoll(second).attempt]).toEqual([1, 2])
    expect(first.roll?.source.label).toBe('Rolled by the app, attempt 1')
    expect(second.roll?.source.label).toBe('Rolled by the app, attempt 2')
    // The room holds the recorded attempts (D85); the attempt numbers it answered are asserted above.
    await expect(d20Pending(base, base.owner)).resolves.toEqual(pending)

    // Only the latest roll of this request by this responder settles it.
    for (const rollId of [evidenceRoll(first).rollId, crypto.randomUUID()])
      await expect(
        domainRejection(
          settle(base, base.owner, pending, {
            kind: 'SYSTEM_ROLL',
            requestId: pending.request.requestId,
            rollId
          })
        )
      ).resolves.toMatchObject({ reason: 'ROLL_UNAVAILABLE' })
    const settled = await settle(base, base.owner, pending, {
      kind: 'SYSTEM_ROLL',
      requestId: pending.request.requestId,
      rollId: evidenceRoll(second).rollId
    })
    expect(settled.occurrence?.status ?? 'COMPLETE').toBe('COMPLETE')
  })

  it('settles an overridden advantage app roll with both faces and labels the change', async () => {
    const base = await playerControlFixture({ bite: 'SAVE', promptRolls: true })
    await base.gm(await base.bite(base.companion.id, base.enemy.id))
    const pending = await d20Pending(base, base.owner)
    expect(pending.request.rollMode).toBe('NORMAL')
    const rolled = await rollDice(base, base.owner, pending, 'ADVANTAGE')
    const roll = evidenceRoll(rolled)
    expect(roll).toMatchObject({ rollMode: 'ADVANTAGE', derivedRollMode: 'NORMAL' })
    expect(roll.faces).toHaveLength(2)
    expect(roll.value).toBe(Math.max(...roll.faces))
    expect(rolled.roll?.source.label).toBe(
      'Rolled by the app, attempt 1 · Advantage, changed from Normal'
    )
    await settle(base, base.owner, pending, {
      kind: 'SYSTEM_ROLL',
      requestId: pending.request.requestId,
      rollId: roll.rollId
    })
  })

  it('lets the controlling player enter their own attack roll and rejects a forged face count', async () => {
    const base = await playerControlFixture({ bite: 'ATTACK', promptRolls: true })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    await executeInRoom(base.other.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    // The companion's attack roll goes to its controller; the GM may answer it too.
    const pending = await d20Pending(base, base.other)
    expect(pending.rollerActorId).toBe(base.companion.id)
    await expect(d20Pending(base, base.owner)).resolves.toEqual(pending)
    await expect(readPending(base, base.player)).resolves.toBeNull()
    await expect(
      settle(base, base.other, pending, {
        kind: 'ENTER_DICE',
        requestId: pending.request.requestId,
        rawFaces: [18],
        rollMode: 'ADVANTAGE'
      })
    ).rejects.toThrow()
    await settle(base, base.other, pending, {
      kind: 'ENTER_DICE',
      requestId: pending.request.requestId,
      rawFaces: [3, 18],
      rollMode: 'ADVANTAGE'
    })
  })

  it('raises no save prompt in a Manual Run, where a save-forcing action is refused whole', async () => {
    const base = await playerControlFixture({ bite: 'SAVE', promptRolls: true })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    // The room holds the Run; close it so the Convex write below is what the next command hydrates.
    await closeRoom(base.campaign.id)
    await storeRunAutomationMode(base.t, base.run.id, 'MANUAL')
    const stored = async () => {
      await checkpointLiveRoom(base.campaign.id)
      return base.t.run(async (ctx) => ({
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        run: await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
          .unique(),
        actors: await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
          .collect(),
        occurrences: await ctx.db
          .query('encounterRuleOccurrences')
          .withIndex('by_encounterId_state', (q) => q.eq('encounterId', base.run.id))
          .collect(),
        receipts: await (
          await readEncounterHistory(ctx)
        )
          .query('encounterRuleReceipts')
          .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', base.run.id))
          .collect()
      }))
    }
    const before = await stored()
    // Manual mode runs no rules: neither the controlling player nor the GM can start the action.
    for (const member of [base.other, base.owner])
      await expect(
        executeInRoom(member.caller, {
          command: await base.bite(base.companion.id, base.enemy.id)
        })
      ).rejects.toThrow(RoomCommandRefusal)
    expect(await stored()).toEqual(before)
    for (const member of [base.owner, base.other, base.player])
      await expect(readPending(base, member)).resolves.toBeNull()
  })

  it('rolls on the server without a prompt when the roller auto-rolls', async () => {
    const base = await playerControlFixture({ bite: 'SAVE' })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    const result = await executeInRoom(base.other.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    expect(result.occurrence?.status ?? 'COMPLETE').toBe('COMPLETE')
    await expect(readPending(base, base.owner)).resolves.toBeNull()
  })
})

describe('Action roll cards (Q14, D83)', () => {
  useLocalRoomWorker()

  /**
   * The d20 cards by default, or the damage cards: whether a random d20 hits (and so deals damage)
   * is not under test, so each test reads only the cards it asserts on.
   */
  async function rollCards(base: PlayerControlFixture, kind: 'CHECKS' | 'DAMAGE' = 'CHECKS') {
    const wanted = (roll: { source: { kind: string } }) =>
      (roll.source.kind === 'DAMAGE') === (kind === 'DAMAGE')
    await checkpointLiveRoom(base.campaign.id)
    return base.t.run(async (ctx) => ({
      table: (await ctx.db.query('campaignConversationEntryPayloads').collect()).flatMap(
        (payload) => (payload.roll && wanted(payload.roll) ? [payload.roll] : [])
      ),
      gm: (
        await ctx.db
          .query('userRollHistory')
          .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', base.owner.userId))
          .collect()
      ).filter(wanted)
    }))
  }

  /** The player's companion saves-bites the GM's enemy, so the GM-controlled enemy rolls the save. */
  async function playerBitesEnemy(base: PlayerControlFixture) {
    await setActorControllers(base, base.companion.id, [base.other.userId])
    await executeInRoom(base.other.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    return rollCards(base)
  }

  it('posts a GM creature save to the TABLE when the GM toggle is PUBLIC, whoever triggered it', async () => {
    const base = await playerControlFixture({ bite: 'SAVE' })
    const cards = await playerBitesEnemy(base)
    expect(cards.table).toEqual([
      expect.objectContaining({ source: expect.objectContaining({ kind: 'SAVING_THROW' }) })
    ])
    expect(cards.gm).toEqual([])
    // The card is the roller's, not the player's who triggered it: the enemy's controller is the GM.
    const saveAuthors = await base.t.run(async (ctx) => {
      // `rollCards` just checkpointed, so these rows are current.
      const payloads = await ctx.db.query('campaignConversationEntryPayloads').collect()
      const saveIds = payloads
        .filter((payload) => payload.roll?.source.kind === 'SAVING_THROW')
        .map((payload) => payload.entryId)
      const headers = await ctx.db.query('campaignConversationEntries').collect()
      return headers.filter((header) => saveIds.includes(header.id)).map((h) => h.authorUserId)
    })
    expect(saveAuthors).toEqual([base.owner.userId])
  })

  it("follows the GM's stored PRIVATE toggle for a player-triggered creature save, naming the creature for a later reveal", async () => {
    const base = await playerControlFixture({ bite: 'SAVE' })
    await setGmRollVisibility(base.t, base.owner.userId, 'PRIVATE')
    const cards = await playerBitesEnemy(base)
    expect(cards.table).toEqual([])
    expect(cards.gm).toEqual([
      expect.objectContaining({
        source: expect.objectContaining({ kind: 'SAVING_THROW' }),
        gmCampaignRoll: expect.objectContaining({
          creature: { encounterId: base.run.id, actorId: base.enemy.id },
          revealedAt: null,
          noticedAt: null
        })
      })
    ])
  })

  it('keeps a hidden creature save private even when the GM toggle is PUBLIC', async () => {
    const base = await playerControlFixture({ bite: 'SAVE' })
    await base.gm({
      type: 'UPDATE_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await base.version(),
      actorId: base.enemy.id,
      public: false
    })
    await executeInRoom(base.owner.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    const cards = await rollCards(base)
    expect(cards.table).toEqual([])
    expect(cards.gm).toHaveLength(1)
  })

  it.each(['hidden', 'PRIVATE toggle'] as const)(
    'keeps a %s creature hit on a player Character off the table while the player still sees the outcome (D62)',
    async (concealment) => {
      const base = await playerControlFixture({ bite: 'ATTACK' })
      if (concealment === 'PRIVATE toggle')
        await setGmRollVisibility(base.t, base.owner.userId, 'PRIVATE')
      else
        await base.gm({
          type: 'UPDATE_ACTOR',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: await base.version(),
          actorId: base.companion.id,
          public: false
        })
      const hit = await executeInRoom(base.owner.caller, {
        command: await base.bite(base.companion.id, base.character.id)
      })
      const cards = await rollCards(base)
      expect(cards.table).toEqual([])
      expect(cards.gm).toHaveLength(1)
      const playerView = await base.player.caller.query(api.encounters.projectionReads.get, {
        encounterId: base.run.id
      })
      const hitPointsOf = (projection: { actors: { id: string; currentHitPoints?: number }[] }) =>
        projection.actors.find((actor) => actor.id === base.character.id)?.currentHitPoints
      // The player sees the same damage outcome the GM does, and no roll, total or creature label.
      const viewed = playerView.actors.find((actor) => actor.id === base.character.id)
      const seen = viewed && 'health' in viewed ? viewed.health : null
      if (seen?.level !== 'EXACT') throw new Error('Expected the Character health to be shown.')
      expect(seen.current).toBe(hitPointsOf(hit.projection))
      if (concealment === 'hidden')
        expect(playerView.actors.map((actor) => actor.id)).not.toContain(base.companion.id)
      await expect(
        base.player.caller.query(pendingRuleOccurrence, { encounterId: base.run.id })
      ).resolves.toBeNull()
    }
  )

  it('posts a total-only damage card to the TABLE, as the dealer rolled it', async () => {
    const base = await playerControlFixture({ bite: 'ACTIVATED' })
    await executeInRoom(base.owner.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    const cards = await rollCards(base, 'DAMAGE')
    expect(cards.gm).toEqual([])
    expect(cards.table).toEqual([
      expect.objectContaining({
        normalizedExpression: '1',
        characterLabel: base.companion.label,
        source: expect.objectContaining({
          kind: 'DAMAGE',
          label: expect.stringContaining('damage')
        }),
        evidence: expect.objectContaining({ terms: [], total: 1 })
      })
    ])
  })

  it.each(['hidden', 'PRIVATE toggle'] as const)(
    'keeps a %s dealer damage card private, with players seeing only the outcome',
    async (concealment) => {
      const base = await playerControlFixture({ bite: 'ACTIVATED' })
      if (concealment === 'PRIVATE toggle')
        await setGmRollVisibility(base.t, base.owner.userId, 'PRIVATE')
      else
        await base.gm({
          type: 'UPDATE_ACTOR',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: await base.version(),
          actorId: base.companion.id,
          public: false
        })
      await executeInRoom(base.owner.caller, {
        command: await base.bite(base.companion.id, base.character.id)
      })
      const cards = await rollCards(base, 'DAMAGE')
      expect(cards.table).toEqual([])
      expect(cards.gm).toEqual([
        expect.objectContaining({
          source: expect.objectContaining({ kind: 'DAMAGE' }),
          gmCampaignRoll: expect.objectContaining({
            creature: { encounterId: base.run.id, actorId: base.companion.id }
          })
        })
      ])
      const playerView = await base.player.caller.query(api.encounters.projectionReads.get, {
        encounterId: base.run.id
      })
      const viewed = playerView.actors.find((actor) => actor.id === base.character.id)
      const seen = viewed && 'health' in viewed ? viewed.health : null
      if (seen?.level !== 'EXACT') throw new Error('Expected the Character health to be shown.')
      expect(seen.current).toBe(seen.maximum - 1)
    }
  )

  it("posts a player's attack to the TABLE even when the GM toggle is PRIVATE", async () => {
    const base = await playerControlFixture({ bite: 'ATTACK' })
    await setGmRollVisibility(base.t, base.owner.userId, 'PRIVATE')
    const cards = await playerBitesEnemy(base)
    expect(cards.table).toEqual([
      expect.objectContaining({ source: expect.objectContaining({ kind: 'ATTACK' }) })
    ])
    expect(cards.gm).toEqual([])
  })
})
