import { useLocalStorage } from '@mantine/hooks'

export const DICE_SHADOW_QUALITIES = ['LOW', 'MEDIUM', 'HIGH'] as const

export type DiceShadowQuality = (typeof DICE_SHADOW_QUALITIES)[number]

export interface DicePresentationPreferences {
  animate3d: boolean
  postProcessing: boolean
  shadowQuality: DiceShadowQuality
}

const DEFAULT_DICE_PRESENTATION_PREFERENCES: DicePresentationPreferences = {
  animate3d: true,
  postProcessing: true,
  shadowQuality: 'MEDIUM'
}

const DICE_PRESENTATION_STORAGE_KEY = 'artificer:dice-presentation:v1'

function deserializeDicePreferences(value: string | undefined): DicePresentationPreferences {
  if (value === undefined) return DEFAULT_DICE_PRESENTATION_PREFERENCES

  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_DICE_PRESENTATION_PREFERENCES

    const candidate = parsed as Record<string, unknown>
    return {
      animate3d:
        typeof candidate.animate3d === 'boolean'
          ? candidate.animate3d
          : DEFAULT_DICE_PRESENTATION_PREFERENCES.animate3d,
      postProcessing:
        typeof candidate.postProcessing === 'boolean'
          ? candidate.postProcessing
          : DEFAULT_DICE_PRESENTATION_PREFERENCES.postProcessing,
      shadowQuality: DICE_SHADOW_QUALITIES.includes(candidate.shadowQuality as DiceShadowQuality)
        ? (candidate.shadowQuality as DiceShadowQuality)
        : DEFAULT_DICE_PRESENTATION_PREFERENCES.shadowQuality
    }
  } catch {
    return DEFAULT_DICE_PRESENTATION_PREFERENCES
  }
}

export function useDicePresentationPreferences() {
  return useLocalStorage<DicePresentationPreferences>({
    key: DICE_PRESENTATION_STORAGE_KEY,
    defaultValue: DEFAULT_DICE_PRESENTATION_PREFERENCES,
    deserialize: deserializeDicePreferences,
    serialize: (value) => JSON.stringify(value)
  })
}
