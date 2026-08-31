import {
  CHARACTER_ACTION_MODEL_KEY,
  characterActionModelInputSchema,
  characterActionModelOutputSchema
} from '@artificer-toolkit/schema/api/characterActionRules'
import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema,
  type CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import {
  characterResourcesSchema,
  characterResourceUsageFactsSchema
} from '@artificer-toolkit/schema/api/characterResourceRules'
import type { DBLike } from '@artificer-toolkit/db'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import type { CharacterResourceUsage } from '@artificer-toolkit/shared/core'

import { evaluateRuleRevision } from '../rules/ruleRevisionRuntime.js'
import type { CharacterRuleEvaluationResult } from './characterRuleEvaluation.js'

type ResourceUsageInput = Pick<CharacterResourceUsage, 'owner' | 'used'>
type SpellSlotUsageInput = { slotKey: string; used: number }

export interface CharacterActionEvaluationResult {
  ruleEvaluation: CharacterRuleEvaluationResult
  zenEvaluationMs: number
}

export interface CharacterActionEvaluationState {
  binding: Pick<CharacterRuleEvaluationResult['binding'], 'revisionId'>
  facts: CharacterRuleEvaluationResult['facts']
  output: CharacterRuleEvaluationResult['output']
}

function buildUsageByPoolId(resourceUsage: readonly ResourceUsageInput[]): Map<string, number> {
  const usageByPoolId = new Map<string, number>()
  for (const usage of resourceUsage) {
    const poolId = createCharacterResourceOwnerKey(usage.owner)
    if (usageByPoolId.has(poolId)) {
      throw new Error(`Duplicate persisted resource usage for pool: ${poolId}`)
    }
    usageByPoolId.set(poolId, usage.used)
  }
  return usageByPoolId
}

function buildUsageBySlotKey(spellSlotUsage: readonly SpellSlotUsageInput[]): Map<string, number> {
  const usageBySlotKey = new Map<string, number>()
  for (const usage of spellSlotUsage) {
    if (usageBySlotKey.has(usage.slotKey)) {
      throw new Error(`Duplicate persisted spell-slot usage for slot: ${usage.slotKey}`)
    }
    usageBySlotKey.set(usage.slotKey, usage.used)
  }
  return usageBySlotKey
}

function resolveSpellSlots(
  committed: CharacterRulePolicyOutput['spellSlots'],
  usageBySlotKey: ReadonlyMap<string, number>
): CharacterRulePolicyOutput['spellSlots'] {
  return {
    ...committed,
    maxByLevel: committed.maxByLevel.map((slot) => {
      const rawUsed = usageBySlotKey.get(`STANDARD:${slot.spellLevel}`) ?? 0
      const effectiveUsed = Math.min(rawUsed, slot.slotCount)
      return { ...slot, rawUsed, effectiveUsed, remaining: slot.slotCount - effectiveUsed }
    }),
    pactMagic:
      committed.pactMagic === null
        ? null
        : (() => {
            const rawUsed = usageBySlotKey.get('PACT') ?? 0
            const effectiveUsed = Math.min(rawUsed, committed.pactMagic.slots)
            return {
              ...committed.pactMagic,
              rawUsed,
              effectiveUsed,
              remaining: committed.pactMagic.slots - effectiveUsed
            }
          })()
  }
}

export async function evaluateCharacterActionStateChange<
  T extends CharacterActionEvaluationState
>(params: {
  db: DBLike
  committed: T
  changedPoolId?: string
  changedSpellSlotKey?: string
  resourceUsage: readonly ResourceUsageInput[]
  spellSlotUsage: readonly SpellSlotUsageInput[]
}): Promise<{
  ruleEvaluation: T & {
    facts: CharacterRuleEvaluationResult['facts']
    output: CharacterRuleEvaluationResult['output']
  }
  zenEvaluationMs: number
}> {
  if (params.changedPoolId === undefined && params.changedSpellSlotKey === undefined) {
    throw new Error('A Character action-state change must identify a resource pool or spell slot.')
  }
  const usageByPoolId = buildUsageByPoolId(params.resourceUsage)
  if (
    params.changedPoolId !== undefined &&
    !params.committed.output.resources.some((resource) => resource.poolId === params.changedPoolId)
  ) {
    throw new Error(`Committed Character resource "${params.changedPoolId}" was not found.`)
  }
  const usageBySlotKey = buildUsageBySlotKey(params.spellSlotUsage)
  const committedSlotKeys = new Set([
    ...params.committed.output.spellSlots.maxByLevel.map((slot) => `STANDARD:${slot.spellLevel}`),
    ...(params.committed.output.spellSlots.pactMagic === null ? [] : ['PACT'])
  ])
  if (
    params.changedSpellSlotKey !== undefined &&
    !committedSlotKeys.has(params.changedSpellSlotKey)
  ) {
    throw new Error(`Committed Character spell slot "${params.changedSpellSlotKey}" was not found.`)
  }

  const resourceUsageFacts = characterResourceUsageFactsSchema.parse(
    params.committed.facts.resourcePoolCandidates.flatMap((candidate) => {
      const rawUsed = usageByPoolId.get(candidate.poolId)
      return rawUsed === undefined ? [] : [{ poolId: candidate.poolId, rawUsed }]
    })
  )
  const resources = characterResourcesSchema.parse(
    params.committed.output.resources.map((resource) => {
      const rawUsed = usageByPoolId.get(resource.poolId) ?? 0
      if (resource.state === 'UNRESOLVED') return { ...resource, rawUsed }
      const maximum = resource.maximum
      if (maximum === null) {
        throw new Error(`Resolved Character resource "${resource.poolId}" has no maximum.`)
      }
      const effectiveUsed = Math.min(rawUsed, maximum)
      return { ...resource, rawUsed, effectiveUsed, remaining: maximum - effectiveUsed }
    })
  )
  const spellSlots = resolveSpellSlots(params.committed.output.spellSlots, usageBySlotKey)
  const spellSlotUsageFacts = params.spellSlotUsage.map((slot) => {
    if (slot.slotKey === 'PACT') return { kind: 'PACT' as const, rawUsed: slot.used }
    const match = /^STANDARD:([1-9])$/.exec(slot.slotKey)
    if (!match) throw new Error(`Unsupported Character spell-slot key: ${slot.slotKey}`)
    return { kind: 'STANDARD' as const, spellLevel: Number(match[1]), rawUsed: slot.used }
  })
  const facts = characterRulePolicyInputSchema.parse({
    ...params.committed.facts,
    resourceUsageFacts,
    spellSlotUsageFacts
  })
  const actionInput = characterActionModelInputSchema.parse({
    candidates: facts.actionCandidates,
    abilityDefinitions: facts.abilityDefinitions,
    spellCandidates: facts.spellCastCandidates,
    spellSlots: [
      ...spellSlots.maxByLevel.map((slot) => ({
        slotKey: `STANDARD:${slot.spellLevel}`,
        label: `STANDARD:${slot.spellLevel}`,
        level: slot.spellLevel,
        max: slot.slotCount,
        remaining: slot.remaining
      })),
      ...(spellSlots.pactMagic === null
        ? []
        : [
            {
              slotKey: 'PACT',
              label: 'PACT',
              level: spellSlots.pactMagic.level,
              max: spellSlots.pactMagic.slots,
              remaining: spellSlots.pactMagic.remaining
            }
          ])
    ],
    spellEffects: facts.spellActionFacts,
    spellMechanics: params.committed.output.spellMechanics.map((mechanics) => ({
      source: mechanics.source,
      attackBonus: mechanics.attackBonus ?? null,
      saveDc: mechanics.saveDC ?? null,
      damageBonus: mechanics.damageBonus
    })),
    activeSourceIds: params.committed.output.grantFold.activeSourceIds,
    activeEquipmentInstanceIds: params.committed.output.grantFold.activeEquipmentInstanceIds,
    resources,
    proficiencies: params.committed.output.proficiencies.map((proficiency) => ({
      kind: proficiency.kind,
      subjectId: proficiency.subjectId,
      scaling: proficiency.scaling,
      category: proficiency.category ?? null
    })),
    modifierGroups: params.committed.output.modifierGroups.map((group) => ({
      domainKey: group.domainKey,
      contributions: group.contributions.map((contribution) => ({
        sourceId: contribution.sourceId,
        value: contribution.value,
        state: contribution.state
      }))
    })),
    itemAttackAdjustments: params.committed.output.itemMechanics.map((item) => ({
      itemInstanceId: item.itemInstanceId,
      bonus: item.calculations.attackBonus.override === null ? item.attackBonus : 0,
      override: item.calculations.attackBonus.override?.value ?? null
    })),
    totalLevel: facts.totalLevel,
    classLevels: facts.grantFoldFacts.base.classes.map((entry) => ({
      classId: entry.classId,
      level: entry.level
    })),
    proficiencyBonus: params.committed.output.derivedStats.proficiencyBonus.effective,
    abilities: params.committed.output.derivedStats.abilities.map((ability) => ({
      abilityId: ability.abilityId,
      modifier: ability.modifier.effective
    })),
    skills: params.committed.output.derivedStats.skills.map((skill) => ({
      skillId: skill.skillId,
      total: skill.total.effective
    })),
    spellcasting:
      params.committed.output.derivedStats.spellcasting === null
        ? null
        : {
            saveDc: params.committed.output.derivedStats.spellcasting.saveDc.effective,
            attackBonus: params.committed.output.derivedStats.spellcasting.attackBonus.effective
          },
    attackRollModes: params.committed.output.rollModes.attacks
  })
  const evaluation = await evaluateRuleRevision({
    db: params.db,
    revisionId: params.committed.binding.revisionId,
    modelKey: CHARACTER_ACTION_MODEL_KEY,
    contractKey: CHARACTER_ACTION_MODEL_KEY,
    normalizedFacts: actionInput
  })
  const actionOutput = characterActionModelOutputSchema.parse(evaluation.result)
  if (actionOutput.spellCastDecisions.length !== facts.spellCastCandidates.length) {
    throw new Error('Character action evaluation did not resolve every spell-cast candidate.')
  }
  const output = characterRulePolicyOutputSchema.parse({
    ...params.committed.output,
    resources,
    spellSlots,
    actionDecisions: actionOutput.actionDecisions,
    spellCastMechanics: actionOutput.spellCastMechanics,
    spellReferenceMechanics: actionOutput.spellReferenceMechanics,
    spellCastDecisions: actionOutput.spellCastDecisions
  })

  return {
    ruleEvaluation: { ...params.committed, facts, output },
    zenEvaluationMs: evaluation.evaluationDurationMs
  }
}
