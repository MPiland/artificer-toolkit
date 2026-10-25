import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import { DND5E_PACT_POOL_CODE } from './coreCodes.js'

const multiclassSlotTable = [
  [],
  [[1, 2]],
  [[1, 3]],
  [
    [1, 4],
    [2, 2]
  ],
  [
    [1, 4],
    [2, 3]
  ],
  [
    [1, 4],
    [2, 3],
    [3, 2]
  ],
  [
    [1, 4],
    [2, 3],
    [3, 3]
  ],
  [
    [1, 4],
    [2, 3],
    [3, 3],
    [4, 1]
  ],
  [
    [1, 4],
    [2, 3],
    [3, 3],
    [4, 2]
  ],
  [
    [1, 4],
    [2, 3],
    [3, 3],
    [4, 3],
    [5, 1]
  ],
  [
    [1, 4],
    [2, 3],
    [3, 3],
    [4, 3],
    [5, 2]
  ],
  [
    [1, 4],
    [2, 3],
    [3, 3],
    [4, 3],
    [5, 2],
    [6, 1]
  ],
  [
    [1, 4],
    [2, 3],
    [3, 3],
    [4, 3],
    [5, 2],
    [6, 1]
  ],
  [
    [1, 4],
    [2, 3],
    [3, 3],
    [4, 3],
    [5, 2],
    [6, 1],
    [7, 1]
  ],
  [
    [1, 4],
    [2, 3],
    [3, 3],
    [4, 3],
    [5, 2],
    [6, 1],
    [7, 1]
  ],
  [
    [1, 4],
    [2, 3],
    [3, 3],
    [4, 3],
    [5, 2],
    [6, 1],
    [7, 1],
    [8, 1]
  ],
  [
    [1, 4],
    [2, 3],
    [3, 3],
    [4, 3],
    [5, 2],
    [6, 1],
    [7, 1],
    [8, 1]
  ],
  [
    [1, 4],
    [2, 3],
    [3, 3],
    [4, 3],
    [5, 2],
    [6, 1],
    [7, 1],
    [8, 1],
    [9, 1]
  ],
  [
    [1, 4],
    [2, 3],
    [3, 3],
    [4, 3],
    [5, 3],
    [6, 1],
    [7, 1],
    [8, 1],
    [9, 1]
  ],
  [
    [1, 4],
    [2, 3],
    [3, 3],
    [4, 3],
    [5, 3],
    [6, 2],
    [7, 1],
    [8, 1],
    [9, 1]
  ],
  [
    [1, 4],
    [2, 3],
    [3, 3],
    [4, 3],
    [5, 3],
    [6, 2],
    [7, 2],
    [8, 1],
    [9, 1]
  ]
] as const

export function evaluateDnd5eCharacterSpellSlots(
  input: CharacterRulePolicyInput
): CharacterRulePolicyOutput['spellSlots'] {
  const casters = input.spellcastingClasses.map((caster) => {
    const eligible = caster.spellLimits.filter((limit) => limit.classLevel <= caster.classLevel)
    const selectedLevel = eligible.reduce<number | null>(
      (highest, limit) => Math.max(highest ?? Number.NEGATIVE_INFINITY, limit.classLevel),
      null
    )
    const selectedSlots =
      selectedLevel === null
        ? []
        : (eligible.find((limit) => limit.classLevel === selectedLevel)?.slots ?? [])
    const maxSpellLevel = Math.max(
      ...caster.spellLimits.map((limit) =>
        limit.slots.length === 0 ? 0 : Math.max(...limit.slots.map((slot) => slot.spellLevel))
      )
    )
    return { ...caster, selectedSlots, maxSpellLevel }
  })
  const standardCasters = casters.filter((caster) => caster.resetKind !== 'SHORT_REST')
  const pactCasters = casters.filter(
    (caster) => caster.resetKind === 'SHORT_REST' && caster.selectedSlots.length > 0
  )
  const effectiveCasterLevel = Math.min(
    20,
    standardCasters.reduce(
      (sum, caster) =>
        sum +
        (caster.maxSpellLevel >= 9
          ? caster.classLevel
          : caster.maxSpellLevel >= 5
            ? Math.floor(caster.classLevel / 2)
            : Math.floor(caster.classLevel / 3)),
      0
    )
  )
  const rawUsed = (spellLevel: number): number => {
    const usages = (input.spellSlotUsageFacts ?? []).filter(
      (usage) => usage.kind === 'STANDARD' && usage.spellLevel === spellLevel
    )
    return usages.length === 1 ? usages[0]!.rawUsed : 0
  }
  const slots =
    standardCasters.length === 0
      ? []
      : standardCasters.length === 1
        ? standardCasters[0]!.selectedSlots.filter((slot) => slot.slotCount > 0)
        : (multiclassSlotTable[effectiveCasterLevel] ?? []).map(([spellLevel, slotCount]) => ({
            spellLevel,
            slotCount
          }))
  const sourceIds =
    standardCasters.length === 1
      ? [standardCasters[0]!.classId]
      : standardCasters.map((caster) => caster.classId)
  const maxByLevel = slots.map((slot) => {
    const used = rawUsed(slot.spellLevel)
    const effectiveUsed = Math.min(used, slot.slotCount)
    return {
      spellLevel: slot.spellLevel,
      slotCount: slot.slotCount,
      sourceIds,
      rawUsed: used,
      effectiveUsed,
      remaining: Math.max(slot.slotCount - effectiveUsed, 0)
    }
  })
  const pactCaster = pactCasters.at(-1)
  const slotPools =
    pactCaster === undefined
      ? []
      : (() => {
          const level = Math.max(...pactCaster.selectedSlots.map((slot) => slot.spellLevel))
          const slots = pactCaster.selectedSlots.find(
            (slot) => slot.spellLevel === level
          )!.slotCount
          const usages = (input.spellSlotUsageFacts ?? []).filter(
            (usage) => usage.kind === 'POOL' && usage.poolCode === DND5E_PACT_POOL_CODE
          )
          const rawUsed = usages.length === 1 ? usages[0]!.rawUsed : 0
          const effectiveUsed = Math.min(rawUsed, slots)
          return [
            {
              poolCode: DND5E_PACT_POOL_CODE,
              sourceClassId: pactCaster.classId,
              slots,
              level,
              rawUsed,
              effectiveUsed,
              remaining: Math.max(slots - effectiveUsed, 0)
            }
          ]
        })()
  return {
    calculationId: 'spell-slots',
    sourceClassIds: casters.map((caster) => caster.classId),
    maxByLevel,
    slotPools,
    fusionStrategy:
      standardCasters.length === 0
        ? 'NONE'
        : standardCasters.length === 1
          ? 'SINGLE_CLASS'
          : 'MULTICLASS_FUSED'
  }
}
