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
    description: 'Narrows selection to feature(s).'
  },

  OPTION: {
    code: 'OPTION',
    label: 'Feature Option',
    description: 'Narrows selection to feature option.'
  },

  SUBCLASS: {
    code: 'SUBCLASS',
    label: 'Subclass',
    description: 'Narrows to a subclass.'
  },

  RESOURCE: {
    code: 'RESOURCE',
    label: 'Resource',
    description: 'Narrows to a class resource.'
  },

  SUBRACE: {
    code: 'SUBRACE',
    label: 'Subrace',
    description: 'Narrows to a subrace.'
  },

  RACE_ANCESTRY_OPTION: {
    code: 'RACE_ANCESTRY_OPTION',
    label: 'Ancestry Option',
    description: 'Narrows selection to ancestry option(s).'
  },

  PROFICIENCY_GRANT: {
    code: 'PROFICIENCY_GRANT',
    label: 'Proficiency Grant',
    description: 'Narrows select to proficiency grants'
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
  const rel: Readonly<Record<string, { readonly to: NodeSubjectCode }>> | undefined =
    RELATIONS[subject as SubjectWithRelations]
  if (!rel) return []

  const codes = Array.from(new Set(valuesOf(rel).map((x) => x.to))) as RelatedSubjectCodes<S>[]
  return codes.map((c) => NODE_SUBJECT[c]) as readonly NodeSubjectOption<RelatedSubjectCodes<S>>[]
}
