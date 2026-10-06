import { readCampaignCharacterAssignment } from '@artificer-toolkit/encounter-persistence/characterStates'
import { readRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readActiveSceneEncounter } from '@artificer-toolkit/encounter-persistence/sceneBindingReads'
import { deriveCharacterSceneVision } from '@artificer-toolkit/rules-runtime/character/characterSceneVision'
import {
  sceneSessionVisionCompositionSchema,
  type SceneSessionVisionComposition
} from '@artificer-toolkit/schema/api/sceneSessionVision'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { senseReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/combatPerception'
import { resolveSceneCharacterVision } from '@artificer-toolkit/shared/vtt'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { roomEncounterReadTransaction } from './roomEncounterReadPorts.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'
import { readRoomSceneHeader } from './roomSceneRead.js'

/**
 * Resolves current Character vision for the raw Scene without persisting presentation overrides.
 * Only the ACTIVE Run bound to the Scene contributes, read from the room's current state, so a
 * completed or unbound Run is never composed.
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

  const selectedTokens = new Set(
    scene.tokens.filter((token) => !token.vision).map((token) => token.id)
  )
  const bindings = new Map<
    string,
    SceneSessionVisionComposition['context']['encounterCharacterBindings'][number]
  >()
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
        if (actor.kind !== 'CHARACTER') continue
        // D74: a departed actor, frozen or not yet frozen by the room, binds no vision.
        if (
          actor.frozenState ||
          !(await readCampaignCharacterAssignment(ctx, campaign.id, actor.sourceId))
        )
          continue
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
        bindings.set(tokenBinding.tokenId, {
          encounterId: run.id,
          actorId: actor.id,
          characterId: character.id,
          tokenId: tokenBinding.tokenId
        })
      }
    }
  }
  const selectedBindings = scene.tokens.flatMap((token) => {
    const binding = bindings.get(token.id)
    return binding ? [binding] : []
  })
  const characterVisions: SceneSessionVisionComposition['context']['characterVisions'] = []
  const characterRevisions: SceneSessionVisionComposition['characterRevisions'] = []
  for (const characterId of new Set(selectedBindings.map((binding) => binding.characterId))) {
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
    const { snapshot, output } = facts.ruleEvaluation
    const system = facts.prepared.context.registry.system
    if (
      snapshot.characterId !== characterId ||
      snapshot.systemId !== campaign.gameSystemId ||
      !system ||
      system.id !== campaign.gameSystemId ||
      facts.campaignContext.campaignId !== campaignId
    )
      throw new Error('Character vision source identity does not match.')
    const admittedSenses = new Set(system.senses.map((sense) => sense.id))
    const senses: Parameters<typeof deriveCharacterSceneVision>[1][number][] = []
    const seen = new Set<string>()
    if (output.senses.length > 100) throw new Error('Character vision Sense limit exceeded.')
    for (const sense of output.senses) {
      if (!admittedSenses.has(sense.senseDefinitionId) || seen.has(sense.senseDefinitionId))
        throw new Error('Character vision Sense is not a unique System vocabulary member.')
      seen.add(sense.senseDefinitionId)
      const { definition } = await inputs.definition(sense.senseDefinitionId, observed, transaction)
      if (
        !definition ||
        definition.id !== sense.senseDefinitionId ||
        definition.definitionFamilyKey !== 'sense' ||
        definition.gameSystemId !== campaign.gameSystemId
      )
        throw new Error('Character vision Sense is unavailable.')
      const document = senseReusableDefinitionDocumentDtoSchema.parse(definition.document)
      if (
        document.id !== sense.senseDefinitionId ||
        document.gameSystemId !== campaign.gameSystemId
      )
        throw new Error('Character vision Sense identity does not match.')
      senses.push({ document, range: sense.range })
    }
    characterVisions.push(deriveCharacterSceneVision(characterId, senses))
    characterRevisions.push({ characterId, revision: revisions[0]!.revision })
  }
  const composition = sceneSessionVisionCompositionSchema.parse({
    context: { characterVisions, encounterCharacterBindings: selectedBindings },
    characterRevisions
  })
  return {
    scene: resolveSceneCharacterVision(
      scene,
      composition.context.encounterCharacterBindings,
      composition.context.characterVisions
    ),
    characterRevisions: composition.characterRevisions
  }
}
