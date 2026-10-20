import type {
  AuthoredPublicationDocument,
  AuthoredStoredCompilation
} from '@artificer-toolkit/schema/api/authoredPublication'
import type { EquipmentAuthored, RaceAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  resolveEquipmentAuthored,
  resolveRaceAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import { compilePublicationDocument } from '../authoredPublicationCompile.js'

/**
 * The compilation each publication stores, from the real compiler: a subrace or Equipment variant
 * is resolved against its parents among `publications` and `parents`, as publish resolves it.
 */
export function storedCompilationOf(
  publication: AuthoredPublicationDocument,
  parents: readonly AuthoredPublicationDocument[] = []
): AuthoredStoredCompilation {
  const byId = new Map(parents.map((parent) => [parent.document.id, parent.document]))
  if (publication.subjectKind === 'RACE' && publication.document.category === 'SUBRACE')
    return compilePublicationDocument(
      publication,
      resolveRaceAuthored(
        publication.document as RaceAuthored,
        (id) => byId.get(id) as RaceAuthored | undefined
      )
    )
  if (publication.subjectKind === 'EQUIPMENT' && publication.document.category === 'VARIANT')
    return compilePublicationDocument(
      publication,
      resolveEquipmentAuthored(
        publication.document as EquipmentAuthored,
        (id) => byId.get(id) as EquipmentAuthored | undefined
      )
    )
  return compilePublicationDocument(publication)
}
