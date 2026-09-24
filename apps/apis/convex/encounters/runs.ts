import { insertRunCommand } from './timelineEntries'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  createEncounterInputDtoSchema,
  encounterGmProjectionDtoSchema,
  type EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounterData'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRunSchema,
  encounterStoredRunActorSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import {
  bindEncounterActorRuleOutputToFacts,
  reconcileEncounterActorRuleOutput
} from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { projectGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireSession } from '../campaigns/sessionDocuments'
import { loadCharacterSheet } from '../characters/sheetPreparation'
import { readBlueprint } from './blueprints'
import { snapshotEncounterPolicies } from './policySnapshots'
import { readRunProjection } from './documents'

const projectionValidator: Validator<EncounterGmProjectionDto, 'required', string> = zodToConvex<
  z.core.$ZodType<EncounterGmProjectionDto>
>(encounterGmProjectionDtoSchema)

export const create = mutation({
  args: zodToConvexFields(createEncounterInputDtoSchema.shape),
  returns: projectionValidator,
  handler: async (ctx, args): Promise<EncounterGmProjectionDto> => {
    const input = createEncounterInputDtoSchema.parse({
      ...args,
      campaignId: args.campaignId.toLowerCase(),
      sessionId: args.sessionId.toLowerCase(),
      commandId: args.commandId.toLowerCase()
    })
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER') throw new Error('Campaign not found.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const session = await requireSession(ctx, campaign.id, input.sessionId)
    if (session.status !== 'OPEN') throw new Error('Encounters can only be added to open Sessions.')
    const commandFingerprint = checksumCanonicalJson(input)
    const prior = await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', campaign.id).eq('commandId', input.commandId)
      )
      .unique()
    if (prior) {
      if (prior.commandType !== 'CREATE' || prior.commandFingerprint !== commandFingerprint)
        throw new Error('Command ID was already used with different input.')
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', prior.encounterId))
        .unique()
      if (
        !row ||
        row.campaignId !== campaign.id ||
        row.sessionId !== session.id ||
        row.gameSystemId !== campaign.gameSystemId
      )
        throw new Error('Encounter is unavailable.')
      return readRunProjection(row)
    }
    const blueprintRow = await ctx.db
      .query('encounterBlueprints')
      .withIndex('by_publicId', (q) => q.eq('id', input.blueprintId))
      .unique()
    if (!blueprintRow || blueprintRow.ownerUserId !== userId)
      throw new Error('Encounter Blueprint is unavailable.')
    const blueprint = readBlueprint(blueprintRow)
    if (blueprint.gameSystemId !== campaign.gameSystemId)
      throw new Error('Encounter Blueprint does not match the Campaign Game System.')
    const attendance = await ctx.db
      .query('campaignSessionAttendance')
      .withIndex('by_campaignId_sessionId_present_characterId', (q) =>
        q.eq('campaignId', campaign.id).eq('sessionId', session.id).eq('present', true)
      )
      .take(MAX_ENCOUNTER_ACTORS + 1)
    if (attendance.length + blueprint.enemies.length > MAX_ENCOUNTER_ACTORS)
      throw new Error(`Encounters support at most ${MAX_ENCOUNTER_ACTORS} actors.`)
    const policies = await snapshotEncounterPolicies(ctx, campaign, userId)
    const now = new Date().toISOString()
    const encounterId = crypto.randomUUID()
    const partySideId = crypto.randomUUID()
    const oppositionSideId = crypto.randomUUID()
    const actors: EncounterRunActorState[] = []
    for (const attendee of attendance) {
      const loaded = await loadCharacterSheet(ctx, userId, attendee.characterId, campaign.id)
      if (!loaded) throw new Error('Attending Character is unavailable.')
      const { character, active, sheet } = loaded
      if (character.systemId !== campaign.gameSystemId)
        throw new Error('Attending Character does not match the Campaign Game System.')
      actors.push(
        encounterRunActorStateSchema.parse({
          id: crypto.randomUUID(),
          encounterId,
          sideId: partySideId,
          kind: 'CHARACTER',
          sourceId: character.id,
          sourceRevision: active.streamVersion,
          label: character.label,
          systemId: character.systemId,
          stableTieKey: crypto.randomUUID(),
          public: true,
          currentHitPoints: Math.max(sheet.overview.currentHitPoints, 0),
          maxHitPoints: Math.max(sheet.overview.maxHitPoints, 0),
          tempHitPoints: Math.max(sheet.overview.tempHitPoints, 0),
          conditions: sheet.overview.conditions.map((condition) => ({
            conditionTypeId: condition.conditionTypeId,
            label: condition.label,
            ...(condition.description === undefined ? {} : { description: condition.description }),
            ...(condition.notes === undefined ? {} : { notes: condition.notes })
          })),
          resources: {},
          gmNotes: null,
          initiative: null,
          manualOrder: null,
          createdAt: now,
          updatedAt: now,
          snapshot: {
            kind: 'CHARACTER',
            id: character.id,
            label: character.label,
            systemId: character.systemId,
            sourceRevision: active.streamVersion
          }
        })
      )
    }
    for (const enemy of blueprint.enemies) {
      if (enemy.systemId !== campaign.gameSystemId)
        throw new Error('Encounter actor does not match the Campaign Game System.')
      actors.push(
        encounterRunActorStateSchema.parse({
          id: crypto.randomUUID(),
          encounterId,
          sideId: oppositionSideId,
          kind: enemy.kind,
          sourceId: enemy.sourceId,
          sourceRevision: enemy.sourceRevision,
          label: enemy.label,
          systemId: enemy.systemId,
          stableTieKey: crypto.randomUUID(),
          public: true,
          currentHitPoints: enemy.maxHitPoints,
          maxHitPoints: enemy.maxHitPoints,
          tempHitPoints: 0,
          conditions: [],
          resources: {},
          gmNotes: null,
          initiative: null,
          manualOrder: null,
          snapshot: enemy.snapshot,
          createdAt: now,
          updatedAt: now
        })
      )
    }
    const state = encounterRunStateSchema.parse({
      id: encounterId,
      campaignId: campaign.id,
      sessionId: session.id,
      gameSystemId: campaign.gameSystemId,
      blueprintId: blueprint.id,
      blueprintVersion: blueprint.version,
      blueprintChecksum: blueprint.setupChecksum,
      name: blueprint.name,
      status: 'PREPARED',
      version: 0,
      round: 0,
      currentActorId: null,
      rulePackRevisionId: null,
      ...policies,
      actorIds: actors.map((actor) => actor.id),
      reminders: [],
      sides: [
        { id: partySideId, label: 'Party', sortOrder: 0 },
        { id: oppositionSideId, label: 'Opposition', sortOrder: 1 }
      ],
      sideRelationships: [
        {
          firstSideId: partySideId < oppositionSideId ? partySideId : oppositionSideId,
          secondSideId: partySideId < oppositionSideId ? oppositionSideId : partySideId,
          relationshipKind: 'HOSTILE'
        }
      ],
      createdAt: now,
      updatedAt: now
    })
    const facts = buildEncounterActorRuleFacts({ actors })
    const output = reconcileEncounterActorRuleOutput(
      evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
      facts
    )
    // New actors start with zero usage; binding rejects a policy output that cannot retain it.
    const bound = bindEncounterActorRuleOutputToFacts(output, facts)
    const projection = projectGm({ ...state, actors, initiativeRoundState: null }, bound)
    await ctx.db.insert(
      'encounterRuns',
      encounterStoredRunSchema.parse({
        id: encounterId,
        campaignId: campaign.id,
        sessionId: session.id,
        gameSystemId: state.gameSystemId,
        status: state.status,
        version: state.version,
        stateJson: JSON.stringify(state),
        stateChecksum: checksumCanonicalJson(state),
        projectionJson: JSON.stringify(projection),
        projectionChecksum: checksumCanonicalJson(projection),
        createdAt: now,
        updatedAt: now
      })
    )
    for (const actor of actors) {
      await ctx.db.insert(
        'encounterRunActors',
        encounterStoredRunActorSchema.parse({
          id: actor.id,
          encounterId,
          stateJson: JSON.stringify(actor),
          stateChecksum: checksumCanonicalJson(actor)
        })
      )
    }
    await insertRunCommand(
      ctx,
      encounterStoredRunCommandSchema.parse({
        campaignId: campaign.id,
        encounterId,
        commandId: input.commandId,
        commandType: 'CREATE',
        commandFingerprint,
        actorUserId: userId,
        createdAt: now
      })
    )
    return projection
  }
})
