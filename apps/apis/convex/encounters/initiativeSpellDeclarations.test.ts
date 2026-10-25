import { readReceiptHeaders } from '../lib/receiptLedgers'
import { makeFunctionReference } from 'convex/server'
import * as z from 'zod/mini'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignPlaySettingsDto,
  SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  initiativeDeclarationSelectionDtoSchema,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/api/encounters'
import { fireBolt } from '@artificer-toolkit/source-data/srd/spells/fire-bolt.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { api, components, internal } from '../_generated/api'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import {
  compileAsPublished,
  importedSubject,
  importSeededSubjects,
  versionWithCompilation
} from '../../tests/fixtures/publication'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { insertAuthoredVersion } from '../content/documents'
import { parsePublicationDocument } from '../content/publicationDocument'
import { readCharacterRow } from '../characters/stateDocuments'
import {
  attachRoomWorker,
  checkpointRoom,
  closeRoom,
  executeInRoom,
  expectRedactedRoomRefusal,
  queueRoomRolls,
  roomErrorLogs,
  seedRoomContentSnapshots,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()
afterEach(() => {
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

type DeclarationPending = Pick<
  Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'INITIATIVE_DECLARATION' }>,
  'encounterVersion' | 'occurrenceId' | 'occurrenceVersion' | 'requestId' | 'primaryOptions'
>

async function setup() {
  const base = await readyCharacterFixture({
    features: [
      {
        id: crypto.randomUUID(),
        label: 'Always available Fire Bolt',
        description: '',
        availableAtLevel: 1,
        order: 0,
        grants: {
          spells: [
            {
              id: crypto.randomUUID(),
              grantKind: 'SPELL_GRANT',
              selectionKind: 'GRANTED',
              scalingKind: 'NONE',
              authoringModeKind: 'SELECTED',
              spellIds: [fireBolt.id],
              attributes: ['CAST_AT_WILL'],
              order: 0
            }
          ]
        }
      }
    ]
  })
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({
        subjectKind: 'SPELL',
        ...fireBolt,
        document: fireBolt
      })
    ]
  })
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  const player = base.owner
  const owner = base.other
  const campaign = await owner.caller.mutation(createCampaign, {
    name: 'Encounter execution fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [owner.userId, player.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Fixture profile is unavailable.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
  })
  await base.t.mutation(
    makeFunctionReference<
      'mutation',
      { ownerUserId: string; playerUserId: string; campaignId: string },
      null
    >('encounters/developmentCampaign:admitFixturePlayer'),
    {
      ownerUserId: owner.userId,
      playerUserId: player.userId,
      campaignId: campaign.id
    }
  )
  await player.caller.mutation(api.campaigns.assignments.assign, {
    campaignId: campaign.id,
    characterId: character.id
  })
  const initiative = createEncounterInitiativeDefinitions([
    { procedure: 'DECLARED_ACTION_ROLL', cadence: 'ENCOUNTER_START' }
  ])
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: initiative.definitions
  })
  const settings = await owner.caller.query(getSettings, {
    campaignId: campaign.id
  })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await owner.caller.mutation(saveSettings, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId: initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
  })
  await attachRoomWorker(base.t)
  await seedRoomContentSnapshots(campaign.id)
  const blueprint = await owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Spell declaration',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Initiative witness', maxHitPoints: 1 }]
  })
  const run = await owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  return { ...base, player, owner, campaign, character, run }
}

function spellCommand(encounterId: string, pending: DeclarationPending, optionId: string) {
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE' as const,
      encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      correlationId: null,
      resolution: {
        kind: 'INITIATIVE_DECLARATION' as const,
        requestId: pending.requestId,
        primary: initiativeDeclarationSelectionDtoSchema.parse({
          kind: 'CHARACTER_SPELL_CAST',
          optionId
        }),
        bonus: null
      }
    } satisfies ResolveRuleOccurrenceInputDto
  }
}

function gmCommand(encounterId: string, pending: DeclarationPending) {
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE' as const,
      encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      correlationId: null,
      resolution: {
        kind: 'INITIATIVE_DECLARATION' as const,
        requestId: pending.requestId,
        primary: initiativeDeclarationSelectionDtoSchema.parse({
          kind: 'GM_ADJUDICATED',
          optionId: 'GM_ADJUDICATED',
          actorSize: 'MEDIUM',
          factorIds: [],
          spellLevel: null
        }),
        bonus: null
      }
    } satisfies ResolveRuleOccurrenceInputDto
  }
}

function spellOption(pending: DeclarationPending) {
  const option = pending.primaryOptions.find(
    (value) => value.kind === 'CHARACTER_SPELL_CAST' && value.label === fireBolt.label
  )
  if (!option) throw new Error('Expected Fire Bolt declaration option.')
  return option
}

describe('native initiative Spell declarations', () => {
  it('pins an authorized Spell publication and completes without spending resources', async () => {
    const base = await setup()
    const actor = base.run.actors.find((value) => value.kind === 'CHARACTER')
    if (!actor) throw new Error('Expected Character actor.')
    // Automatic scores that tie, and a tie-break roll-off that ties again, leave the Run PREPARED for
    // the GM's order. Faces 10 apart cannot tie whichever order they are drawn in.
    await queueRoomRolls(base.campaign.id, { rolls: [2, 12] })
    let result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    let pending = result.occurrence?.pending
    if (!pending || pending.kind !== 'INITIATIVE_DECLARATION')
      throw new Error('Expected declaration.')
    if (!pending.primaryOptions.some((value) => value.kind === 'CHARACTER_SPELL_CAST')) {
      result = await executeInRoom(base.owner.caller, gmCommand(base.run.id, pending))
      pending = result.occurrence?.pending
      if (!pending || pending.kind !== 'INITIATIVE_DECLARATION')
        throw new Error('Expected Spell declaration.')
    }
    const option = spellOption(pending)
    // The room's checkpoint publishes the Encounter's receipts to a Campaign ledger; only the
    // Character's own ledgers show a spend.
    const characterSpend = async () => {
      await checkpointRoom(base.campaign.id)
      return base.t.run(async (ctx) => {
        const ledgers = await ctx.db
          .query('receiptLedgers')
          .withIndex('by_scope_scopeId', (q) =>
            q.eq('scope', 'CHARACTER').eq('scopeId', base.character.id)
          )
          .collect()
        return {
          receiptLedgers: ledgers,
          receiptLedgerParts: await Promise.all(
            ledgers.map((ledger) =>
              ctx.db
                .query('receiptLedgerParts')
                .withIndex('by_ledgerId_index', (q) => q.eq('ledgerId', ledger.id))
                .collect()
            )
          ),
          character: await readCharacterRow(ctx, base.character.id),
          receipts: await ctx.db
            .query('characterCommandReceipts')
            .withIndex('by_characterId_commandId', (q) => q.eq('characterId', base.character.id))
            .collect()
            .then((headers) => readReceiptHeaders(ctx, 'characterCommandReceipts', headers))
        }
      })
    }
    const beforeCharacter = await characterSpend()
    const publication = await base.t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', fireBolt.id))
        .unique()
      if (!root) throw new Error('Expected Fire Bolt root.')
      const version = await ctx.db.get(root.currentVersionId)
      if (!version) throw new Error('Expected Fire Bolt version.')
      return version
    })
    expect(option.selectionContract).toBe(
      checksumRuleDocument({
        kind: 'CHARACTER_SPELL_CAST',
        optionId: option.optionId,
        spellId: fireBolt.id,
        castLevel: 0,
        spellVersionId: publication.versionId,
        spellVersion: publication.version,
        spellChecksum: publication.checksum
      })
    )
    result = await executeInRoom(
      base.player.caller,
      spellCommand(base.run.id, pending, option.optionId)
    )
    await checkpointRoom(base.campaign.id)
    pending = z.nullable(pendingEncounterRuleOccurrenceSummaryDtoSchema).parse(
      await base.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    )
    if (pending && pending.kind === 'INITIATIVE_DECLARATION')
      result = await executeInRoom(base.owner.caller, gmCommand(base.run.id, pending))
    expect(result.projection.status).toBe('ACTIVE')
    await checkpointRoom(base.campaign.id)
    const participant = await base.t.run((ctx) =>
      ctx.db
        .query('encounterInitiativeParticipants')
        .withIndex('by_encounterId_round_actorId', (q) =>
          q.eq('encounterId', base.run.id).eq('round', 1).eq('actorId', actor.id)
        )
        .unique()
    )
    expect(participant?.declaration).toMatchObject({
      primary: {
        kind: 'CHARACTER_SPELL_CAST',
        spellId: fireBolt.id,
        spellVersionId: publication.versionId,
        spellVersion: publication.version,
        spellChecksum: publication.checksum
      }
    })
    expect(await characterSpend()).toEqual(beforeCharacter)
  }, 30_000)

  it('rejects a response after the Spell publication changes before any encounter write', async () => {
    const base = await setup()
    let result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    let pending = result.occurrence?.pending
    if (!pending || pending.kind !== 'INITIATIVE_DECLARATION')
      throw new Error('Expected declaration.')
    if (!pending.primaryOptions.some((value) => value.kind === 'CHARACTER_SPELL_CAST')) {
      result = await executeInRoom(base.owner.caller, gmCommand(base.run.id, pending))
      pending = result.occurrence?.pending
      if (!pending || pending.kind !== 'INITIATIVE_DECLARATION')
        throw new Error('Expected Spell declaration.')
    }
    const option = spellOption(pending)
    const response = spellCommand(base.run.id, pending, option.optionId)
    await base.t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', fireBolt.id))
        .unique()
      if (!root) throw new Error('Expected Fire Bolt root.')
      const current = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
      if (!current) throw new Error('Expected Fire Bolt version.')
      const document = { ...fireBolt, description: 'Republished Fire Bolt.' }
      const checksum = checksumRuleDocument(document)
      const currentVersionPublicId = crypto.randomUUID()
      const versionId = await insertAuthoredVersion(
        ctx,
        {
          subjectKind: current.subjectKind,
          id: current.id,
          systemId: current.systemId,
          label: current.label,
          checksum,
          contentSourceId: current.contentSourceId,
          versionId: currentVersionPublicId,
          version: current.version + 1,
          documentSchemaVersion: current.documentSchemaVersion
        },
        canonicalizeRuleDocument(document),
        // The republished document gets its own compilation, as publication writes.
        await compileAsPublished(ctx, parsePublicationDocument('SPELL', document), null)
      )
      await ctx.db.patch(root._id, {
        currentVersionId: versionId,
        currentVersionPublicId,
        checksum
      })
    })
    // A room reads the content snapshots current at activation, so it re-hydrates on the republished Spell.
    await seedRoomContentSnapshots(base.campaign.id)
    await closeRoom(base.campaign.id)
    const before = await base.t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      run: await ctx.db.query('encounterRuns').collect(),
      actors: await ctx.db.query('encounterRunActors').collect(),
      rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
      participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
      occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
      receipts: await ctx.db
        .query('encounterRuleReceipts')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRuleReceipts', headers)),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
    }))
    // The room redacts the cause to the member and logs it.
    await expectRedactedRoomRefusal(
      executeInRoom(base.player.caller, response),
      'The Encounter command could not be completed.'
    )
    await vi.waitFor(() =>
      expect(roomErrorLogs()).toEqual([
        expect.stringMatching(/Initiative declaration options are stale/)
      ])
    )
    await checkpointRoom(base.campaign.id)
    expect(
      await base.t.run(async (ctx) => ({
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        run: await ctx.db.query('encounterRuns').collect(),
        actors: await ctx.db.query('encounterRunActors').collect(),
        rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
        participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        receipts: await ctx.db
          .query('encounterRuleReceipts')
          .collect()
          .then((headers) => readReceiptHeaders(ctx, 'encounterRuleReceipts', headers)),
        commands: await ctx.db
          .query('encounterRunCommands')
          .collect()
          .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
      }))
    ).toEqual(before)
  }, 30_000)
})
