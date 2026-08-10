import type { EngineResource } from '../contracts/engineState.js'
import type { RulesSystem } from '../contracts/rulesSystem.js'
import type { CharacterAssemblyRegistry } from '../registry.js'
import type { CharacterBuildSnapshot } from '../snapshot.js'
import type { EngineAccumulatedState } from './grantApplication.js'
import { resolveCompiledChargeMaximum } from '../../shared/compilers/charge.js'
import { resolveNumericCalculation } from './calculationResolver.js'

/**
 * Resolves class and selected subclass resource maximums from compiled class
 * resource data at the character's current class level.
 */
export function resolveResources(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem,
  modifierEntries: EngineAccumulatedState['modifierEntries'] = [],
  context: {
    abilities?: Readonly<Record<string, number>>
    proficiencyBonus?: number
  } = {}
): EngineResource[] {
  const out: EngineResource[] = []
  const proficiencyBonus =
    context.proficiencyBonus ?? rules.proficiencyBonus(Math.max(snapshot.totalLevel, 1))
  const classLevels = Object.fromEntries(
    snapshot.classes.map((entry) => [entry.classId, entry.level])
  )

  for (const cls of snapshot.classes) {
    const resourceOwnerIds = cls.subclassId ? [cls.classId, cls.subclassId] : [cls.classId]

    for (const resourceOwnerId of resourceOwnerIds) {
      const compiled = registry.classes[resourceOwnerId]
      if (!compiled?.resources) continue

      const resource = compiled.resources
      const maxCount = resolveCompiledChargeMaximum(resource.charges, {
        abilities: context.abilities ?? snapshot.abilities,
        classLevels,
        sourceClassLevel: cls.level,
        proficiencyBonus,
        totalLevel: snapshot.totalLevel
      })
      if (maxCount <= 0) continue

      out.push({
        resourceId: resource.id,
        label: resource.label,
        maxCount,
        maxCountCalculation: resolveNumericCalculation(maxCount),
        rechargeOn: mapResetKind(
          resolveResourceResetKind(resource.charges.resetKind, resource.id, modifierEntries)
        ),
        sourceFeatureId: resourceOwnerId
      })
    }
  }

  return out
}

type ChargeResetModifierGrant = {
  valueDomainCode?: string
  modifierKind?: string
  payload?: {
    resetKind?: string
  }
  restrictions?: {
    groups?: Array<{
      contexts?: Array<{
        subject?: string
        resourceIds?: string[]
        conditions?: Array<{
          resourceIds?: string[]
        }>
      }>
    }>
  }
}

export function resolveResourceResetKind(
  baseResetKind: string,
  resourceId: string,
  modifierEntries: EngineAccumulatedState['modifierEntries']
): string {
  let resetKind = baseResetKind

  for (const entry of modifierEntries) {
    const grant = entry.grant as ChargeResetModifierGrant
    if (grant.valueDomainCode !== 'CHARGE_RESET') continue
    if (grant.modifierKind !== 'REPLACE_CHARGE_RESET_KIND') continue
    if (!grant.payload?.resetKind) continue
    if (!targetsResource(grant, resourceId)) continue

    resetKind = grant.payload.resetKind
  }

  return resetKind
}

function targetsResource(grant: ChargeResetModifierGrant, resourceId: string): boolean {
  let hasResourceScope = false

  for (const group of grant.restrictions?.groups ?? []) {
    for (const context of group.contexts ?? []) {
      if (context.subject !== 'RESOURCE') continue

      hasResourceScope = true
      if (context.resourceIds?.includes(resourceId)) return true

      for (const condition of context.conditions ?? []) {
        if (condition.resourceIds?.includes(resourceId)) return true
      }
    }
  }

  return !hasResourceScope
}

function mapResetKind(resetKind: string): EngineResource['rechargeOn'] {
  switch (resetKind) {
    case 'DAILY':
      return 'DAILY'
    case 'DAWN':
      return 'DAWN'
    case 'DUSK':
      return 'DUSK'
    case 'SHORT_REST':
      return 'SHORT_REST'
    case 'LONG_REST':
      return 'LONG_REST'
    default:
      return 'MANUAL'
  }
}
