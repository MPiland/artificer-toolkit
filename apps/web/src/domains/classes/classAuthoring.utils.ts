import type { ChargeDto } from '@artificer-toolkit/schema/shared'
import type {
  ClassAuthoringInputDto,
  ClassSpellcastingDto
} from '@artificer-toolkit/schema/subjects/class'
import type {
  ClassMulticlassDto,
  ClassStartingGoldDto
} from '@artificer-toolkit/schema/subjects/shared'
import {
  CHARGE_LIMIT_KIND,
  CHARGE_RESET_KIND,
  CLASS_CATEGORY
} from '@artificer-toolkit/shared/core'
import type { ClassAuthoredDto } from '@artificer-toolkit/schema/subjects/class'
import { createEmptyStartingEquipment } from '#app/forms/rendering/startingEquipmentDefaults'

export type ClassFormValues = ClassAuthoringInputDto

interface CreateEmptyClassInput {
  systemId: string
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
    label: classRecord.label.trim(),
    description: classRecord.description ?? '',
    status: classRecord.status,
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
      hitpoint: classRecord.hitpoint ?? { dieConfig: '1d8' },
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

function createEmptyStartingGold(): ClassStartingGoldDto {
  return {
    multiplier: 1,
    currencyId: '',
    dieConfig: '1d4'
  }
}

function createEmptyCharge(): ChargeDto {
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

export function createEmptySpellcasting(): ClassSpellcastingDto {
  return {
    spellLimits: [],
    availableSpellIds: [],
    maxSpellLevel: 9,
    attributes: [],
    charges: createEmptyCharge()
  }
}
