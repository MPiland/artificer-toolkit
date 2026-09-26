import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignPlaySettingsDto,
  SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import {
  encounterCommandResultDtoSchema,
  initiativeDeclarationSelectionDtoSchema,
  type CreateEncounterBlueprintInputDto,
  type CreateEncounterInputDto,
  type EncounterBlueprintDto,
  type EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  LiveSessionEncounterCommandInput,
  LiveSessionEncounterRouteInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { cleavingChildCommandIdentity } from '@artificer-toolkit/rules-runtime/encounterCleavingIdentity'
import { concentrationCommandId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { internal } from '../_generated/api'
import {
  classifyNativeEncounterOccurrence,
  type NativeEncounterOccurrenceFacts
} from '../encounters/occurrenceOwner'
import { fixture } from '../../tests/fixtures/characters'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { insertActiveLiveAuthority } from '../../tests/fixtures/liveSessionWorker'

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

function facts(
  context: NativeEncounterOccurrenceFacts['context'],
  overrides: Partial<Omit<NativeEncounterOccurrenceFacts, 'context'>> = {}
): NativeEncounterOccurrenceFacts {
  return {
    occurrence: { id: 'occurrence-1', rootCommandId: 'root-1' },
    context,
    rootCommandType: null,
    completedDisarm: false,
    ...overrides
  }
}

describe('classifyNativeEncounterOccurrence', () => {
  it('assigns every pending context kind to its native coordinator', () => {
    const cases: Array<[NativeEncounterOccurrenceFacts, string]> = [
      [facts({ kind: 'ENCOUNTER_ACTION' }), 'ACTION'],
      [facts({ kind: 'ENCOUNTER_ACTION', contest: { actionKind: 'DISARM' } }), 'DISARM'],
      [facts({ kind: 'ENCOUNTER_ACTION', contest: { actionKind: 'SHOVE' } }), 'ACTION'],
      [facts({ kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING' }), 'CLEAVING'],
      [facts({ kind: 'ENCOUNTER_TURN_RECHARGE' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_INITIATIVE' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_INITIATIVE_DECLARATION' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_SPATIAL_MOVEMENT' }), 'MOVEMENT'],
      [facts({ kind: 'ENCOUNTER_MOVEMENT_REACTION' }), 'MOVEMENT'],
      [facts({ kind: 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE' }), 'MOVEMENT'],
      [facts({ kind: 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST', movementContinuation: {} }), 'MOVEMENT'],
      [facts({ kind: 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST' }), 'OTHER'],
      [facts({ kind: 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK' }), 'OTHER'],
      [facts(null), 'OTHER']
    ]
    for (const [input, owner] of cases)
      expect(classifyNativeEncounterOccurrence(input), input.context?.kind ?? 'null').toBe(owner)
  })

  it('keeps native resume precedence ahead of the context kind', () => {
    const concentrationRoot = {
      id: 'occurrence-1',
      rootCommandId: concentrationCommandId('occurrence-1')
    }
    const cleavingRoot = {
      id: 'occurrence-1',
      rootCommandId: cleavingChildCommandIdentity('occurrence-1')
    }
    expect(
      classifyNativeEncounterOccurrence(
        facts({ kind: 'ENCOUNTER_ACTION' }, { occurrence: concentrationRoot })
      )
    ).toBe('CONCENTRATION')
    expect(
      classifyNativeEncounterOccurrence(
        facts({ kind: 'ENCOUNTER_ACTION' }, { occurrence: cleavingRoot })
      )
    ).toBe('CLEAVING')
    expect(
      classifyNativeEncounterOccurrence(
        facts(
          { kind: 'ENCOUNTER_ACTION', contest: { actionKind: 'DISARM' } },
          {
            occurrence: concentrationRoot
          }
        )
      )
    ).toBe('DISARM')
    expect(
      classifyNativeEncounterOccurrence(
        facts({ kind: 'ENCOUNTER_TURN_RECHARGE' }, { rootCommandType: 'RESOLVE_ACTION' })
      )
    ).toBe('ACTION')
    expect(classifyNativeEncounterOccurrence(facts(null, { completedDisarm: true }))).toBe('DISARM')
  })
})

async function setup() {
  const base = await fixture()
  const initiative = createEncounterInitiativeDefinitions([
    { procedure: 'DECLARED_ACTION_ROLL', cadence: 'ENCOUNTER_START' }
  ])
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: initiative.definitions
  })
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Encounter door fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const settings = await base.owner.caller.query(getSettings, { campaignId: campaign.id })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await base.owner.caller.mutation(saveSettings, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    manualReminderMode: 'OFF',
    initiativePolicyDefinitionId: initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Encounter door target',
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
  const epoch = crypto.randomUUID()
  await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
    await insertActiveLiveAuthority(ctx, {
      campaignId: campaign.id,
      epoch,
      createdAt: campaign.createdAt
    })
  })
  const scope = {
    campaignId: campaign.id,
    authorityEpoch: epoch,
    expectedUserId: base.owner.userId,
    expectedRole: 'OWNER' as const
  }
  const forward = async (input: LiveSessionEncounterCommandInput) =>
    encounterCommandResultDtoSchema.parse(
      await base.owner.caller.action(internal.liveSessions.encounterCommand.execute, input)
    )
  const start: LiveSessionEncounterCommandInput = {
    ...scope,
    command: {
      type: 'START',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: run.version
    }
  }
  const started = await forward(start)
  const pending = started.occurrence?.pending
  if (pending?.kind !== 'INITIATIVE_DECLARATION')
    throw new Error('Expected a pending initiative declaration.')
  const route: LiveSessionEncounterRouteInput = {
    ...scope,
    commandType: 'RESOLVE_RULE_OCCURRENCE',
    encounterId: run.id,
    occurrenceId: pending.occurrenceId
  }
  return { ...base, campaign, run, epoch, scope, forward, start, started, pending, route }
}

describe('Session room Encounter door', () => {
  it('forwards native commands with exact replay and classifies the pending declaration', async () => {
    const base = await setup()
    expect(await base.forward(base.start)).toEqual(base.started)
    expect(
      await base.owner.caller.query(internal.liveSessions.encounterRoute.route, base.route)
    ).toEqual({ route: 'TURN' })
    // Only a GM void that declines a movement decision settles through the room (D26).
    expect(
      await base.owner.caller.query(internal.liveSessions.encounterRoute.route, {
        ...base.route,
        commandType: 'VOID_RULE_OCCURRENCE'
      })
    ).toEqual({ route: 'NATIVE' })

    const option = base.pending.primaryOptions[0]
    if (!option) throw new Error('Expected an issued declaration option.')
    const declaration: LiveSessionEncounterCommandInput = {
      ...base.scope,
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.pending.encounterVersion,
        occurrenceId: base.pending.occurrenceId,
        expectedOccurrenceVersion: base.pending.occurrenceVersion,
        correlationId: null,
        resolution: {
          kind: 'INITIATIVE_DECLARATION',
          requestId: base.pending.requestId,
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
    }
    const declared = await base.forward(declaration)
    expect(declared.occurrence?.occurrenceVersion).toBe(base.pending.occurrenceVersion + 1)
    expect(await base.forward(declaration)).toEqual(declared)
  })

  it('applies native resume precedence to the stored occurrence root', async () => {
    const base = await setup()
    const patchRoot = (rootCommandId: string) =>
      base.t.run(async (ctx) => {
        const occurrence = await ctx.db
          .query('encounterRuleOccurrences')
          .withIndex('by_publicId', (q) => q.eq('id', base.pending.occurrenceId))
          .unique()
        await ctx.db.patch(occurrence!._id, { rootCommandId })
      })
    await patchRoot(concentrationCommandId(base.pending.occurrenceId))
    expect(
      await base.owner.caller.query(internal.liveSessions.encounterRoute.route, base.route)
    ).toEqual({ route: 'CONCENTRATION' })
    await patchRoot(cleavingChildCommandIdentity(base.pending.occurrenceId))
    expect(
      await base.owner.caller.query(internal.liveSessions.encounterRoute.route, base.route)
    ).toEqual({ route: 'NATIVE' })
  })

  it('refuses players outside the occurrence audience, forged scope and stale authority', async () => {
    const base = await setup()
    const route = internal.liveSessions.encounterRoute.route
    const command = internal.liveSessions.encounterCommand.execute
    await expect(
      base.other.caller.query(route, {
        ...base.route,
        expectedUserId: base.other.userId,
        expectedRole: 'PLAYER'
      })
    ).rejects.toThrow('Rule occurrence is unavailable.')
    await expect(
      base.owner.caller.query(route, { ...base.route, expectedRole: 'PLAYER' })
    ).rejects.toThrow('Live Session role mismatch.')
    await expect(
      base.owner.caller.query(route, { ...base.route, expectedUserId: base.other.userId })
    ).rejects.toThrow('Live Session identity mismatch.')
    await expect(
      base.other.caller.action(command, { ...base.start, expectedUserId: base.other.userId })
    ).rejects.toThrow('Live Session role mismatch.')
    await expect(
      base.owner.caller.query(route, { ...base.route, occurrenceId: crypto.randomUUID() })
    ).rejects.toThrow('Rule occurrence is unavailable.')
    await expect(
      base.owner.caller.query(route, { ...base.route, authorityEpoch: crypto.randomUUID() })
    ).rejects.toThrow('Live Session authority is stale.')
    await expect(
      base.owner.caller.action(command, { ...base.start, authorityEpoch: crypto.randomUUID() })
    ).rejects.toThrow('Live Session authority is stale.')

    await base.t.run(async (ctx) => {
      const authority = await ctx.db
        .query('campaignLiveAuthorities')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
        .unique()
      await ctx.db.delete(authority!._id)
    })
    await expect(base.owner.caller.query(route, base.route)).rejects.toThrow(
      'Live Session authority is stale.'
    )
    await expect(base.forward(base.start)).rejects.toThrow('Live Session authority is stale.')
  })
})
