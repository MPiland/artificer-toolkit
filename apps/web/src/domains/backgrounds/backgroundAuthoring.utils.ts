import type {
  BackgroundAuthoringInputDto,
  BackgroundAuthoredDto
} from '@artificer-toolkit/schema/subjects/background'
import type { DetailDto } from '@artificer-toolkit/schema/shared'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import type { ProficiencyGrantDto } from '@artificer-toolkit/schema/grants'
import { createEmptyStartingEquipment } from '#forms'

export {
  addStartingEquipmentItem,
  createEmptyStartingEquipment,
  createEmptyStartingEquipmentItem,
  getStartingEquipmentItems,
  removeStartingEquipmentItem,
  replaceStartingEquipmentItem,
  upsertStartingEquipmentItem,
  type StartingEquipmentItemDto
} from '#forms'

export interface CreateEmptyBackgroundInput {
  systemId: string
}

export function createEmptyBackground({
  systemId
}: CreateEmptyBackgroundInput): BackgroundAuthoringInputDto {
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
    systemId
  }
}

export function normalizeBackgroundForSubmit(
  background: BackgroundAuthoringInputDto | BackgroundAuthoredDto
): BackgroundAuthoringInputDto {
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

export function resolveCreateBackgroundSystemId(systems: readonly { id: string }[]): string | null {
  return systems[0]?.id ?? null
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
