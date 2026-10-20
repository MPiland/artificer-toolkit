import { acquiredEquipmentRulesSchema } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import type { ResolvedEquipment } from '@artificer-toolkit/shared/subjects/compilers'
import { compilePublicationDocument } from '../authoredPublicationCompile.js'
import { parsePublicationDocument } from '../authoredPublicationRead.js'
import { equipmentPresentation, spellPresentation } from '../character/acquiredEquipmentRules.js'

/** Retained rules pinned from the real compiler's output, in the shape capture stores (D163). */
export function pinnedRetainedRulesJson(input: {
  systemId: string
  equipment: unknown
  spells?: readonly unknown[]
  /** A variant's Equipment resolved against its parents. */
  resolvedEquipment?: ResolvedEquipment
}) {
  const equipment = parsePublicationDocument('EQUIPMENT', input.equipment)
  if (equipment.subjectKind !== 'EQUIPMENT') throw new Error('Expected an Equipment document.')
  const spells = (input.spells ?? []).map((spell) => {
    const parsed = parsePublicationDocument('SPELL', spell)
    if (parsed.subjectKind !== 'SPELL') throw new Error('Expected a Spell document.')
    return parsed
  })
  const pinned = [
    {
      subject: equipment,
      compilation: compilePublicationDocument(equipment, input.resolvedEquipment),
      presentation: equipmentPresentation(equipment.document)
    },
    ...spells.map((spell) => ({
      subject: spell,
      compilation: compilePublicationDocument(spell),
      presentation: spellPresentation(spell.document)
    }))
  ]
  return JSON.stringify(
    acquiredEquipmentRulesSchema.parse({
      equipmentId: equipment.document.id,
      systemId: input.systemId,
      sources: pinned.map(({ subject, compilation, presentation }) => ({
        subjectKind: subject.subjectKind,
        subjectId: subject.document.id,
        versionId: subject.document.id,
        version: 1,
        checksum: compilation.authoredChecksum,
        compilation,
        presentation
      }))
    })
  )
}
