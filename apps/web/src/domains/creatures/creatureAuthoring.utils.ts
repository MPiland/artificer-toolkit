import type {
  CreatureAuthoringInputDto,
  CreatureAuthoredDto
} from '@artificer-toolkit/schema/subjects/creature'
import type { DetailDto } from '@artificer-toolkit/schema/shared'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import type { ProficiencyGrantDto } from '@artificer-toolkit/schema/grants'
import type { SpeedDto } from '@artificer-toolkit/schema/shared'
import {
  CREATURE_CATEGORY_CODE,
  CREATURE_COMPANION_BOND_TYPE_CODE,
  CREATURE_INITIATIVE_MODE_CODE,
  CREATURE_MOUNT_TYPE_CODE,
  MEASUREMENT_UNIT_CODE,
  SIZE_CODE
} from '@artificer-toolkit/shared/core'

export type CreatureFormValues = CreatureAuthoringInputDto

export interface CreateEmptyCreatureInput {
  systemId: string
}

export function createEmptyCreature({
  systemId
}: CreateEmptyCreatureInput): CreatureFormValues {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: '',
    quote: '',
    status: 'DRAFT',
    recordKind: 'STAT_BLOCK',
    category: CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: '',
    size: SIZE_CODE.MEDIUM,
    systemId,
    tags: [],
    abilityScores: createDefaultAbilityScores(),
    armorClass: 10,
    hitPoints: 1,
    speeds: [],
    senses: [],
    damageVulnerabilities: [],
    damageResistances: [],
    damageImmunities: [],
    conditionImmunities: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    details: [],
    features: [],
    proficiencies: []
  }
}

export function createDefaultAbilityScores(): CreatureFormValues['abilityScores'] {
  return {
    STRENGTH: 10,
    DEXTERITY: 10,
    CONSTITUTION: 10,
    INTELLIGENCE: 10,
    WISDOM: 10,
    CHARISMA: 10,
    SPELLCASTING: 0
  }
}

export function createEmptyDetail(order: number): DetailDto {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: '',
    order
  }
}

export function createEmptyFeature(order: number): FeatureDto {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: '',
    order
  }
}

export function createEmptyAction(): NonNullable<CreatureFormValues['actions']>[number] {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: ''
  }
}

export function createEmptySpeed(): SpeedDto {
  return {
    speedId: '',
    amount: 30,
    unit: MEASUREMENT_UNIT_CODE.FEET
  }
}

export function createEmptyProficiency(): ProficiencyGrantDto {
  return {
    id: crypto.randomUUID(),
    order: 1,
    grantKind: 'PROFICIENCY_GRANT',
    proficiencyKind: 'SKILL',
    selectionKind: 'GRANTED',
    level: 'FULL'
  }
}

export function createEmptyLegendaryProfile(): NonNullable<CreatureFormValues['legendaryProfile']> {
  return {
    actionsCount: 3,
    legendaryResistanceCount: 0
  }
}

export function createEmptyLairProfile(): NonNullable<CreatureFormValues['lairProfile']> {
  return {
    lairActions: [],
    regionalEffects: []
  }
}

export function createEmptyMountProfile(): NonNullable<CreatureFormValues['mountProfile']> {
  return {
    mountType: CREATURE_MOUNT_TYPE_CODE.CONTROLLED,
    riderCount: 1,
    notes: ''
  }
}

export function createEmptyCompanionProfile(): NonNullable<CreatureFormValues['companionProfile']> {
  return {
    bondType: CREATURE_COMPANION_BOND_TYPE_CODE.ANIMAL_COMPANION,
    initiativeMode: CREATURE_INITIATIVE_MODE_CODE.USES_PC_INITIATIVE,
    notes: ''
  }
}

export function createEmptyNpcProfile(): NonNullable<CreatureFormValues['npcProfile']> {
  return {
    bonds: [],
    flaws: [],
    ideals: [],
    personalityTraits: []
  }
}

export function normalizeCreatureForSubmit(creature: CreatureFormValues): CreatureAuthoringInputDto {
  return {
    ...creature,
    label: creature.label.trim() || 'Untitled Creature',
    description: creature.description ?? '',
    quote: creature.quote ?? '',
    recordKind: creature.recordKind ?? 'STAT_BLOCK',
    status: creature.status ?? 'DRAFT',
    tags: creature.tags ?? [],
    speeds: creature.speeds ?? [],
    senses: creature.senses ?? [],
    damageVulnerabilities: creature.damageVulnerabilities ?? [],
    damageResistances: creature.damageResistances ?? [],
    damageImmunities: creature.damageImmunities ?? [],
    conditionImmunities: creature.conditionImmunities ?? [],
    actions: creature.actions ?? [],
    bonusActions: creature.bonusActions ?? [],
    reactions: creature.reactions ?? [],
    details: creature.details ?? [],
    features: creature.features ?? [],
    proficiencies: creature.proficiencies ?? []
  }
}

export function toCreatureFormValues(creature: CreatureAuthoringInputDto | CreatureAuthoredDto | CreatureFormValues): CreatureFormValues {
  return {
    ...creature,
    description: creature.description ?? '',
    quote: creature.quote ?? '',
    recordKind: creature.recordKind ?? 'STAT_BLOCK',
    tags: creature.tags ?? [],
    abilityScores: creature.abilityScores ?? createDefaultAbilityScores(),
    speeds: creature.speeds ?? [],
    senses: creature.senses ?? [],
    damageVulnerabilities: creature.damageVulnerabilities ?? [],
    damageResistances: creature.damageResistances ?? [],
    damageImmunities: creature.damageImmunities ?? [],
    conditionImmunities: creature.conditionImmunities ?? [],
    actions: creature.actions ?? [],
    bonusActions: creature.bonusActions ?? [],
    reactions: creature.reactions ?? [],
    details: creature.details ?? [],
    features: creature.features ?? [],
    proficiencies: creature.proficiencies ?? []
  }
}

export function resolveCreateCreatureSystemId(systems: readonly { id: string }[]): string | null {
  return systems[0]?.id ?? null
}

export function upsertById<TItem extends { id: string }>(items: TItem[], item: TItem): TItem[] {
  const exists = items.some((current) => current.id === item.id)
  return exists
    ? items.map((current) => current.id === item.id ? item : current)
    : [...items, item]
}
