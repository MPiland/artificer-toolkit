import type { CharacterInput, CharacterFeatureInput, CharacterHitpointInput } from '@/types'
import { calculateHitpoints, sourcePropertyMap, type SourcePropertyMapReturn } from '@/components/Form'
import { useClassData, useGetSections } from '@/hooks'
import { CharacterFeatureInputSchema, CharacterHitpointInputSchema } from '@/schemas'

const useGetCharacterData = ({ formData }: { formData: CharacterInput }) => {
  const { classes } = useClassData()

  const { features, createSections, createAbilityScores } = useGetSections({ formData })
  const sections = createSections()
  const abilityScores = createAbilityScores()

  let hitpoints = {} as CharacterHitpointInput

  const characterFeatures: CharacterFeatureInput[] =
    features?.map((feature) => {
      const featureObj: CharacterFeatureInput = CharacterFeatureInputSchema().parse({
        __typename: 'CharacterFeature',
        id: feature.id,
      })
      Object.keys(sourcePropertyMap(formData)).forEach((key) => {
        const typeKey = key as keyof SourcePropertyMapReturn
        if (sourcePropertyMap(formData)[typeKey]) {
          featureObj[typeKey] = feature[typeKey] || ''
        }
      })
      if (feature.level) {
        featureObj.level = feature.level
      }
      if (feature.options?.length) {
        featureObj.options = feature.options || null
      }
      return featureObj
    }) || []

  if (formData?.classes?.length) {
    const primaryClass = classes?.findClass(formData?.classes?.[0]?.id)
    if (primaryClass) {
      hitpoints = calculateHitpoints(formData, primaryClass)
    }
  } else if (formData?.hitpoint?.maxHitpoints !== undefined && formData?.hitpoint?.maxHitpoints !== null) {
    hitpoints = CharacterHitpointInputSchema().parse({
      maxHitpoints: undefined,
      maxOverride: undefined,
      method: formData?.hitpoint?.method,
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

  return { features, characterFeatures, sections, hitpoints, abilityScores }
}
export default useGetCharacterData
