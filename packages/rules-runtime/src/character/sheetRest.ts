import type { HitPointMaximumFractionDto } from '@artificer-toolkit/schema/shared/hitPointMaximumFraction'
import { CLASS_CATEGORY } from '@artificer-toolkit/shared/core'
import {
  temporaryHitPointsSet,
  withCharacterTemporaryHitPoints
} from '@artificer-toolkit/schema/shared/temporaryHitPoints'
import {
  clampCharacterCurrentHitPoints,
  formatCharacterHitDiceRollExpression,
  resolveCharacterEffectiveMaximumHitPoints,
  validateCharacterHitDiceRollEvidence,
  type CharacterSheetAdjustment
} from '@artificer-toolkit/shared/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type {
  CharacterRestPreviewRequestDto,
  CharacterRestPreviewResponseDto,
  CharacterSheetCommandInputDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type { CharacterCompletedRestResultDto } from '@artificer-toolkit/schema/api/characterSheet'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  CharacterSheetCommandError,
  clearEmptyStateArrays,
  getHitPointAdjustment
} from './sheetCommandReducer.js'
import { endSubscriptions } from '../events/effectHooks.js'
import { systemCoreCodeRegistry } from '../platformSystemCoreCodes.js'
import type { CharacterBuilderResolution } from './builderTypes.js'

function parseCharacterClassHitDie(dieConfig: string | undefined): number | undefined {
  const match = dieConfig?.trim().match(/^(?:1)?d(\d+)$/i)
  if (!match) return undefined
  const die = Number(match[1])
  return Number.isSafeInteger(die) && die >= 2 ? die : undefined
}

/** The reset kinds a rest recovers: a long rest recovers short-rest resources too. Shared with creature rests. */
export function getRestRecoveryTriggers(restKind: 'SHORT' | 'LONG') {
  return restKind === 'LONG'
    ? new Set(['SHORT_REST', 'LONG_REST'] as const)
    : new Set(['SHORT_REST'] as const)
}

/**
 * Whether finishing a rest deletes this Character active effect: one that ends on a long rest
 * (Contact Other Plane's madness), a scalar reduction whose recovery triggers match, or a hit point
 * maximum reduction that ends on a long rest (Life Drain, D62).
 */
export function activeEffectEndsOnRest(
  effect: Pick<ActiveRuleEffectRecord, 'definition'>,
  restKind: 'SHORT' | 'LONG'
): boolean {
  if (
    endSubscriptions(effect).some(
      (subscription) => subscription.event === 'REST' && subscription.restKind === restKind
    )
  )
    return true
  const triggers = getRestRecoveryTriggers(restKind)
  return effect.definition.stateContributions.some(
    (contribution) =>
      (contribution.kind === 'SCALAR_REDUCTION' &&
        contribution.recoveryTriggers.some((trigger) => triggers.has(trigger))) ||
      (contribution.kind === 'HIT_POINT_MAXIMUM_REDUCTION' &&
        restKind === 'LONG' &&
        contribution.recoveryTags.includes('LONG_REST'))
  )
}

function recoverCharacterHitDice(
  hitDice: CharacterAuthored['state']['hitpoints']['hitDice'],
  recoveryCount: number
): {
  hitDice: CharacterAuthored['state']['hitpoints']['hitDice']
  recovered: Array<{ die: number; count: number }>
} {
  let remaining = recoveryCount
  const recoveredByDie = new Map<number, number>()
  for (const pool of [...hitDice].sort((left, right) => right.die - left.die)) {
    const recovered = Math.min(pool.used, remaining)
    if (recovered > 0) recoveredByDie.set(pool.die, recovered)
    remaining -= recovered
  }
  return {
    hitDice: hitDice.map((pool) => ({
      ...pool,
      used: pool.used - (recoveredByDie.get(pool.die) ?? 0)
    })),
    recovered: [...recoveredByDie]
      .map(([die, count]) => ({ die, count }))
      .sort((left, right) => right.die - left.die)
  }
}

function sameHitDiceRollTerms(
  evidence: NonNullable<CharacterRestPreviewRequestDto['rollEvidence']>,
  expected: ReadonlyArray<{ die: number; count: number; modifierPerDie: number }>
): boolean {
  if (evidence.terms.length !== expected.length) return false
  const terms = [...evidence.terms].sort((left, right) => right.die - left.die)
  const normalizedExpected = [...expected].sort((left, right) => right.die - left.die)
  return terms.every((term, index) => {
    const candidate = normalizedExpected[index]
    return (
      candidate !== undefined &&
      term.die === candidate.die &&
      term.count === candidate.count &&
      term.modifierPerDie === candidate.modifierPerDie
    )
  })
}

export function validateCharacterRestRollEvidence(params: {
  characterId: string
  evidence: CharacterRestPreviewRequestDto['rollEvidence']
  rollId?: string
  roll: RollRecordDto | null
}): void {
  if (!params.evidence && !params.rollId) return
  if (!params.evidence || !params.rollId) {
    throw new CharacterSheetCommandError('Hit-die evidence must reference its authoritative roll.')
  }

  const roll = params.roll
  if (
    !roll ||
    roll.characterId !== params.characterId ||
    roll.source.kind !== 'HIT_DIE' ||
    roll.normalizedExpression !== params.evidence.expression ||
    roll.evidence.total !== params.evidence.total ||
    roll.evidence.modifier !==
      params.evidence.terms.reduce((total, term) => total + term.count * term.modifierPerDie, 0) ||
    roll.evidence.terms.length !== params.evidence.terms.length ||
    params.evidence.terms.some((term) => {
      const recorded = roll.evidence.terms.find((candidate) => candidate.die === term.die)
      return (
        !recorded ||
        recorded.count !== term.count ||
        recorded.rolls.length !== term.rolls.length ||
        recorded.rolls.some((value, index) => value !== term.rolls[index])
      )
    })
  ) {
    throw new CharacterSheetCommandError('Hit-die evidence does not match its authoritative roll.')
  }
}

export async function buildCharacterRestPreview(params: {
  character: CharacterAuthored
  resolution: CharacterBuilderResolution
  characterAdjustments?: readonly CharacterSheetAdjustment[]
  effectiveMaximum: number
  restPolicy: CharacterRulePolicyOutput['rest']
  ruleRevisionId?: string
  sheet: CharacterSheetResponseDto
  input: CharacterRestPreviewRequestDto
}): Promise<CharacterRestPreviewResponseDto> {
  const { character, resolution, sheet, input } = params
  const characterAdjustments = params.characterAdjustments ?? []
  const maximumModifier = getHitPointAdjustment(characterAdjustments, 'MAXIMUM_MODIFIER') ?? 0
  const canResetMaximumModifier = maximumModifier !== 0
  const effectiveMaximum = params.effectiveMaximum
  const currentMaximum = resolveCharacterEffectiveMaximumHitPoints(sheet.overview.maxHitPoints)
  const currentHitPoints = clampCharacterCurrentHitPoints(
    sheet.overview.currentHitPoints,
    input.resetMaximumHitPointModifier ? effectiveMaximum : currentMaximum
  )
  const constitutionModifier = params.restPolicy.hitDieConstitutionModifier
  const classLabelsByDie = new Map<number, string[]>()
  for (const classSummary of resolution.summary.classes) {
    const authoredClass = resolution.registry.classes.find(
      (candidate) =>
        candidate.id === classSummary.classId && candidate.category === CLASS_CATEGORY.BASE
    )
    const die = parseCharacterClassHitDie(
      authoredClass && 'hitpoint' in authoredClass ? authoredClass.hitpoint?.dieConfig : undefined
    )
    if (!die) continue
    const labels = classLabelsByDie.get(die) ?? []
    labels.push(classSummary.classLabel)
    classLabelsByDie.set(die, labels)
  }
  if (input.restKind === 'LONG' && input.selectedHitDice.length > 0)
    throw new CharacterSheetCommandError('Long rests do not spend hit dice.')
  const selectionsByDie = new Map(
    input.selectedHitDice.map((selection) => [selection.die, selection.count])
  )
  for (const selection of input.selectedHitDice) {
    const pool = sheet.overview.hitDice.find((candidate) => candidate.die === selection.die)
    if (!pool) throw new CharacterSheetCommandError(`No d${selection.die} hit dice are available.`)
    if (selection.count > pool.remaining)
      throw new CharacterSheetCommandError(
        `Only ${pool.remaining} d${selection.die} hit dice are available.`
      )
  }
  const rollTerms = input.selectedHitDice.map((selection) => ({
    ...selection,
    modifierPerDie: constitutionModifier
  }))
  if (input.restKind === 'LONG' && input.rollEvidence)
    throw new CharacterSheetCommandError('Long rests do not accept hit-die roll evidence.')
  const rollEvidence = input.rollEvidence
  if (rollEvidence) {
    try {
      validateCharacterHitDiceRollEvidence(rollEvidence)
    } catch (error) {
      throw new CharacterSheetCommandError(
        error instanceof Error ? error.message : 'Invalid hit-die roll evidence.'
      )
    }
    if (!sameHitDiceRollTerms(rollEvidence, rollTerms))
      throw new CharacterSheetCommandError(
        'Hit-die roll evidence does not match the selected hit dice.'
      )
  }
  const triggers = getRestRecoveryTriggers(input.restKind)
  const characterResources = sheet.resources.items
    .filter(
      (resource) =>
        resource.owner.kind !== 'COMPANION_FEATURE' &&
        resource.used > 0 &&
        resource.recoveries.some((recovery) =>
          triggers.has(recovery.trigger as 'SHORT_REST' | 'LONG_REST')
        )
    )
    .map((resource) => ({ id: resource.id, label: resource.label, recovered: resource.used }))
    .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id))
  const shortRestPoolCodes = new Set(
    systemCoreCodeRegistry
      .entries(character.systemId, 'spellSlotPool')
      .filter((pool) => pool.recoversOnShortRest)
      .map(({ code }) => code)
  )
  const spellSlots = sheet.spells.slots
    .filter(
      (slot) => slot.used > 0 && (input.restKind === 'LONG' || shortRestPoolCodes.has(slot.slotKey))
    )
    .map((slot) => ({ id: slot.slotKey, label: slot.label, recovered: slot.used }))
    .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id))
  const selectedCompanionIds = new Set(input.selectedCompanionInstanceIds)
  const companionHitDiceRecoveryById = new Map(
    params.restPolicy.companionHitDiceRecoveredAfterLongRest.map((companion) => [
      companion.companionInstanceId,
      companion.recovered
    ])
  )
  const eligibleCompanions = sheet.extras.items
    .filter((extra) => extra.isActive)
    .flatMap((extra) => {
      if (extra.kind === 'VEHICLE' || extra.kind === 'SPELL_SUMMON') return []
      const companionHitDiceRecovery = companionHitDiceRecoveryById.get(extra.id)
      if (input.restKind === 'LONG' && companionHitDiceRecovery === undefined)
        throw new CharacterSheetCommandError(
          `Companion "${extra.id}" is missing from the Character rest policy.`
        )
      const hitDiceRecovery =
        input.restKind === 'LONG'
          ? recoverCharacterHitDice(extra.hitDice, companionHitDiceRecovery ?? 0).recovered
          : []
      const resources = sheet.resources.items
        .filter(
          (resource) =>
            resource.owner.kind === 'COMPANION_FEATURE' &&
            resource.owner.companionInstanceId === extra.id &&
            resource.used > 0 &&
            resource.recoveries.some((recovery) =>
              triggers.has(recovery.trigger as 'SHORT_REST' | 'LONG_REST')
            )
        )
        .map((resource) => ({ id: resource.id, label: resource.label, recovered: resource.used }))
        .sort(
          (left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
        )
      if (hitDiceRecovery.length === 0 && resources.length === 0) return []
      const recoveryByDie = new Map(hitDiceRecovery.map((pool) => [pool.die, pool.count]))
      return [
        {
          companionInstanceId: extra.id,
          label: extra.displayName,
          selected: selectedCompanionIds.has(extra.id),
          hitDice: extra.hitDice.map((pool) => ({
            die: pool.die,
            total: pool.total,
            used: pool.used,
            remaining: pool.remaining,
            recovered: recoveryByDie.get(pool.die) ?? 0
          })),
          resources
        }
      ]
    })
    .sort(
      (left, right) =>
        left.label.localeCompare(right.label) ||
        left.companionInstanceId.localeCompare(right.companionInstanceId)
    )
  const eligibleCompanionIds = new Set(
    eligibleCompanions.map((companion) => companion.companionInstanceId)
  )
  for (const companionId of selectedCompanionIds)
    if (!eligibleCompanionIds.has(companionId))
      throw new CharacterSheetCommandError(
        `Companion "${companionId}" has no eligible recovery for this rest.`
      )
  const missingHitPoints = Math.max(effectiveMaximum - currentHitPoints, 0)
  const stagedHealing = Math.min(Math.max(rollEvidence?.total ?? 0, 0), missingHitPoints)
  const canonicalExpression =
    rollTerms.length > 0 ? formatCharacterHitDiceRollExpression(rollTerms) : undefined
  const selectedCompanionRecoveries = eligibleCompanions.filter((companion) => companion.selected)
  const hasSelectedDice = input.selectedHitDice.length > 0
  const healingDecisionResolved =
    !hasSelectedDice ||
    (rollEvidence !== undefined &&
      (input.healingMode === 'AUTOMATIC' || input.manualHealingAccepted))
  const hasMeaningfulRecovery =
    hasSelectedDice ||
    characterResources.length > 0 ||
    spellSlots.length > 0 ||
    selectedCompanionRecoveries.length > 0 ||
    // An ended standing effect this rest turns back on (SPELLS-31.2).
    sheet.overview.standingEffects.some(
      ({ held, returnsOn }) => !held && getRestRecoveryTriggers(input.restKind).has(returnsOn)
    ) ||
    (input.resetMaximumHitPointModifier && canResetMaximumModifier) ||
    (input.restKind === 'LONG' &&
      (currentHitPoints !== effectiveMaximum ||
        sheet.overview.tempHitPoints > 0 ||
        sheet.overview.exhaustion.level > sheet.overview.exhaustion.minimumLevel ||
        sheet.overview.hitDice.some((pool) => pool.used > 0)))
  const longRestPolicy =
    input.restKind === 'LONG'
      ? (() => {
          const hitDiceRecoveryCount = params.restPolicy.hitDiceRecoveredAfterLongRest
          return {
            exhaustionAfter: params.restPolicy.exhaustionAfterLongRest,
            hitDiceRecoveryCount,
            recoveredHitDice: recoverCharacterHitDice(
              character.state.hitpoints.hitDice,
              hitDiceRecoveryCount
            ).recovered
          }
        })()
      : undefined
  const fingerprintInput = {
    restKind: input.restKind,
    streamVersion: sheet.meta.streamVersion,
    rulesPolicy: {
      ...(params.ruleRevisionId === undefined ? {} : { revisionId: params.ruleRevisionId }),
      rest: params.restPolicy,
      longRest: longRestPolicy
    },
    hitPoints: {
      current: currentHitPoints,
      maximum: effectiveMaximum,
      temporary: sheet.overview.tempHitPoints,
      maximumModifier
    },
    selectedHitDice: [...input.selectedHitDice].sort((left, right) => right.die - left.die),
    resetMaximumHitPointModifier: input.resetMaximumHitPointModifier,
    healingMode: input.healingMode,
    manualHealingAccepted: input.manualHealingAccepted,
    selectedCompanionInstanceIds: [...selectedCompanionIds].sort(),
    rollEvidence,
    automaticRecoveries: { resources: characterResources, spellSlots },
    eligibleCompanions
  }
  const previewFingerprint = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(sortFingerprintValue(fingerprintInput)))
      )
    ),
    (byte) => byte.toString(16).padStart(2, '0')
  ).join('')
  return {
    restKind: input.restKind,
    streamVersion: sheet.meta.streamVersion,
    previewFingerprint,
    hitPoints: {
      current: currentHitPoints,
      maximum: effectiveMaximum,
      temporary: sheet.overview.tempHitPoints,
      missing: missingHitPoints,
      maximumHitPointModifier: maximumModifier,
      canResetMaximumHitPointModifier: canResetMaximumModifier
    },
    hitDice: sheet.overview.hitDice.map((pool) => ({
      ...pool,
      classLabels: classLabelsByDie.get(pool.die) ?? [`d${pool.die} Hit Dice`],
      selected: selectionsByDie.get(pool.die) ?? 0,
      constitutionModifier
    })),
    healingMode: input.healingMode,
    manualHealingAccepted: input.manualHealingAccepted,
    ...(canonicalExpression ? { canonicalExpression } : {}),
    ...(rollEvidence ? { rollEvidence } : {}),
    stagedHealing,
    automaticRecoveries: { resources: characterResources, spellSlots },
    eligibleCompanions,
    canApply: healingDecisionResolved && hasMeaningfulRecovery
  }
}

export function applyCompletedCharacterRest(params: {
  character: CharacterAuthored
  command: Extract<CharacterSheetCommandInputDto, { type: 'COMPLETE_REST' }>
  preview: CharacterRestPreviewResponseDto
  restPolicy: CharacterRulePolicyOutput['rest']
  /** The maximum-HP fraction the rest leaves the Character; a long rest can lift it. */
  maximumFraction: HitPointMaximumFractionDto | null
  sheet: CharacterSheetResponseDto
}): {
  character: CharacterAuthored
  result: CharacterCompletedRestResultDto
  allRecoveredResourceIds: string[]
} {
  const { character, command, preview, sheet } = params
  const next = structuredClone(character)
  const currentBefore = clampCharacterCurrentHitPoints(
    sheet.overview.currentHitPoints,
    sheet.overview.maxHitPoints
  )
  const temporaryBefore = Math.max(sheet.overview.tempHitPoints, 0)
  const exhaustionBefore = sheet.overview.exhaustion.level
  let recoveredHitDice: Array<{ die: number; count: number }> = []
  if (command.restKind === 'SHORT') {
    const spentByDie = new Map(
      command.selectedHitDice.map((selection) => [selection.die, selection.count])
    )
    next.state.hitpoints.hitDice = next.state.hitpoints.hitDice.map((pool) => ({
      ...pool,
      used: pool.used + (spentByDie.get(pool.die) ?? 0)
    }))
    next.state.hitpoints.current = clampCharacterCurrentHitPoints(
      preview.hitPoints.current + preview.stagedHealing,
      preview.hitPoints.maximum
    )
    const recoveredSlotKeys = new Set(preview.automaticRecoveries.spellSlots.map((slot) => slot.id))
    next.state.spellSlots = next.state.spellSlots?.filter(
      (slot) => !recoveredSlotKeys.has(slot.slotKey)
    )
  } else {
    const characterHitDice = recoverCharacterHitDice(
      next.state.hitpoints.hitDice,
      params.restPolicy.hitDiceRecoveredAfterLongRest
    )
    next.state.hitpoints.current = preview.hitPoints.maximum
    next.state.hitpoints.maximumFraction = params.maximumFraction ?? undefined
    next.state.hitpoints = withCharacterTemporaryHitPoints(
      next.state.hitpoints,
      temporaryHitPointsSet(0)
    )
    next.state.hitpoints.hitDice = characterHitDice.hitDice
    next.state.spellSlots = undefined
    // A long rest ends every creature a spell cast from the Sheet conjured for a duration (D190).
    const untimedSummons = next.state.spellSummons?.filter((summon) => summon.untimed)
    next.state.spellSummons = untimedSummons?.length ? untimedSummons : undefined
    recoveredHitDice = characterHitDice.recovered
    const exhaustionAfter = params.restPolicy.exhaustionAfterLongRest
    next.state.exhaustion =
      exhaustionAfter > 0
        ? {
            level: exhaustionAfter,
            ...(next.state.exhaustion?.notes ? { notes: next.state.exhaustion.notes } : {})
          }
        : undefined
  }
  const selectedCompanions = new Map(
    preview.eligibleCompanions
      .filter((companion) => companion.selected)
      .map((companion) => [companion.companionInstanceId, companion])
  )
  next.state.creatures = next.state.creatures?.map((creature) => {
    const recovery = selectedCompanions.get(creature.id)
    if (!recovery || command.restKind !== 'LONG' || !creature.hitDice) return creature
    const recoveredByDie = new Map(
      recovery.hitDice
        .filter((pool) => pool.recovered > 0)
        .map((pool) => [pool.die, pool.recovered])
    )
    return {
      ...creature,
      hitDice: creature.hitDice.map((pool) => ({
        ...pool,
        used: pool.used - (recoveredByDie.get(pool.die) ?? 0)
      }))
    }
  })
  const companionRecoveries = preview.eligibleCompanions
    .filter((companion) => companion.selected)
    .map((companion) => ({
      companionInstanceId: companion.companionInstanceId,
      recoveredHitDice: companion.hitDice
        .filter((pool) => pool.recovered > 0)
        .map((pool) => ({ die: pool.die, count: pool.recovered })),
      recoveredResourceIds: companion.resources.map((resource) => resource.id)
    }))
  const allRecoveredResourceIds = [
    ...preview.automaticRecoveries.resources.map((resource) => resource.id),
    ...companionRecoveries.flatMap((companion) => companion.recoveredResourceIds)
  ]
  const currentAfter = clampCharacterCurrentHitPoints(
    next.state.hitpoints.current,
    preview.hitPoints.maximum
  )
  next.state.hitpoints.current = currentAfter
  return {
    character: clearEmptyStateArrays(next),
    allRecoveredResourceIds,
    result: {
      restKind: command.restKind,
      previewFingerprint: preview.previewFingerprint,
      hitPoints: {
        currentBefore,
        currentAfter,
        temporaryBefore,
        temporaryAfter: Math.max(next.state.hitpoints.temp, 0),
        healingApplied: Math.max(currentAfter - preview.hitPoints.current, 0)
      },
      exhaustion: { before: exhaustionBefore, after: next.state.exhaustion?.level ?? 0 },
      spentHitDice: command.restKind === 'SHORT' ? command.selectedHitDice : [],
      recoveredHitDice,
      ...(preview.rollEvidence ? { rollEvidence: preview.rollEvidence } : {}),
      resetMaximumHitPointModifier:
        command.resetMaximumHitPointModifier && preview.hitPoints.canResetMaximumHitPointModifier,
      recoveredResourceIds: preview.automaticRecoveries.resources.map((resource) => resource.id),
      recoveredSpellSlotKeys: preview.automaticRecoveries.spellSlots.map((slot) => slot.id),
      companionRecoveries
    }
  }
}

function sortFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortFingerprintValue)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortFingerprintValue(entry)])
  )
}
