import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const EQUIPMENT_CATEGORY_CODE = {
  WEAPON: 'WEAPON',
  ARMOR: 'ARMOR',
  ADVENTURING_GEAR: 'ADVENTURING_GEAR',
  TOOL: 'TOOL',
  SHIELD: 'SHIELD',
  VARIANT: 'VARIANT'
} as const

export type EquipmentCategoryCode = keyof typeof EQUIPMENT_CATEGORY_CODE

export type EquipmentCategoryOption = CoreMeta<EquipmentCategoryCode>

export const EQUIPMENT_CATEGORY_REGISTRY: Record<EquipmentCategoryCode, EquipmentCategoryOption> = {
  [EQUIPMENT_CATEGORY_CODE.WEAPON]: {
    code: EQUIPMENT_CATEGORY_CODE.WEAPON,
    label: 'Weapon',
    description: 'Weapons used to make attacks.'
  },

  [EQUIPMENT_CATEGORY_CODE.VARIANT]: {
    code: EQUIPMENT_CATEGORY_CODE.VARIANT,
    label: 'Variant',
    description: 'A variant of another item.'
  },

  [EQUIPMENT_CATEGORY_CODE.ARMOR]: {
    code: EQUIPMENT_CATEGORY_CODE.ARMOR,
    label: 'Armor',
    description: 'Protective equipment that increases armor class.'
  },

  [EQUIPMENT_CATEGORY_CODE.SHIELD]: {
    code: EQUIPMENT_CATEGORY_CODE.SHIELD,
    label: 'Shield',
    description: 'Defensive equipment held in one hand.'
  },

  [EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR]: {
    code: EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    label: 'Adventuring Gear',
    description: 'General-purpose equipment.'
  },

  [EQUIPMENT_CATEGORY_CODE.TOOL]: {
    code: EQUIPMENT_CATEGORY_CODE.TOOL,
    label: 'Tool',
    description: 'Tools used for crafting or checks.'
  }
} as const

export type EquipmentCategoryValue =
  (typeof EQUIPMENT_CATEGORY_REGISTRY)[keyof typeof EQUIPMENT_CATEGORY_REGISTRY]

export const EQUIPMENT_CATEGORY_OPTIONS = valuesOf(
  EQUIPMENT_CATEGORY_REGISTRY
) as readonly EquipmentCategoryValue[]

export const EQUIPMENT_PROPERTY_CODE = {
  LIGHT: 'LIGHT',
  ONE_HANDED: 'ONE_HANDED',
  TWO_HANDED: 'TWO_HANDED',
  FINESSE: 'FINESSE',
  RANGED: 'RANGED',
  THROWN: 'THROWN',
  HEAVY: 'HEAVY',
  LOADING: 'LOADING',
  AMMUNITION: 'AMMUNITION',
  REACH: 'REACH',
  SPECIAL: 'SPECIAL',
  VERSATILE: 'VERSATILE',
  MEDIUM: 'MEDIUM',
  SIMPLE: 'SIMPLE',
  MARTIAL: 'MARTIAL',
  MELEE: 'MELEE',
  FLASK: 'FLASK',
  VIAL: 'VIAL',
  POISON: 'POISON',
  CONTAINER: 'CONTAINER',
  POTION: 'POTION',
  SCROLL: 'SCROLL',
  WONDEROUS_ITEM: 'WONDEROUS_ITEM',
  ARCANE_FOCUS: 'ARCANE_FOCUS',
  HOLY_SYMBOL: 'HOLY_SYMBOL',
  DRINK: 'DRINK',
  FOOD: 'FOOD',
  ARTISANAL_TOOL: 'ARTISANAL_TOOL',
  MUSICAL_INSTRUMENT: 'MUSICAL_INSTRUMENT',
  GAMING_SET: 'GAMING_SET',
  DRUIDIC_FOCUS: 'DRUIDIC_FOCUS',
  PROFESSIONAL_TOOL: 'PROFESSIONAL_TOOL',
  WOOD: 'WOOD',
  METAL: 'METAL',
  MAGIC: 'MAGIC',
  VEX: 'VEX',
  CLOTHING: 'CLOTHING'
} as const

export type EquipmentPropertyCode = keyof typeof EQUIPMENT_PROPERTY_CODE

export type EquipmentPropertyOption = CoreMeta<EquipmentPropertyCode>

export const EQUIPMENT_PROPERTY_REGISTRY: Record<EquipmentPropertyCode, EquipmentPropertyOption> = {
  [EQUIPMENT_PROPERTY_CODE.LIGHT]: {
    code: EQUIPMENT_PROPERTY_CODE.LIGHT,
    label: 'Light',
    description: 'Light weapon or armor.'
  },

  [EQUIPMENT_PROPERTY_CODE.ONE_HANDED]: {
    code: EQUIPMENT_PROPERTY_CODE.ONE_HANDED,
    label: 'One-Handed',
    description: 'Requires only one hand to use.'
  },

  [EQUIPMENT_PROPERTY_CODE.TWO_HANDED]: {
    code: EQUIPMENT_PROPERTY_CODE.TWO_HANDED,
    label: 'Two-Handed',
    description: 'Requires two hands to use.'
  },

  [EQUIPMENT_PROPERTY_CODE.FINESSE]: {
    code: EQUIPMENT_PROPERTY_CODE.FINESSE,
    label: 'Finesse',
    description: 'Can use Dexterity instead of Strength.'
  },

  [EQUIPMENT_PROPERTY_CODE.RANGED]: {
    code: EQUIPMENT_PROPERTY_CODE.RANGED,
    label: 'Ranged',
    description: 'Used to attack at a distance.'
  },

  [EQUIPMENT_PROPERTY_CODE.THROWN]: {
    code: EQUIPMENT_PROPERTY_CODE.THROWN,
    label: 'Thrown',
    description: 'Can be thrown to make a ranged attack.'
  },

  [EQUIPMENT_PROPERTY_CODE.HEAVY]: {
    code: EQUIPMENT_PROPERTY_CODE.HEAVY,
    label: 'Heavy',
    description: 'Large weapon or armor.'
  },

  [EQUIPMENT_PROPERTY_CODE.LOADING]: {
    code: EQUIPMENT_PROPERTY_CODE.LOADING,
    label: 'Loading',
    description: 'Requires time to reload.'
  },

  [EQUIPMENT_PROPERTY_CODE.AMMUNITION]: {
    code: EQUIPMENT_PROPERTY_CODE.AMMUNITION,
    label: 'Ammunition',
    description: 'Consumes ammunition when used.'
  },

  [EQUIPMENT_PROPERTY_CODE.REACH]: {
    code: EQUIPMENT_PROPERTY_CODE.REACH,
    label: 'Reach',
    description: 'Extends attack range.'
  },

  [EQUIPMENT_PROPERTY_CODE.SPECIAL]: {
    code: EQUIPMENT_PROPERTY_CODE.SPECIAL,
    label: 'Special',
    description: 'Has special rules.'
  },

  [EQUIPMENT_PROPERTY_CODE.VERSATILE]: {
    code: EQUIPMENT_PROPERTY_CODE.VERSATILE,
    label: 'Versatile',
    description: 'Can be used one- or two-handed.'
  },

  [EQUIPMENT_PROPERTY_CODE.MEDIUM]: {
    code: EQUIPMENT_PROPERTY_CODE.MEDIUM,
    label: 'Medium',
    description: 'Medium armor category.'
  },

  [EQUIPMENT_PROPERTY_CODE.SIMPLE]: {
    code: EQUIPMENT_PROPERTY_CODE.SIMPLE,
    label: 'Simple',
    description: 'Easy to use.'
  },

  [EQUIPMENT_PROPERTY_CODE.MARTIAL]: {
    code: EQUIPMENT_PROPERTY_CODE.MARTIAL,
    label: 'Martial',
    description: 'Requires martial training.'
  },

  [EQUIPMENT_PROPERTY_CODE.MELEE]: {
    code: EQUIPMENT_PROPERTY_CODE.MELEE,
    label: 'Melee',
    description: 'Used in close combat.'
  },

  [EQUIPMENT_PROPERTY_CODE.FLASK]: {
    code: EQUIPMENT_PROPERTY_CODE.FLASK,
    label: 'Flask',
    description: 'A small container.'
  },

  [EQUIPMENT_PROPERTY_CODE.VIAL]: {
    code: EQUIPMENT_PROPERTY_CODE.VIAL,
    label: 'Vial',
    description: 'A small glass container.'
  },

  [EQUIPMENT_PROPERTY_CODE.POISON]: {
    code: EQUIPMENT_PROPERTY_CODE.POISON,
    label: 'Poison',
    description: 'Contains a harmful substance.'
  },

  [EQUIPMENT_PROPERTY_CODE.CONTAINER]: {
    code: EQUIPMENT_PROPERTY_CODE.CONTAINER,
    label: 'Container',
    description: 'Can hold other items.'
  },

  [EQUIPMENT_PROPERTY_CODE.POTION]: {
    code: EQUIPMENT_PROPERTY_CODE.POTION,
    label: 'Potion',
    description: 'Consumable magical liquid.'
  },

  [EQUIPMENT_PROPERTY_CODE.SCROLL]: {
    code: EQUIPMENT_PROPERTY_CODE.SCROLL,
    label: 'Scroll',
    description: 'Contains a written spell.'
  },

  [EQUIPMENT_PROPERTY_CODE.WONDEROUS_ITEM]: {
    code: EQUIPMENT_PROPERTY_CODE.WONDEROUS_ITEM,
    label: 'Wondrous Item',
    description: 'A unique magical item.'
  },

  [EQUIPMENT_PROPERTY_CODE.ARCANE_FOCUS]: {
    code: EQUIPMENT_PROPERTY_CODE.ARCANE_FOCUS,
    label: 'Arcane Focus',
    description: 'Used for arcane spellcasting.'
  },

  [EQUIPMENT_PROPERTY_CODE.HOLY_SYMBOL]: {
    code: EQUIPMENT_PROPERTY_CODE.HOLY_SYMBOL,
    label: 'Holy Symbol',
    description: 'Used for divine spellcasting.'
  },

  [EQUIPMENT_PROPERTY_CODE.DRINK]: {
    code: EQUIPMENT_PROPERTY_CODE.DRINK,
    label: 'Drink',
    description: 'Consumable liquid item.'
  },

  [EQUIPMENT_PROPERTY_CODE.FOOD]: {
    code: EQUIPMENT_PROPERTY_CODE.FOOD,
    label: 'Food',
    description: 'Consumable food item.'
  },

  [EQUIPMENT_PROPERTY_CODE.DRUIDIC_FOCUS]: {
    code: EQUIPMENT_PROPERTY_CODE.DRUIDIC_FOCUS,
    label: 'Druidic Focus',
    description: 'Used for druid spellcasting.'
  },

  [EQUIPMENT_PROPERTY_CODE.ARTISANAL_TOOL]: {
    code: EQUIPMENT_PROPERTY_CODE.ARTISANAL_TOOL,
    label: 'Artisan Tool',
    description: 'Used for crafting.'
  },

  [EQUIPMENT_PROPERTY_CODE.MUSICAL_INSTRUMENT]: {
    code: EQUIPMENT_PROPERTY_CODE.MUSICAL_INSTRUMENT,
    label: 'Musical Instrument',
    description: 'Used to perform music.'
  },

  [EQUIPMENT_PROPERTY_CODE.GAMING_SET]: {
    code: EQUIPMENT_PROPERTY_CODE.GAMING_SET,
    label: 'Gaming Set',
    description: 'Used for games of chance or skill.'
  },

  [EQUIPMENT_PROPERTY_CODE.PROFESSIONAL_TOOL]: {
    code: EQUIPMENT_PROPERTY_CODE.PROFESSIONAL_TOOL,
    label: 'Professional Tool',
    description: 'Used for a profession.'
  },

  [EQUIPMENT_PROPERTY_CODE.WOOD]: {
    code: EQUIPMENT_PROPERTY_CODE.WOOD,
    label: 'Wood',
    description: 'Made primarily of wood.'
  },

  [EQUIPMENT_PROPERTY_CODE.METAL]: {
    code: EQUIPMENT_PROPERTY_CODE.METAL,
    label: 'Metal',
    description: 'Made primarily of metal.'
  },

  [EQUIPMENT_PROPERTY_CODE.MAGIC]: {
    code: EQUIPMENT_PROPERTY_CODE.MAGIC,
    label: 'Magic',
    description: 'Magical in nature.'
  },

  [EQUIPMENT_PROPERTY_CODE.VEX]: {
    code: EQUIPMENT_PROPERTY_CODE.VEX,
    label: 'Vex',
    description: 'Weapon mastery property.'
  },

  [EQUIPMENT_PROPERTY_CODE.CLOTHING]: {
    code: EQUIPMENT_PROPERTY_CODE.CLOTHING,
    label: 'Clothing',
    description: 'A wearable garment.'
  }
} as const

export const EQUIPMENT_PROPERTY_OPTIONS = valuesOf(
  EQUIPMENT_PROPERTY_REGISTRY
) as readonly EquipmentPropertyOption[]

export const PROPERTIES_BY_CATEGORY = {
  [EQUIPMENT_CATEGORY_CODE.WEAPON]: [
    EQUIPMENT_PROPERTY_CODE.SIMPLE,
    EQUIPMENT_PROPERTY_CODE.MARTIAL,
    EQUIPMENT_PROPERTY_CODE.MELEE,
    EQUIPMENT_PROPERTY_CODE.RANGED,
    EQUIPMENT_PROPERTY_CODE.AMMUNITION,
    EQUIPMENT_PROPERTY_CODE.FINESSE,
    EQUIPMENT_PROPERTY_CODE.THROWN,
    EQUIPMENT_PROPERTY_CODE.LIGHT,
    EQUIPMENT_PROPERTY_CODE.ONE_HANDED,
    EQUIPMENT_PROPERTY_CODE.TWO_HANDED,
    EQUIPMENT_PROPERTY_CODE.VERSATILE,
    EQUIPMENT_PROPERTY_CODE.HEAVY,
    EQUIPMENT_PROPERTY_CODE.REACH,
    EQUIPMENT_PROPERTY_CODE.LOADING,
    EQUIPMENT_PROPERTY_CODE.SPECIAL,
    EQUIPMENT_PROPERTY_CODE.MAGIC,
    EQUIPMENT_PROPERTY_CODE.VEX,
    EQUIPMENT_PROPERTY_CODE.METAL,
    EQUIPMENT_PROPERTY_CODE.WONDEROUS_ITEM
  ],

  [EQUIPMENT_CATEGORY_CODE.ARMOR]: [
    EQUIPMENT_PROPERTY_CODE.LIGHT,
    EQUIPMENT_PROPERTY_CODE.MEDIUM,
    EQUIPMENT_PROPERTY_CODE.HEAVY,
    EQUIPMENT_PROPERTY_CODE.MAGIC,
    EQUIPMENT_PROPERTY_CODE.METAL,
    EQUIPMENT_PROPERTY_CODE.WONDEROUS_ITEM
  ],

  [EQUIPMENT_CATEGORY_CODE.SHIELD]: [
    EQUIPMENT_PROPERTY_CODE.MELEE,
    EQUIPMENT_PROPERTY_CODE.MAGIC,
    EQUIPMENT_PROPERTY_CODE.WOOD,
    EQUIPMENT_PROPERTY_CODE.METAL,
    EQUIPMENT_PROPERTY_CODE.WONDEROUS_ITEM
  ],

  [EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR]: [
    EQUIPMENT_PROPERTY_CODE.CONTAINER,
    EQUIPMENT_PROPERTY_CODE.FLASK,
    EQUIPMENT_PROPERTY_CODE.VIAL,
    EQUIPMENT_PROPERTY_CODE.POISON,
    EQUIPMENT_PROPERTY_CODE.POTION,
    EQUIPMENT_PROPERTY_CODE.SCROLL,
    EQUIPMENT_PROPERTY_CODE.ARCANE_FOCUS,
    EQUIPMENT_PROPERTY_CODE.HOLY_SYMBOL,
    EQUIPMENT_PROPERTY_CODE.DRINK,
    EQUIPMENT_PROPERTY_CODE.FOOD,
    EQUIPMENT_PROPERTY_CODE.CLOTHING,
    EQUIPMENT_PROPERTY_CODE.MAGIC,
    EQUIPMENT_PROPERTY_CODE.WONDEROUS_ITEM
  ],

  [EQUIPMENT_CATEGORY_CODE.TOOL]: [
    EQUIPMENT_PROPERTY_CODE.ARTISANAL_TOOL,
    EQUIPMENT_PROPERTY_CODE.MUSICAL_INSTRUMENT,
    EQUIPMENT_PROPERTY_CODE.GAMING_SET,
    EQUIPMENT_PROPERTY_CODE.PROFESSIONAL_TOOL,
    EQUIPMENT_PROPERTY_CODE.MAGIC,
    EQUIPMENT_PROPERTY_CODE.WONDEROUS_ITEM
  ],

  [EQUIPMENT_CATEGORY_CODE.VARIANT]: [
    EQUIPMENT_PROPERTY_CODE.AMMUNITION,
    EQUIPMENT_PROPERTY_CODE.MAGIC,
    EQUIPMENT_PROPERTY_CODE.WONDEROUS_ITEM
  ]
} as const

export const EQUIPMENT_ATTRIBUTE = {
  LIMITED_USE: 'LIMITED_USE',
  STACKABLE: 'STACKABLE',
  CONSUMED_ON_USE: 'CONSUMED_ON_USE'
} as const

export type EquipmentAttribute = keyof typeof EQUIPMENT_ATTRIBUTE

export type EquipmentAttributeOption = CoreMeta<EquipmentAttribute>

export const EQUIPMENT_ATTRIBUTE_REGISTRY: Record<EquipmentAttribute, EquipmentAttributeOption> = {
  LIMITED_USE: {
    code: EQUIPMENT_ATTRIBUTE.LIMITED_USE,
    label: 'Limited Use',
    description: 'The equipment has a limited number of uses.'
  },

  STACKABLE: {
    code: EQUIPMENT_ATTRIBUTE.STACKABLE,
    label: 'Stackable',
    description: 'The equipment can be stacked.'
  },

  CONSUMED_ON_USE: {
    code: EQUIPMENT_ATTRIBUTE.CONSUMED_ON_USE,
    label: 'Consumed On Use',
    description: 'Using the equipment uses one up.'
  }
} as const

export const EQUIPMENT_ATTRIBUTE_OPTIONS = valuesOf(
  EQUIPMENT_ATTRIBUTE_REGISTRY
) as EquipmentAttributeOption[]

/** Hands a weapon attack effect is wielded with; null on every non-attack equipment effect. */
export const EQUIPMENT_GRIP = {
  ONE_HANDED: 'ONE_HANDED',
  TWO_HANDED: 'TWO_HANDED'
} as const

export type EquipmentGrip = keyof typeof EQUIPMENT_GRIP

export type EquipmentGripOption = CoreMeta<EquipmentGrip>

export const EQUIPMENT_GRIP_REGISTRY: Record<EquipmentGrip, EquipmentGripOption> = {
  ONE_HANDED: {
    code: EQUIPMENT_GRIP.ONE_HANDED,
    label: 'One hand',
    description: 'This attack is made holding the weapon in one hand.'
  },
  TWO_HANDED: {
    code: EQUIPMENT_GRIP.TWO_HANDED,
    label: 'Two hands',
    description: 'This attack is made holding the weapon in both hands.'
  }
} as const

export const EQUIPMENT_GRIP_OPTIONS = valuesOf(EQUIPMENT_GRIP_REGISTRY) as EquipmentGripOption[]
