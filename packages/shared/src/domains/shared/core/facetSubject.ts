import type { CoreMeta } from '../../core/core.js'
import type { ProficiencyKind } from '../../grants/core/proficiency.js'
import { SUBJECT_REGISTRY } from '../../subjects/core/subject.js'
import { valuesOf, type EmptyObject } from '#utils'

export type SubjectPayloadByCode = {
  CLASS: { classIds: string[] }
  FEATURE: { featureIds: string[] }
  SPELL: { spellIds: string[] }
  EQUIPMENT: { equipmentIds: string[] }
  FEAT: { featIds: string[] }
  RACE: { raceIds: string[] }
  BACKGROUND: { backgroundIds: string[] }
  CREATURE: { creatureIds: string[] }
  VEHICLE: { vehicleIds: string[] }
  PROFICIENCY_GRANT: { proficiencyKind: ProficiencyKind }

  OPTION: { optionIds: string[] }
  SUBRACE: { subraceIds: string[] }
  SUBCLASS: { subclassIds: string[] }
  RESOURCE: { resourceIds: string[] }
  RACE_ANCESTRY_OPTION: { ancestryOptionIds: string[] }

  // If a node subject cannot be selected directly, use EmptyObject
  CHARACTER: EmptyObject
}

export type NodeSubjectCode = keyof SubjectPayloadByCode

export type NodeSubjectOption<C extends NodeSubjectCode = NodeSubjectCode> = CoreMeta<C>

type NodeSubjectRegistry = { [C in NodeSubjectCode]: NodeSubjectOption<C> }

export const NODE_SUBJECT: NodeSubjectRegistry = {
  ...SUBJECT_REGISTRY,

  FEATURE: {
    code: 'FEATURE',
    label: 'Feature',
    tooltip: 'Narrows selection to feature(s).',
    description:
      'Narrows selection to one or more specific features. This can be used to target class features, racial attributes, feat features, or other authored features.'
  },

  OPTION: {
    code: 'OPTION',
    label: 'Feature Option',
    tooltip: 'Narrows selection to feature option.',
    description:
      'Narrows selection to one or more specific feature options, such as Fighting Style selections, invocation choices, or other option-based feature paths.'
  },

  SUBCLASS: {
    code: 'SUBCLASS',
    label: 'Subclass',
    tooltip: 'Narrows to a subclass.',
    description: 'Narrows selection to a specific subclass for their class.'
  },

  RESOURCE: {
    code: 'RESOURCE',
    label: 'Resource',
    tooltip: 'Narrows to a class resource.',
    description:
      'Narrows applicability to a specific resource of a class such as Ki or Inspiration Dice.'
  },

  SUBRACE: {
    code: 'SUBRACE',
    label: 'Subrace',
    tooltip: 'Narrows to a subrace.',
    description: 'Narrows selections to a specific subrace within a race.'
  },

  RACE_ANCESTRY_OPTION: {
    code: 'RACE_ANCESTRY_OPTION',
    label: 'Ancestry Option',
    tooltip: 'Narrows selection to ancestry option(s).',
    description:
      'Narrows one or more specific options within an ancestry, such as Red or Blue for Draconic Ancestry.'
  },

  PROFICIENCY_GRANT: {
    code: 'PROFICIENCY_GRANT',
    label: 'Proficiency Grant',
    tooltip: 'Narrows select to proficiency grants',
    description: 'Narrows one or more proficiency kinds, such as ability, equipment, etc'
  }
} as const

export const NODE_SUBJECT_OPTIONS = valuesOf(NODE_SUBJECT)

export type SubjectSelectionPayload<S extends NodeSubjectCode> = SubjectPayloadByCode[S]

export const RELATIONS = {
  CLASS: {
    FEATURE: { to: 'FEATURE' },
    SUBCLASS: { to: 'SUBCLASS' },
    RESOURCE: { to: 'RESOURCE' },
    PROFICIENCY_GRANT: { to: 'PROFICIENCY_GRANT' }
  },
  SUBCLASS: {
    FEATURE: { to: 'FEATURE' },
    RESOURCE: { to: 'RESOURCE' },
    PROFICIENCY_GRANT: { to: 'PROFICIENCY_GRANT' }
  },
  FEATURE: {
    OPTION: { to: 'OPTION' },
    PROFICIENCY_GRANT: { to: 'PROFICIENCY_GRANT' }
  },
  FEAT: {
    FEATURE: { to: 'FEATURE' },
    PROFICIENCY_GRANT: { to: 'PROFICIENCY_GRANT' }
  },
  EQUIPMENT: {
    FEATURE: { to: 'FEATURE' }
  },
  OPTION: {
    PROFICIENCY_GRANT: { to: 'PROFICIENCY_GRANT' }
  },
  BACKGROUND: {
    FEATURE: { to: 'FEATURE' },
    PROFICIENCY_GRANT: { to: 'PROFICIENCY_GRANT' }
  },
  CHARACTER: {
    CREATURE: { to: 'CREATURE' },
    VEHICLE: { to: 'VEHICLE' }
  },
  RACE: {
    FEATURE: { to: 'FEATURE' },
    SUBRACE: { to: 'SUBRACE' },
    RACE_ANCESTRY_OPTION: { to: 'RACE_ANCESTRY_OPTION' }
  },
  SUBRACE: {
    FEATURE: { to: 'FEATURE' },
    RACE_ANCESTRY_OPTION: { to: 'RACE_ANCESTRY_OPTION' }
  },
  RACE_ANCESTRY_OPTION: {
    FEATURE: { to: 'FEATURE' }
  }
} as const satisfies Partial<Record<NodeSubjectCode, Record<string, { to: NodeSubjectCode }>>>

export const RELATION_SUBJECTS = Object.keys(RELATIONS) as SubjectWithRelations[]

export const RELATION_CODES = Array.from(
  new Set(valuesOf(RELATIONS).flatMap((m) => Object.keys(m)))
) as RelationCode<SubjectWithRelations>[]

type RelationsMap = typeof RELATIONS

/** Subjects that have relations */
export type SubjectWithRelations = keyof RelationsMap

/** Relation codes for a given subject */
export type RelationCode<S extends NodeSubjectCode> = S extends SubjectWithRelations
  ? keyof RelationsMap[S] & string
  : never

export type RelatedSubjectCodes<S extends NodeSubjectCode> = S extends SubjectWithRelations
  ? RelationSpec<S>['to'] & NodeSubjectCode
  : never

/** Correlated { relationCode, to } union for a given subject S */
type RelationSpec<S extends SubjectWithRelations> = {
  [R in keyof RelationsMap[S] & string]: {
    relationCode: R
    to: RelationsMap[S][R] extends { to: infer T } ? T : never
  }
}[keyof RelationsMap[S] & string]

/** Maps (S, R) → child subject, preserving correlation */
export type RelationTargetSubject<
  S extends NodeSubjectCode,
  R extends RelationCode<S>
> = S extends SubjectWithRelations
  ? Extract<RelationSpec<S>, { relationCode: R }>['to'] & NodeSubjectCode
  : never
export function getRelatedSubjectOptions<S extends NodeSubjectCode>(
  subject: S
): readonly NodeSubjectOption<RelatedSubjectCodes<S>>[] {
  const rel = RELATIONS[subject as SubjectWithRelations]
  if (!rel) return []

  const relationValues = valuesOf(rel) as unknown as ReadonlyArray<{ to: RelatedSubjectCodes<S> }>
  const codes = Array.from(new Set(relationValues.map((x) => x.to))) as RelatedSubjectCodes<S>[]
  return codes.map((c) => NODE_SUBJECT[c]) as readonly NodeSubjectOption<RelatedSubjectCodes<S>>[]
}
