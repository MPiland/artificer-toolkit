import { z } from '../zod.js'
import { characterListItemDtoSchema } from './characterBuilder.js'
import { characterDraftListPageSchema } from './characterDrafts.js'

/** Canonical Characters, including repair DRAFTs; never-activated drafts use the draft page. */
export const characterListPageSchema = z.extend(characterDraftListPageSchema, {
  page: z.array(characterListItemDtoSchema).check(z.maxLength(48))
})

export type CharacterListPage = z.infer<typeof characterListPageSchema>
