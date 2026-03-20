import { CoreMeta } from '#core'
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

export const EQUIPMENT_CATEGORY_REGISTRY: Record<
  EquipmentCategoryCode,
  EquipmentCategoryOption
> = {
  [EQUIPMENT_CATEGORY_CODE.WEAPON]: {
    code: EQUIPMENT_CATEGORY_CODE.WEAPON,
    label: 'Weapon',
    tooltip: 'Weapons used to make attacks.',
    description: 'Includes melee and ranged weapons.'
  },

  [EQUIPMENT_CATEGORY_CODE.VARIANT]: {
    code: EQUIPMENT_CATEGORY_CODE.VARIANT,
    label: 'Variant',
    tooltip: 'A variant of another item.',
    description:
      'Represents a derived version of another item. Variants inherit the base item\'s core properties and may add or modify behavior through grants, effects, restrictions, cost, or rarity without redefining the base item.'
  },

  [EQUIPMENT_CATEGORY_CODE.ARMOR]: {
    code: EQUIPMENT_CATEGORY_CODE.ARMOR,
    label: 'Armor',
    tooltip: 'Protective equipment that increases armor class.',
    description: 'Includes light, medium, and heavy armor.'
  },

  [EQUIPMENT_CATEGORY_CODE.SHIELD]: {
    code: EQUIPMENT_CATEGORY_CODE.SHIELD,
    label: 'Shield',
    tooltip: 'Defensive equipment held in one hand.',
    description: 'Provides a bonus to armor class.'
  },

  [EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR]: {
    code: EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    label: 'Adventuring Gear',
    tooltip: 'General-purpose equipment.',
    description: 'Includes ropes, torches, kits, and similar items.'
  },

  [EQUIPMENT_CATEGORY_CODE.TOOL]: {
    code: EQUIPMENT_CATEGORY_CODE.TOOL,
    label: 'Tool',
    tooltip: 'Tools used for crafting or checks.',
    description: 'Includes artisan tools, musical instruments, and gaming sets.'
  }
} as const

export type EquipmentCategoryValue
  = (typeof EQUIPMENT_CATEGORY_REGISTRY)[keyof typeof EQUIPMENT_CATEGORY_REGISTRY]

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
  CLOTHING: 'CLOTHING'
} as const

export type EquipmentPropertyCode = keyof typeof EQUIPMENT_PROPERTY_CODE

export type EquipmentPropertyOption = CoreMeta<EquipmentPropertyCode>

export const EQUIPMENT_PROPERTY_REGISTRY: Record<
  EquipmentPropertyCode,
  EquipmentPropertyOption
> = {
  [EQUIPMENT_PROPERTY_CODE.LIGHT]: {
    code: EQUIPMENT_PROPERTY_CODE.LIGHT,
    label: 'Light',
    tooltip: 'Light weapon or armor.',
    description:
      'A light weapon is often used for two-weapon fighting. Light armor is easy to wear and does not impose significant movement restrictions.'
  },

  [EQUIPMENT_PROPERTY_CODE.ONE_HANDED]: {
    code: EQUIPMENT_PROPERTY_CODE.ONE_HANDED,
    label: 'One-Handed',
    tooltip: 'Requires only one hand to use.',
    description: 'Can be used with a shield or free hand.'
  },

  [EQUIPMENT_PROPERTY_CODE.TWO_HANDED]: {
    code: EQUIPMENT_PROPERTY_CODE.TWO_HANDED,
    label: 'Two-Handed',
    tooltip: 'Requires two hands to use.',
    description: 'Cannot be used with a shield.'
  },

  [EQUIPMENT_PROPERTY_CODE.FINESSE]: {
    code: EQUIPMENT_PROPERTY_CODE.FINESSE,
    label: 'Finesse',
    tooltip: 'Can use Dexterity instead of Strength.',
    description: 'Allows choice of ability for attack and damage.'
  },

  [EQUIPMENT_PROPERTY_CODE.RANGED]: {
    code: EQUIPMENT_PROPERTY_CODE.RANGED,
    label: 'Ranged',
    tooltip: 'Used to attack at a distance.',
    description: 'Includes bows, crossbows, and thrown weapons.'
  },

  [EQUIPMENT_PROPERTY_CODE.THROWN]: {
    code: EQUIPMENT_PROPERTY_CODE.THROWN,
    label: 'Thrown',
    tooltip: 'Can be thrown to make a ranged attack.',
    description: 'Uses Strength or Dexterity depending on weapon.'
  },

  [EQUIPMENT_PROPERTY_CODE.HEAVY]: {
    code: EQUIPMENT_PROPERTY_CODE.HEAVY,
    label: 'Heavy',
    tooltip: 'Large weapon or armor.',
    description:
      'Heavy weapons may impose disadvantages on smaller creatures. Heavy armor provides substantial protection but may limit mobility.'
  },

  [EQUIPMENT_PROPERTY_CODE.LOADING]: {
    code: EQUIPMENT_PROPERTY_CODE.LOADING,
    label: 'Loading',
    tooltip: 'Requires time to reload.',
    description: 'Limits number of attacks per turn.'
  },

  [EQUIPMENT_PROPERTY_CODE.AMMUNITION]: {
    code: EQUIPMENT_PROPERTY_CODE.AMMUNITION,
    label: 'Ammunition',
    tooltip: 'Consumes ammunition when used.',
    description: 'Requires compatible ammo to function.'
  },

  [EQUIPMENT_PROPERTY_CODE.REACH]: {
    code: EQUIPMENT_PROPERTY_CODE.REACH,
    label: 'Reach',
    tooltip: 'Extends attack range.',
    description: 'Allows attacks beyond normal melee reach.'
  },

  [EQUIPMENT_PROPERTY_CODE.SPECIAL]: {
    code: EQUIPMENT_PROPERTY_CODE.SPECIAL,
    label: 'Special',
    tooltip: 'Has special rules.',
    description: 'Refer to item description for details.'
  },

  [EQUIPMENT_PROPERTY_CODE.VERSATILE]: {
    code: EQUIPMENT_PROPERTY_CODE.VERSATILE,
    label: 'Versatile',
    tooltip: 'Can be used one- or two-handed.',
    description: 'Deals different damage when used with two hands.'
  },

  [EQUIPMENT_PROPERTY_CODE.MEDIUM]: {
    code: EQUIPMENT_PROPERTY_CODE.MEDIUM,
    label: 'Medium',
    tooltip: 'Medium armor category.',
    description:
      'Indicates medium armor. Medium armor typically allows limited Dexterity bonuses and imposes moderate movement or stealth constraints, depending on system rules.'
  },

  [EQUIPMENT_PROPERTY_CODE.SIMPLE]: {
    code: EQUIPMENT_PROPERTY_CODE.SIMPLE,
    label: 'Simple',
    tooltip: 'Easy to use.',
    description: 'Typically usable by most classes.'
  },

  [EQUIPMENT_PROPERTY_CODE.MARTIAL]: {
    code: EQUIPMENT_PROPERTY_CODE.MARTIAL,
    label: 'Martial',
    tooltip: 'Requires martial training.',
    description: 'Typically requires proficiency.'
  },

  [EQUIPMENT_PROPERTY_CODE.MELEE]: {
    code: EQUIPMENT_PROPERTY_CODE.MELEE,
    label: 'Melee',
    tooltip: 'Used in close combat.',
    description: 'Requires adjacency to target.'
  },

  [EQUIPMENT_PROPERTY_CODE.FLASK]: {
    code: EQUIPMENT_PROPERTY_CODE.FLASK,
    label: 'Flask',
    tooltip: 'A small container.',
    description: 'Often used for liquids.'
  },

  [EQUIPMENT_PROPERTY_CODE.VIAL]: {
    code: EQUIPMENT_PROPERTY_CODE.VIAL,
    label: 'Vial',
    tooltip: 'A small glass container.',
    description: 'Often used for potions or poisons.'
  },

  [EQUIPMENT_PROPERTY_CODE.POISON]: {
    code: EQUIPMENT_PROPERTY_CODE.POISON,
    label: 'Poison',
    tooltip: 'Contains a harmful substance.',
    description: 'May apply conditions or damage.'
  },

  [EQUIPMENT_PROPERTY_CODE.CONTAINER]: {
    code: EQUIPMENT_PROPERTY_CODE.CONTAINER,
    label: 'Container',
    tooltip: 'Can hold other items.',
    description: 'Includes bags, cases, and quivers.'
  },

  [EQUIPMENT_PROPERTY_CODE.POTION]: {
    code: EQUIPMENT_PROPERTY_CODE.POTION,
    label: 'Potion',
    tooltip: 'Consumable magical liquid.',
    description: 'Usually consumed to produce an effect.'
  },

  [EQUIPMENT_PROPERTY_CODE.SCROLL]: {
    code: EQUIPMENT_PROPERTY_CODE.SCROLL,
    label: 'Scroll',
    tooltip: 'Contains a written spell.',
    description: 'Typically consumed when used.'
  },

  [EQUIPMENT_PROPERTY_CODE.WONDEROUS_ITEM]: {
    code: EQUIPMENT_PROPERTY_CODE.WONDEROUS_ITEM,
    label: 'Wondrous Item',
    tooltip: 'A unique magical item.',
    description: 'Does not fit other equipment categories.'
  },

  [EQUIPMENT_PROPERTY_CODE.ARCANE_FOCUS]: {
    code: EQUIPMENT_PROPERTY_CODE.ARCANE_FOCUS,
    label: 'Arcane Focus',
    tooltip: 'Used for arcane spellcasting.',
    description: 'Substitutes for material components.'
  },

  [EQUIPMENT_PROPERTY_CODE.HOLY_SYMBOL]: {
    code: EQUIPMENT_PROPERTY_CODE.HOLY_SYMBOL,
    label: 'Holy Symbol',
    tooltip: 'Used for divine spellcasting.',
    description: 'Represents a deity or belief.'
  },

  [EQUIPMENT_PROPERTY_CODE.DRINK]: {
    code: EQUIPMENT_PROPERTY_CODE.DRINK,
    label: 'Drink',
    tooltip: 'Consumable liquid item.',
    description:
      'Indicates a consumable liquid, such as water, ale, wine, potions, or other drinkable substances. Mechanical effects, if any, are defined via effects or grants.'
  },

  [EQUIPMENT_PROPERTY_CODE.FOOD]: {
    code: EQUIPMENT_PROPERTY_CODE.FOOD,
    label: 'Food',
    tooltip: 'Consumable food item.',
    description:
      'Indicates a consumable food item, such as rations or prepared meals. Any benefits, penalties, or special effects are defined separately via effects or grants.'
  },

  [EQUIPMENT_PROPERTY_CODE.DRUIDIC_FOCUS]: {
    code: EQUIPMENT_PROPERTY_CODE.DRUIDIC_FOCUS,
    label: 'Druidic Focus',
    tooltip: 'Used for druid spellcasting.',
    description: 'Natural object serving as a focus.'
  },

  [EQUIPMENT_PROPERTY_CODE.ARTISANAL_TOOL]: {
    code: EQUIPMENT_PROPERTY_CODE.ARTISANAL_TOOL,
    label: 'Artisan Tool',
    tooltip: 'Used for crafting.',
    description: 'Includes smith’s tools, brewer’s supplies, etc.'
  },

  [EQUIPMENT_PROPERTY_CODE.MUSICAL_INSTRUMENT]: {
    code: EQUIPMENT_PROPERTY_CODE.MUSICAL_INSTRUMENT,
    label: 'Musical Instrument',
    tooltip: 'Used to perform music.',
    description: 'Often associated with bard abilities.'
  },

  [EQUIPMENT_PROPERTY_CODE.GAMING_SET]: {
    code: EQUIPMENT_PROPERTY_CODE.GAMING_SET,
    label: 'Gaming Set',
    tooltip: 'Used for games of chance or skill.',
    description: 'Includes dice, cards, and boards.'
  },

  [EQUIPMENT_PROPERTY_CODE.PROFESSIONAL_TOOL]: {
    code: EQUIPMENT_PROPERTY_CODE.PROFESSIONAL_TOOL,
    label: 'Professional Tool',
    tooltip: 'Used for a profession.',
    description: 'Specialized tools for work or trade.'
  },

  [EQUIPMENT_PROPERTY_CODE.WOOD]: {
    code: EQUIPMENT_PROPERTY_CODE.WOOD,
    label: 'Wood',
    tooltip: 'Made primarily of wood.',
    description: 'Relevant for material interactions.'
  },

  [EQUIPMENT_PROPERTY_CODE.METAL]: {
    code: EQUIPMENT_PROPERTY_CODE.METAL,
    label: 'Metal',
    tooltip: 'Made primarily of metal.',
    description: 'Relevant for material interactions.'
  },

  [EQUIPMENT_PROPERTY_CODE.MAGIC]: {
    code: EQUIPMENT_PROPERTY_CODE.MAGIC,
    label: 'Magic',
    tooltip: 'Magical in nature.',
    description: 'May interact with anti-magic effects.'
  },

  [EQUIPMENT_PROPERTY_CODE.CLOTHING]: {
    code: EQUIPMENT_PROPERTY_CODE.CLOTHING,
    label: 'Clothing',
    tooltip: 'A wearable garment.',
    description: 'Clothing items worn for social, religious, or practical purposes.'
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
    EQUIPMENT_PROPERTY_CODE.WONDEROUS_ITEM
  ],

  [EQUIPMENT_CATEGORY_CODE.ARMOR]: [
    EQUIPMENT_PROPERTY_CODE.LIGHT,
    EQUIPMENT_PROPERTY_CODE.MEDIUM,
    EQUIPMENT_PROPERTY_CODE.HEAVY,
    EQUIPMENT_PROPERTY_CODE.MAGIC,
    EQUIPMENT_PROPERTY_CODE.WONDEROUS_ITEM
  ],

  [EQUIPMENT_CATEGORY_CODE.SHIELD]: [
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
    EQUIPMENT_PROPERTY_CODE.MAGIC,
    EQUIPMENT_PROPERTY_CODE.WONDEROUS_ITEM
  ]
} as const

export const EQUIPMENT_ATTRIBUTE = {
  LIMITED_USE: 'LIMITED_USE',
  STACKABLE: 'STACKABLE'
} as const

export type EquipmentAttribute = keyof typeof EQUIPMENT_ATTRIBUTE

export type EquipmentAttributeOption = CoreMeta<EquipmentAttribute>

export const EQUIPMENT_ATTRIBUTE_REGISTRY: Record<
  EquipmentAttribute,
  EquipmentAttributeOption
> = {
  LIMITED_USE: {
    code: EQUIPMENT_ATTRIBUTE.LIMITED_USE,
    label: 'Limited Use',
    tooltip: 'The equipment has a limited number of uses.',
    description: 'The equipment has a limited number of uses.'
  },

  STACKABLE: {
    code: EQUIPMENT_ATTRIBUTE.STACKABLE,
    label: 'Stackable',
    tooltip: 'The equipment can be stacked.',
    description: 'The equipment can be stacked.'
  }
} as const

export const EQUIPMENT_ATTRIBUTE_OPTIONS = valuesOf(
  EQUIPMENT_ATTRIBUTE_REGISTRY
) as EquipmentAttributeOption[]
