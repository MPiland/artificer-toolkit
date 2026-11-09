import { z, lazySchema } from '../zod.js'
import { projectionChecksumSchema } from './identity.js'

/** The viewer a stored Sheet section was projected for (ADR 0041). */
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

/** The input fingerprint a Character's stored sections were derived from; every read checks it. */
export const characterSheetDerivationRecordSchema = lazySchema(() =>
  z.strictObject({
    characterId: z.string(),
    fingerprint: projectionChecksumSchema
  })
)

/**
 * The checksum of every stored section of a Character, which only a store reads: a read checks the
 * fingerprint alone, so it never loads this list (ADR 0041 Amendment 2).
 */
export const characterSheetSectionChecksumsRecordSchema = lazySchema(() =>
  z.strictObject({
    characterId: z.string(),
    sections: z.array(sectionIdentitySchema)
  })
)

export type CharacterSheetSectionViewer = z.infer<typeof characterSheetSectionViewerSchema>
