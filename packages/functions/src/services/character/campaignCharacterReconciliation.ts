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
  const [character, row] = await Promise.all([
    characters.findAuthoredById(characterId),
    characters.findById(characterId)
  ])
  if (!character || !row) return false
  if (!row.rule_pack_revision_id) {
    throw new Error(`Active Character "${character.id}" does not have a pinned rule revision.`)
  }

  const context = await loadCharacterBuilderContext(db, character)
  const reconciled = await reconcileCharacterBuilderCharacter(
    db,
    character,
    character,
    context,
    row.rule_pack_revision_id
  )
  const resolution = await resolveCharacterBuilder(
    db,
    reconciled,
    'edit',
    context,
    null,
    row.rule_pack_revision_id
  )
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
