import type { CharacterInput, CharacterFeatureInput, Feature } from '@types'
import { useQuery } from '@tanstack/react-query'
import { CharacterFeatureInputSchema } from '@artificer-toolkit/shared/schemas'
import { useOptimizedSelector } from '@store'
import { Attributes } from '@enums'
import { useCharacterBaseData } from '@hooks'

export const useCharacterFeatures = () => {
  // Use optimized selector with shallow comparison for all needed properties
  const current = useOptimizedSelector<CharacterInput, CharacterInput | null>(
    (state) => state.current
  )
  const { data: baseData, isLoading: baseDataLoading } = useCharacterBaseData()

  // Helper function to extract feature levels from various sources
  const extractFeatureLevels = (feature: {
    levelAvailable?: string | null
    optionsByLevel?: Array<{ level?: number | null }> | null
  }): (number | string)[] => {
    let levels: (number | string)[] = []

    if (feature?.levelAvailable) {
      levels = feature.levelAvailable.split(/\s*,\s*/)
    }

    if (feature?.optionsByLevel?.length) {
      const filteredFeatureOptions = feature.optionsByLevel.filter((o) => o.level !== null && o.level !== undefined)
      levels = filteredFeatureOptions.map((o) => o.level as number)
    }

    return levels
  }

  // Helper function to check if feature already exists
  const featureExists = (
    featureId: string,
    level: number | string,
    sourceId: string,
    sourceIdKey: 'classId' | 'raceId' | 'featId' | 'backgroundId' | 'equipmentId' | 'ancestryId'
  ): boolean => {
    return (
      current?.features?.some(
        (existingFeature) => existingFeature.id === featureId
          && existingFeature.level === Number(level)
          && existingFeature[sourceIdKey] === sourceId
      ) || false
    )
  }

  // Helper function to create character feature input
  const createCharacterFeature = (
    featureId: string,
    sourceId: string,
    sourceIdKey: 'classId' | 'raceId' | 'featId' | 'backgroundId' | 'equipmentId' | 'ancestryId',
    level?: number
  ): CharacterFeatureInput => {
    const baseFeature = {
      __kind: 'CharacterFeatureInput' as const,
      id: featureId,
      [sourceIdKey]: sourceId,
      options: null
    }

    if (level !== undefined) {
      return CharacterFeatureInputSchema.parse({
        ...baseFeature,
        level
      })
    }

    return CharacterFeatureInputSchema.parse(baseFeature)
  }

  // Helper function to process simple features (race/feat/background)
  const processSimpleFeatures = (
    sourceFeatures: Array<{ id: string }>,
    sourceId: string,
    existingFeatures: CharacterFeatureInput[],
    sourceIdKey: 'classId' | 'raceId' | 'featId' | 'backgroundId' | 'equipmentId' | 'ancestryId'
  ): CharacterFeatureInput[] => {
    const features: CharacterFeatureInput[] = []

    sourceFeatures.forEach((feature) => {
      if (
        !existingFeatures?.some(
          (existingFeature) => existingFeature.id === feature.id && existingFeature[sourceIdKey] === sourceId
        )
      ) {
        features.push(createCharacterFeature(feature.id, sourceId, sourceIdKey))
      }
    })

    return features
  }

  const processClassFeatures = () => {
    let features: CharacterFeatureInput[] = []

    if (!baseData || !current?.classes?.length) return features

    const processFeatureWithLevels = (
      sourceFeatures: Feature[],
      sourceId: string,
      sourceIdKey: 'classId' | 'raceId' | 'featId' | 'backgroundId' | 'equipmentId' | 'ancestryId'
    ): CharacterFeatureInput[] => {
      const features: CharacterFeatureInput[] = []
      for (const feature of sourceFeatures) {
        const levels = extractFeatureLevels(feature)

        if (levels?.length) {
          levels.forEach((featureLevel) => {
            if (!featureExists(feature.id, featureLevel, sourceId, sourceIdKey)) {
              features.push(createCharacterFeature(feature.id, sourceId, sourceIdKey, Number(featureLevel)))
            }
          })
        }
      }

      return features
    }

    // Process existing character features
    const filteredCharFeatures = current?.features?.filter(
      (feature) => feature?.classId
        && current?.classes?.some((c) => c?.id === feature.classId || c?.subclass?.id === feature.classId)
    )

    if (filteredCharFeatures?.length) {
      features = [...features, ...filteredCharFeatures]
    }

    // Process all classes using pre-fetched data
    current.classes.forEach((dataClass) => {
      const fullClass = baseData.classMap.get(dataClass.id)
      if (!fullClass) return

      if (fullClass?.features?.length) {
        const classFeatures = processFeatureWithLevels(fullClass.features, fullClass.id, 'classId')
        features = [...features, ...classFeatures]
      }

      // Process subclass features using pre-fetched data
      if (dataClass.subclass) {
        const fullSubclass = baseData.classMap.get(dataClass.subclass.id)
        if (fullSubclass && fullSubclass?.features?.length) {
          const subclassFeatures = processFeatureWithLevels(fullSubclass.features, fullSubclass.id, 'classId')
          features = [...features, ...subclassFeatures]
        }
      }
    })

    return features
  }

  const processRaceFeatures = () => {
    let features: CharacterFeatureInput[] = []

    if (!baseData || !current?.race) return features

    const fullRace = baseData.raceMap.get(current.race)
    if (!fullRace) return features

    // Process existing character features
    const filteredCharFeatures = current?.features?.filter(
      (feature) => feature?.raceId && current?.race === feature.raceId
    )

    if (filteredCharFeatures?.length) {
      features = [...features, ...filteredCharFeatures]
    }

    // Process race features using pre-fetched data
    if (fullRace?.features?.length) {
      const raceFeatures = processSimpleFeatures(fullRace.features, fullRace.id, features, 'raceId')
      features = [...features, ...raceFeatures]
    }

    // Process lineage features using pre-fetched data
    if (fullRace?.lineages?.length) {
      fullRace.lineages.forEach((lineageId: string) => {
        const fullLineage = baseData.lineageMap.get(lineageId)
        if (fullLineage && fullLineage?.features?.length) {
          const lineageFeatures = processSimpleFeatures(fullLineage.features, fullLineage.id, features, 'raceId')
          features = [...features, ...lineageFeatures]
        }
      })
    }

    return features
  }

  const processAncestryFeatures = () => {
    let features: CharacterFeatureInput[] = []

    if (!baseData || !current?.ancestry?.id) return features

    const fullAncestry = baseData.ancestryMap.get(current.ancestry.id)
    if (!fullAncestry) return features

    // Process existing character features
    const filteredCharFeatures = current?.features?.filter(
      (feature) => feature?.ancestryId && current?.ancestry?.id === feature.ancestryId
    )

    if (filteredCharFeatures?.length) {
      features = [...features, ...filteredCharFeatures]
    }

    // Process ancestry features using pre-fetched data
    if (fullAncestry?.features?.length) {
      const ancestryFeatures = processSimpleFeatures(fullAncestry.features, fullAncestry.id, features, 'ancestryId')
      features = [...features, ...ancestryFeatures]
    }

    return features
  }

  const processEquipmentFeatures = () => {
    let features: CharacterFeatureInput[] = []

    if (!baseData || !current?.equipment?.inventory?.length) return features

    // Process existing character features first
    const filteredCharFeatures = current?.features?.filter(
      (feature) => feature?.equipmentId && current?.equipment?.inventory?.some((e) => e?.id === feature.equipmentId)
    )

    if (filteredCharFeatures?.length) {
      features = [...features, ...filteredCharFeatures]
    }

    // Process equipment features using pre-fetched data
    current.equipment.inventory.forEach((equipment) => {
      const fullEquipment = baseData.equipmentMap.get(equipment.id)
      if (!fullEquipment) return

      if (current?.equipment?.equipped?.includes(equipment.id)) {
        const attunementRequired = fullEquipment?.attributes?.some(
          (attribute: string) => attribute === Attributes.REQUIRE_ATTUNEMENT
        )

        if (!attunementRequired || (attunementRequired && current?.equipment?.attuned?.includes(equipment.id))) {
          if (fullEquipment?.features?.length) {
            const equipmentFeatures = processSimpleFeatures(
              fullEquipment.features,
              fullEquipment.id,
              features,
              'equipmentId'
            )
            features = [...features, ...equipmentFeatures]
          }
        }
      }
    })

    return features
  }

  const processFeatFeatures = () => {
    let features: CharacterFeatureInput[] = []

    if (!baseData || !current?.feats?.length) return features

    // Process existing character features first
    const filteredCharFeatures = current?.features?.filter(
      (feature) => feature?.featId && current?.feats?.some((f) => f?.id === feature.featId)
    )

    if (filteredCharFeatures?.length) {
      features = [...features, ...filteredCharFeatures]
    }

    // Process feat features using pre-fetched data
    current.feats.forEach((feat) => {
      const fullFeat = baseData.featMap.get(feat.id)
      if (!fullFeat) return

      if (fullFeat?.features?.length) {
        const featFeatures = processSimpleFeatures(fullFeat.features, fullFeat.id, features, 'featId')
        features = [...features, ...featFeatures]
      }
    })

    return features
  }

  const processBackgroundFeatures = () => {
    let features: CharacterFeatureInput[] = []

    if (!baseData || !current?.background) return features

    const fullBackground = baseData.backgroundMap.get(current.background)
    if (!fullBackground) return features

    // Process existing character features
    const filteredCharFeatures = current?.features?.filter(
      (feature) => feature?.backgroundId && current?.background === feature.backgroundId
    )

    if (filteredCharFeatures?.length) {
      features = [...features, ...filteredCharFeatures]
    }

    // Process background features using pre-fetched data
    if (fullBackground?.features?.length) {
      const backgroundFeatures = processSimpleFeatures(
        fullBackground.features,
        fullBackground.id,
        features,
        'backgroundId'
      )
      features = [...features, ...backgroundFeatures]
    }

    return features
  }

  return useQuery({
    queryKey: [
      'characterFeatures',
      current?.id,
      {
        classIds: current?.classes?.map((c) => c.id) || [],
        raceId: current?.race,
        ancestryId: current?.ancestry?.id,
        featIds: current?.feats?.map((f) => f.id) || [],
        equipmentIds: current?.equipment?.inventory?.map((i) => i.id) || [],
        backgroundId: current?.background,
        existingFeatureIds: current?.features?.map((f) => f.id) || []
      }
    ],
    queryFn: () => {
      if (!baseData || baseDataLoading) return []

      // Process all feature types using pre-fetched data
      const allFeatures = [
        ...processClassFeatures(),
        ...processRaceFeatures(),
        ...processAncestryFeatures(),
        ...processFeatFeatures(),
        ...processEquipmentFeatures(),
        ...processBackgroundFeatures()
      ]

      return allFeatures
    },
    enabled: !!current?.id && !!baseData && !baseDataLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  })
}
