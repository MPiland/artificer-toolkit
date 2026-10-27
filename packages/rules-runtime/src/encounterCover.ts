import type { D20FoldedBonusDto } from '@artificer-toolkit/schema/shared/d20FoldedBonuses'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'

type SystemCoverTier = NonNullable<SystemAuthoredDto['cover']>['tiers'][number]
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
 * The target's cover on the live Scene under the System's cover data. The GM's override on the target
 * token wins against any origin; otherwise the tier is computed while `automatic` is on. Null when the
 * System authors none, nothing sets a tier, the override names no tier the System knows, or the grid
 * cannot be judged (not square, or a space is not cell-aligned).
 */
export function resolveEncounterCover(input: {
  system: Pick<SystemAuthoredDto, 'cover'>
  scene: Pick<CampaignSceneState, 'barriers' | 'doorStates' | 'grid' | 'tokens'>
  origin: SquareGridCoverOrigin
  targetTokenId: string
  /** The Campaign's automatic cover setting, frozen into the Run. */
  automatic: boolean
}): EncounterCoverFacts | null {
  const rules = input.system.cover
  const target = input.scene.tokens.find(({ id }) => id === input.targetTokenId)
  if (!rules || !target) return null
  const facts = (tier: SystemCoverTier | null): EncounterCoverFacts => ({
    tier: tier && { label: tier.label, bonus: tier.bonus, blocksTargeting: tier.blocksTargeting },
    saveAbilityDefinitionIds: rules.saveAbilityDefinitionIds
  })
  if (target.coverTierOverride) {
    const { tierCode } = target.coverTierOverride
    if (tierCode === null) return facts(null)
    const tier = rules.tiers.find(({ code }) => code === tierCode)
    return tier ? facts(tier) : null
  }
  if (!input.automatic) return null
  const cover = resolveSquareGridCover({
    creatures: input.scene.tokens,
    origin: input.origin,
    rules,
    state: input.scene,
    target
  })
  return cover && facts(cover.tier)
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
