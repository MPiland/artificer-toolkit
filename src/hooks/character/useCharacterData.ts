import type { CharacterInput, CharacterHitpointInput } from '~/types'
import { calculateHitpoints } from '~/components/Form'
import { useGetClass } from '~/apis'
import { CharacterHitpointInputSchema } from '~/schemas'
import { useOptimizedSelector, useFormProperties } from '~/store'
import { useCharacterAbilityScores, useCharacterSections, useCharacterFeatures } from '~/hooks'

export const useCharacterData = () => {
  // Use optimized selector with shallow comparison
  const formData = useOptimizedSelector<CharacterInput, CharacterInput | null>(
    (state) => state.current
  )
  
  // Batch related properties for better performance
  const { classes, hitpoint } = useFormProperties<CharacterInput, 'classes' | 'hitpoint'>(
    ['classes', 'hitpoint']
  ) || { classes: undefined, hitpoint: undefined }
  const sections = useCharacterSections()
  const { data: abilityScores } = useCharacterAbilityScores()

  let hitpoints: CharacterHitpointInput | undefined

  const characterFeatures = useCharacterFeatures()

  const { data: primaryClass } = useGetClass(classes?.[0]?.id || '')

  if (primaryClass) {
    hitpoints = calculateHitpoints(formData, primaryClass)
  } else if (hitpoint?.maxHitpoints !== undefined && hitpoint?.maxHitpoints !== null) {
    hitpoints = CharacterHitpointInputSchema.parse({
      maxHitpoints: undefined,
      maxOverride: undefined,
      method: hitpoint?.method,
      temp: undefined,
      bonus: undefined,
      rolled: {
        values: [],
        total: undefined,
        current: undefined,
      },
      fixed: {
        total: undefined,
        current: undefined,
      },
    })
  }

  return { characterFeatures, sections, hitpoints, abilityScores }
}
