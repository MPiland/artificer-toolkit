import {
  assertNever,
  COMPILE_DIAGNOSTIC_SEVERITY,
  compileFailure,
  compileSuccess,
  unwrapCompileResult,
  type CompileResult
} from '#utils'

import type { FacetAuthored, GrantPayloadAuthored, SpellGrantAuthored } from '#authored'
import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  SPELL_GRANT_ACCESS,
  type NodeSubjectCode
} from '#core'
import { compileChargeUse } from '#compilers'
import type { CompiledChargeUse, CompiledScalingGrant, CompiledGrantTarget } from '#compilers'
import { SCALING } from '#core'
import type { SpellGrantAttribute } from '#core'

export type CompiledSpellGrant = CompiledScalingGrant<
  typeof GRANT_KIND.SPELL_GRANT,
  CompiledGrantTarget<{ spellIds: string[] }>
> & {
  castAtLevel?: number
  castingAbility?: string
  spellSaveDc?: number
  charges?: CompiledChargeUse
  attributes?: SpellGrantAttribute[]
  filters?: FacetAuthored<Extract<NodeSubjectCode, 'SPELL'>>
  restrictions?: FacetAuthored
  allowedCreatureTypeIds?: string[]
  perTargetLockout?: SpellGrantAuthored['perTargetLockout']
  slotCost?: SpellGrantAuthored['slotCost']
  access?: SpellGrantAuthored['access']
  classListIds?: string[]
}

function compileSpellTarget(
  authored: GrantPayloadAuthored<{ spellIds: string[] }>
): CompiledGrantTarget<{ spellIds: string[] }> {
  switch (authored.authoringModeKind) {
    case undefined:
    case AUTHORING_MODE_KIND.ALL:
      return { authoringModeKind: AUTHORING_MODE_KIND.ALL }

    case AUTHORING_MODE_KIND.SELECTED:
      return authored

    default:
      return assertNever(authored)
  }
}

export function compileSpellGrantResult(
  authored: SpellGrantAuthored
): CompileResult<CompiledSpellGrant> {
  const listOnly = authored.access === SPELL_GRANT_ACCESS.CLASS_LIST_ONLY
  if (listOnly !== Boolean(authored.classListIds?.length)) {
    return compileFailure({
      code: listOnly ? 'SPELL_GRANT_CLASS_LIST_MISSING' : 'SPELL_GRANT_CLASS_LIST_UNUSED',
      message: listOnly
        ? 'A class-list-only spell grant must name the class spell lists it joins.'
        : 'Only a class-list-only spell grant may name class spell lists.',
      severity: COMPILE_DIAGNOSTIC_SEVERITY.ERROR,
      path: ['classListIds']
    })
  }
  if (
    listOnly &&
    (authored.scalingKind !== SCALING.NONE ||
      authored.authoringModeKind !== AUTHORING_MODE_KIND.SELECTED)
  ) {
    return compileFailure({
      code: 'SPELL_GRANT_CLASS_LIST_SHAPE',
      message: 'A class-list-only spell grant must name its spells and not scale.',
      severity: COMPILE_DIAGNOSTIC_SEVERITY.ERROR,
      path: ['access']
    })
  }
  const base = {
    id: authored.id,
    castAtLevel: authored.castAtLevel,
    ...(authored.castingAbility ? { castingAbility: authored.castingAbility } : {}),
    ...(authored.spellSaveDc ? { spellSaveDc: authored.spellSaveDc } : {}),
    charges:
      'charges' in authored && authored.charges ? compileChargeUse(authored.charges) : undefined,
    attributes: authored.attributes && authored.attributes.length ? authored.attributes : undefined,
    filters: authored.filters,
    restrictions: authored.restrictions,
    ...(authored.allowedCreatureTypeIds?.length
      ? { allowedCreatureTypeIds: authored.allowedCreatureTypeIds }
      : {}),
    ...(authored.perTargetLockout ? { perTargetLockout: authored.perTargetLockout } : {}),
    ...(authored.slotCost ? { slotCost: authored.slotCost } : {}),
    ...(listOnly ? { access: authored.access, classListIds: authored.classListIds } : {}),
    order: authored.order
  }

  switch (authored.scalingKind) {
    case SCALING.NONE: {
      switch (authored.selectionKind) {
        case AUTHORING_SELECTION_KIND.GRANTED: {
          return compileSuccess({
            ...base,
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            ...compileSpellTarget(authored)
          })
        }

        case AUTHORING_SELECTION_KIND.CHOSEN: {
          return compileSuccess({
            ...base,
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            scalingKind: SCALING.NONE,
            ...compileSpellTarget(authored),
            count: authored.count,
            selectionDuplicatePolicy: authored.selectionDuplicatePolicy
          })
        }

        default:
          return assertNever(authored)
      }
    }

    case SCALING.PER_LEVEL: {
      const { levels: _levels, ...scalingSource } = authored.progression
      switch (authored.selectionKind) {
        case AUTHORING_SELECTION_KIND.CHOSEN: {
          return compileSuccess({
            ...base,
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            scalingKind: SCALING.PER_LEVEL,
            ...scalingSource,
            levels: authored.progression.levels.map((entry) => ({
              level: entry.level,
              count: entry.count,
              selectionDuplicatePolicy: entry.selectionDuplicatePolicy,
              order: entry.order,
              ...compileSpellTarget(entry)
            }))
          })
        }

        case AUTHORING_SELECTION_KIND.GRANTED: {
          return compileSuccess({
            ...base,
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED, // <- literal
            scalingKind: SCALING.PER_LEVEL,
            ...scalingSource,
            levels: authored.progression.levels.map((entry) => ({
              level: entry.level,
              order: entry.order,
              ...compileSpellTarget(entry)
            }))
          })
        }

        default:
          return assertNever(authored)
      }
    }

    default:
      return assertNever(authored)
  }
}

export function compileSpellGrant(authored: SpellGrantAuthored): CompiledSpellGrant {
  return unwrapCompileResult(compileSpellGrantResult(authored))
}
