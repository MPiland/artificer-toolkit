import { persistCarriedEffectResumes } from '@artificer-toolkit/encounter-persistence/grantTickPersistence'
import { persistEncounterTurnPending } from '@artificer-toolkit/encounter-persistence/turnPendingPersistence'
import { persistEncounterTurnCommit } from '@artificer-toolkit/encounter-persistence/turnCommitPersistence'
import { bindEncounterConcentrationApplications } from '@artificer-toolkit/encounter-persistence/concentrationChildrenPersistence'
import type {
  EncounterCharacterWriteTransaction,
  EncounterWritePorts
} from '@artificer-toolkit/encounter-persistence/ports'
import {
  liveSessionEncounterTurnPendingInputSchema,
  type LiveSessionEncounterTurnCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type {
  EncounterRunState,
  EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterCommandInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'
import { planNativeLiveEncounterTurn } from './nativeEncounterTurn.js'
import { readRoomEncounterTurnCapture } from './roomEncounterTurnCapture.js'
import { readRoomMaintenanceCapture } from './roomMaintenanceCapture.js'
import { readRoomSceneHeader, readRoomSceneEntities, readRoomSceneState } from './roomSceneRead.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { applyRoomEncounterMechanicsBatch } from './roomEncounterMechanics.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { persistRoomConcentrationChildren } from './roomConcentrationPersistence.js'

/** The existing turn planner and persistence reducers share the admitted SQLite transaction. */
export async function executeRoomEncounterTurn(input: {
  ctx: EncounterCharacterWriteTransaction & {
    ports: EncounterCharacterWriteTransaction['ports'] &
      Pick<
        EncounterWritePorts,
        | 'recordConcentrationCheckRoll'
        | 'postRulesChatMessage'
        | 'insertTableRoll'
        | 'retainPrivateRoll'
      >
  }
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>
  observed: LiveSessionRulesRevisions
  command: Extract<
    EncounterCommandInputDto,
    { type: 'START' | 'ADVANCE_TURN' | 'RESOLVE_RULE_OCCURRENCE' }
  >
  runtime: RulesRuntimeService
  random(maximum: number): number
}) {
  const { ctx, store, transaction, inputs, scope, observed } = input
  const scene = {
    readSceneHeader: async (sceneId: string) => readRoomSceneHeader(transaction, sceneId),
    readSceneEntities: (page: Parameters<typeof readRoomSceneEntities>[1]) =>
      readRoomSceneEntities(transaction, page)
  }
  if (input.command.type === 'START')
    await persistCarriedEffectResumes(ctx, {
      encounterId: scope.encounterId,
      readClockMinute: () => inputs.campaignClockMinute(),
      occurredAt: new Date().toISOString()
    })
  const plan = await planNativeLiveEncounterTurn(scope, input.command, {
    runtime: input.runtime,
    random: input.random,
    captures: {
      encounterRules: (request) =>
        readRoomEncounterTurnCapture(
          ctx,
          inputs,
          transaction,
          request,
          observed.filter((revision) => revision.scope !== 'CHARACTER'),
          scene
        ),
      prepareCharacter: (characterScope) =>
        prepareRoomLiveCharacterSheet(store, inputs, characterScope, observed, transaction)
    }
  })
  if (plan.kind === 'REPLAY') return plan.result
  const maintenanceOwners = plan.terminal?.maintenanceOwners ?? []
  const characterIds = new Set(
    plan.actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : []))
  )
  for (const request of maintenanceOwners)
    if (request.owner.kind === 'CHARACTER') characterIds.add(request.owner.characterId)
  const revisions = observed.filter(
    (revision) => revision.scope !== 'CHARACTER' || characterIds.has(revision.id)
  )
  // Complete the fence for actors whose turn needed no mechanics read, including frozen actors.
  mergeNativeRulesRevisions(revisions, plan.revisions)
  const validateReadFence = (
    state: EncounterRunState,
    actors: readonly EncounterRunActorState[],
    fence: {
      revisions: LiveSessionRulesRevisions
      scenes: LiveSessionEncounterTurnCommitInput['scenes']
    },
    owners: LiveSessionEncounterTurnCommitInput['maintenanceOwners'] = []
  ) => assertRoomEncounterReadFence(ctx, transaction, observed, state, actors, fence, owners)
  if (plan.prepared.kind === 'PENDING')
    return persistEncounterTurnPending(
      ctx,
      liveSessionEncounterTurnPendingInputSchema.parse({
        ...scope,
        command: plan.command,
        revisions,
        scenes: plan.scenes,
        snapshot: plan.prepared.snapshot
      }),
      validateReadFence
    )
  if (!plan.terminal) throw new Error('Completed room turn has no commit input.')
  return persistEncounterTurnCommit(
    ctx,
    { ...plan.terminal, revisions },
    {
      validateReadFence,
      applyMechanics: (batch) =>
        applyRoomEncounterMechanicsBatch({
          ctx,
          store,
          transaction,
          inputs,
          campaignId: scope.campaignId,
          epoch: scope.authorityEpoch,
          observed,
          batch
        }),
      readSceneTokens: async (sceneId) =>
        (await readRoomSceneState(transaction, sceneId)).scene.tokens,
      readDefinition: async (id, userId) => {
        await ctx.ports.requireCampaignAuthority(scope.campaignId, userId)
        return (await inputs.definition(id, observed, transaction)).definition
      },
      bindConcentrationApplications: (state, applications) =>
        bindEncounterConcentrationApplications(ctx, state, applications),
      persistConcentrationChildren: (children) => persistRoomConcentrationChildren(ctx, children)
    }
  )
}

/** Checks the exact leased input scope and native Scene pins before settlement writes. */
export async function assertRoomEncounterReadFence(
  ctx: EncounterCharacterWriteTransaction,
  transaction: RoomTransaction,
  observed: LiveSessionRulesRevisions,
  state: EncounterRunState,
  actors: readonly EncounterRunActorState[],
  fence: {
    revisions: LiveSessionRulesRevisions
    scenes: LiveSessionEncounterTurnCommitInput['scenes']
  },
  owners: LiveSessionEncounterTurnCommitInput['maintenanceOwners'] = []
) {
  const ids = actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : []))
  if (new Set(ids).size !== ids.length)
    throw new Error('Encounter Character source binding mismatch.')
  const requests = new Set<string>()
  for (const request of owners) {
    const key = checksumCanonicalJson(request)
    if (!actors.some((actor) => actor.id === request.actorId) || requests.has(key))
      throw new Error('Room turn maintenance scope mismatch.')
    requests.add(key)
    await readRoomMaintenanceCapture(ctx, state, request)
    if (request.owner.kind === 'CHARACTER' && !ids.includes(request.owner.characterId))
      ids.push(request.owner.characterId)
  }
  assertRoomEncounterRulesRevisions(observed, state, ids, fence.revisions)
  for (const pin of fence.scenes) {
    const binding = await ctx.db
      .query('encounterSceneBindings')
      .withIndex('by_encounterId', (query) => query.eq('encounterId', state.id))
      .unique()
    const header = readRoomSceneHeader(transaction, pin.sceneId)
    if (
      !binding ||
      binding.campaignId !== state.campaignId ||
      binding.sceneId !== pin.sceneId ||
      header.campaignId !== state.campaignId ||
      header.version !== pin.sceneVersion ||
      header.definitionSaveId !== pin.definitionSaveId
    )
      throw new Error('Room turn Scene changed before commit.')
  }
}

/** The durable callback additionally refuses a lease revision change before the SQLite commit. */
export function assertRoomEncounterRulesRevisions(
  observed: LiveSessionRulesRevisions,
  state: EncounterRunState,
  characterIds: readonly string[],
  revisions: LiveSessionRulesRevisions
) {
  const required = new Set([
    `SYSTEM:${state.gameSystemId}`,
    `CAMPAIGN:${state.campaignId}`,
    `PLAY:${state.campaignId}`,
    ...characterIds.map((id) => `CHARACTER:${id}`)
  ])
  if (revisions.length !== required.size) throw new Error('Room turn revision scope is incomplete.')
  for (const revision of revisions) {
    if (
      !required.delete(`${revision.scope}:${revision.id}`) ||
      !observed.some(
        (current) =>
          current.scope === revision.scope &&
          current.id === revision.id &&
          current.revision === revision.revision
      )
    )
      throw new Error('Room turn inputs changed before commit.')
  }
}
