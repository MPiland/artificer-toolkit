import type { DetailDto } from '@artificer-toolkit/schema/shared'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import type {
  RaceAuthoringInputDto,
  RaceAuthoredDto
} from '@artificer-toolkit/schema/subjects/race'
import type { SpeedDto } from '@artificer-toolkit/schema/shared'
import {
  MEASUREMENT_UNIT_CODE,
  RACE_CATEGORY_CODE,
  RACE_SELECTION_MODE,
  SIZE_CODE
} from '@artificer-toolkit/shared/core'

type BaseRaceDto = Extract<RaceAuthoringInputDto, { category: 'BASE' }>
type SubraceDto = Extract<RaceAuthoringInputDto, { category: 'SUBRACE' }>

export type RaceFormValues = {
  id: string
  label: string
  quote?: string
  description?: string
  status?: RaceAuthoredDto['status']
  category: BaseRaceDto['category'] | SubraceDto['category']
  selectionMode?: BaseRaceDto['selectionMode']
  ancestry?: BaseRaceDto['ancestry']
  heritageIds?: string[]
  details?: DetailDto[]
  features?: FeatureDto[]
  size?: BaseRaceDto['size']
  speeds?: SpeedDto[]
  parentRaceId?: string
  userId?: string
  systemId: string
}

interface CreateEmptyRaceInput {
  systemId: string
}

export function createEmptyBaseRace({ systemId }: CreateEmptyRaceInput): RaceFormValues {
  return {
    id: crypto.randomUUID(),
    label: '',
    quote: '',
    description: '',
    status: 'DRAFT',
    category: RACE_CATEGORY_CODE.BASE,
    selectionMode: RACE_SELECTION_MODE.DIRECT,
    heritageIds: [],
    details: [],
    features: [],
    size: SIZE_CODE.MEDIUM,
    speeds: [createEmptySpeed()],
    systemId
  }
}

export function createEmptyRace(input: CreateEmptyRaceInput): RaceFormValues {
  return createEmptyBaseRace(input)
}

function createEmptySpeed(): SpeedDto {
  return {
    speedId: '',
    amount: 30,
    unit: MEASUREMENT_UNIT_CODE.FEET
  }
}

export function toRaceFormValues(
  race: RaceAuthoringInputDto | RaceAuthoredDto | RaceFormValues
): RaceFormValues {
  if (race.category === RACE_CATEGORY_CODE.SUBRACE) {
    return {
      ...race,
      quote: race.quote ?? '',
      description: race.description ?? '',
      details: race.details ?? [],
      features: race.features ?? []
    }
  }

  return {
    ...race,
    quote: race.quote ?? '',
    description: race.description ?? '',
    heritageIds: race.heritageIds ?? [],
    details: race.details ?? [],
    features: race.features ?? [],
    speeds: race.speeds ?? [],
    ancestry: race.ancestry
  }
}

export function normalizeRaceForSubmit(race: RaceFormValues): RaceAuthoringInputDto {
  const common = {
    id: race.id,
    label: race.label.trim() || 'Untitled Race',
    quote: race.quote ?? '',
    description: race.description ?? '',
    status: race.status ?? 'DRAFT',
    details: race.details ?? [],
    features: race.features ?? [],
    systemId: race.systemId,
    ...(race.userId ? { userId: race.userId } : {})
  }

  if (race.category === RACE_CATEGORY_CODE.SUBRACE) {
    return {
      ...common,
      category: RACE_CATEGORY_CODE.SUBRACE,
      parentRaceId: race.parentRaceId ?? ''
    }
  }

  return {
    ...common,
    category: RACE_CATEGORY_CODE.BASE,
    selectionMode: race.selectionMode ?? RACE_SELECTION_MODE.DIRECT,
    ancestry: normalizeAncestry(race.ancestry),
    heritageIds: race.heritageIds ?? [],
    size: race.size ?? SIZE_CODE.MEDIUM,
    speeds: race.speeds ?? []
  }
}

function normalizeAncestry(ancestry: RaceFormValues['ancestry']): BaseRaceDto['ancestry'] {
  if (!ancestry) return undefined

  return {
    ...ancestry,
    label: ancestry.label.trim(),
    description: ancestry.description ?? '',
    options: ancestry.options ?? []
  }
}
