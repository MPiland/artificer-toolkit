import {
  SUBJECT_COMPILER_VERSION,
  type AuthoredStoredCompilation
} from '@artificer-toolkit/schema/api/authoredPublication'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { createContentMemo } from '@artificer-toolkit/shared/contentMemo'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type {
  CompiledBackground,
  CompiledClass,
  CompiledCreature,
  CompiledEquipment,
  CompiledFeat,
  CompiledRace,
  CompiledSpell,
  CompiledVehicle
} from '@artificer-toolkit/shared/subjects/compilers'

/** The compiler's output type of each publication kind. */
export type CompiledProjectionOf = {
  BACKGROUND: CompiledBackground
  CLASS: CompiledClass
  CREATURE: CompiledCreature
  EQUIPMENT: CompiledEquipment
  FEAT: CompiledFeat
  RACE: CompiledRace
  SPELL: CompiledSpell
  VEHICLE: CompiledVehicle
}

/** A compiled projection's rules identity; compiler output leaves absent fields `undefined`. */
export function compiledProjectionChecksum(compiled: unknown) {
  return checksumRuleDocument(jsonValueSchema.parse(JSON.parse(JSON.stringify(compiled))))
}

// Parsed projections and their checksums by exact JSON: Sheets re-read the same publications.
const projections = createContentMemo<{ checksum: string; projection: { id: string } }>(512)

/**
 * The compiled record a current publication stored (D163); nothing compiles at read time. Fails
 * closed on another compiler version, a compilation of another document or a corrupt projection.
 */
export function hydrateStoredCompilation<Kind extends keyof CompiledProjectionOf>(
  subjectKind: Kind,
  subject: { id: string; checksum: string },
  compilation: AuthoredStoredCompilation
): CompiledProjectionOf[Kind] {
  if (compilation.compilerVersion !== SUBJECT_COMPILER_VERSION)
    throw new Error(`Stored ${subjectKind} compilation is superseded; recompile it.`)
  if (compilation.authoredChecksum !== subject.checksum)
    throw new Error(`Stored ${subjectKind} compilation is stale for ${subject.id}.`)
  const { checksum, projection } = projections(compilation.projectionJson, (json) => {
    const parsed: unknown = JSON.parse(json)
    return { checksum: checksumRuleDocument(parsed), projection: parsed as { id: string } }
  })
  if (checksum !== compilation.projectionChecksum)
    throw new Error(`Stored ${subjectKind} compilation checksum mismatch.`)
  if (projection.id !== subject.id)
    throw new Error(`Stored ${subjectKind} compilation identity mismatch.`)
  // The checksums prove this is the stored compiler output of this version, so the compiler's
  // type applies.
  return projection as CompiledProjectionOf[Kind]
}
