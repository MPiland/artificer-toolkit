import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterCommandResultDto,
  EncounterGmProjectionDto,
  EncounterExecuteInput
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterPlayerProjectionDtoSchema,
  initiativeDeclarationSelectionDtoSchema,
  type PendingEncounterRuleOccurrenceSummaryDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  CampaignPlaySettingsDto,
  SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import { api, components, internal } from '../_generated/api'
import { fixture } from '../../tests/fixtures/characters'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { equipAllCharacterItems, setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import {
  automaticChargedBiteEffectId,
  automaticChargedBiteFeatureId,
  automaticChargedCreature,
  automaticChargedCreatureId
} from '../../tests/fixtures/encounterAction'
import { importedSubject } from '../../tests/fixtures/publication'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  liveSessionEncounterTurnPendingInputSchema,
  type LiveSessionEncounterTurnCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import { liveSessionEncounterRulesInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  createPlatformRulesRuntime,
  deriveRulesContinuationKey
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { planNativeLiveEncounterTurn } from '../../../session-worker/src/nativeEncounterTurn'
import { callLiveSessionRoute } from '../../../session-worker/src/liveSessionRoutes'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createBlueprint = makeFunctionReference<
  'mutation',
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:create')
const createRun = makeFunctionReference<
  'mutation',
  CreateEncounterInputDto,
  EncounterGmProjectionDto
>('encounters/runs:create')
const getSettings = makeFunctionReference<'query', { campaignId: string }, CampaignPlaySettingsDto>(
  'campaigns/playSettings:get'
)
const saveSettings = makeFunctionReference<
  'mutation',
  SaveCampaignPlaySettingsInput,
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')
const commitPrivateTurn = makeFunctionReference<
  'mutation',
  LiveSessionEncounterTurnCommitInput,
  EncounterCommandResultDto
>('liveSessions/encounterTurnCommit:commit')

async function setup(
  options: {
    cadence?: 'ENCOUNTER_START' | 'EACH_ROUND'
    automationMode?: 'AUTOMATIC' | 'ASSISTED'
  } = {}
) {
  const base = await fixture()
  const initiative = createEncounterInitiativeDefinitions([
    { procedure: 'DECLARED_ACTION_ROLL', cadence: options.cadence ?? 'ENCOUNTER_START' }
  ])
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: initiative.definitions
  })
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Initiative declaration fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const settings = await base.owner.caller.query(getSettings, { campaignId: campaign.id })
  const policyId = initiative.policyIds[0]!
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await base.owner.caller.mutation(saveSettings, {
    ...fields,
    expectedVersion: version,
    automationMode: options.automationMode ?? 'AUTOMATIC',
    manualReminderMode: 'OFF',
    initiativePolicyDefinitionId: policyId,
    initiativeTieDefinitionId: null
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Declaration fixture',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CUSTOM', label: 'First', maxHitPoints: 10 },
      { kind: 'CUSTOM', label: 'Second', maxHitPoints: 10 }
    ]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  return { ...base, campaign, run }
}

function declarationCommand(input: {
  encounterId: string
  pending: Pick<
    Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'INITIATIVE_DECLARATION' }>,
    'encounterVersion' | 'occurrenceId' | 'occurrenceVersion' | 'primaryOptions' | 'requestId'
  >
  commandId?: string
}): { command: ResolveRuleOccurrenceInputDto } {
  const option = input.pending.primaryOptions[0]
  if (!option) throw new Error('Expected an issued declaration option.')
  const primary = initiativeDeclarationSelectionDtoSchema.parse(
    option.kind === 'GM_ADJUDICATED'
      ? {
          kind: 'GM_ADJUDICATED',
          optionId: 'GM_ADJUDICATED',
          actorSize: 'MEDIUM',
          actionFactors: [],
          spellLevel: null
        }
      : { kind: option.kind, optionId: option.optionId }
  )
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: input.encounterId,
      commandId: input.commandId ?? crypto.randomUUID(),
      expectedVersion: input.pending.encounterVersion,
      occurrenceId: input.pending.occurrenceId,
      expectedOccurrenceVersion: input.pending.occurrenceVersion,
      correlationId: null,
      resolution: {
        kind: 'INITIATIVE_DECLARATION',
        requestId: input.pending.requestId,
        primary,
        bonus: null
      }
    }
  }
}

async function storedInitiative<T extends { t: Awaited<ReturnType<typeof fixture>>['t'] }>(
  base: T
) {
  return base.t.run(async (ctx) => ({
    rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
    participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
    runs: await ctx.db.query('encounterRuns').collect(),
    actors: await ctx.db.query('encounterRunActors').collect(),
    commands: await ctx.db.query('encounterRunCommands').collect(),
    occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
    receipts: await ctx.db.query('encounterRuleReceipts').collect()
  }))
}

describe('native initiative declarations', () => {
  it('collects each automatic declaration, then settles exactly one Run, round, and order', async () => {
    const base = await setup()
    const start: EncounterExecuteInput = {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    }
    const pending = await base.owner.caller.mutation(api.encounters.commands.execute, start)
    if (
      !pending.occurrence?.pending ||
      pending.occurrence.pending.kind !== 'INITIATIVE_DECLARATION'
    )
      throw new Error('Expected first declaration.')
    await expect(
      base.owner.caller.mutation(api.encounters.commands.execute, start)
    ).resolves.toEqual(pending)
    expect(await storedInitiative(base)).toMatchObject({
      rounds: [],
      participants: [],
      receipts: [],
      commands: expect.any(Array)
    })
    const first = declarationCommand({
      encounterId: base.run.id,
      pending: pending.occurrence.pending
    })
    const continued = await base.owner.caller.mutation(api.encounters.commands.execute, first)
    await expect(
      base.owner.caller.mutation(api.encounters.commands.execute, first)
    ).resolves.toEqual(continued)
    if (
      !continued.occurrence?.pending ||
      continued.occurrence.pending.kind !== 'INITIATIVE_DECLARATION'
    )
      throw new Error('Expected second declaration.')
    expect(await storedInitiative(base)).toMatchObject({
      rounds: [],
      participants: [],
      receipts: [],
      commands: expect.any(Array)
    })
    const terminal = declarationCommand({
      encounterId: base.run.id,
      pending: continued.occurrence.pending
    })
    const beforeTerminal = await storedInitiative(base)
    await expect(
      base.owner.caller.run(async (ctx) => {
        await ctx.runMutation(api.encounters.commands.execute, terminal)
        throw new Error('rollback declaration terminal')
      })
    ).rejects.toThrow('rollback declaration terminal')
    expect(await storedInitiative(base)).toEqual(beforeTerminal)
    const settled = await base.owner.caller.mutation(api.encounters.commands.execute, terminal)
    await expect(
      base.owner.caller.mutation(api.encounters.commands.execute, terminal)
    ).resolves.toEqual(settled)
    await expect(
      base.owner.caller.mutation(api.encounters.commands.execute, first)
    ).resolves.toEqual(settled)
    await expect(
      base.owner.caller.mutation(api.encounters.commands.execute, start)
    ).resolves.toEqual(settled)
    expect(settled).toMatchObject({
      projection: { status: 'ACTIVE', round: 1, currentActorId: expect.any(String) },
      occurrence: { status: 'COMPLETE', pending: null }
    })
    const stored = await storedInitiative(base)
    expect(stored.rounds).toHaveLength(1)
    expect(stored.participants).toHaveLength(2)
    expect(stored.receipts).toHaveLength(1)
    expect(stored.commands.filter((command) => command.commandType === 'START')).toHaveLength(1)
  }, 30000)

  it('settles Assisted declarations through score evidence and GM order', async () => {
    const base = await setup({ automationMode: 'ASSISTED' })
    let result = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    for (let steps = 0; result.occurrence?.status === 'PENDING'; steps += 1) {
      expect(steps).toBeLessThan(12)
      const pending = result.occurrence.pending
      if (!pending) throw new Error('Missing Assisted initiative request.')
      const resolution =
        pending.kind === 'INITIATIVE_DECLARATION'
          ? declarationCommand({ encounterId: base.run.id, pending }).command.resolution
          : pending.kind === 'INITIATIVE_EVIDENCE'
            ? { kind: 'ENTER_INTEGER' as const, requestId: pending.request.requestId, value: 12 }
            : pending.kind === 'INITIATIVE_ORDER'
              ? {
                  kind: 'INITIATIVE_ENTITY' as const,
                  requestId: pending.requestId,
                  entityId: pending.optionIds[0]!
                }
              : null
      if (!resolution) throw new Error('Unexpected Assisted initiative request.')
      result = await base.owner.caller.mutation(api.encounters.commands.execute, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: pending.encounterVersion,
          occurrenceId: pending.occurrenceId,
          expectedOccurrenceVersion: pending.occurrenceVersion,
          correlationId: null,
          resolution
        }
      })
    }
    expect(result).toMatchObject({
      projection: { status: 'ACTIVE', round: 1 },
      occurrence: { status: 'COMPLETE' }
    })
    expect((await storedInitiative(base)).rounds).toHaveLength(1)
  }, 30000)

  it('reissues declarations when EACH_ROUND wraps', async () => {
    const base = await setup({ cadence: 'EACH_ROUND' })
    let result = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    for (let index = 0; index < 2; index += 1) {
      if (
        !result.occurrence?.pending ||
        result.occurrence.pending.kind !== 'INITIATIVE_DECLARATION'
      )
        throw new Error('Expected declaration.')
      result = await base.owner.caller.mutation(
        api.encounters.commands.execute,
        declarationCommand({ encounterId: base.run.id, pending: result.occurrence.pending })
      )
    }
    expect(result.projection).toMatchObject({ status: 'ACTIVE', round: 1 })
    const next = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: result.projection.version
      }
    })
    const turn = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: next.projection.version
      }
    })
    expect(turn.occurrence?.pending?.kind).toBe('INITIATIVE_DECLARATION')
    expect((await storedInitiative(base)).rounds).toHaveLength(1)
    if (!turn.occurrence?.pending || turn.occurrence.pending.kind !== 'INITIATIVE_DECLARATION')
      throw new Error('Expected second-round declaration.')
    const beforeRound = await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterInitiativeRounds')
        .withIndex('by_encounterId_round', (q) => q.eq('encounterId', base.run.id).eq('round', 1))
        .unique()
      if (!row) throw new Error('Expected current initiative round.')
      await ctx.db.patch(row._id, { version: row.version + 1 })
      return row
    })
    const changedRound = await storedInitiative(base)
    await expect(
      base.owner.caller.mutation(
        api.encounters.commands.execute,
        declarationCommand({ encounterId: base.run.id, pending: turn.occurrence.pending })
      )
    ).rejects.toThrow()
    expect(await storedInitiative(base)).toEqual(changedRound)
    await base.t.run((ctx) => ctx.db.patch(beforeRound._id, { version: beforeRound.version }))
    const nextRoundFirst = await base.owner.caller.mutation(
      api.encounters.commands.execute,
      declarationCommand({ encounterId: base.run.id, pending: turn.occurrence.pending })
    )
    if (
      !nextRoundFirst.occurrence?.pending ||
      nextRoundFirst.occurrence.pending.kind !== 'INITIATIVE_DECLARATION'
    )
      throw new Error('Expected second second-round declaration.')
    const secondRound = await base.owner.caller.mutation(
      api.encounters.commands.execute,
      declarationCommand({ encounterId: base.run.id, pending: nextRoundFirst.occurrence.pending })
    )
    expect(secondRound.projection).toMatchObject({ status: 'ACTIVE', round: 2 })
    expect((await storedInitiative(base)).rounds).toHaveLength(2)
  }, 30000)

  it('refuses a declaration whose staged Run binding was tampered with', async () => {
    const base = await setup()
    await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    await base.t.run(async (ctx) => {
      const occurrence = await ctx.db.query('encounterRuleOccurrences').unique()
      if (!occurrence?.pendingSnapshotJson) throw new Error('Expected declaration occurrence.')
      const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(
        JSON.parse(occurrence.pendingSnapshotJson)
      )
      if (snapshot.applicationContext.kind !== 'ENCOUNTER_INITIATIVE_DECLARATION')
        throw new Error('Expected declaration context.')
      const root = snapshot.applicationContext.root
      const stagedInitiativeRoundState = {
        ...root.stagedInitiativeRoundState,
        round: { ...root.stagedInitiativeRoundState.round, encounterId: crypto.randomUUID() }
      }
      const tampered = {
        ...snapshot,
        applicationContext: {
          ...snapshot.applicationContext,
          root: { ...root, stagedInitiativeRoundState }
        }
      }
      await ctx.db.patch(occurrence._id, {
        pendingSnapshotJson: JSON.stringify(tampered),
        pendingSnapshotChecksum: checksumCanonicalJson(tampered)
      })
    })
    await expect(
      base.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).rejects.toThrow()
  }, 30000)

  it('refuses a changed actor cohort before accepting another declaration', async () => {
    const base = await setup()
    const result = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    const pending = result.occurrence?.pending
    if (pending?.kind !== 'INITIATIVE_DECLARATION') throw new Error('Expected declaration.')
    await base.t.run(async (ctx) => {
      const occurrence = await ctx.db.query('encounterRuleOccurrences').unique()
      if (!occurrence?.pendingSnapshotJson) throw new Error('Expected declaration occurrence.')
      const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(
        JSON.parse(occurrence.pendingSnapshotJson)
      )
      if (snapshot.applicationContext.kind !== 'ENCOUNTER_INITIATIVE_DECLARATION')
        throw new Error('Expected declaration context.')
      const root = snapshot.applicationContext.root
      const tampered = serverRuleExecutionPendingSnapshotDtoSchema.parse({
        ...snapshot,
        applicationContext: {
          ...snapshot.applicationContext,
          root: {
            ...root,
            initiativeBeforePin: {
              ...root.initiativeBeforePin,
              actorIds: [crypto.randomUUID(), ...root.initiativeBeforePin.actorIds.slice(1)].sort()
            }
          }
        }
      })
      await ctx.db.patch(occurrence._id, {
        pendingSnapshotJson: JSON.stringify(tampered),
        pendingSnapshotChecksum: checksumCanonicalJson(tampered)
      })
    })
    const before = await storedInitiative(base)
    await expect(
      base.owner.caller.mutation(
        api.encounters.commands.execute,
        declarationCommand({ encounterId: base.run.id, pending })
      )
    ).rejects.toThrow('Rule occurrence is unavailable.')
    expect(await storedInitiative(base)).toEqual(before)
  }, 30000)

  it('shows a Character declaration only to its current controller and the GM', async () => {
    // Deliberately unequipped: a carried weapon is declared as drawn.
    const base = await setupCharacterRun()
    const initiative = createEncounterInitiativeDefinitions([
      { procedure: 'DECLARED_ACTION_ROLL', cadence: 'ENCOUNTER_START' }
    ])
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: initiative.definitions
    })
    const settings = await base.owner.caller.query(getSettings, { campaignId: base.campaign.id })
    const { version, updatedAt: _updatedAt, ...fields } = settings
    await base.owner.caller.mutation(saveSettings, {
      ...fields,
      expectedVersion: version,
      automationMode: 'AUTOMATIC',
      manualReminderMode: 'OFF',
      initiativePolicyDefinitionId: initiative.policyIds[0]!,
      initiativeTieDefinitionId: null
    })
    const blueprint = await base.owner.caller.mutation(createBlueprint, {
      gameSystemId: base.campaign.gameSystemId,
      name: 'Declaration privacy',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CUSTOM', label: 'First', maxHitPoints: 3 }]
    })
    const run = await base.owner.caller.mutation(createRun, {
      campaignId: base.campaign.id,
      blueprintId: blueprint.id,
      commandId: crypto.randomUUID()
    })
    const characterActor = run.actors.find((actor) => actor.kind === 'CHARACTER')
    if (!characterActor) throw new Error('Expected assigned Character actor.')
    let result = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: run.version
      }
    })
    for (let step = 0; step < 2; step += 1) {
      const pending = result.occurrence?.pending
      if (!pending || pending.kind !== 'INITIATIVE_DECLARATION')
        throw new Error('Expected declaration.')
      const playerPending = await base.player.caller.query(
        api.encounters.pendingReads.pendingRuleOccurrence,
        { encounterId: run.id }
      )
      if (pending.actorId === characterActor.id) {
        expect(playerPending).toMatchObject({
          kind: 'INITIATIVE_DECLARATION',
          actorId: characterActor.id
        })
        expect(
          await base.player.caller.query(api.encounters.projectionReads.pendingPrepared, {
            campaignId: base.campaign.id
          })
        ).toHaveLength(1)
        const response = declarationCommand({ encounterId: run.id, pending })
        await base.t.run(async (ctx) => {
          const membership = await ctx.db
            .query('campaignMemberships')
            .withIndex('by_campaignId_userId', (q) =>
              q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
            )
            .unique()
          if (!membership) throw new Error('Expected Character controller membership.')
          await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
        })
        await expect(
          base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
            encounterId: run.id
          })
        ).rejects.toThrow()
        await expect(
          base.player.caller.query(api.encounters.projectionReads.pendingPrepared, {
            campaignId: base.campaign.id
          })
        ).rejects.toThrow()
        await expect(
          base.player.caller.mutation(api.encounters.commands.execute, response)
        ).rejects.toThrow()
        await base.t.run(async (ctx) => {
          const membership = await ctx.db
            .query('campaignMemberships')
            .withIndex('by_campaignId_userId', (q) =>
              q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
            )
            .unique()
          if (!membership) throw new Error('Expected Character controller membership.')
          await ctx.db.patch(membership._id, { status: 'ACTIVE', leftAt: null })
        })
        const stale = {
          command: {
            ...response.command,
            commandId: crypto.randomUUID(),
            expectedOccurrenceVersion: pending.occurrenceVersion + 1
          }
        }
        const beforeStale = await base.t.run((ctx) =>
          ctx.db.query('encounterRuleOccurrences').collect()
        )
        await expect(
          base.player.caller.mutation(api.encounters.commands.execute, stale)
        ).rejects.toThrow()
        expect(
          await base.t.run((ctx) => ctx.db.query('encounterRuleOccurrences').collect())
        ).toEqual(beforeStale)
        result = await base.player.caller.action(api.encounters.commandActions.execute, response)
        expect(encounterPlayerProjectionDtoSchema.safeParse(result.projection).success).toBe(true)
        expect(result.occurrence?.pending).toBeNull()
        await expect(
          base.player.caller.action(api.encounters.commandActions.execute, response)
        ).resolves.toEqual(result)
        result = {
          ...result,
          occurrence: result.occurrence && {
            ...result.occurrence,
            pending: await base.owner.caller.query(
              api.encounters.pendingReads.pendingRuleOccurrence,
              {
                encounterId: run.id
              }
            )
          }
        }
      } else {
        expect(playerPending).toBeNull()
        expect(
          await base.player.caller.query(api.encounters.projectionReads.pendingPrepared, {
            campaignId: base.campaign.id
          })
        ).toEqual([])
        await expect(
          base.player.caller.mutation(
            api.encounters.commands.execute,
            declarationCommand({ encounterId: run.id, pending })
          )
        ).rejects.toThrow()
        result = await base.owner.caller.mutation(
          api.encounters.commands.execute,
          declarationCommand({ encounterId: run.id, pending })
        )
      }
    }
    expect(result.projection.status).toBe('ACTIVE')
    expect(
      await base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: run.id
      })
    ).toBeNull()
    expect(
      await base.player.caller.query(api.encounters.projectionReads.pendingPrepared, {
        campaignId: base.campaign.id
      })
    ).toEqual([])
    const declared = (await storedInitiative(base)).participants.find(
      (participant) => participant.actorId === characterActor.id
    )?.declaration?.primary
    if (declared?.kind !== 'CHARACTER_ACTION' || declared.equipmentInstanceId === null)
      throw new Error('Expected a declared Character equipment action.')
    const sheet = await base.player.caller.query(api.characters.sheet.get, {
      id: base.character.id
    })
    expect(
      sheet?.inventory.items.find((item) => item.id === declared.equipmentInstanceId)?.equipped
    ).toBe(false)
  }, 30000)

  it.each(['PLAYER', 'OWNER'] as const)(
    'commits private declarations with %s responding first',
    async (firstRole) => {
      const workerSecret = 'private-declaration-worker-secret-at-least-32-bytes'
      const authSecret = 'private-declaration-continuation-secret-at-least-32-bytes'
      vi.stubEnv('BETTER_AUTH_SECRET', authSecret)
      vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
      const base = await setupCharacterRun()
      await equipAllCharacterItems(base)
      const initiative = createEncounterInitiativeDefinitions([
        { procedure: 'DECLARED_ACTION_ROLL', cadence: 'ENCOUNTER_START' }
      ])
      await base.t.mutation(internal.content.import.importDefinitions, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitions: initiative.definitions
      })
      const settings = await base.owner.caller.query(getSettings, { campaignId: base.campaign.id })
      const { version, updatedAt: _updatedAt, ...fields } = settings
      await base.owner.caller.mutation(saveSettings, {
        ...fields,
        expectedVersion: version,
        automationMode: 'AUTOMATIC',
        manualReminderMode: 'OFF',
        initiativePolicyDefinitionId: initiative.policyIds[0]!,
        initiativeTieDefinitionId: null
      })
      const blueprint = await base.owner.caller.mutation(createBlueprint, {
        gameSystemId: base.campaign.gameSystemId,
        name: 'Private declaration controllers',
        commandId: crypto.randomUUID(),
        enemies: [{ kind: 'CUSTOM', label: 'First', maxHitPoints: 3 }]
      })
      const characterActorId =
        firstRole === 'PLAYER'
          ? '00000000-0000-4000-8000-000000000011'
          : 'ffffffff-ffff-4fff-8fff-fffffffffff1'
      const customActorId =
        firstRole === 'PLAYER'
          ? 'ffffffff-ffff-4fff-8fff-fffffffffff2'
          : '00000000-0000-4000-8000-000000000012'
      const createRunCommandId = crypto.randomUUID()
      const randomUUID = crypto.randomUUID.bind(crypto)
      let createdUuidCount = 0
      const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
        createdUuidCount += 1
        if (createdUuidCount === 4) return characterActorId
        if (createdUuidCount === 6) return customActorId
        return randomUUID()
      })
      const run = await base.owner.caller
        .mutation(createRun, {
          campaignId: base.campaign.id,
          blueprintId: blueprint.id,
          commandId: createRunCommandId
        })
        .finally(() => uuidSpy.mockRestore())
      const characterActor = run.actors.find((actor) => actor.kind === 'CHARACTER')
      if (!characterActor) throw new Error('Expected assigned Character actor.')
      expect(characterActor.id).toBe(characterActorId)
      expect(run.actors.find((actor) => actor.kind === 'CUSTOM')?.id).toBe(customActorId)
      const start = {
        type: 'START' as const,
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: run.version
      }
      let current = await base.owner.caller.mutation(api.encounters.commands.execute, {
        command: start
      })
      if (current.occurrence?.pending?.kind !== 'INITIATIVE_DECLARATION')
        throw new Error('Expected the first native declaration request.')
      expect(current.occurrence.pending.actorId === characterActor.id).toBe(firstRole === 'PLAYER')
      const epoch = crypto.randomUUID()
      await base.t.run((ctx) =>
        insertActiveLiveAuthority(ctx, {
          campaignId: base.campaign.id,
          epoch,
          createdAt: base.campaign.createdAt
        })
      )
      const environment = workerEnvironment(workerSecret)
      stubLiveSessionFetch((pathname, init) => {
        if (
          ![
            '/live-sessions/encounter-rules',
            '/live-sessions/character-rules',
            '/live-sessions/encounter-turn-pending',
            '/live-sessions/encounter-turn'
          ].includes(pathname)
        )
          throw new Error(`Unexpected private declaration request: ${pathname}`)
        if (
          new Headers(init?.headers).get('authorization') !== 'Bearer fixture-access-token' ||
          new Headers(init?.headers).get('x-artificer-live-session-secret') !== workerSecret ||
          typeof init?.body !== 'string'
        )
          throw new Error('Private declaration credentials or body are missing.')
        const input = JSON.parse(init.body) as { expectedRole: 'OWNER' | 'PLAYER' }
        if (pathname === '/live-sessions/encounter-rules')
          liveSessionEncounterRulesInputSchema.parse(input)
        return (input.expectedRole === 'PLAYER' ? base.player.caller : base.owner.caller).fetch(
          pathname,
          init
        )
      })
      const runtime = createPlatformRulesRuntime({
        continuationIntegrityKey: await deriveRulesContinuationKey(
          process.env.RULES_CONTINUATION_SECRET
        ),
        definitions: {
          async requireCurrent() {
            throw new Error('Private declaration graphs must use captured definitions.')
          }
        }
      })
      const scope = (role: 'OWNER' | 'PLAYER') => ({
        campaignId: base.campaign.id,
        authorityEpoch: epoch,
        expectedUserId: role === 'PLAYER' ? base.player.userId : base.owner.userId,
        expectedRole: role,
        encounterId: run.id,
        expectedVersion: run.version
      })
      let pendingCommits = 0
      let playerDeclarations = 0
      let ownerDeclarations = 0
      let finalResponderUserId: string | null = null
      for (let step = 0; step < 4; step += 1) {
        const pending = current.occurrence?.pending
        if (!pending || pending.kind !== 'INITIATIVE_DECLARATION')
          throw new Error('Expected an issued declaration.')
        const role = pending.actorId === characterActor.id ? 'PLAYER' : 'OWNER'
        const caller = role === 'PLAYER' ? base.player.caller : base.owner.caller
        const visible = await base.player.caller.query(
          api.encounters.pendingReads.pendingRuleOccurrence,
          { encounterId: run.id }
        )
        expect(visible?.kind === 'INITIATIVE_DECLARATION').toBe(role === 'PLAYER')
        expect(
          await base.player.caller.query(api.encounters.projectionReads.pendingPrepared, {
            campaignId: base.campaign.id
          })
        ).toHaveLength(role === 'PLAYER' ? 1 : 0)
        const { command } = declarationCommand({ encounterId: run.id, pending })
        if (command.resolution.kind !== 'INITIATIVE_DECLARATION')
          throw new Error('Expected a declaration response command.')
        const before = await storedInitiative(base)
        if (role === 'PLAYER') {
          const forged = await base.player.caller.fetch('/live-sessions/encounter-rules', {
            method: 'POST',
            headers: { 'x-artificer-live-session-secret': workerSecret },
            body: JSON.stringify({
              ...scope('OWNER'),
              request: { kind: 'TURN_COMMAND', command },
              turnResponse: command
            })
          })
          expect(forged.status).toBe(409)
          await expect(
            planNativeLiveEncounterTurn(
              environment,
              'fixture-access-token',
              scope('PLAYER'),
              start,
              {
                runtime,
                random: () => 0
              }
            )
          ).rejects.toThrow()
          const membership = await base.t.run((ctx) =>
            ctx.db
              .query('campaignMemberships')
              .withIndex('by_campaignId_userId', (q) =>
                q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
              )
              .unique()
          )
          if (!membership) throw new Error('Expected Character controller membership.')
          await base.t.run((ctx) =>
            ctx.db.patch(membership._id, {
              status: 'LEFT',
              leftAt: new Date().toISOString()
            })
          )
          await expect(
            planNativeLiveEncounterTurn(
              environment,
              'fixture-access-token',
              scope('PLAYER'),
              command,
              { runtime, random: () => 0 }
            )
          ).rejects.toThrow()
          await base.t.run((ctx) =>
            ctx.db.patch(membership._id, {
              status: 'ACTIVE',
              leftAt: null
            })
          )
          const assignment = await base.t.run((ctx) =>
            ctx.db
              .query('campaignCharacterAssignments')
              .withIndex('by_campaignId_userId', (q) =>
                q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
              )
              .unique()
          )
          if (!assignment) throw new Error('Expected current Character assignment.')
          await base.t.run((ctx) => ctx.db.delete(assignment._id))
          await expect(
            planNativeLiveEncounterTurn(
              environment,
              'fixture-access-token',
              scope('PLAYER'),
              command,
              { runtime, random: () => 0 }
            )
          ).rejects.toThrow()
          await base.t.run((ctx) => {
            const { _id: ignoredId, _creationTime: ignoredTime, ...saved } = assignment
            void ignoredId
            void ignoredTime
            return ctx.db.insert('campaignCharacterAssignments', saved)
          })
          expect(await storedInitiative(base)).toEqual(before)
        } else {
          await expect(
            planNativeLiveEncounterTurn(
              environment,
              'fixture-access-token',
              scope('PLAYER'),
              command,
              { runtime, random: () => 0 }
            )
          ).rejects.toThrow()
        }
        await expect(
          planNativeLiveEncounterTurn(
            environment,
            'fixture-access-token',
            scope(role),
            {
              ...command,
              expectedOccurrenceVersion: command.expectedOccurrenceVersion + 1
            },
            { runtime, random: () => 0 }
          )
        ).rejects.toThrow()
        await expect(
          planNativeLiveEncounterTurn(
            environment,
            'fixture-access-token',
            scope(role),
            {
              ...command,
              resolution: { ...command.resolution, requestId: crypto.randomUUID() }
            },
            { runtime, random: () => 0 }
          )
        ).rejects.toThrow()
        expect(await storedInitiative(base)).toEqual(before)
        const planned = await planNativeLiveEncounterTurn(
          environment,
          'fixture-access-token',
          scope(role),
          command,
          { runtime, random: () => 0 }
        )
        if (planned.kind !== 'PLANNED') throw new Error('Expected planned declaration response.')
        expect(await storedInitiative(base)).toEqual(before)
        const preparedContext =
          planned.prepared.kind === 'PENDING' ? planned.prepared.snapshot.applicationContext : null
        if (preparedContext && preparedContext.kind !== 'ENCOUNTER_INITIATIVE_DECLARATION')
          throw new Error('Expected the next declaration context.')
        const history =
          planned.prepared.kind === 'COMPLETE'
            ? planned.prepared.root.resolutionCommands.at(-1)
            : preparedContext?.root.resolutionCommands.at(-1)
        expect(history).toMatchObject({
          kind: 'INITIATIVE_DECLARATION',
          actorUserId: role === 'PLAYER' ? base.player.userId : base.owner.userId,
          initiativeActorId: pending.actorId
        })
        if (role === 'PLAYER') playerDeclarations += 1
        else ownerDeclarations += 1
        if (planned.prepared.kind === 'PENDING') {
          const input = liveSessionEncounterTurnPendingInputSchema.parse({
            ...scope(role),
            command,
            revisions: planned.revisions,
            scenes: planned.scenes,
            snapshot: planned.prepared.snapshot
          })
          current = await callLiveSessionRoute(
            environment,
            'fixture-access-token',
            'encounterTurnPending',
            input
          )
          expect(
            await callLiveSessionRoute(
              environment,
              'fixture-access-token',
              'encounterTurnPending',
              input
            )
          ).toEqual(current)
          const retained = (await storedInitiative(base)).occurrences.find(
            (entry) => entry.encounterId === run.id
          )
          if (!retained?.pendingSnapshotJson)
            throw new Error('Expected retained private declaration response.')
          const retainedSnapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(
            JSON.parse(retained.pendingSnapshotJson)
          )
          if (retainedSnapshot.applicationContext.kind !== 'ENCOUNTER_INITIATIVE_DECLARATION')
            throw new Error('Expected retained initiative declaration root.')
          expect(retainedSnapshot.applicationContext.root.resolutionCommands.at(-1)).toMatchObject({
            kind: 'INITIATIVE_DECLARATION',
            actorUserId: role === 'PLAYER' ? base.player.userId : base.owner.userId,
            initiativeActorId: pending.actorId
          })
          pendingCommits += 1
          continue
        }
        if (!planned.terminal) throw new Error('Expected terminal declaration settlement.')
        const terminal = planned.terminal
        expect(terminal.root.resolutionCommands.map((entry) => entry.actorUserId)).toEqual(
          firstRole === 'PLAYER'
            ? [base.player.userId, base.owner.userId]
            : [base.owner.userId, base.player.userId]
        )
        await expect(
          caller.run(async (ctx) => {
            await ctx.runMutation(commitPrivateTurn, terminal)
            throw new Error('Roll back private declaration terminal.')
          })
        ).rejects.toThrow('Roll back private declaration terminal.')
        expect(await storedInitiative(base)).toEqual(before)
        current = await callLiveSessionRoute(
          environment,
          'fixture-access-token',
          'encounterTurnCommit',
          terminal
        )
        finalResponderUserId = role === 'PLAYER' ? base.player.userId : base.owner.userId
        expect(
          await callLiveSessionRoute(
            environment,
            'fixture-access-token',
            'encounterTurnCommit',
            terminal
          )
        ).toEqual(current)
        break
      }
      expect(ownerDeclarations).toBe(1)
      expect(playerDeclarations).toBe(1)
      expect(pendingCommits).toBe(1)
      expect(current.projection).toMatchObject({ status: 'ACTIVE', round: 1 })
      expect(current.occurrence?.pending).toBeNull()
      const settled = await storedInitiative(base)
      expect(settled.rounds.filter((entry) => entry.encounterId === run.id)).toHaveLength(1)
      expect(settled.occurrences.filter((entry) => entry.encounterId === run.id)).toHaveLength(1)
      expect(finalResponderUserId).toBe(
        firstRole === 'PLAYER' ? base.owner.userId : base.player.userId
      )
      expect(settled.receipts.find((entry) => entry.commandId === start.commandId)).toMatchObject({
        actorUserId: base.owner.userId
      })
      expect(
        await base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: run.id
        })
      ).toBeNull()
    },
    120_000
  )

  it('settles declarations from two assigned Character controllers through the player action entrypoint', async () => {
    const base = await setupCharacterRun()
    const secondUser = await base.t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'user',
          data: {
            name: 'Second declaration player',
            email: 'second-declaration-player@example.invalid',
            emailVerified: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        },
        onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
      })
    )
    const secondSession = await base.t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'session',
          data: {
            userId: secondUser._id,
            token: crypto.randomUUID(),
            expiresAt: Date.now() + 60_000,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
    )
    const secondPlayer = base.t.withIdentity({
      subject: secondUser._id,
      sessionId: secondSession._id
    })
    const secondIdentity = await secondPlayer.query(api.account.identity, {})
    if (!secondIdentity) throw new Error('Expected second Character controller identity.')
    // The Run party follows membership join order, so the earlier-joined second Character is
    // snapshotted first and declares last.
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: base.campaign.id,
        userId: secondIdentity.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: base.campaign.createdAt,
        joinedAt: new Date(Date.parse(base.campaign.createdAt) - 1).toISOString(),
        leftAt: null
      })
    )
    const secondDraft = await secondPlayer.mutation(api.characters.drafts.create, {
      id: '00000000-0000-4000-8000-000000000100',
      systemId: base.character.systemId
    })
    const secondCharacter = characterAuthoredDtoSchema.parse({
      ...base.character,
      id: secondDraft.payload.character.id,
      userId: secondIdentity.userId,
      label: 'Second declaration Character',
      status: 'DRAFT'
    })
    await secondPlayer.mutation(api.characters.commit.commit, {
      expectedDraftId: secondDraft.id,
      mode: 'create',
      character: secondCharacter
    })
    await secondPlayer.mutation(api.campaigns.assignments.assign, {
      campaignId: base.campaign.id,
      characterId: secondCharacter.id
    })

    const playerSheet = await base.player.caller.query(api.characters.sheet.get, {
      id: base.character.id
    })
    if (!playerSheet) throw new Error('Expected first Character Sheet.')
    let playerVersion = playerSheet.meta.streamVersion
    for (const item of playerSheet.inventory.items) {
      await base.player.caller.mutation(api.characters.sheetCommands.execute, {
        id: base.character.id,
        command: {
          type: 'EQUIP_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: playerVersion,
          itemId: item.id
        }
      })
      playerVersion += 1
    }
    const secondSheet = await secondPlayer.query(api.characters.sheet.get, {
      id: secondCharacter.id
    })
    if (!secondSheet) throw new Error('Expected second Character Sheet.')
    let secondVersion = secondSheet.meta.streamVersion
    for (const item of secondSheet.inventory.items) {
      await secondPlayer.mutation(api.characters.sheetCommands.execute, {
        id: secondCharacter.id,
        command: {
          type: 'EQUIP_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: secondVersion,
          itemId: item.id
        }
      })
      secondVersion += 1
    }

    const initiative = createEncounterInitiativeDefinitions([
      { procedure: 'DECLARED_ACTION_ROLL', cadence: 'ENCOUNTER_START' }
    ])
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: initiative.definitions
    })
    const settings = await base.owner.caller.query(getSettings, { campaignId: base.campaign.id })
    const { version, updatedAt: _updatedAt, ...fields } = settings
    await base.owner.caller.mutation(saveSettings, {
      ...fields,
      expectedVersion: version,
      automationMode: 'AUTOMATIC',
      manualReminderMode: 'OFF',
      initiativePolicyDefinitionId: initiative.policyIds[0]!,
      initiativeTieDefinitionId: null
    })
    const blueprint = await base.owner.caller.mutation(createBlueprint, {
      gameSystemId: base.campaign.gameSystemId,
      name: 'Two controller declarations',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CUSTOM', label: 'Required opponent', maxHitPoints: 3 }]
    })
    const randomUuid = vi.spyOn(crypto, 'randomUUID')
    let uuidValue = 0xffffffff
    randomUuid.mockImplementation(() => {
      const prefix = (uuidValue--).toString(16).padStart(8, '0')
      return `${prefix}-0000-4000-8000-000000000000`
    })
    let run: EncounterGmProjectionDto
    try {
      run = await base.owner.caller.mutation(createRun, {
        campaignId: base.campaign.id,
        blueprintId: blueprint.id,
        commandId: crypto.randomUUID()
      })
    } finally {
      randomUuid.mockRestore()
    }
    expect(
      [...run.actors]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((actor) => actor.sourceId)
    ).toEqual([null, base.character.id, secondCharacter.id])

    await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: run.version
      }
    })
    let pending = await base.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
      encounterId: run.id
    })
    for (let response = 0; response < 2; response += 1) {
      if (!pending || pending.kind !== 'INITIATIVE_DECLARATION')
        throw new Error('Expected a pending declaration before terminal resolution.')
      const pendingActorId = pending.actorId
      const actor = run.actors.find((candidate) => candidate.id === pendingActorId)
      if (!actor) throw new Error('Expected pending Encounter actor.')
      const command = declarationCommand({ encounterId: run.id, pending })
      if (actor.sourceId === base.character.id) {
        expect(
          await secondPlayer.query(api.encounters.pendingReads.pendingRuleOccurrence, {
            encounterId: run.id
          })
        ).toBeNull()
        await base.player.caller.mutation(api.encounters.commands.execute, command)
      } else if (actor.sourceId === secondCharacter.id) {
        expect(
          await base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
            encounterId: run.id
          })
        ).toBeNull()
        await secondPlayer.mutation(api.encounters.commands.execute, command)
      } else {
        await base.owner.caller.mutation(api.encounters.commands.execute, command)
      }
      pending = await base.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: run.id
      })
    }
    const finalPending = pending
    if (!finalPending || finalPending.kind !== 'INITIATIVE_DECLARATION')
      throw new Error('Expected final Character declaration.')
    const finalActor = run.actors.find((actor) => actor.id === finalPending.actorId)
    if (finalActor?.sourceId !== secondCharacter.id)
      throw new Error('Expected final declaration from the second Character controller.')
    expect(
      await base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: run.id
      })
    ).toBeNull()
    const terminal = declarationCommand({ encounterId: run.id, pending: finalPending })
    const settled = await secondPlayer.action(api.encounters.commandActions.execute, terminal)
    expect(settled.projection.status).toBe('ACTIVE')
    expect(encounterPlayerProjectionDtoSchema.safeParse(settled.projection).success).toBe(true)
    expect(settled.projection.actors.every((actor) => !('currentHitPoints' in actor))).toBe(true)
    const beforeReplay = await storedInitiative(base)
    await expect(
      secondPlayer.action(api.encounters.commandActions.execute, terminal)
    ).resolves.toEqual(settled)
    expect(await storedInitiative(base)).toEqual(beforeReplay)

    const currentSheet = await base.player.caller.query(api.characters.sheet.get, {
      id: base.character.id
    })
    if (!currentSheet) throw new Error('Expected first Character Sheet after settlement.')
    await base.player.caller.mutation(api.characters.sheetCommands.execute, {
      id: base.character.id,
      command: {
        type: 'CREATE_NOTE',
        commandId: crypto.randomUUID(),
        expectedVersion: currentSheet.meta.streamVersion,
        title: 'Turn note',
        body: 'Advance after a sheet change',
        groupId: 'session-notes'
      }
    })
    const advanced = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: settled.projection.version
      }
    })
    expect(advanced.projection).toMatchObject({
      status: 'ACTIVE',
      round: 1,
      version: settled.projection.version + 1
    })
    expect(advanced.projection.currentActorId).not.toBe(settled.projection.currentActorId)
    const afterAdvance = await storedInitiative(base)
    expect(afterAdvance.rounds).toEqual(beforeReplay.rounds)
    expect(
      afterAdvance.participants.map(({ actorId, initiativeScore, turnOrderOrdinal }) => ({
        actorId,
        initiativeScore,
        turnOrderOrdinal
      }))
    ).toEqual(
      beforeReplay.participants.map(({ actorId, initiativeScore, turnOrderOrdinal }) => ({
        actorId,
        initiativeScore,
        turnOrderOrdinal
      }))
    )
  }, 30000)

  it('declares a published Creature feature without spending its charge', async () => {
    const base = await setup()
    await base.t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({
          ...automaticChargedCreature,
          subjectKind: 'CREATURE',
          document: automaticChargedCreature
        })
      ]
    })
    const blueprint = await base.owner.caller.mutation(createBlueprint, {
      gameSystemId: base.campaign.gameSystemId,
      name: 'Creature declaration',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CREATURE', sourceId: automaticChargedCreatureId }]
    })
    const run = await base.owner.caller.mutation(createRun, {
      campaignId: base.campaign.id,
      blueprintId: blueprint.id,
      commandId: crypto.randomUUID()
    })
    const actor = run.actors.find((value) => value.kind === 'CREATURE')
    if (!actor) throw new Error('Expected Creature actor.')
    const before = await base.t.run(async (ctx) =>
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique()
    )
    let result = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: run.version
      }
    })
    const pending = result.occurrence?.pending
    if (!pending || pending.kind !== 'INITIATIVE_DECLARATION')
      throw new Error('Expected Creature declaration.')
    const option = pending.primaryOptions.find(
      (value) => value.kind === 'CREATURE_FEATURE_ACTION' && value.label === 'Bite'
    )
    if (!option) throw new Error('Expected charged Creature feature declaration option.')
    const response = declarationCommand({
      encounterId: run.id,
      pending: { ...pending, primaryOptions: [option] }
    })
    result = await base.owner.caller.mutation(api.encounters.commands.execute, response)
    expect(result.projection.status).toBe('ACTIVE')
    const after = await base.t.run(async (ctx) => ({
      actor: await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique(),
      participant: await ctx.db
        .query('encounterInitiativeParticipants')
        .withIndex('by_encounterId_round_actorId', (q) =>
          q.eq('encounterId', run.id).eq('round', 1).eq('actorId', actor.id)
        )
        .unique(),
      receipts: (await ctx.db.query('encounterRuleReceipts').collect()).filter(
        (value) => value.encounterId === run.id
      ),
      run: await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique(),
      rounds: await ctx.db
        .query('encounterInitiativeRounds')
        .withIndex('by_encounterId_round', (q) => q.eq('encounterId', run.id).eq('round', 1))
        .collect()
    }))
    await expect(
      base.owner.caller.mutation(api.encounters.commands.execute, response)
    ).resolves.toEqual(result)
    expect(
      await base.t.run(async (ctx) => ({
        actor: await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
          .unique(),
        participant: await ctx.db
          .query('encounterInitiativeParticipants')
          .withIndex('by_encounterId_round_actorId', (q) =>
            q.eq('encounterId', run.id).eq('round', 1).eq('actorId', actor.id)
          )
          .unique(),
        receipts: (await ctx.db.query('encounterRuleReceipts').collect()).filter(
          (value) => value.encounterId === run.id
        ),
        run: await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', run.id))
          .unique(),
        rounds: await ctx.db
          .query('encounterInitiativeRounds')
          .withIndex('by_encounterId_round', (q) => q.eq('encounterId', run.id).eq('round', 1))
          .collect()
      }))
    ).toEqual(after)
    expect(after.actor).toEqual(before)
    expect(after.receipts).toHaveLength(1)
    expect(after.participant?.declaration).toMatchObject({
      primary: {
        kind: 'CREATURE_FEATURE_ACTION',
        creatureSourceId: automaticChargedCreatureId,
        sourceRevision: actor.sourceRevision,
        sourceChecksum: checksumRuleDocument(automaticChargedCreature),
        ownerFeatureId: automaticChargedBiteFeatureId,
        effectId: automaticChargedBiteEffectId
      }
    })
  }, 30000)
})
