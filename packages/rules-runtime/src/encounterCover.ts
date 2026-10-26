import type { D20FoldedBonusDto } from '@artificer-toolkit/schema/shared/d20FoldedBonuses'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import {
  resolveSquareGridCover,
  type CampaignSceneState,
  type SquareGridCoverOrigin
} from '@artificer-toolkit/shared/vtt'

/** The cover a target has from an origin, with the System data that says what the tier changes. */
export interface EncounterCoverFacts {
  /** Null when the lines to the target give no cover. */
  readonly tier: {
    readonly label: string
    readonly bonus: number
    readonly blocksTargeting: boolean
  } | null
  /** The abilities whose saving throws the tier's bonus adds to. */
  readonly saveAbilityDefinitionIds: readonly string[]
}

/**
 * The target's cover on the live Scene under the System's cover data. Null when the System authors
 * none or the grid cannot be judged (not square, or a space is not cell-aligned).
 */
export function resolveEncounterCover(input: {
  system: Pick<SystemAuthoredDto, 'cover'>
  scene: Pick<CampaignSceneState, 'barriers' | 'doorStates' | 'grid' | 'tokens'>
  origin: SquareGridCoverOrigin
  targetTokenId: string
}): EncounterCoverFacts | null {
  const rules = input.system.cover
  const target = input.scene.tokens.find(({ id }) => id === input.targetTokenId)
  if (!rules || !target) return null
  const cover = resolveSquareGridCover({
    creatures: input.scene.tokens,
    origin: input.origin,
    rules,
    state: input.scene,
    target
  })
  if (!cover) return null
  return {
    tier: cover.tier && {
      label: cover.tier.label,
      bonus: cover.tier.bonus,
      blocksTargeting: cover.tier.blocksTargeting
    },
    saveAbilityDefinitionIds: rules.saveAbilityDefinitionIds
  }
}

/**
 * The labelled bonus a cover tier folds into one d20 test: an attack's target armor class, or the
 * saver's roll when the save is of an ability the System's cover covers. Empty when it folds none.
 */
export function coverFoldedBonuses(
  cover: EncounterCoverFacts | null,
  test: { kind: 'ATTACK' } | { kind: 'SAVE'; abilityDefinitionId: string }
): D20FoldedBonusDto[] {
  if (!cover?.tier || cover.tier.bonus <= 0) return []
  const { label, bonus: amount } = cover.tier
  if (test.kind === 'ATTACK') return [{ label, amount, operand: 'defenseOrDc' }]
  return cover.saveAbilityDefinitionIds.includes(test.abilityDefinitionId)
    ? [{ label, amount, operand: 'modifier' }]
    : []
}
