import { EQUIPPED_SLOT_CODES } from '@artificer-toolkit/shared/core'
import { z, lazySchema } from '../zod.js'
import {
  characterCurrencyAmountDtoSchema,
  characterCurrencyQualificationDtoSchema
} from '../shared/characterCurrency.js'
import { characterSheetConditionDtoSchema } from './characterSheetCondition.js'

import {
  activationCodeSchema,
  authoredRecordStatusSchema,
  equipmentPropertyCodeSchema,
  pathLifecycleReturnsOnSchema,
  spellAttributeSchema,
  spellComponentSchema
} from '../shared/enums.js'
import { capacityDtoSchema, costDtoSchema, weightDtoSchema } from '../subjects/shared.js'
import { castingTimeDtoSchema } from '../subjects/castingTime.js'
import { characterDeathSavesDtoSchema } from '../subjects/characterState.js'
import { characterConsequenceDtoSchema } from '../shared/consequenceRolls.js'
import {
  characterResourceOwnerRefDtoSchema,
  characterResourceRecoveryDtoSchema,
  characterSheetReadInputSchema,
  characterSpellSourceRefDtoSchema
} from './characterSheet.js'
import { characterSheetReferenceFeatureDtoSchema } from './characterBuilder.js'
import {
  characterActionReasonCodeSchema,
  resolvedSpellSlotExchangeSchema
} from './characterActionRules.js'
import { characterPartyVisibilityDtoSchema } from './healthDisplay.js'
import { hitPointMaximumReductionRecoveryTagsSchema } from '../effects/hitPointMaximumReduction.js'
import {
  activeGrantListingDtoSchema,
  concentrationListingDtoSchema
} from '../shared/activeGrantListing.js'
import { offeredRollModeSchema, systemCoreCodeSchema } from '../shared/systemCoreCode.js'

export { characterSheetReadInputSchema, type CharacterSheetReadInput } from './characterSheet.js'

const stringSchema = lazySchema(() => z.string())
const integerSchema = lazySchema(() => z.number().check(z.int()))
const booleanSchema = lazySchema(() => z.boolean())

export const characterSheetFactDtoSchema = lazySchema(() =>
  z.object({
    label: stringSchema,
    value: stringSchema
  })
)

export const characterSheetProficiencyFactDtoSchema = lazySchema(() =>
  z.extend(characterSheetFactDtoSchema, {
    kind: z.enum(['ARMOR', 'LANGUAGE', 'TOOL', 'WEAPON'])
  })
)

export const characterSheetOptionDtoSchema = lazySchema(() =>
  z.object({
    id: stringSchema,
    label: stringSchema,
    description: z.optional(stringSchema)
  })
)

export const characterSheetMetaDtoSchema = lazySchema(() =>
  z.object({
    characterId: stringSchema,
    campaignId: z.optional(z.nullable(stringSchema.check(z.uuid()))),
    /** PARTY_MEMBER is another player reading through "Party can view" (ADR 0034 decision 5). */
    viewer: z.enum(['CHARACTER_OWNER', 'CAMPAIGN_OWNER', 'PARTY_MEMBER']),
    capabilities: z.object({
      managePlayState: booleanSchema,
      managePrivateNotes: booleanSchema,
      manageInventory: booleanSchema,
      openBuilder: booleanSchema,
      /** True only for the Campaign owner on an ACTIVE Campaign, including on the GM's own Character (D92, D99). */
      endActiveEffects: booleanSchema,
      /** The same GM-only rule: recorded consequences are removed by the GM alone (ATTACK-15.2). */
      removeConsequences: booleanSchema
    }),
    systemId: stringSchema,
    status: authoredRecordStatusSchema,
    streamVersion: integerSchema,
    hasBuilderDraft: z.optional(booleanSchema),
    /** Present only for the Character's own player, who sets it on the Sheet. */
    partyVisibility: z.optional(characterPartyVisibilityDtoSchema)
  })
)

export const characterSheetIdentityDtoSchema = lazySchema(() =>
  z.object({
    label: stringSchema,
    description: z.optional(stringSchema),
    concept: z.optional(stringSchema),
    classSummary: stringSchema,
    raceLabel: z.optional(stringSchema),
    backgroundLabel: z.optional(stringSchema),
    totalLevel: integerSchema
  })
)

/** `label` and `short` come from the System record's ability. */
export const characterSheetAbilityDtoSchema = lazySchema(() =>
  z.object({
    ability: systemCoreCodeSchema,
    label: stringSchema,
    short: stringSchema,
    score: integerSchema,
    modifier: integerSchema,
    rollMode: systemCoreCodeSchema
  })
)

export const characterSheetHitDiceDtoSchema = lazySchema(() =>
  z.object({
    die: integerSchema,
    total: integerSchema,
    used: integerSchema,
    remaining: integerSchema
  })
)

export { characterSheetConditionDtoSchema } from './characterSheetCondition.js'

export const characterSheetExhaustionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      label: stringSchema.check(z.trim()).check(z.minLength(1)),
      description: stringSchema.check(z.trim()).check(z.minLength(1)),
      level: integerSchema.check(z.nonnegative()),
      minimumLevel: integerSchema.check(z.nonnegative()),
      maximumLevel: integerSchema.check(z.positive()),
      notes: z.optional(stringSchema)
    })
    .check(
      z.superRefine((exhaustion, context) => {
        if (
          exhaustion.minimumLevel > exhaustion.maximumLevel ||
          exhaustion.level < exhaustion.minimumLevel ||
          exhaustion.level > exhaustion.maximumLevel
        ) {
          context.addIssue({
            code: 'custom',
            path: ['level'],
            message: 'Exhaustion level must be within the rules-system range.'
          })
        }
      })
    )
)

export const characterSheetOverviewDtoSchema = lazySchema(() =>
  z.object({
    abilities: z.array(characterSheetAbilityDtoSchema),
    facts: z.array(characterSheetFactDtoSchema),
    armorClass: integerSchema,
    initiative: integerSchema,
    initiativeRollMode: systemCoreCodeSchema,
    /** The roll modes the System offers a roller for a d20 roll, each with the face it keeps. */
    rollModes: z.array(offeredRollModeSchema).check(z.minLength(1)),
    proficiencyBonus: integerSchema,
    inspiration: z.optional(booleanSchema),
    currentHitPoints: integerSchema,
    maxHitPoints: integerSchema,
    tempHitPoints: integerSchema,
    /** Shown and editable at 0 hit points only (D96). */
    deathSaves: characterDeathSavesDtoSchema,
    maxHitPointsModifier: integerSchema,
    maxHitPointsModifierAdjustmentId: z.nullable(z.guid()),
    maxHitPointsOverride: z.nullable(integerSchema),
    /** Active reductions already subtracted from `maxHitPoints` (Life Drain, D62), oldest first. */
    maxHitPointsReductions: z.array(
      z.strictObject({
        id: z.guid(),
        /** Null for a viewer other than the GM when the attacker was hidden. */
        label: z.nullable(stringSchema.check(z.minLength(1))),
        sourceHidden: booleanSchema,
        amount: integerSchema.check(z.positive()),
        recoveryTags: hitPointMaximumReductionRecoveryTagsSchema
      })
    ),
    /** Active grants (Antitoxin, Aid) with their source and time left; a hidden source's label is null for players (D99). */
    activeGrants: z.array(activeGrantListingDtoSchema),
    /**
     * The always-on effects of the Character's features (SPELLS-31.2): held, or ended until the rest
     * they return on. They are never uses.
     */
    standingEffects: z.array(
      z.strictObject({
        effectId: z.guid(),
        label: stringSchema,
        returnsOn: pathLifecycleReturnsOnSchema,
        held: booleanSchema
      })
    ),
    /**
     * A Concentration this Character cast whose grants a finished Run carried onto the Campaign clock
     * (SPELLS-5.11); the caster ends it with END_CONCENTRATION. Null for a viewer who does not control
     * the Character; the label is null for a hidden source.
     */
    concentration: z.nullable(concentrationListingDtoSchema),
    /** Consequence rows the GM accepted, such as lingering injuries, with the healing the table names. */
    consequences: z.array(characterConsequenceDtoSchema),
    savingThrows: z.array(
      z.object({
        ability: systemCoreCodeSchema,
        label: stringSchema,
        short: stringSchema,
        total: integerSchema,
        rollMode: systemCoreCodeSchema,
        proficiency: z.enum(['NONE', 'HALF', 'FULL', 'DOUBLE'])
      })
    ),
    skills: z.array(
      z.object({
        skillId: stringSchema,
        code: stringSchema,
        label: stringSchema,
        ability: systemCoreCodeSchema,
        abilityShort: stringSchema,
        total: integerSchema,
        rollMode: systemCoreCodeSchema,
        proficiency: z.enum(['NONE', 'HALF', 'FULL', 'DOUBLE'])
      })
    ),
    exhaustion: characterSheetExhaustionDtoSchema,
    conditions: z.array(characterSheetConditionDtoSchema),
    hitDice: z.array(characterSheetHitDiceDtoSchema)
  })
)

export const characterSheetOutcomeScalingDtoSchema = lazySchema(() =>
  z.object({
    level: integerSchema.check(z.positive()),
    expression: stringSchema
  })
)

export const characterSheetOutcomeDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('DAMAGE'),
      pathCode: stringSchema,
      expression: stringSchema,
      damageTypeId: stringSchema,
      damageTypeLabel: stringSchema,
      scaling: z.optional(z.array(characterSheetOutcomeScalingDtoSchema))
    }),
    z.object({
      kind: z.literal('HEAL'),
      pathCode: stringSchema,
      expression: stringSchema,
      temporary: booleanSchema,
      scaling: z.optional(z.array(characterSheetOutcomeScalingDtoSchema))
    }),
    z.object({
      kind: z.literal('CONDITION'),
      pathCode: stringSchema,
      conditionId: stringSchema,
      label: stringSchema
    }),
    z.object({
      kind: z.literal('EFFECT'),
      pathCode: stringSchema,
      effectKind: stringSchema,
      label: z.optional(stringSchema),
      spellSlotExchange: z.optional(resolvedSpellSlotExchangeSchema)
    })
  ])
)

export const characterSheetMechanicDtoSchema = lazySchema(() =>
  z.object({
    effectId: stringSchema,
    trigger: stringSchema,
    activation: z.optional(
      z.object({
        kind: stringSchema,
        amount: integerSchema.check(z.positive())
      })
    ),
    rangeLabel: z.optional(stringSchema),
    attackBonus: z.optional(integerSchema),
    attackRollMode: z.optional(systemCoreCodeSchema),
    save: z.optional(
      z.object({
        ability: systemCoreCodeSchema,
        dc: z.optional(integerSchema)
      })
    ),
    targetCountLevels: z.optional(z.array(integerSchema.check(z.positive()))),
    outcomes: z.array(characterSheetOutcomeDtoSchema)
  })
)

export const characterSheetActionDtoSchema = lazySchema(() =>
  z.object({
    id: stringSchema,
    label: stringSchema,
    kind: z.enum(['ACTION', 'BONUS_ACTION', 'REACTION', 'OTHER']),
    sourceLabel: z.optional(stringSchema),
    description: z.optional(stringSchema),
    mechanic: z.optional(characterSheetMechanicDtoSchema),
    availability: z.discriminatedUnion('status', [
      z.object({ status: z.literal('AVAILABLE') }),
      z.object({
        status: z.literal('UNAVAILABLE'),
        reasonCode: characterActionReasonCodeSchema
      })
    ]),
    resourceGrantId: z.optional(stringSchema),
    resourceCost: z.optional(integerSchema.check(z.positive()))
  })
)

const characterSheetExtraKindOptionDtoSchema = lazySchema(() =>
  z.object({
    code: z.enum(['COMPANION', 'MOUNT', 'OWNED', 'VEHICLE']),
    label: stringSchema.check(z.minLength(1))
  })
)

const characterSheetCreatureOriginOptionDtoSchema = lazySchema(() =>
  z.object({
    code: z.enum(['WORLD', 'SUMMONED']),
    label: stringSchema.check(z.minLength(1))
  })
)

const characterSheetExtraActionDtoSchema = lazySchema(() =>
  z.object({
    id: stringSchema.check(z.minLength(1)),
    label: stringSchema.check(z.minLength(1)),
    description: z.optional(stringSchema)
  })
)

const characterSheetExtraFeatureDtoSchema = lazySchema(() =>
  z.object({
    id: stringSchema.check(z.minLength(1)),
    label: stringSchema.check(z.minLength(1)),
    description: z.optional(stringSchema)
  })
)

const characterSheetExtraHitPointsDtoSchema = lazySchema(() =>
  z.object({
    current: integerSchema.check(z.nonnegative()),
    maximum: integerSchema.check(z.nonnegative())
  })
)

const characterSheetExtraCreatureHitPointsDtoSchema = lazySchema(() =>
  z.extend(characterSheetExtraHitPointsDtoSchema, {
    temp: integerSchema.check(z.nonnegative())
  })
)

const characterSheetExtraHitDiceDtoSchema = lazySchema(() =>
  z
    .array(
      z
        .object({
          die: integerSchema.check(z.positive()),
          total: integerSchema.check(z.nonnegative()),
          used: integerSchema.check(z.nonnegative()),
          remaining: integerSchema.check(z.nonnegative())
        })
        .check(
          z.refine(({ remaining, total, used }) => used <= total && remaining === total - used, {
            message: 'Hit dice usage and remaining count must be consistent.'
          })
        )
    )
    .check(
      z.superRefine((hitDice, context) => {
        const seen = new Set<number>()

        hitDice.forEach(({ die }, index) => {
          if (seen.has(die)) {
            context.addIssue({
              code: 'custom',
              path: [index, 'die'],
              message: 'Hit dice denominations must be unique.'
            })
          }
          seen.add(die)
        })
      })
    )
)

const characterSheetExtraCommonDtoSchema = lazySchema(() =>
  z.object({
    id: z.guid(),
    kindLabel: stringSchema.check(z.minLength(1)),
    authoredName: stringSchema.check(z.minLength(1)),
    displayName: stringSchema.check(z.minLength(1)),
    customName: z.optional(stringSchema),
    notes: z.optional(stringSchema),
    isActive: booleanSchema,
    actions: z.array(characterSheetExtraActionDtoSchema),
    features: z.array(characterSheetExtraFeatureDtoSchema),
    equipmentItemIds: z.array(z.guid())
  })
)

const characterSheetCreatureExtraDtoSchema = lazySchema(() =>
  z.extend(characterSheetExtraCommonDtoSchema, {
    kind: z.enum(['COMPANION', 'MOUNT', 'OWNED']),
    creatureId: z.guid(),
    relationshipKind: z.enum(['COMPANION', 'MOUNT', 'OWNED']),
    relationshipLabel: stringSchema.check(z.minLength(1)),
    size: z.optional(systemCoreCodeSchema),
    alignmentId: z.optional(z.guid()),
    creatureTypeId: z.optional(z.guid()),
    originKind: z.enum(['WORLD', 'SUMMONED']),
    originLabel: stringSchema.check(z.minLength(1)),
    armorClass: integerSchema.check(z.nonnegative()),
    speedLabel: z.optional(stringSchema.check(z.minLength(1))),
    carryingCapacityLabel: z.optional(stringSchema.check(z.minLength(1))),
    riderCapacity: z.optional(integerSchema.check(z.nonnegative())),
    hitPoints: characterSheetExtraCreatureHitPointsDtoSchema,
    hitDice: characterSheetExtraHitDiceDtoSchema
  })
)

const characterSheetVehicleExtraDtoSchema = lazySchema(() =>
  z.extend(characterSheetExtraCommonDtoSchema, {
    kind: z.literal('VEHICLE'),
    vehicleId: z.guid(),
    categoryLabel: stringSchema.check(z.minLength(1)),
    speedLabel: z.optional(stringSchema.check(z.minLength(1))),
    crewLabel: z.optional(stringSchema.check(z.minLength(1))),
    passengerCapacity: z.optional(integerSchema.check(z.nonnegative())),
    cargoCapacityLabel: z.optional(stringSchema.check(z.minLength(1))),
    hitPoints: characterSheetExtraHitPointsDtoSchema
  })
)

/**
 * A creature a spell cast conjured (D190). Only a cast creates one, so its kind is never an add
 * option. Its stat block values are the ones the cast resolved against the caster.
 */
const characterSheetSpellSummonExtraDtoSchema = lazySchema(() =>
  z.extend(characterSheetExtraCommonDtoSchema, {
    kind: z.literal('SPELL_SUMMON'),
    spellId: stringSchema.check(z.minLength(1)),
    /**
     * Set when an Encounter cast made the summon: its owned Run actor is the record, so the Sheet
     * reads it live and neither edits nor dismisses it.
     */
    encounterActorId: z.optional(z.guid()),
    originKind: z.literal('SUMMONED'),
    originLabel: stringSchema.check(z.minLength(1)),
    /** The summon is the Sheet's Concentration and ends with it. */
    concentration: booleanSchema,
    armorClass: z.nullable(integerSchema.check(z.nonnegative())),
    speedLabel: z.optional(stringSchema.check(z.minLength(1))),
    /** Absent when the stat block gives the summon no hit points. */
    hitPoints: z.optional(characterSheetExtraCreatureHitPointsDtoSchema),
    size: z.optional(systemCoreCodeSchema),
    abilityScores: z.optional(z.record(systemCoreCodeSchema, integerSchema)),
    passivePerception: z.optional(integerSchema)
  })
)

export const characterSheetExtrasDtoSchema = lazySchema(() =>
  z.object({
    kindOptions: z.array(characterSheetExtraKindOptionDtoSchema),
    originOptions: z.array(characterSheetCreatureOriginOptionDtoSchema),
    items: z.array(
      z.union([
        characterSheetCreatureExtraDtoSchema,
        characterSheetVehicleExtraDtoSchema,
        characterSheetSpellSummonExtraDtoSchema
      ])
    )
  })
)

export const characterSheetExtraCatalogKindDtoSchema = lazySchema(() =>
  z.enum(['CREATURE', 'VEHICLE'])
)

export const characterSheetExtraCatalogCursorDtoSchema = lazySchema(() =>
  z.strictObject({
    id: z.guid(),
    label: stringSchema.check(z.minLength(1))
  })
)

export const characterSheetExtraCatalogInputDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: characterSheetExtraCatalogKindDtoSchema,
    query: z.optional(stringSchema.check(z.trim()).check(z.maxLength(120))),
    cursor: z.optional(characterSheetExtraCatalogCursorDtoSchema),
    limit: z._default(integerSchema.check(z.gte(1)).check(z.lte(50)), 25)
  })
)

export const characterSheetExtraCatalogReadInputSchema = lazySchema(() =>
  z.extend(characterSheetExtraCatalogInputDtoSchema, {
    id: characterSheetReadInputSchema.shape.id,
    cursor: z.optional(
      z.extend(characterSheetExtraCatalogCursorDtoSchema, {
        label: stringSchema.check(z.minLength(1)).check(z.maxLength(200))
      })
    )
  })
)

export type CharacterSheetExtraCatalogReadInput = z.infer<
  typeof characterSheetExtraCatalogReadInputSchema
>

export const characterSheetExtraCatalogOptionDtoSchema = lazySchema(() =>
  z.strictObject({
    id: z.guid(),
    label: stringSchema.check(z.minLength(1)),
    description: z.optional(stringSchema)
  })
)

export const characterSheetExtraCatalogResponseDtoSchema = lazySchema(() =>
  z.strictObject({
    items: z.array(characterSheetExtraCatalogOptionDtoSchema),
    nextCursor: z.nullable(characterSheetExtraCatalogCursorDtoSchema)
  })
)

export const characterSheetResourceDtoSchema = lazySchema(() =>
  z.object({
    id: stringSchema,
    owner: characterResourceOwnerRefDtoSchema,
    label: stringSchema,
    description: z.optional(stringSchema),
    sourceLabel: stringSchema,
    sourceFeatureId: z.optional(stringSchema),
    used: integerSchema,
    max: integerSchema,
    remaining: integerSchema,
    recoveries: z.array(characterResourceRecoveryDtoSchema)
  })
)

export const characterSheetSpellSlotDtoSchema = lazySchema(() =>
  z.object({
    slotKey: stringSchema,
    label: stringSchema,
    level: z.nullable(integerSchema),
    used: integerSchema,
    max: integerSchema,
    remaining: integerSchema
  })
)

export const characterSheetSpellSourceDtoSchema = lazySchema(() =>
  z.object({
    id: z.optional(stringSchema),
    source: characterSpellSourceRefDtoSchema,
    classId: z.optional(stringSchema),
    label: stringSchema,
    provenance: z.optional(
      z.enum(['CLASS', 'SUBCLASS', 'RACE', 'BACKGROUND', 'FEAT', 'FEATURE', 'OPTION', 'EQUIPMENT'])
    ),
    acquisition: z.optional(z.enum(['KNOWN', 'PREPARED', 'ALWAYS_PREPARED', 'GRANTED'])),
    castMode: z.optional(z.enum(['SPELL_SLOT', 'AT_WILL', 'RITUAL', 'FIXED_LEVEL', 'LIMITED_USE'])),
    fixedLevel: z.optional(integerSchema.check(z.positive())),
    resourceGrantId: z.optional(stringSchema),
    resourceOwner: z.optional(characterResourceOwnerRefDtoSchema),
    customName: z.optional(stringSchema),
    notes: z.optional(stringSchema),
    displayAsAttack: z.optional(booleanSchema),
    canPrepare: booleanSchema,
    prepared: z.optional(booleanSchema)
  })
)

export const characterSheetSpellPreparationSourceDtoSchema = lazySchema(() =>
  z.object({
    classId: stringSchema,
    label: stringSchema,
    preparedSpellLimit: z.optional(integerSchema.check(z.gte(0))),
    preparedSpellIds: z.array(stringSchema)
  })
)

export const characterSheetSpellDtoSchema = lazySchema(() =>
  z.object({
    id: stringSchema,
    label: stringSchema,
    description: z.optional(stringSchema),
    level: integerSchema,
    school: z.optional(stringSchema),
    castingTime: z.optional(castingTimeDtoSchema),
    components: z.optional(z.array(spellComponentSchema)),
    attributes: z.optional(z.array(spellAttributeSchema)),
    materialDescription: z.optional(stringSchema),
    prepared: z.optional(booleanSchema),
    known: z.optional(booleanSchema),
    sourceLabel: z.optional(stringSchema),
    sources: z.optional(z.array(characterSheetSpellSourceDtoSchema)),
    mechanics: z.optional(z.array(characterSheetMechanicDtoSchema))
  })
)

export const characterSheetActiveSpellEntryDtoSchema = lazySchema(() =>
  z.object({
    rowId: stringSchema.check(z.minLength(1)),
    target: z.object({
      kind: z.literal('SPELL'),
      source: characterSpellSourceRefDtoSchema,
      castLevel: integerSchema.check(z.nonnegative())
    }),
    spellId: z.guid(),
    source: characterSpellSourceRefDtoSchema,
    sourceId: stringSchema.check(z.minLength(1)),
    displayName: stringSchema.check(z.minLength(1)),
    sourceLabel: z.optional(stringSchema.check(z.minLength(1))),
    sourceQualifier: z.optional(stringSchema.check(z.minLength(1))),
    castLevel: integerSchema.check(z.nonnegative()),
    activationType: z.optional(activationCodeSchema),
    activationLabel: z.optional(stringSchema.check(z.minLength(1))),
    rangeLabel: z.optional(stringSchema.check(z.minLength(1))),
    hitOrDcLabel: z.optional(stringSchema.check(z.minLength(1))),
    primaryEffect: z.optional(stringSchema.check(z.minLength(1))),
    mechanics: z.optional(z.array(characterSheetMechanicDtoSchema)),
    available: booleanSchema,
    unavailableReason: z.optional(stringSchema.check(z.minLength(1))),
    cast: z.object({
      spellId: z.guid(),
      sourceId: stringSchema.check(z.minLength(1)),
      slotKey: z.optional(stringSchema.check(z.minLength(1)))
    })
  })
)

export const characterSheetActiveSpellGroupDtoSchema = lazySchema(() =>
  z.object({
    level: integerSchema.check(z.nonnegative()),
    label: stringSchema.check(z.minLength(1)),
    entries: z.array(characterSheetActiveSpellEntryDtoSchema)
  })
)

export const characterSheetEquipmentPropertyDtoSchema = lazySchema(() =>
  z.object({
    code: equipmentPropertyCodeSchema,
    label: stringSchema.check(z.minLength(1))
  })
)

export const characterSheetInventoryItemDtoSchema = lazySchema(() =>
  z.object({
    id: stringSchema,
    equipmentId: stringSchema,
    label: stringSchema,
    equipmentLabel: z.optional(stringSchema),
    description: z.optional(z.nullable(stringSchema)),
    category: z.optional(stringSchema),
    properties: z.optional(z.array(characterSheetEquipmentPropertyDtoSchema)),
    rarityId: z.optional(stringSchema),
    cost: z.optional(costDtoSchema),
    costLabel: z.optional(stringSchema),
    weight: z.optional(weightDtoSchema),
    armorClass: z.optional(integerSchema),
    /** Corrosion on the item: the armor class it offers or the damage rolls it makes lose this much. */
    degradation: z.optional(integerSchema),
    customName: z.optional(stringSchema),
    quantity: integerSchema,
    equippedSlot: z.nullable(z.enum(EQUIPPED_SLOT_CODES)),
    attuned: booleanSchema,
    requiresAttunement: booleanSchema,
    displayAsAttack: z.optional(booleanSchema),
    containerId: z.optional(stringSchema),
    capacity: z.optional(capacityDtoSchema),
    notes: z.optional(stringSchema)
  })
)

export const characterSheetCurrencyDtoSchema = lazySchema(() =>
  z.extend(characterCurrencyAmountDtoSchema, {
    label: stringSchema,
    containerId: z.optional(stringSchema)
  })
)
export const characterSheetCurrencyOptionDtoSchema = lazySchema(() =>
  z.extend(characterCurrencyQualificationDtoSchema, characterSheetOptionDtoSchema.shape)
)

export const characterSheetReferenceDtoSchema = lazySchema(() =>
  z.object({
    features: z.array(characterSheetReferenceFeatureDtoSchema),
    proficiencies: z.array(characterSheetProficiencyFactDtoSchema),
    defenses: z.array(
      z.extend(characterSheetFactDtoSchema, {
        kind: z.enum(['RESISTANCE', 'IMMUNITY', 'VULNERABILITY']),
        damageTypeId: stringSchema
      })
    ),
    senses: z.array(
      z.extend(characterSheetFactDtoSchema, {
        senseId: stringSchema
      })
    ),
    conditionOptions: z.array(
      z.extend(characterSheetOptionDtoSchema, {
        code: stringSchema.check(z.trim()).check(z.minLength(1)),
        levelled: z.optional(booleanSchema)
      })
    ),
    equipmentOptions: z.array(
      z.extend(characterSheetOptionDtoSchema, {
        isContainer: booleanSchema,
        maxStack: z.optional(integerSchema.check(z.positive())),
        requiresAttunement: booleanSchema
      })
    ),
    currencyOptions: z.array(characterSheetCurrencyOptionDtoSchema)
  })
)

export const characterSheetEquipmentOptionsInputSchema = lazySchema(() =>
  z.extend(characterSheetReadInputSchema, {
    campaignId: z.optional(stringSchema.check(z.uuid()))
  })
)
export const characterSheetEquipmentOptionsResponseDtoSchema = lazySchema(
  () => characterSheetReferenceDtoSchema.shape.equipmentOptions
)
export type CharacterSheetEquipmentOptionsInput = z.infer<
  typeof characterSheetEquipmentOptionsInputSchema
>
export type CharacterSheetEquipmentOptionsResponseDto = z.infer<
  typeof characterSheetEquipmentOptionsResponseDtoSchema
>

export const characterSheetNotesDtoSchema = lazySchema(() =>
  z.object({
    alignment: z.optional(stringSchema),
    lifestyle: z.optional(stringSchema),
    faith: z.optional(stringSchema),
    gender: z.optional(stringSchema),
    age: z.optional(stringSchema),
    appearance: z.optional(stringSchema),
    personalityTraits: z.optional(stringSchema),
    ideals: z.optional(stringSchema),
    bonds: z.optional(stringSchema),
    flaws: z.optional(stringSchema),
    organizations: z.optional(stringSchema),
    allies: z.optional(stringSchema),
    enemies: z.optional(stringSchema),
    backstory: z.optional(stringSchema),
    notes: z.optional(stringSchema),
    groups: z.optional(
      z.array(
        z.object({
          id: stringSchema,
          label: stringSchema,
          sortOrder: integerSchema,
          kind: z.enum(['SESSION', 'LOOT', 'CHARACTERS', 'PLACES', 'CUSTOM'])
        })
      )
    ),
    items: z.optional(
      z.array(
        z.object({
          id: stringSchema,
          title: stringSchema,
          body: z.optional(stringSchema),
          groupId: stringSchema,
          pinned: booleanSchema,
          createdAt: stringSchema,
          updatedAt: stringSchema
        })
      )
    )
  })
)

export const characterSheetResponseDtoSchema = lazySchema(() =>
  z.object({
    publicId: z.optional(stringSchema),
    meta: characterSheetMetaDtoSchema,
    identity: characterSheetIdentityDtoSchema,
    overview: characterSheetOverviewDtoSchema,
    actions: z.object({
      items: z.array(characterSheetActionDtoSchema)
    }),
    resources: z.object({
      items: z.array(characterSheetResourceDtoSchema),
      hitDice: z.array(characterSheetHitDiceDtoSchema)
    }),
    spells: z.object({
      saveDc: z.nullable(integerSchema),
      attackBonus: z.nullable(integerSchema),
      attackRollMode: z.optional(systemCoreCodeSchema),
      slots: z.array(characterSheetSpellSlotDtoSchema),
      activeGroups: z.array(characterSheetActiveSpellGroupDtoSchema),
      spells: z.array(characterSheetSpellDtoSchema),
      preparationSources: z.optional(z.array(characterSheetSpellPreparationSourceDtoSchema))
    }),
    inventory: z.object({
      items: z.array(characterSheetInventoryItemDtoSchema),
      currencies: z.array(characterSheetCurrencyDtoSchema),
      containers: z.optional(
        z.array(
          z.object({
            id: stringSchema,
            label: stringSchema,
            capacity: z.optional(capacityDtoSchema),
            itemIds: z.array(stringSchema),
            currencies: z.array(characterSheetCurrencyDtoSchema)
          })
        )
      )
    }),
    extras: characterSheetExtrasDtoSchema,
    reference: characterSheetReferenceDtoSchema,
    notes: characterSheetNotesDtoSchema
  })
)

export type CharacterSheetResponseDto = z.infer<typeof characterSheetResponseDtoSchema>
export type CharacterSheetExtrasDto = z.infer<typeof characterSheetExtrasDtoSchema>
export type CharacterSheetExtraCatalogInputDto = z.infer<
  typeof characterSheetExtraCatalogInputDtoSchema
>
export type CharacterSheetExtraCatalogResponseDto = z.infer<
  typeof characterSheetExtraCatalogResponseDtoSchema
>

export type CharacterSheetCurrencyOptionDto = z.infer<typeof characterSheetCurrencyOptionDtoSchema>
