import { isDepartedCharacterActor } from '@artificer-toolkit/encounter-persistence/characterStates'
import { readRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { listActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'
import { readActiveSceneEncounter } from '@artificer-toolkit/encounter-persistence/sceneBindingReads'
import {
  createActorSensePinner,
  deriveActorSceneVision
} from '@artificer-toolkit/rules-runtime/actorSenses'
import { creatureEmittedLight } from '@artificer-toolkit/rules-runtime/creatureLight'
import { encounterActorMovementPassage } from '@artificer-toolkit/rules-runtime/encounterMovementPassagePolicy'
import { snapshotStatBlock } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { evaluateCharacterActiveGrantRules } from '@artificer-toolkit/rules-runtime/character/characterRuleEvaluation'
import {
  sceneSessionVisionCompositionSchema,
  type SceneSessionVisionComposition
} from '@artificer-toolkit/schema/api/sceneSessionVision'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { resolveSceneActorVision } from '@artificer-toolkit/shared/vtt'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { roomEncounterReadTransaction } from './roomEncounterReadPorts.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'
import { readRoomSceneHeader } from './roomSceneRead.js'

/** The same resolved passage the server moves the actor with decides whether it passes barriers. */
function barrierPassage(
  gameSystemId: string,
  actor: EncounterRunActorState,
  characterPolicy: CharacterRulePolicyOutput | null
): { passesBlockingBarriers?: true } {
  return encounterActorMovementPassage(gameSystemId, actor, characterPolicy).throughBarriers
    ? { passesBlockingBarriers: true }
    : {}
}

/**
 * Resolves current Character and Creature vision for the raw Scene without persisting presentation
 * overrides. Only the ACTIVE Run bound to the Scene contributes, read from the room's current
 * state, so a completed or unbound Run is never composed.
 */
export async function composeRoomSceneVision(input: {
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  authorization: LiveSessionRoomAuthorization
  campaignId: string
  epoch: string
  scene: CampaignSceneStateDto
}): Promise<{
  scene: CampaignSceneStateDto
  characterRevisions: SceneSessionVisionComposition['characterRevisions']
}> {
  const { store, transaction, inputs, authorization, campaignId, epoch, scene } = input
  if (store.epoch !== epoch || inputs.epoch !== epoch)
    throw new Error('Room Scene vision authority changed.')
  const observed = inputs.revisions(campaignId, authorization.revisions)
  const ownerUserId = authorization.campaign.ownerUserId
  const ctx = await roomEncounterReadTransaction({
    store,
    transaction,
    inputs,
    authorization,
    campaignId,
    epoch,
    userId: ownerUserId,
    observed
  })
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(campaignId, ownerUserId)
  const header = readRoomSceneHeader(transaction, scene.id)
  if (
    membership.role !== 'OWNER' ||
    scene.campaignId !== campaign.id ||
    header.campaignId !== campaign.id ||
    header.id !== scene.id ||
    header.definitionId !== scene.definitionId ||
    header.definitionVersion !== scene.definitionVersion
  )
    throw new Error('Scene vision Campaign identity does not match.')
  if (header.version !== scene.version) throw new Error('Scene vision Scene version is stale.')

  const selectedTokens = new Set(scene.tokens.map((token) => token.id))
  const bindings = new Map<
    string,
    SceneSessionVisionComposition['context']['encounterActorBindings'][number]
  >()
  const characterActors = new Map<string, { characterId: string; actor: EncounterRunActorState }>()
  const creatureActors = new Map<string, EncounterRunActorState>()
  if (selectedTokens.size) {
    const held = authorization.play.encounter
    if (held?.sceneId === scene.id) await inputs.encounter(held.encounterId, transaction)
    const active = await readActiveSceneEncounter(ctx, {
      campaignId: campaign.id,
      sceneId: scene.id
    })
    if (active) {
      const { run } = active
      if (run.gameSystemId !== campaign.gameSystemId)
        throw new Error('Scene vision Encounter identity or version is stale.')
      const state = readRunState(run)
      const tokenBindings = await ctx.db
        .query('encounterActorTokenBindings')
        .withIndex('by_encounterId_actorId', (query) => query.eq('encounterId', run.id))
        .collect()
      for (const tokenBinding of tokenBindings) {
        if (tokenBinding.sceneId !== scene.id)
          throw new Error('Scene vision actor token binding is inconsistent.')
        const actor = await readRunActor(ctx, state, tokenBinding.actorId)
        if (actor.kind === 'CREATURE') {
          if (!selectedTokens.has(tokenBinding.tokenId)) continue
          creatureActors.set(actor.id, actor)
          bindings.set(tokenBinding.tokenId, {
            encounterId: run.id,
            actorId: actor.id,
            tokenId: tokenBinding.tokenId
          })
          continue
        }
        if (actor.kind !== 'CHARACTER') continue
        if (await isDepartedCharacterActor(ctx, campaign.id, actor)) continue
        const { assignment } = await ctx.ports.requireCampaignCharacterAuthority(
          campaign.id,
          actor.sourceId,
          campaign.ownerUserId
        )
        const character = await ctx.ports.readCharacterRow(actor.sourceId)
        if (
          !character ||
          character.id !== assignment.characterId ||
          character.userId !== assignment.userId ||
          character.systemId !== campaign.gameSystemId
        )
          throw new Error('Scene vision Character identity is inconsistent.')
        if (!selectedTokens.has(tokenBinding.tokenId)) continue
        characterActors.set(actor.id, { characterId: character.id, actor })
        bindings.set(tokenBinding.tokenId, {
          encounterId: run.id,
          actorId: actor.id,
          tokenId: tokenBinding.tokenId
        })
      }
    }
  }
  const selectedBindings = scene.tokens.flatMap((token) => {
    const binding = bindings.get(token.id)
    return binding ? [binding] : []
  })
  const actorVisions: SceneSessionVisionComposition['context']['actorVisions'] = []
  const characterRevisions: SceneSessionVisionComposition['characterRevisions'] = []
  const pinSenses = createActorSensePinner({
    gameSystemId: campaign.gameSystemId,
    loadSystem: () => ctx.ports.requireSystem(campaign.gameSystemId),
    loadDefinition: async (id) => (await inputs.definition(id, observed, transaction)).definition
  })
  const actorSenses = async (held: Parameters<typeof pinSenses>[0]) =>
    (await pinSenses(held)).map(({ pin, label }) => ({
      document: pin.document,
      label,
      range: pin.range
    }))
  for (const characterId of new Set(
    [...characterActors.values()].map((bound) => bound.characterId)
  )) {
    const revisions = observed.filter(
      (revision) => revision.scope === 'CHARACTER' && revision.id === characterId
    )
    if (revisions.length !== 1)
      throw new Error('Room Scene vision Character revision is unavailable.')
    const facts = await prepareRoomLiveCharacterSheet(
      store,
      inputs,
      {
        campaignId,
        authorityEpoch: epoch,
        expectedUserId: campaign.ownerUserId,
        expectedRole: 'OWNER',
        characterId
      },
      observed,
      transaction
    )
    mergeNativeRulesRevisions(observed, facts.revisions)
    const character = await ctx.ports.readCharacterRow(characterId)
    if (
      !character ||
      facts.active.id !== characterId ||
      facts.character.id !== characterId ||
      character.systemId !== campaign.gameSystemId ||
      facts.active._id !== character._id ||
      facts.active.play.streamVersion !== character.play.streamVersion ||
      facts.active.play.checksum !== character.play.checksum ||
      facts.character.systemId !== campaign.gameSystemId
    )
      throw new Error('Character vision source is stale.')
    const { snapshot } = facts.ruleEvaluation
    // Sense grants the Character holds (the Darkvision spell) fold in like its own features.
    const policy = evaluateCharacterActiveGrantRules({
      gameSystemId: campaign.gameSystemId,
      evaluation: facts.ruleEvaluation,
      activeEffects: await listActiveRuleEffects(
        ctx,
        { kind: 'CHARACTER', characterId },
        { ownerVerified: true }
      ),
      vocabularySnapshot: facts.prepared.context.vocabularySnapshot
    }).output
    const system = facts.prepared.context.registry.system
    if (
      snapshot.characterId !== characterId ||
      snapshot.systemId !== campaign.gameSystemId ||
      !system ||
      system.id !== campaign.gameSystemId ||
      facts.campaignContext.campaignId !== campaignId
    )
      throw new Error('Character vision source identity does not match.')
    const senses = await actorSenses(policy.senses)
    for (const bound of characterActors.values())
      if (bound.characterId === characterId)
        actorVisions.push({
          ...deriveActorSceneVision(bound.actor.id, senses),
          ...barrierPassage(campaign.gameSystemId, bound.actor, policy)
        })
    characterRevisions.push({ characterId, revision: revisions[0]!.revision })
  }
  for (const actor of creatureActors.values())
    actorVisions.push({
      ...deriveActorSceneVision(
        actor.id,
        await actorSenses(snapshotStatBlock(actor)?.senses ?? []),
        creatureEmittedLight(actor)
      ),
      ...barrierPassage(campaign.gameSystemId, actor, null)
    })
  const composition = sceneSessionVisionCompositionSchema.parse({
    context: { actorVisions, encounterActorBindings: selectedBindings },
    characterRevisions
  })
  return {
    scene: resolveSceneActorVision(
      scene,
      composition.context.encounterActorBindings,
      composition.context.actorVisions
    ),
    characterRevisions: composition.characterRevisions
  }
}
