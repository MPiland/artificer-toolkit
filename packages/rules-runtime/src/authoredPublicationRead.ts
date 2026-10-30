import type {
  AuthoredPublicationDocument,
  AuthoredPublishDraftInput
} from '@artificer-toolkit/schema/api/authoredPublication'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import {
  classAuthoredDtoSchema,
  subclassAuthoredDtoSchema
} from '@artificer-toolkit/schema/subjects/class'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { featAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'

/**
 * A stored current document whose checksum the caller already verified. Publish and seed parse a
 * document before they checksum and store it, so a matching checksum proves the typed shape and a
 * read does not parse it again. A caller that has not verified the checksum must use
 * `parsePublicationDocument`.
 */
export function readVerifiedPublicationDocument(
  subjectKind: AuthoredPublishDraftInput['subjectKind'],
  verifiedDocument: unknown
): AuthoredPublicationDocument {
  return { subjectKind, document: verifiedDocument } as AuthoredPublicationDocument
}

/** Validate current authored data at the publish and Session DO hydration boundaries. */
export function parsePublicationDocument(
  subjectKind: 'BACKGROUND',
  document: unknown
): Extract<AuthoredPublicationDocument, { subjectKind: 'BACKGROUND' }>
export function parsePublicationDocument(
  subjectKind: 'CLASS',
  document: unknown
): Extract<AuthoredPublicationDocument, { subjectKind: 'CLASS' }>
export function parsePublicationDocument(
  subjectKind: 'RACE',
  document: unknown
): Extract<AuthoredPublicationDocument, { subjectKind: 'RACE' }>
export function parsePublicationDocument(
  subjectKind: AuthoredPublishDraftInput['subjectKind'],
  document: unknown
): AuthoredPublicationDocument
export function parsePublicationDocument(
  subjectKind: AuthoredPublishDraftInput['subjectKind'],
  document: unknown
): AuthoredPublicationDocument {
  switch (subjectKind) {
    case 'BACKGROUND':
      return { subjectKind, document: backgroundAuthoredDtoSchema.parse(document) }
    case 'CLASS': {
      if (
        typeof document === 'object' &&
        document !== null &&
        'category' in document &&
        document.category === 'SUBCLASS'
      ) {
        const parsed = subclassAuthoredDtoSchema.safeParse(document)
        if (parsed.success) return { subjectKind, document: parsed.data }
      }
      return { subjectKind, document: classAuthoredDtoSchema.parse(document) }
    }
    case 'CREATURE':
      return { subjectKind, document: creatureAuthoredDtoSchema.parse(document) }
    case 'FEAT':
      return { subjectKind, document: featAuthoredDtoSchema.parse(document) }
    case 'EQUIPMENT':
      return { subjectKind, document: equipmentAuthoredDtoSchema.parse(document) }
    case 'RACE':
      return { subjectKind, document: raceAuthoredDtoSchema.parse(document) }
    case 'SPELL':
      return { subjectKind, document: spellAuthoredDtoSchema.parse(document) }
    case 'VEHICLE':
      return { subjectKind, document: vehicleAuthoredDtoSchema.parse(document) }
  }
}
