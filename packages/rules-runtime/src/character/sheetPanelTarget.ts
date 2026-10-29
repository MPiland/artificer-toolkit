import type { CharacterSheetPanelTargetDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type { CharacterSheetAdjustment } from '@artificer-toolkit/shared/character'

export function characterSheetAdjustmentMatchesPanelTarget(
  adjustment: CharacterSheetAdjustment,
  target: CharacterSheetPanelTargetDto
): boolean {
  switch (target.kind) {
    case 'ABILITY':
      return adjustment.family === 'ABILITY' && adjustment.ability === target.ability
    case 'SAVING_THROW':
      return adjustment.family === 'SAVING_THROW' && adjustment.ability === target.ability
    case 'SKILL':
      return adjustment.family === 'SKILL' && adjustment.skillId === target.skillId
    case 'SKILLS':
      return adjustment.family === 'SKILL'
    case 'SENSES':
      if (!target.entry) return adjustment.family === 'PASSIVE' || adjustment.family === 'SENSE'
      return target.entry.kind === 'PASSIVE'
        ? adjustment.family === 'PASSIVE' && adjustment.skillId === target.entry.skillId
        : adjustment.family === 'SENSE' && adjustment.senseId === target.entry.senseId
    case 'MOVEMENT':
      return adjustment.family === 'MOVEMENT'
    case 'HIT_POINTS':
      return adjustment.family === 'HIT_POINTS' && adjustment.field === 'MAXIMUM_MODIFIER'
    case 'DEFENSES':
      return adjustment.family === 'DEFENSE'
    case 'PROFICIENCIES':
      return adjustment.family === 'PROFICIENCY'
    case 'SPELL':
      return (
        adjustment.family === 'SPELL' &&
        adjustment.source.spellId === target.source.spellId &&
        adjustment.source.sourceKind === target.source.sourceKind &&
        adjustment.source.sourceInstanceId === target.source.sourceInstanceId
      )
    case 'SPELLS':
      return adjustment.family === 'SPELL'
    case 'ITEM':
      return adjustment.family === 'ITEM' && adjustment.itemInstanceId === target.itemInstanceId
    case 'COMPANION':
      return (
        adjustment.family === 'COMPANION' &&
        adjustment.companionInstanceId === target.companionInstanceId
      )
    case 'EXTRAS':
    case 'VEHICLE':
    case 'FEATURE':
    case 'BACKGROUND':
    case 'RESOURCE':
      return false
  }
}

/**
 * Every panel the Sheet itself links to, without a cast level or passive entry: the panels a write
 * stores (ADR 0041). PROFICIENCIES reads the resolution catalogue, so it is always derived live.
 */
export function listCharacterSheetPanelTargets(
  sheet: CharacterSheetResponseDto
): CharacterSheetPanelTargetDto[] {
  const { overview, reference, spells, inventory, resources, extras } = sheet
  return [
    ...overview.abilities.map(({ ability }) => ({ kind: 'ABILITY' as const, ability })),
    ...overview.savingThrows.map(({ ability }) => ({ kind: 'SAVING_THROW' as const, ability })),
    ...overview.skills.map(({ skillId }) => ({ kind: 'SKILL' as const, skillId })),
    { kind: 'SKILLS' },
    { kind: 'SENSES' },
    ...reference.senses.map(({ senseId }) => ({
      kind: 'SENSES' as const,
      entry: { kind: 'SENSE' as const, senseId }
    })),
    { kind: 'MOVEMENT' },
    { kind: 'DEFENSES' },
    { kind: 'SPELLS' },
    ...spells.spells.flatMap((spell) =>
      (spell.sources ?? []).map(({ source }) => ({ kind: 'SPELL' as const, source }))
    ),
    ...inventory.items.map(({ id }) => ({ kind: 'ITEM' as const, itemInstanceId: id })),
    ...resources.items.map(({ owner }) => ({ kind: 'RESOURCE' as const, owner })),
    { kind: 'EXTRAS' },
    ...extras.items.flatMap((extra): CharacterSheetPanelTargetDto[] =>
      extra.kind === 'VEHICLE'
        ? [{ kind: 'VEHICLE' as const, vehicleInstanceId: extra.id }]
        : extra.kind === 'SPELL_SUMMON'
          ? []
          : [{ kind: 'COMPANION' as const, companionInstanceId: extra.id }]
    )
  ]
}

export function getCharacterSheetPanelAdjustmentIds(
  adjustments: readonly CharacterSheetAdjustment[],
  target: CharacterSheetPanelTargetDto
): Array<{ id: string; family: CharacterSheetAdjustment['family'] }> {
  return adjustments
    .filter((adjustment) => characterSheetAdjustmentMatchesPanelTarget(adjustment, target))
    .map((adjustment) => ({ id: adjustment.id, family: adjustment.family }))
}
