import { assertNever } from '#utils'

import type {
  RaceAncestryAuthored,
  RaceAncestryOptionAuthored,
  RaceAuthored
} from '#authored'
import { RACE_CATEGORY_CODE, type SizeCode } from '#core'
import {
  compileFeature,
  type CompiledFeature,
  compileSpeed,
  type CompiledSpeed
} from '#compilers'

export interface CompiledRaceCharacteristics {
  sizeId: string
  speeds: CompiledSpeed[]
}

export interface CompiledRaceAncestry {
  id: string
  options: CompiledRaceAncestryOption[]
}

export interface CompiledRaceAncestryOption {
  id: string
  order: number // int
  features?: CompiledFeature[]
}

export type CompiledRaceBase = {
  id: string
  features?: CompiledFeature[]
}

export type CompiledRace = (
  | {
    category: typeof RACE_CATEGORY_CODE.BASE
    playable: boolean
    ancestry?: CompiledRaceAncestry
    size: SizeCode
    speeds: CompiledSpeed[]
  }
  | {
    category: typeof RACE_CATEGORY_CODE.SUBRACE
    parentRaceId: string
    size?: SizeCode
    speeds?: CompiledSpeed[]
  }
)
& CompiledRaceBase

export function compileAncestryOption(
  authored: RaceAncestryOptionAuthored
): CompiledRaceAncestryOption {
  const features
    = authored.features && authored.features.length
      ? authored.features.map((feature) => compileFeature(feature))
      : undefined

  return {
    id: authored.id,
    order: authored.order,
    features
  }
}

export function compileAncestry(
  authored: RaceAncestryAuthored
): CompiledRaceAncestry {
  return {
    id: authored.id,
    options: authored.options.map((option) => compileAncestryOption(option))
  }
}

export function compileRace(authored: RaceAuthored): CompiledRace {
  const features
    = authored.features && authored.features.length
      ? authored.features.map((feature) => compileFeature(feature))
      : undefined

  const base: CompiledRaceBase = {
    id: authored.id,
    features
  }

  switch (authored.category) {
    case RACE_CATEGORY_CODE.BASE: {
      const ancestry = authored.ancestry
        ? compileAncestry(authored.ancestry)
        : undefined

      return {
        ...base,
        category: authored.category,
        playable: authored.playable,
        ancestry,
        size: authored.size,
        speeds: authored.speeds.map(compileSpeed)
      }
    }

    case RACE_CATEGORY_CODE.SUBRACE: {
      return {
        ...base,
        category: authored.category,
        parentRaceId: authored.parentRaceId,
        size: authored.size,
        speeds:
          authored.speeds && authored.speeds.length
            ? authored.speeds.map(compileSpeed)
            : undefined
      }
    }

    default:
      return assertNever(authored)
  }
}
