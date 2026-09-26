import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  EncounterCommandResultDto,
  EncounterEvidenceRollDto
} from '@artificer-toolkit/schema/api/encounterData'
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
import { executeInRoom } from '../../tests/fixtures/liveSessionWorker'
import { LiveSessionRouteError } from '../../../session-worker/src/liveSessionRoutes'

type D20Pending = Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'D20_EVIDENCE' }>
type Caller = Pick<PlayerControlFixture['owner'], 'caller'>

const latestRolls = makeFunctionReference<
  'query',
  { encounterId: string },
  EncounterEvidenceRollDto[]
>('encounters/evidenceRolls:latest')

/** Typed from the shared contract: the generated API predates `rollerActorId`. */
const pendingRuleOccurrence = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')

function readPending(base: PlayerControlFixture, member: Caller) {
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

/** Every stored d20 evidence record (it carries both roll modes) in the Run's rule receipts. */
async function storedD20Evidence(base: PlayerControlFixture) {
  const receipts = await base.t.run((ctx) =>
    ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', base.run.id))
      .collect()
  )
  // Phase receipts repeat earlier evidence, so each request is reported once.
  const found = new Map<unknown, Record<string, unknown>>()
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      if ('derivedRollMode' in record && 'rawFaces' in record) found.set(record.requestId, record)
      else Object.values(record).forEach(visit)
    }
  }
  for (const receipt of receipts) visit(JSON.parse(receipt.resultJson))
  return [...found.values()]
}

describe('Encounter roll prompts', () => {
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
    await expect(
      base.owner.caller.query(latestRolls, { encounterId: base.run.id })
    ).resolves.toEqual([evidenceRoll(second)])
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
    expect(await storedD20Evidence(base)).toEqual([
      expect.objectContaining({
        requestId: pending.request.requestId,
        rawFaces: evidenceRoll(second).faces,
        rollMode: pending.request.rollMode,
        derivedRollMode: pending.request.rollMode
      })
    ])
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
    expect(await storedD20Evidence(base)).toEqual([
      expect.objectContaining({
        rawFaces: roll.faces,
        selectedNatural: roll.value,
        rollMode: 'ADVANTAGE',
        derivedRollMode: 'NORMAL'
      })
    ])
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
    expect(await storedD20Evidence(base)).toEqual([
      expect.objectContaining({
        rawFaces: [3, 18],
        selectedNatural: 18,
        rollMode: 'ADVANTAGE',
        derivedRollMode: 'NORMAL'
      })
    ])
  })

  it('raises no save prompt in a Manual Run, where a save-forcing action is refused whole', async () => {
    const base = await playerControlFixture({ bite: 'SAVE', promptRolls: true })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    await storeRunAutomationMode(base.t, base.run.id, 'MANUAL')
    const stored = () =>
      base.t.run(async (ctx) => ({
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
        receipts: await ctx.db
          .query('encounterRuleReceipts')
          .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', base.run.id))
          .collect()
      }))
    const before = await stored()
    // Manual mode runs no rules: neither the controlling player nor the GM can start the action.
    for (const member of [base.other, base.owner])
      await expect(
        executeInRoom(member.caller, {
          command: await base.bite(base.companion.id, base.enemy.id)
        })
      ).rejects.toThrow(LiveSessionRouteError)
    expect(await stored()).toEqual(before)
    for (const member of [base.owner, base.other, base.player])
      await expect(readPending(base, member)).resolves.toBeNull()
    expect(await storedD20Evidence(base)).toEqual([])
  })

  it('rolls on the server without a prompt when the roller auto-rolls', async () => {
    const base = await playerControlFixture({ bite: 'SAVE' })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    const result = await executeInRoom(base.other.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    expect(result.occurrence?.status ?? 'COMPLETE').toBe('COMPLETE')
    await expect(readPending(base, base.owner)).resolves.toBeNull()
    expect(await storedD20Evidence(base)).toEqual([
      expect.objectContaining({ rollMode: 'NORMAL', derivedRollMode: 'NORMAL' })
    ])
  })
})
