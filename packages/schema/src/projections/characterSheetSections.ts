import { z, lazySchema } from '../zod.js'
import { projectionChecksumSchema } from './identity.js'

/** The viewer a stored Sheet section was projected for (ADR 0040). */
const characterSheetSectionViewerSchema = lazySchema(() =>
  z.enum(['CHARACTER_OWNER', 'CAMPAIGN_OWNER', 'PARTY_MEMBER'])
)

const sectionIdentitySchema = lazySchema(() =>
  z.strictObject({
    viewer: characterSheetSectionViewerSchema,
    /** `SLICE:<slice>`, `PANEL:<canonical target JSON>` or `PREPARATION`. */
    section: z.string().check(z.minLength(1)),
    checksum: projectionChecksumSchema
  })
)

/** One stored, viewer-projected Sheet section: a slice, a panel or the preparation options. */
export const characterSheetSectionRecordSchema = lazySchema(() =>
  z.extend(sectionIdentitySchema, {
    characterId: z.string(),
    /** The section's response DTO as JSON; the reading query parses it with that DTO's schema. */
    json: z.string()
  })
)

/** The input fingerprint a Character's stored sections were derived from, and their checksums. */
export const characterSheetDerivationRecordSchema = lazySchema(() =>
  z.strictObject({
    characterId: z.string(),
    fingerprint: projectionChecksumSchema,
    sections: z.array(sectionIdentitySchema)
  })
)

export type CharacterSheetSectionViewer = z.infer<typeof characterSheetSectionViewerSchema>
