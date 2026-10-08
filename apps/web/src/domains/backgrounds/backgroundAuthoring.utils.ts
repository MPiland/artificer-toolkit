import type {
  BackgroundAuthoringInputDto,
  BackgroundAuthoredDto
} from '@artificer-toolkit/schema/subjects/background'
import type { DetailDto } from '@artificer-toolkit/schema/shared'
import type { ProficiencyGrantDto } from '@artificer-toolkit/schema/grants'
import { createEmptyStartingEquipment } from '#app/forms/rendering/startingEquipmentDefaults'

export {
  addStartingEquipmentItem,
  createEmptyStartingEquipment,
  getStartingEquipmentItems,
  removeStartingEquipmentItem,
  replaceStartingEquipmentItem,
  upsertStartingEquipmentItem,
  type StartingEquipmentItemDto
} from '#app/forms/rendering/startingEquipmentDefaults'

interface CreateEmptyBackgroundInput {
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
    scalingKind: 'NONE',
    proficiencyKind: 'SKILL',
    authoringModeKind: 'ALL',
    level: 'FULL'
  }
}
