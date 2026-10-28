import {
  characterRulePolicyInputSchema,
  type CharacterRulePolicyInput,
  type CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import {
  EQUIPMENT_PROPERTY_CODE,
  nextEquipSlot,
  type CharacterBuildSnapshot,
  type HeldItem
} from '@artificer-toolkit/shared/core'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import type { CharacterResourceUsage } from '@artificer-toolkit/shared/core'
import type { EquipmentAuthored, RaceAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileFeature } from '@artificer-toolkit/shared/compilers'
import {
  compileClass,
  compileRace,
  compileResolvedEquipment,
  resolveEquipmentAuthored,
  resolveRaceAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd'
import {
  SRD_ABILITIES,
  SRD_SPEEDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { systemConditionMaximumLevel } from '../conditionLevels.js'
import { creatureConditionCapabilityRegistry } from '../platformPolicyModules.js'
import { buildCharacterActionRuleFacts } from '../character/characterActionRuleFacts.js'
import { buildCharacterArmorClassRuleFacts } from '../character/characterArmorClassRuleFacts.js'
import { buildCharacterHandRuleFacts } from '../character/characterHandRuleFacts.js'
import { buildCharacterDerivedRuleFacts } from '../character/characterDerivedRuleFacts.js'
import { compileCharacterGrantFoldRuleFacts } from '../character/characterGrantFoldRuleFacts.js'
import { buildCharacterItemMechanicsRuleFacts } from '../character/characterItemMechanicsRuleFacts.js'
import { buildCharacterMovementRuleFacts } from '../character/characterMovementRuleFacts.js'
import { buildCharacterResourceRuleFacts } from '../character/characterResourceRuleFacts.js'
import { prepareCharacterRuleSources } from '../character/characterRuleSnapshot.js'
import { resolveCharacterRulePolicyRollModes } from '../character/characterRuleRollProjection.js'
import { evaluateDnd5e2014CharacterPolicy } from '../systems/dnd5e/characterPolicy.js'

type Ability = (typeof SRD_ABILITIES)[number]['code']
type SnapshotFeature = CharacterBuildSnapshot['features'][number]

export const SRD = srdBaselineContent.subjects

export function srdByLabel<T extends { readonly label: string }>(
  items: readonly T[],
  label: string
): T {
  const match = items.find((item) => item.label === label)
  if (match === undefined) throw new Error(`SRD fixture "${label}" is missing.`)
  return match
}

const racesById = new Map<string, RaceAuthored>(SRD.races.map((race) => [race.id, race]))

/** The rule registry over the SRD and any further authored equipment and Features, resolved as publication does. */
function registryWith(
  extraEquipment: readonly EquipmentAuthored[],
  extraFeatures: readonly FeatureAuthored[]
) {
  const equipment = [...SRD.equipment, ...extraEquipment]
  const equipmentById = new Map<string, EquipmentAuthored>(equipment.map((item) => [item.id, item]))
  const compiled = {
    races: SRD.races.map((race) =>
      compileRace(resolveRaceAuthored(race, (id) => racesById.get(id)))
    ),
    classes: SRD.classes.map(compileClass),
    backgrounds: [],
    equipment: equipment.map((item) =>
      compileResolvedEquipment(resolveEquipmentAuthored(item, (id) => equipmentById.get(id)))
    ),
    feats: [],
    features: extraFeatures.map(compileFeature)
  }
  return prepareCharacterRuleSources({
    registry: {
      ...compiled,
      system: {
        skills: [],
        speeds: [...SRD_SPEEDS],
        defaults: srdSystemRecord.defaults
      }
    },
    catalog: { spells: [] }
  }).registry
}

export const srdRegistry = registryWith([], [])

/** The SRD vocabulary slice that saving-throw projection reads. */
export const vocabulary = {
  document: { abilities: SRD_ABILITIES.map(({ id, code, label }) => ({ id, code, label })) }
} as Pick<SystemVocabularySnapshot, 'document'>

/** A class, subclass, race or subrace feature acquisition, with any selected options. */
export function srdFeature(input: {
  owner: 'CLASS' | 'SUBCLASS'
  classLabel: string
  subclassLabel?: string
  featureLabel: string
  level: number
  optionLabels?: readonly string[]
}): SnapshotFeature {
  const characterClass = srdByLabel(SRD.classes, input.classLabel)
  const owner =
    input.owner === 'SUBCLASS'
      ? srdByLabel(SRD.classes, input.subclassLabel ?? input.classLabel)
      : characterClass
  const feature = srdByLabel(owner.features ?? [], input.featureLabel)
  const options = (input.optionLabels ?? []).map(
    (label) => srdByLabel(feature.options ?? [], label).id
  )
  return {
    acquisitionId: `acquired:${feature.id}`,
    featureId: feature.id,
    source:
      input.owner === 'SUBCLASS'
        ? { kind: 'SUBCLASS', subclassId: owner.id, classLevel: input.level }
        : { kind: 'CLASS', classId: characterClass.id, classLevel: input.level },
    timing: { kind: 'CLASS_LEVEL', classId: characterClass.id, classLevel: input.level },
    ...(options.length > 0
      ? { selections: [{ selectionKey: 'options', values: [{ kind: 'IDS', ids: options }] }] }
      : {})
  }
}

function raceFeatures(race: RaceAuthored | undefined, kind: 'RACE' | 'SUBRACE') {
  return (race?.features ?? []).map((feature): SnapshotFeature => ({
    featureId: feature.id,
    source: kind === 'RACE' ? { kind, raceId: race!.id } : { kind, subraceId: race!.id },
    timing: { kind: 'IMMEDIATE' }
  }))
}

export type SrdCharacterInput = {
  abilities?: Partial<Record<Ability, number>>
  race?: string
  subrace?: string
  classes: readonly { label: string; level: number; subclass?: string }[]
  features?: readonly SnapshotFeature[]
  items?: readonly {
    label: string
    equipped?: boolean
    attuned?: boolean
    /** Corrosion play has put on the item. */
    degradation?: number
  }[]
  /** Authored equipment beyond the SRD, which `items` may then name by label. */
  extraEquipment?: readonly EquipmentAuthored[]
  /** Authored Features beyond the SRD, which `features` may then acquire by id. */
  extraFeatures?: readonly FeatureAuthored[]
  /** Builds the Character's resource pools from its sources, with these uses; none when absent. */
  resourceUsage?: readonly CharacterResourceUsage[]
}

export type SrdCharacter = {
  facts: CharacterRulePolicyInput
  /** Server-only authored action entries, index-aligned with `facts.actionCandidates`. */
  entryPoints: ReturnType<typeof buildCharacterActionRuleFacts>['entryPoints']
  /** Server-only passive zone sources, as the Character's rule evaluation carries them (D155). */
  passiveZoneSources: ReturnType<typeof buildCharacterActionRuleFacts>['passiveZones']
  /** Server-only initiative restore sources, as the Character's rule evaluation carries them. */
  initiativeRestoreSources: ReturnType<typeof buildCharacterActionRuleFacts>['initiativeRestores']
  standingEffectSources: ReturnType<typeof buildCharacterActionRuleFacts>['standingEffects']
  standingGrantedActions: ReturnType<typeof buildCharacterActionRuleFacts>['standingGrantedActions']
  snapshot: CharacterBuildSnapshot
  output: CharacterRulePolicyOutput
  itemInstanceId: (label: string) => string
}

/** Evaluates an SRD Character through the real fact builders and the installed D&D policy. */
export function evaluateSrdCharacter(input: SrdCharacterInput): SrdCharacter {
  const registry =
    input.extraEquipment || input.extraFeatures
      ? registryWith(input.extraEquipment ?? [], input.extraFeatures ?? [])
      : srdRegistry
  const equipmentRecords = [...SRD.equipment, ...(input.extraEquipment ?? [])]
  const race = input.race === undefined ? undefined : srdByLabel(SRD.races, input.race)
  const subrace = input.subrace === undefined ? undefined : srdByLabel(SRD.races, input.subrace)
  const classes = input.classes.map((entry) => ({
    classId: srdByLabel(SRD.classes, entry.label).id,
    level: entry.level,
    ...(entry.subclass === undefined
      ? {}
      : { subclassId: srdByLabel(SRD.classes, entry.subclass).id })
  }))
  const held: HeldItem[] = []
  const items = (input.items ?? []).map((item, index) => {
    const equipment = srdByLabel(equipmentRecords, item.label)
    const compiledItem = registry.equipment[equipment.id]
    if (compiledItem === undefined) throw new Error(`SRD item "${item.label}" did not compile.`)
    const twoHanded = (compiledItem.properties ?? []).includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED)
    const assignment = item.equipped
      ? nextEquipSlot({ id: `item-${index}`, category: compiledItem.category, twoHanded }, held)
      : undefined
    if (assignment && 'conflict' in assignment)
      throw new Error(`SRD item "${item.label}" cannot be equipped: ${assignment.conflict}.`)
    if (assignment && assignment.slot !== 'WORN')
      held.push({ id: `item-${index}`, slot: assignment.slot, twoHanded })
    return {
      instanceId: `item-${index}`,
      contentRef: {
        definitionId: equipment.id,
        binding: { kind: 'ACTIVE' as const },
        systemId: equipment.systemId
      },
      ...(assignment ? { equippedState: { slot: assignment.slot } } : {}),
      attuned: item.attuned ?? false,
      ...(item.degradation === undefined ? {} : { degradation: item.degradation }),
      compiledItem
    }
  })
  const totalLevel = classes.reduce((sum, entry) => sum + entry.level, 0)
  const snapshot: CharacterBuildSnapshot = {
    characterId: 'srd-character',
    systemId: SRD.classes[0]!.systemId,
    totalLevel,
    ...(race ? { raceId: race.id } : {}),
    ...(subrace ? { subraceId: subrace.id } : {}),
    classes,
    abilities: Object.fromEntries(
      SRD_ABILITIES.map(({ code }) => [code, input.abilities?.[code] ?? 10])
    ),
    hitpoints: [],
    features: [
      ...raceFeatures(race, 'RACE'),
      ...raceFeatures(subrace, 'SUBRACE'),
      ...(input.features ?? [])
    ],
    equipmentItems: items
  }
  const grantFoldFacts = compileCharacterGrantFoldRuleFacts({ snapshot, registry })
  const resourceFacts =
    input.resourceUsage === undefined
      ? { resourcePoolCandidates: [], chargeCalculations: [] }
      : buildCharacterResourceRuleFacts({
          character: createEmptyCharacterAuthored({
            id: snapshot.characterId,
            systemId: snapshot.systemId,
            userId: 'srd-user'
          }),
          snapshot,
          registry,
          spellAccessCandidates: [],
          grantFoldFacts,
          creaturesById: new Map(),
          resourceUsage: input.resourceUsage
        })
  const actionFacts = buildCharacterActionRuleFacts({
    snapshot,
    registry,
    grantFoldFacts,
    resourcePoolCandidates: resourceFacts.resourcePoolCandidates
  })
  const facts = characterRulePolicyInputSchema.parse({
    contractVersion: 4,
    grantFoldFacts,
    totalLevel,
    derivedBaseFacts: buildCharacterDerivedRuleFacts(snapshot, registry),
    ...buildCharacterItemMechanicsRuleFacts(snapshot),
    ...buildCharacterMovementRuleFacts(snapshot, registry),
    ...buildCharacterArmorClassRuleFacts(snapshot),
    ...buildCharacterHandRuleFacts(snapshot),
    spellAccessCandidates: [],
    spellClasses: [],
    spellPreparationClasses: [],
    spellPreparationCatalog: [],
    spellPreparationRequest: null,
    spellCastCandidates: [],
    spellCastSlots: [],
    spellCastResources: [],
    spellcastingClasses: [],
    ...resourceFacts,
    actionCandidates: actionFacts.actionCandidates,
    eligibilityFacets: [],
    rest: {
      totalHitDice: totalLevel,
      currentExhaustion: 0,
      maximumExhaustion: systemConditionMaximumLevel(
        srdSystemRecord.conditionTypes,
        creatureConditionCapabilityRegistry.require(srdSystemRecord.id)
          .exhaustionConditionDefinitionId
      ),
      attunementSlotOverride: null
    }
  })
  return {
    facts,
    entryPoints: actionFacts.entryPoints,
    passiveZoneSources: actionFacts.passiveZones,
    initiativeRestoreSources: actionFacts.initiativeRestores,
    standingEffectSources: actionFacts.standingEffects,
    standingGrantedActions: actionFacts.standingGrantedActions,
    snapshot,
    output: resolveCharacterRulePolicyRollModes(
      evaluateDnd5e2014CharacterPolicy(facts),
      vocabulary
    ),
    itemInstanceId: (label) => {
      const index = (input.items ?? []).findIndex((item) => item.label === label)
      if (index < 0) throw new Error(`SRD fixture item "${label}" is missing.`)
      return `item-${index}`
    }
  }
}

/** One item action's candidate and resolved decision, selected by attack kind and grip. */
export function itemAction(
  character: SrdCharacter,
  label: string,
  select: { attackKind: string; grip?: 'ONE_HANDED' | 'TWO_HANDED'; activation?: string }
) {
  const itemInstanceId = character.itemInstanceId(label)
  const matches = character.facts.actionCandidates.flatMap((candidate) => {
    const decision = character.output.actionDecisions.find(
      (entry) => entry.actionId === candidate.actionId
    )
    return candidate.equipment?.itemInstanceId === itemInstanceId &&
      decision?.mechanic.attackKind === select.attackKind &&
      (select.grip === undefined || candidate.equipment.grip === select.grip) &&
      (select.activation === undefined ||
        candidate.mechanicFacts.invocation.activation?.code === select.activation)
      ? [{ candidate, decision }]
      : []
  })
  if (matches.length !== 1)
    throw new Error(
      `Expected one ${select.attackKind} action for "${label}", got ${matches.length}.`
    )
  return matches[0]!
}

/** The first damage expression an action deals. */
export function damageExpression(decision: {
  mechanic: CharacterRulePolicyOutput['actionDecisions'][number]['mechanic']
}) {
  const damage = decision.mechanic.outcomes.find((outcome) => outcome.kind === 'DAMAGE')
  if (damage?.kind !== 'DAMAGE') throw new Error('The action deals no damage.')
  return damage.expression
}
