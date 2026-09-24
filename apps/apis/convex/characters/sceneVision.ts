import { zodToConvex } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  characterMechanicsReadInputSchema,
  characterSceneVisionResultSchema,
  type CharacterSceneVisionResult
} from '@artificer-toolkit/schema/api/characterMechanicsRead'
import { senseReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/combatPerception'
import { deriveCharacterSceneVision } from '@artificer-toolkit/rules-runtime/character/characterSceneVision'
import { internalQuery } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { readDefinitionRoot } from '../content/definitionStore'
import { loadCharacterSheetFacts } from './sheetFacts'

const resultValidator: Validator<CharacterSceneVisionResult, 'required', string> = zodToConvex<
  z.core.$ZodType<CharacterSceneVisionResult>
>(characterSceneVisionResultSchema)

/** Internal current-source presentation facts; never returns private Character mechanics. */
export const read = internalQuery({
  args: zodToConvex(characterMechanicsReadInputSchema),
  returns: resultValidator,
  handler: async (ctx, args): Promise<CharacterSceneVisionResult> => {
    const { userId: callerUserId } = await requireIdentity(ctx)
    const input = characterMechanicsReadInputSchema.parse(args)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, callerUserId)
    // Current Character facts use the Campaign owner context; private source reads keep caller identity.
    const loaded = await loadCharacterSheetFacts(
      ctx,
      campaign.ownerUserId,
      input.characterId,
      input.campaignId
    )
    if (!loaded || loaded.active.id !== input.characterId)
      throw new Error('Character vision source is unavailable.')
    if (
      loaded.active.streamVersion !== input.streamVersion ||
      loaded.character.systemId !== input.systemId
    )
      throw new Error('Character vision source is stale.')
    const { snapshot, output } = loaded.ruleEvaluation
    const system = loaded.prepared.context.registry.system
    if (
      snapshot.characterId !== input.characterId ||
      snapshot.systemId !== input.systemId ||
      !system ||
      system.id !== input.systemId ||
      loaded.prepared.context.sourceAccess.campaign?.id !== input.campaignId
    )
      throw new Error('Character vision source identity does not match.')
    const admittedSenses = new Set(system.senses.map((sense) => sense.id))
    const senses = []
    const seen = new Set<string>()
    if (output.senses.length > 100) throw new Error('Character vision Sense limit exceeded.')
    for (const sense of output.senses) {
      if (!admittedSenses.has(sense.senseDefinitionId) || seen.has(sense.senseDefinitionId))
        throw new Error('Character vision Sense is not a unique System vocabulary member.')
      seen.add(sense.senseDefinitionId)
      const root = await readDefinitionRoot(ctx, sense.senseDefinitionId, callerUserId)
      if (
        !root?.current ||
        root.definitionFamilyKey !== 'sense' ||
        root.gameSystemId !== input.systemId
      )
        throw new Error('Character vision Sense is unavailable.')
      const document = senseReusableDefinitionDocumentDtoSchema.parse(root.current.document)
      if (document.id !== sense.senseDefinitionId || document.gameSystemId !== input.systemId)
        throw new Error('Character vision Sense identity does not match.')
      senses.push({ document, range: sense.range })
    }
    return characterSceneVisionResultSchema.parse(
      deriveCharacterSceneVision(input.characterId, senses)
    )
  }
})
