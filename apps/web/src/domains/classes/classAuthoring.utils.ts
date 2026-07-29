import type { ChargeDto, StartingEquipmentDto } from '@artificer-toolkit/schema/shared'
import type {
  ClassAuthoringInputDto,
  ClassSpellcastingDto
} from '@artificer-toolkit/schema/subjects/class'
import type {
  ClassMulticlassDto,
  ClassResourceDto,
  ClassSpecializationDto,
  ClassSpellLimitDto,
  ClassStartingGoldDto
} from '@artificer-toolkit/schema/subjects/shared'
import type { DetailDto } from '@artificer-toolkit/schema/shared'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import type { ProficiencyGrantDto } from '@artificer-toolkit/schema/grants'
import {
  ABILITY_CODE,
  CHARGE_LIMIT_KIND,
  CHARGE_RESET_KIND,
  CLASS_CATEGORY
} from '@artificer-toolkit/shared/core'
import type { ClassAuthoredDto } from '@artificer-toolkit/schema/subjects/class'
import { createEmptyStartingEquipment } from '#app/forms/rendering/authoringNodeDefaults'

export type ClassFormValues = ClassAuthoringInputDto

export interface CreateEmptyClassInput {
  systemId: string
}

export interface ResolveClassEditReadOnlyInput {
  canEdit?: boolean
  hasActiveClass: boolean
}

export function createEmptyClass({
  systemId
}: CreateEmptyClassInput): Extract<ClassFormValues, { category?: undefined }> {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: '',
    status: 'DRAFT',
    details: [],
    proficiencies: [],
    features: [],
    systemId
  }
}

export function toClassFormValues(
  classRecord: ClassAuthoringInputDto | ClassAuthoredDto
): ClassFormValues {
  return {
    ...classRecord,
    description: classRecord.description ?? '',
    details: classRecord.details ?? [],
    proficiencies: classRecord.proficiencies ?? [],
    features: classRecord.features ?? []
  }
}

export function normalizeClassForSubmit(classRecord: ClassFormValues): ClassAuthoringInputDto {
  const common = {
    id: classRecord.id,
    label: classRecord.label.trim() || 'Untitled Class',
    description: classRecord.description ?? '',
    status: classRecord.status ?? 'DRAFT',
    details: classRecord.details ?? [],
    proficiencies: classRecord.proficiencies ?? [],
    spellcasting: classRecord.spellcasting,
    resources: classRecord.resources,
    features: classRecord.features ?? [],
    systemId: classRecord.systemId
  }

  if (classRecord.category === CLASS_CATEGORY.BASE) {
    return {
      ...common,
      category: CLASS_CATEGORY.BASE,
      attributes: classRecord.attributes ?? [],
      subclassSelectionLevel: classRecord.subclassSelectionLevel,
      startingGold: classRecord.startingGold ?? createEmptyStartingGold(),
      startingEquipment: classRecord.startingEquipment ?? createEmptyStartingEquipment(),
      hitpoint: classRecord.hitpoint ?? createEmptyHitpoint(),
      multiclass: classRecord.multiclass ?? createEmptyMulticlass()
    }
  }

  if (classRecord.category === CLASS_CATEGORY.SUBCLASS) {
    const parentClassId = classRecord.parentClassId?.trim()

    return {
      ...common,
      category: CLASS_CATEGORY.SUBCLASS,
      attributes: classRecord.attributes ?? [],
      ...(parentClassId ? { parentClassId } : {}),
      specializations: classRecord.specializations ?? []
    }
  }

  return {
    ...common,
    attributes: classRecord.attributes ?? []
  }
}

export function resolveCreateClassSystemId(systems: readonly { id: string }[]): string | null {
  return systems[0]?.id ?? null
}

export function resolveClassEditReadOnly({
  canEdit,
  hasActiveClass
}: ResolveClassEditReadOnlyInput): boolean {
  return hasActiveClass && canEdit === false
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

export function createEmptyProficiency(order: number): ProficiencyGrantDto {
  return {
    grantKind: 'PROFICIENCY_GRANT',
    id: crypto.randomUUID(),
    order,
    selectionKind: 'GRANTED',
    scalingKind: 'NONE',
    proficiencyKind: 'SKILL',
    authoringModeKind: 'ALL',
    level: 'FULL'
  }
}

export function createEmptyStartingGold(): ClassStartingGoldDto {
  return {
    multiplier: 1,
    currencyId: '',
    dieConfig: '1d4'
  }
}

export function createEmptyHitpoint(): NonNullable<ClassAuthoringInputDto['hitpoint']> {
  return {
    ability: ABILITY_CODE.CONSTITUTION,
    dieConfig: '1d8'
  }
}

export function createEmptyCharge(): ChargeDto {
  return {
    id: crypto.randomUUID(),
    resetKind: CHARGE_RESET_KIND.LONG_REST,
    limitKind: CHARGE_LIMIT_KIND.FIXED_AMOUNT,
    scalingKind: 'NONE',
    amount: 1
  }
}

export function createEmptyMulticlass(): ClassMulticlassDto {
  return {
    id: crypto.randomUUID(),
    requirementGroups: {
      groups: []
    },
    proficiencies: []
  }
}

export function createEmptyRequirementGroup(): ClassMulticlassDto['requirementGroups']['groups'][number] {
  return {
    id: crypto.randomUUID(),
    requirements: []
  }
}

export function createEmptyRequirement(): ClassMulticlassDto['requirementGroups']['groups'][number]['requirements'][number] {
  return {
    id: crypto.randomUUID(),
    ability: ABILITY_CODE.STRENGTH,
    min: 13
  }
}

export function createEmptyResource(): ClassResourceDto {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: '',
    availableAtLevel: 1,
    charges: createEmptyCharge()
  }
}

export function createEmptySpellcasting(): ClassSpellcastingDto {
  return {
    spellLimits: [],
    maxSpellLevel: 9,
    attributes: [],
    charges: createEmptyCharge()
  }
}

export function createEmptySpellLimit(order: number): ClassSpellLimitDto {
  return {
    classLevel: order,
    slots: []
  }
}

export function createEmptySpellSlot(order: number): ClassSpellLimitDto['slots'][number] {
  return {
    spellLevel: order,
    slotCount: 0
  }
}

export function createEmptyPrepareLimit(): NonNullable<ClassSpellcastingDto['prepareLimit']> {
  return {
    methodKinds: [],
    perLevel: []
  }
}

export function createEmptyPrepareLimitLevel(
  order: number
): NonNullable<NonNullable<ClassSpellcastingDto['prepareLimit']>['perLevel']>[number] {
  return {
    classLevel: order,
    amount: 0
  }
}

export function createEmptySpecialization(order: number): ClassSpecializationDto {
  return {
    id: crypto.randomUUID(),
    label: '',
    order
  }
}

export function createEmptyStartingEquipmentRecord(): StartingEquipmentDto {
  return createEmptyStartingEquipment()
}
