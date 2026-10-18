import type { FacetDto } from '@artificer-toolkit/schema/shared/facet'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

const useAnObject = SRD_BASIC_ACTION_DEFINITIONS.find(
  ({ id }) => id === SRD_BASIC_ACTION_IDS.USE_AN_OBJECT
)
if (useAnObject?.document.kind !== 'BASIC_ACTION') throw new Error('Missing Use an Object fixture.')
export const useAnObjectEffectId = useAnObject.document.effects[0]!.id

/**
 * One OR-group per holder kind, each holding one AND-ed holder predicate, the way a basic action's
 * restrictions are authored (each facet context gates on the holder's kind, D152).
 */
export function restrictedTo(seed: number, predicateCode: 'FREE_HAND' | 'CAN_ACT'): FacetDto {
  const id = (group: number, offset: number) =>
    `00000000-0000-4000-8000-0000000e${seed}${group}${offset}`
  return {
    id: id(0, 0),
    groups: (['CHARACTER', 'CREATURE'] as const).map((subject, index) => ({
      id: id(index, 1),
      order: index + 1,
      contexts: [
        {
          id: id(index, 2),
          order: 1,
          subject,
          ...(subject === 'CREATURE' ? { authoringModeKind: 'ALL' as const } : {}),
          conditions: [
            { id: id(index, 3), order: 1, kind: 'PREDICATE', constraint: 'INCLUDE', predicateCode }
          ]
        }
      ]
    }))
  } as FacetDto
}

/** A System-authored copy of Use an Object under its own identity, taken only by actors meeting `restrictions`. */
export function restrictedAction(seed: number, label: string, restrictions: FacetDto) {
  const document = {
    ...useAnObject!.document,
    id: `00000000-0000-4000-8000-0000000b${seed}00`,
    restrictions
  }
  return {
    ...useAnObject!,
    id: document.id,
    label,
    document,
    checksum: checksumRuleDocument(document)
  }
}
