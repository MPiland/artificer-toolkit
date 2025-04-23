import { GQL } from '@/types'
import { calculateHitpoints, sourcePropertyMap, type SourcePropertyMapReturn } from '@/components/Form'
import { useClassData, useGetSections } from '@/hooks'

const useGetCharacterData = ({ formData }: { formData: GQL.Character }) => {
  const { classes } = useClassData()

  const { features, createSections, createAbilityScores } = useGetSections({ formData })
  const sections = createSections()
  const abilityScores = createAbilityScores()

  let hitpoints = {} as GQL.CharacterHitpoint

  const characterFeatures: GQL.CharacterFeature[] =
    features?.map((feature) => {
      const featureObj: GQL.CharacterFeature = {
        __typename: 'CharacterFeature',
        id: feature.id,
      }
      Object.keys(sourcePropertyMap(formData)).forEach((key) => {
        const typeKey = key as keyof SourcePropertyMapReturn
        if (sourcePropertyMap(formData)[typeKey]) {
          featureObj[typeKey] = feature[typeKey]
        }
      })
      if (feature.level) {
        featureObj.level = feature.level
      }
      if (feature.options?.length) {
        featureObj.options = feature.options
      }
      return featureObj
    }) || []

  if (formData?.classes?.length) {
    const primaryClass = classes?.findClass(formData?.classes?.[0]?.id)
    if (primaryClass) {
      hitpoints = calculateHitpoints(formData, primaryClass)
    }
  } else if (formData?.hitpoint?.maxHitpoints !== undefined && formData?.hitpoint?.maxHitpoints !== null) {
    hitpoints = {
      __typename: 'CharacterHitpoint',
      maxHitpoints: undefined,
      maxOverride: undefined,
      method: formData?.hitpoint?.method,
      temp: undefined,
      bonus: undefined,
      rolled: {
        __typename: 'HitpointRoll',
        values: [],
        total: undefined,
        current: undefined,
      },
      fixed: {
        __typename: 'HitpointFixed',
        total: undefined,
        current: undefined,
      },
    }
  }

  return { features, characterFeatures, sections, hitpoints, abilityScores }
}
export default useGetCharacterData
