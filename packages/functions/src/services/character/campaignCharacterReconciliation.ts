import { isDeepStrictEqual } from 'node:util'
import {
  createCharacterBuilderDraftRepository,
  createCharacterRepository,
  type DBLike,
  type Json
} from '@artificer-toolkit/db'
import { characterBuilderDraftPayloadDtoSchema } from '@artificer-toolkit/schema/api/characters'
import { AUTHORED_RECORD_STATUS } from '@artificer-toolkit/shared/core'
import { loadCharacterBuilderContext, resolveCharacterBuilder } from './builderService.js'
import { reconcileCharacterBuilderCharacter } from './builderReconciliation.js'

export async function reconcileCharacterAfterCampaignContentRemoval(
  db: DBLike,
  characterId: string
): Promise<boolean> {
  const characters = createCharacterRepository(db)
  await characters.findUpdatedAtByIdForUpdate(characterId)
  const character = await characters.findAuthoredById(characterId)
  if (!character) return false

  const context = await loadCharacterBuilderContext(db, character)
  const reconciled = await reconcileCharacterBuilderCharacter(db, character, character, context)
  const resolution = await resolveCharacterBuilder(db, reconciled, 'edit', context)
  if (resolution.readiness.ready && isDeepStrictEqual(reconciled, character)) return false

  const draftCharacter = { ...reconciled, status: AUTHORED_RECORD_STATUS.DRAFT }
  const payload = characterBuilderDraftPayloadDtoSchema.parse({ character: draftCharacter })
  await characters.upsertAuthored(draftCharacter, { incrementStreamVersion: true })
  await createCharacterBuilderDraftRepository(db).save({
    characterId,
    userId: character.userId,
    systemId: character.systemId,
    label: character.label,
    mode: 'edit',
    payload: payload as unknown as Json,
    baseActiveUpdatedAt: await characters.findUpdatedAtById(characterId)
  })
  return true
}
