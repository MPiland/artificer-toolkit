const resourceContexts = (modifier: string) =>
  `${modifier}.grant.restrictions == null ? [] : flatten(map(${modifier}.grant.restrictions.groups as group, filter(group.contexts as context, context.subject == "RESOURCE")))`

const hasResourceScope = (modifier: string) => `len(${resourceContexts(modifier)}) > 0`

const resourceContextMatches = (modifier: string, resource: string) =>
  `some(${resourceContexts(modifier)} as context, (context.resourceIds != null and some(context.resourceIds, # == ${resource})) or (context.conditions != null and some(context.conditions as condition, condition.resourceIds != null and some(condition.resourceIds, # == ${resource}))))`

const resetModifiers = (resource: string) =>
  `filter(grantFold.modifiers as modifier, modifier.grant.valueDomainCode == "CHARGE_RESET" and modifier.grant.modifierKind == "REPLACE_CHARGE_RESET_KIND" and modifier.grant.payload != null and modifier.grant.payload.resetKind != null and (!(${hasResourceScope('modifier')}) or ${resourceContextMatches('modifier', resource)}))`

const resetResolution = (resource: string) => {
  const modifiers = resetModifiers(resource)
  const last = `${modifiers}[len(${modifiers}) - 1]`
  return `(pool.ownerKind != "AUTHORED_GRANT" and pool.ownerKind != "AUTHORED_SOURCE") ? { baseResetKind: pool.baseResetKind, appliedGrantId: null, source: null } : len(${modifiers}) == 0 ? { baseResetKind: pool.baseResetKind, appliedGrantId: null, source: null } : { baseResetKind: pool.baseResetKind, appliedGrantId: ${last}.grant.id, source: ${last}.source }`
}

const resolvedResetKind = (resource: string) => {
  const modifiers = resetModifiers(resource)
  const lastKind = `${modifiers}[len(${modifiers}) - 1].grant.payload.resetKind`
  return `(pool.ownerKind != "AUTHORED_GRANT" and pool.ownerKind != "AUTHORED_SOURCE") ? pool.baseResetKind : len(${modifiers}) == 0 ? pool.baseResetKind : (${lastKind} == "DAILY" or ${lastKind} == "DAWN" or ${lastKind} == "DUSK" or ${lastKind} == "LONG_REST" or ${lastKind} == "SHORT_REST" or ${lastKind} == "MANUAL" ? ${lastKind} : "MANUAL")`
}

const ownerFields =
  'pool.ownerKind == "AUTHORED_GRANT" ? { resourceGrantId: pool.resourceGrantId, availableAtLevel: pool.availableAtLevel, activeSourceLevel: pool.activeSourceLevel } : pool.ownerKind == "AUTHORED_SOURCE" ? { sourceId: pool.sourceId, source: pool.source } : pool.ownerKind == "ITEM_INSTANCE" ? { itemInstanceId: pool.itemInstanceId, sourceId: pool.sourceId } : pool.ownerKind == "COMPANION_FEATURE" ? { companionInstanceId: pool.companionInstanceId, featureId: pool.featureId } : { accessId: pool.accessId, sourceInstanceId: pool.sourceInstanceId, spellId: pool.spellId }'

const resourceCandidates =
  'filter(resourcePoolCandidates as candidate, (candidate.ownerKind != "AUTHORED_GRANT" or candidate.activeSourceLevel >= candidate.availableAtLevel) and (candidate.ownerKind != "AUTHORED_SOURCE" or some(grantFold.activeSourceIds, # == candidate.sourceId)) and (candidate.ownerKind != "ITEM_INSTANCE" or candidate.sourceId == null or some(grantFold.activeSourceIds, # == candidate.sourceId)) and (candidate.ownerKind != "SPELL_SOURCE" or some(spellAccess as access, access.accessId == candidate.accessId)))'

const rawUsed =
  'len(filter(resourceUsageFacts == null ? [] : resourceUsageFacts as usage, usage.poolId == pool.poolId)) == 1 ? filter(resourceUsageFacts == null ? [] : resourceUsageFacts as usage, usage.poolId == pool.poolId)[0].rawUsed : 0'

export const dnd5e2014CharacterResourcePolicyExpressions = [
  {
    id: 'resolved-resource-pools',
    key: 'resolvedResourcePools',
    value: `map(${resourceCandidates} as pool, merge([{ sequence: pool.sequence, poolId: pool.poolId, ownerKind: pool.ownerKind, resourceDefinitionId: pool.resourceDefinitionId, chargeId: pool.chargeId, chargeCalculationId: pool.chargeCalculationId }, ${ownerFields}, { state: len(filter(resolvedChargeMaximums as maximum, maximum.calculationId == pool.chargeCalculationId)) == 1 ? filter(resolvedChargeMaximums as maximum, maximum.calculationId == pool.chargeCalculationId)[0].state : "UNRESOLVED", maximum: len(filter(resolvedChargeMaximums as maximum, maximum.calculationId == pool.chargeCalculationId)) == 1 ? filter(resolvedChargeMaximums as maximum, maximum.calculationId == pool.chargeCalculationId)[0].maximum : null, rawUsed: ${rawUsed}, effectiveUsed: len(filter(resolvedChargeMaximums as maximum, maximum.calculationId == pool.chargeCalculationId)) == 1 and filter(resolvedChargeMaximums as maximum, maximum.calculationId == pool.chargeCalculationId)[0].state == "RESOLVED" ? min([${rawUsed}, filter(resolvedChargeMaximums as maximum, maximum.calculationId == pool.chargeCalculationId)[0].maximum]) : null, remaining: len(filter(resolvedChargeMaximums as maximum, maximum.calculationId == pool.chargeCalculationId)) == 1 and filter(resolvedChargeMaximums as maximum, maximum.calculationId == pool.chargeCalculationId)[0].state == "RESOLVED" ? max([filter(resolvedChargeMaximums as maximum, maximum.calculationId == pool.chargeCalculationId)[0].maximum - min([${rawUsed}, filter(resolvedChargeMaximums as maximum, maximum.calculationId == pool.chargeCalculationId)[0].maximum]), 0]) : null, reasonCode: len(filter(resolvedChargeMaximums as maximum, maximum.calculationId == pool.chargeCalculationId)) == 1 and filter(resolvedChargeMaximums as maximum, maximum.calculationId == pool.chargeCalculationId)[0].state == "RESOLVED" ? "CALCULATED" : "MISSING_REQUIRED_FACT", baseContribution: len(filter(resolvedChargeMaximums as maximum, maximum.calculationId == pool.chargeCalculationId)) == 1 ? filter(resolvedChargeMaximums as maximum, maximum.calculationId == pool.chargeCalculationId)[0].baseContribution : null, bonusContributions: len(filter(resolvedChargeMaximums as maximum, maximum.calculationId == pool.chargeCalculationId)) == 1 ? filter(resolvedChargeMaximums as maximum, maximum.calculationId == pool.chargeCalculationId)[0].bonusContributions : [], resetKind: ${resolvedResetKind('pool.resourceDefinitionId')}, resetResolution: ${resetResolution('pool.resourceDefinitionId')} }]))`
  }
]

export const dnd5e2014CharacterResourcePolicyOutputExpression = {
  id: 'resources',
  key: 'resources',
  value: 'resolvedResourcePools'
}
