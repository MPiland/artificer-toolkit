import {
  authoredStoredCompilationSchema,
  SUBJECT_COMPILER_VERSION,
  type AuthoredPublicationDocument,
  type AuthoredStoredCompilation
} from '@artificer-toolkit/schema/api/authoredPublication'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import {
  compileSubjectWithMechanicsIndex,
  assertCompiledSubjectMechanicsIndex,
  type ResolvedEquipment,
  type ResolvedRace
} from '@artificer-toolkit/shared/subjects/compilers'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'

/** The stored compilation a publication writes: the current compiler's projection and checksums. */
export function compilePublicationDocument(
  subject: AuthoredPublicationDocument,
  effectiveAuthored?: ResolvedEquipment | ResolvedRace
): AuthoredStoredCompilation {
  if (
    subject.subjectKind === 'EQUIPMENT' &&
    subject.document.category === 'VARIANT' &&
    !effectiveAuthored
  )
    throw new Error('Equipment publication requires resolved current parents.')
  if (
    subject.subjectKind === 'RACE' &&
    subject.document.category === 'SUBRACE' &&
    !effectiveAuthored
  )
    throw new Error('Race publication requires a resolved current parent.')
  const result = compileSubjectWithMechanicsIndex({
    subjectKind: subject.subjectKind,
    authored: subject.document,
    ...(subject.subjectKind === 'EQUIPMENT' || subject.subjectKind === 'RACE'
      ? { effectiveAuthored }
      : {})
  })
  assertCompiledSubjectMechanicsIndex(result.mechanicsIndex)
  const projection = jsonValueSchema.parse(JSON.parse(JSON.stringify(result.compiled)))
  return authoredStoredCompilationSchema.parse({
    compilerVersion: SUBJECT_COMPILER_VERSION,
    projectionSchemaVersion: 1,
    authoredChecksum: checksumRuleDocument(subject.document),
    projectionChecksum: checksumRuleDocument(projection),
    projectionJson: canonicalizeRuleDocument(projection)
  })
}
