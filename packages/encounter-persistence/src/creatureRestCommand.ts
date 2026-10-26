import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto,
  type RestEncounterCreaturesInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { planCreatureRest } from '@artificer-toolkit/rules-runtime/encounterCreatureRest'
import { readEncounterActorConditionState } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { discoverEncounterFeatureActions } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { prepareRestStandingEffects } from '@artificer-toolkit/rules-runtime/standingEffects'
import { rejectDomain } from './domainRejections.js'
import { readRunActorWithRow, readRunState, writeRunActor } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import type { EncounterWriteTransaction } from './ports.js'
import { encounterReplayReceipt, replayEncounterCommandResult } from './replayReceipts.js'
import { insertRunCommand, requireUnusedEvidenceCommandId } from './timelineEntries.js'

/**
 * The GM rests creature actors: each one's spent feature charges and spell slot rows that reset on
 * that rest come back (a long rest also recovers short-rest ones), and each ended standing effect
 * that returns on that rest is held again (SPELLS-31.2). A Character rests through its Sheet. The
 * receipt keeps what each row had spent and the effects the rest made, so the GM's undo spends the
 * rows again and ends those effects.
 */
export async function restEncounterCreatures(
  ctx: EncounterWriteTransaction,
  command: RestEncounterCreaturesInputDto,
  userId: string
): Promise<EncounterCommandResultDto> {
  const lower = (id: string) => id.toLowerCase()
  const input = {
    ...command,
    encounterId: lower(command.encounterId),
    commandId: lower(command.commandId),
    actorIds: command.actorIds.map(lower)
  }
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(run.campaignId, userId)
  if (membership.role !== 'OWNER') rejectDomain('GM_ONLY')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  await requireUnusedEvidenceCommandId(ctx, campaign.id, input.commandId)
  const fingerprint = checksumCanonicalJson(input)
  const prior = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', input.commandId)
    )
    .unique()
  if (prior) {
    if (
      prior.commandType !== 'CREATURE_REST' ||
      prior.encounterId !== run.id ||
      prior.actorUserId !== userId ||
      prior.commandFingerprint !== fingerprint
    )
      rejectDomain('COMMAND_ID_REUSED')
    return replayEncounterCommandResult(ctx, readRunState(run), prior)
  }
  if (run.version !== input.expectedVersion) rejectDomain('VERSION_STALE')
  const state = readRunState(run)
  if (state.status !== 'ACTIVE')
    rejectDomain('ENCOUNTER_NOT_ACTIVE', 'Only an active Encounter can rest creatures.')
  if (new Set(input.actorIds).size !== input.actorIds.length)
    rejectDomain('TARGET_UNAVAILABLE', 'Each creature can rest once per command.')

  const now = new Date().toISOString()
  const effectStore = createActiveRuleEffectStore(ctx)
  const rested: {
    actorId: string
    resets: { key: string; beforeUsed: number }[]
    armedEffectIds: string[]
  }[] = []
  for (const actorId of input.actorIds) {
    const { row, actor } = await readRunActorWithRow(ctx, state, actorId)
    if (actor.kind === 'CHARACTER')
      rejectDomain('TARGET_UNAVAILABLE', 'A Character rests through its Character Sheet.')
    const { resets, resources } = planCreatureRest(actor, input.restKind)
    const owner = turnEffectOwner(actor, state.id)
    const held = actor.kind === 'CREATURE' ? await effectStore.list(owner) : []
    const armed =
      actor.kind === 'CREATURE'
        ? prepareRestStandingEffects({
            standing: discoverEncounterFeatureActions({
              actor,
              conditionDefinitionIds: [],
              abilityDefinitions: [],
              spells: new Map()
            }).standingEffects,
            restKind: input.restKind,
            holder: {
              actorId,
              conditionIds: readEncounterActorConditionState(actor.conditions ?? []).ids,
              effectiveSize: null,
              lifetimeScope: 'ENCOUNTER',
              hidden: !actor.public,
              held
            },
            origin: {
              encounterId: state.id,
              currentActorId: state.currentActorId,
              occurrenceId: input.commandId,
              commandId: input.commandId
            }
          })
        : []
    if (!resets.length && !armed.length) continue
    if (resets.length)
      await writeRunActor(
        ctx,
        row._id,
        encounterRunActorStateSchema.parse({ ...actor, resources, updatedAt: now })
      )
    for (const effect of armed)
      await effectStore.create({
        id: effect.id,
        owner,
        definition: effect.definition,
        lifecycle: effect.lifecycle,
        occurredAt: now
      })
    rested.push({ actorId, resets, armedEffectIds: armed.map(({ id }) => id) })
  }
  if (!rested.length)
    rejectDomain('TARGET_UNAVAILABLE', 'Those creatures have nothing to recover from this rest.')

  const version = run.version + 1
  const nextState = encounterRunStateSchema.parse({ ...state, version, updatedAt: now })
  await ctx.db.patch(run._id, {
    version,
    updatedAt: now,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState)
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection: await readEncounterGmProjection(ctx, nextState),
    roll: null,
    occurrence: null
  })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: input.commandId,
      commandType: 'CREATURE_REST',
      receipt: { restKind: input.restKind, actors: rested },
      commandFingerprint: fingerprint,
      actorUserId: userId,
      version,
      commandJson: JSON.stringify(input),
      ...encounterReplayReceipt(result),
      createdAt: now
    })
  )
  return result
}
