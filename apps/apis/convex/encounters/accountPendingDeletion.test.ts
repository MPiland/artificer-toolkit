import { describe, expect, it } from 'vitest'
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  initiativeDeclarationSelectionDtoSchema,
  pendingEncounterRuleOccurrenceSummaryDtoSchema,
  type EncounterExecuteInput,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/api/encounters'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { api, internal } from '../_generated/api'
import {
  automaticChargedCreature,
  automaticChargedCreatureId
} from '../../tests/fixtures/encounterAction'
import { importedSubject } from '../../tests/fixtures/publication'
import {
  seedTurnSaveEffect,
  turnCharacterEffectFixture
} from '../../tests/fixtures/turnActiveEffectFixtures'
import { removeAccountCharacterActors } from './actorRemovalCommand'

type Fixture = Awaited<ReturnType<typeof turnCharacterEffectFixture>>

async function capture(base: Fixture) {
  return base.t.run(async (ctx) => ({
    runs: await ctx.db.query('encounterRuns').collect(),
    actors: await ctx.db.query('encounterRunActors').collect(),
    rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
    participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
    sides: await ctx.db.query('encounterInitiativeSides').collect(),
    commands: await ctx.db.query('encounterRunCommands').collect(),
    occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
    receipts: await ctx.db.query('encounterRuleReceipts').collect(),
    bindings: await ctx.db.query('encounterActorTokenBindings').collect(),
    effects: await ctx.db.query('encounterActiveRuleEffects').collect(),
    characterEffects: await ctx.db.query('characterActiveRuleEffects').collect(),
    states: await ctx.db.query('encounterMaintainedEffectStates').collect()
  }))
}

function initiativeDeclarationResolution(
  pending: Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'INITIATIVE_DECLARATION' }>
) {
  const option = pending.primaryOptions[0]
  if (!option) throw new Error('Expected an initiative declaration option.')
  return {
    kind: 'INITIATIVE_DECLARATION' as const,
    requestId: pending.requestId,
    primary: initiativeDeclarationSelectionDtoSchema.parse(
      option.kind === 'GM_ADJUDICATED'
        ? {
            kind: 'GM_ADJUDICATED',
            optionId: 'GM_ADJUDICATED',
            actorSize: 'MEDIUM',
            actionFactors: [],
            spellLevel: null
          }
        : { kind: option.kind, optionId: option.optionId }
    ),
    bonus: null
  }
}

async function preparePendingDeletion() {
  const fixture = await turnCharacterEffectFixture()
  await fixture.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({
        ...automaticChargedCreature,
        subjectKind: 'CREATURE',
        document: automaticChargedCreature
      })
    ]
  })
  const reinforced = await fixture.owner.caller.mutation(internal.encounters.commands.execute, {
    command: {
      type: 'REINFORCE',
      encounterId: fixture.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: fixture.run.version,
      enemy: { kind: 'CREATURE', sourceId: automaticChargedCreatureId },
      public: false
    }
  })
  const base = { ...fixture, run: encounterGmProjectionDtoSchema.parse(reinforced.projection) }
  const actor = base.run.actors.find((entry) => entry.kind === 'CHARACTER')
  const other = base.run.actors.find((entry) => entry.sourceId === automaticChargedCreatureId)
  if (!actor || actor.kind !== 'CHARACTER' || !other)
    throw new Error('Expected deleting Character and other pending actor fixtures.')
  await base.t.run(async (ctx) => {
    const rows = await ctx.db
      .query('encounterRuns')
      .withIndex('by_campaignId_status', (q) => q.eq('campaignId', base.campaign.id))
      .collect()
    for (const row of rows)
      if (row.id !== base.run.id) await ctx.db.patch(row._id, { status: 'COMPLETED' })
  })
  let effect: Awaited<ReturnType<typeof seedTurnSaveEffect>> | null = null
  const start = {
    type: 'START' as const,
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: base.run.version
  }
  const continueStart = async () =>
    encounterCommandResultDtoSchema.parse(
      await base.owner.caller.mutation(internal.encounters.commands.execute, { command: start })
    )
  let current = await continueStart()

  for (let step = 0; step < 16; step += 1) {
    const occurrence = current.occurrence
    const pending = occurrence?.pending
    if (!occurrence || !pending) {
      if (
        current.projection.status !== 'ACTIVE' ||
        (current.projection.currentActorId !== actor.id &&
          current.projection.currentActorId !== other.id)
      )
        throw new Error(
          `Expected an active fixture turn before the Creature turn-save (step ${step}, status ${current.projection.status}, current actor ${current.projection.currentActorId ?? 'none'}, occurrence ${occurrence?.status ?? 'none'}).`
        )
      if (current.projection.currentActorId === other.id) {
        if (effect) throw new Error('The seeded Creature end-turn save did not pause.')
        effect = await seedTurnSaveEffect(
          {
            ...base,
            run: {
              ...base.run,
              actors: [other, ...base.run.actors.filter((entry) => entry.id !== other.id)]
            }
          },
          { stage: 'END_OF_TURN', ticks: 1, damage: 1 }
        )
      }
      current = encounterCommandResultDtoSchema.parse(
        await base.owner.caller.mutation(internal.encounters.commands.execute, {
          command: {
            type: 'ADVANCE_TURN',
            encounterId: base.run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: current.projection.version
          }
        })
      )
      continue
    }

    if (pending.kind === 'D20_EVIDENCE') {
      if (!effect) throw new Error('Expected the already-active Creature end-turn save.')
      expect(current.projection.status).toBe('ACTIVE')
      expect(current.projection.currentActorId).toBe(other.id)
      return { base, actor, other, effect, pending: current }
    }

    if (pending.kind === 'INITIATIVE_DECLARATION') {
      if (pending.actorId === other.id) {
        current = encounterCommandResultDtoSchema.parse(
          await base.owner.caller.mutation(internal.encounters.commands.execute, {
            command: {
              type: 'RESOLVE_RULE_OCCURRENCE',
              encounterId: base.run.id,
              commandId: crypto.randomUUID(),
              expectedVersion: pending.encounterVersion,
              occurrenceId: pending.occurrenceId,
              expectedOccurrenceVersion: pending.occurrenceVersion,
              correlationId: null,
              resolution: initiativeDeclarationResolution(pending)
            }
          })
        )
        if (!current.occurrence?.pending) current = await continueStart()
        continue
      }

      if (pending.actorId === actor.id) {
        const declaration = await base.player.caller.query(
          api.encounters.pendingReads.pendingRuleOccurrence,
          {
            encounterId: base.run.id
          }
        )
        const playerDeclaration =
          declaration === null
            ? null
            : pendingEncounterRuleOccurrenceSummaryDtoSchema.parse(declaration)
        expect(playerDeclaration?.kind).toBe('INITIATIVE_DECLARATION')
        if (!playerDeclaration || playerDeclaration.kind !== 'INITIATIVE_DECLARATION')
          throw new Error('Expected the public Character initiative declaration.')
        expect(playerDeclaration.actorId).toBe(actor.id)

        await base.player.caller.action(internal.encounters.commandActions.execute, {
          command: {
            type: 'RESOLVE_RULE_OCCURRENCE',
            encounterId: base.run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: playerDeclaration.encounterVersion,
            occurrenceId: playerDeclaration.occurrenceId,
            expectedOccurrenceVersion: playerDeclaration.occurrenceVersion,
            correlationId: null,
            resolution: initiativeDeclarationResolution(playerDeclaration)
          }
        })
        current = await continueStart()
        continue
      }

      throw new Error(`Unexpected initiative declaration actor ${pending.actorId}`)
    }

    if (pending.kind === 'INITIATIVE_EVIDENCE') {
      current = encounterCommandResultDtoSchema.parse(
        await base.owner.caller.mutation(internal.encounters.commands.execute, {
          command: {
            type: 'RESOLVE_RULE_OCCURRENCE',
            encounterId: base.run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: pending.encounterVersion,
            occurrenceId: pending.occurrenceId,
            expectedOccurrenceVersion: pending.occurrenceVersion,
            correlationId: null,
            resolution: {
              kind: 'ENTER_INTEGER',
              requestId: pending.request.requestId,
              value: pending.request.max
            }
          }
        })
      )
      continue
    }

    if (pending.kind === 'INITIATIVE_ORDER') {
      expect(pending.optionIds).toContain(other.id)
      current = encounterCommandResultDtoSchema.parse(
        await base.owner.caller.mutation(internal.encounters.commands.execute, {
          command: {
            type: 'RESOLVE_RULE_OCCURRENCE',
            encounterId: base.run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: pending.encounterVersion,
            occurrenceId: pending.occurrenceId,
            expectedOccurrenceVersion: pending.occurrenceVersion,
            correlationId: null,
            resolution: {
              kind: 'INITIATIVE_ENTITY',
              requestId: pending.requestId,
              entityId: other.id
            }
          }
        })
      )
      continue
    }

    throw new Error(`Unexpected pending occurrence ${pending.kind}`)
  }

  throw new Error('Initiative did not reach the other Creature turn-save occurrence.')
}

describe('trusted account cleanup during another actor pending turn effect', () => {
  it('closes a valid public non-initiative pending occurrence and rolls back atomically', async () => {
    const prepared = await preparePendingDeletion()
    const { base, actor, other, effect, pending } = prepared
    const before = await capture(base)
    const pendingOccurrence = before.occurrences.find(
      (occurrence) => occurrence.id === pending.occurrence!.occurrenceId
    )
    if (!pendingOccurrence) throw new Error('Expected stored pending occurrence.')
    const remove: EncounterExecuteInput = {
      command: {
        type: 'REMOVE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: pending.projection.version,
        actorId: actor.id
      }
    }
    await expect(
      base.owner.caller.mutation(internal.encounters.commands.execute, remove)
    ).rejects.toThrow('Resolve the pending Encounter occurrence')
    expect(await capture(base)).toEqual(before)

    await base.t.run((ctx) =>
      removeAccountCharacterActors(ctx, base.campaign.id, base.player.userId)
    )
    const after = await capture(base)
    const completed = after.occurrences.find((occurrence) => occurrence.id === pendingOccurrence.id)
    if (!completed) throw new Error('Expected maintenance-completed occurrence.')
    expect(completed).toMatchObject({
      state: 'COMPLETED',
      version: pendingOccurrence.version + 1,
      expectedEncounterVersion: pending.projection.version + 1,
      pendingSnapshotJson: null,
      pendingSnapshotChecksum: null
    })
    expect(after.occurrences.some((occurrence) => occurrence.state === 'PENDING')).toBe(false)
    expect(after.actors.some((entry) => entry.id === actor.id)).toBe(false)
    expect(after.actors.some((entry) => entry.id === other.id)).toBe(true)
    expect(after.effects.some((entry) => entry.id === effect.id)).toBe(true)
    expect(after.commands).toEqual(expect.arrayContaining(before.commands))
    expect(after.receipts).toEqual(expect.arrayContaining(before.receipts))
    const receipt = after.receipts.find(
      (entry) => entry.occurrenceId === completed.id && entry.commandType === 'REMOVE_ACTOR'
    )
    const command = after.commands.find(
      (entry) => entry.commandType === 'REMOVE_ACTOR' && entry.ruleOccurrenceId === completed.id
    )
    expect(receipt).toMatchObject({ actorUserId: base.player.userId })
    expect(command).toMatchObject({ actorUserId: base.player.userId })
    expect(JSON.parse(receipt?.resultJson ?? 'null')).toMatchObject({
      status: 'MAINTENANCE_COMPLETE',
      occurrenceId: completed.id,
      occurrenceVersion: completed.version,
      removedActorId: actor.id,
      reason: 'ACTOR_REMOVED'
    })

    const rollback = await preparePendingDeletion()
    const rollbackBefore = await capture(rollback.base)
    await expect(
      rollback.base.t.run(async (ctx) => {
        await removeAccountCharacterActors(
          ctx,
          rollback.base.campaign.id,
          rollback.base.player.userId
        )
        throw new Error('Abort after trusted pending cleanup')
      })
    ).rejects.toThrow('Abort after trusted pending cleanup')
    expect(await capture(rollback.base)).toEqual(rollbackBefore)
  }, 30000)
})
