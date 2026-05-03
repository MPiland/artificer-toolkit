import type { BackgroundAuthoredDto } from '@artificer-toolkit/schema/subjects/background'
import type { DetailDto } from '@artificer-toolkit/schema/shared'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import type { ProficiencyGrantDto } from '@artificer-toolkit/schema/grants'
import { createEmptyStartingEquipment } from '#components/editors'

export {
  addStartingEquipmentItem,
  createEmptyStartingEquipment,
  createEmptyStartingEquipmentItem,
  getStartingEquipmentItems,
  removeStartingEquipmentItem,
  replaceStartingEquipmentItem,
  upsertStartingEquipmentItem,
  type StartingEquipmentItemDto
} from '#components/editors'

export type BackgroundFormStep = 'basics' | 'content' | 'details'

export interface CreateEmptyBackgroundInput {
  systemId: string
  userId: string
}

export function createEmptyBackground({
  systemId,
  userId
}: CreateEmptyBackgroundInput): BackgroundAuthoredDto {
  return {
    kind: 'BACKGROUND',
    id: crypto.randomUUID(),
    label: '',
    description: '',
    status: 'DRAFT',
    details: [],
    proficiencies: [],
    features: [],
    startingEquipment: createEmptyStartingEquipment(),
    userId,
    systemId
  }
}

export function normalizeBackgroundForSubmit(background: BackgroundAuthoredDto): BackgroundAuthoredDto {
  return {
    ...background,
    label: background.label.trim() || 'Untitled Background',
    description: background.description ?? '',
    status: background.status ?? 'DRAFT',
    details: background.details ?? [],
    proficiencies: background.proficiencies ?? [],
    features: background.features ?? [],
    startingEquipment: background.startingEquipment ?? createEmptyStartingEquipment()
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

export function createEmptyProficiency(order: number): ProficiencyGrantDto {
  return {
    grantKind: 'PROFICIENCY_GRANT',
    id: crypto.randomUUID(),
    order,
    selectionKind: 'GRANTED',
    proficiencyKind: 'SKILL',
    authoringModeKind: 'ALL',
    level: 'FULL'
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
