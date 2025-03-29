import {
  Character,
  Race,
  Class,
  Feature,
  Contains,
  Equipment,
  Background,
  CharacterFeature,
  AncestryFeature,
  FeatureOption,
  Feat,
  CharacterFeatureOption,
} from '../../amplify/gql/types'
import { useListClassesQuery } from '../apis/classesApi'
import { useListEquipmentQuery } from '../apis/equipmentApi'
import { useListRacesQuery } from '../apis/racesApi'
import { useListFeatsQuery } from '../apis/featsApi'
import { useListBackgroundsQuery } from '../apis/backgroundsApi'
import { DeepKeyOf } from '../types/form'
import { useCallback, useMemo } from 'react'
import { Attributes, Prerequisites } from '../types/enums'
import { getKeyFromId } from '../utils/form'
import { sourcePropertyMap } from '../utils/form'

export type FactoryFeature = Omit<Feature | AncestryFeature, 'options' | '__typename'> & {
  level?: number
  classId?: string
  backgroundId?: string
  equipmentId?: string
  raceId?: string
  featId?: string
  ancestryId?: string
  options?: CharacterFeatureOption[] | null | undefined
}

export interface GetFeatureOptionsProps {
  feature: FactoryFeature
  optionIndex: string
}

export interface GetFeatureOptionsResult<T> {
  options: Array<{ id: string; label: string; value: string }>
  path: DeepKeyOf<T> | null
  exist?: string // Making this optional since it might not always be set
}

type PrerequisiteProcessor = {
  [key in keyof typeof Prerequisites]?: ({
    option,
    feature,
    optionIndex,
  }: {
    option: FeatureOption
    feature?: FactoryFeature
    optionIndex?: string
  }) => boolean
}

const useGetFeatures = ({ data }: { data: Character | Class | Race | Background | Equipment | Feat }) => {
  const { data: classes } = useListClassesQuery()
  const { data: races } = useListRacesQuery()
  const { data: feats } = useListFeatsQuery()
  const { data: equipment } = useListEquipmentQuery()
  const { data: backgrounds } = useListBackgroundsQuery()

  const prerequisiteProcessors: PrerequisiteProcessor = {
    optionNotObtained: ({ option, feature, optionIndex }) => {
      if (data?.__typename !== 'Character' || !feature) return true
      // Get already selected options
      const alreadySelectedOptions =
        data?.features
          ?.filter((f) => f.id === feature.id && f.options?.length)
          .flatMap((f) =>
            f.options?.filter((o) => !(o.optionIndex === optionIndex && o.id === option.id)).map((o) => o.id)
          ) || []

      return !alreadySelectedOptions.includes(option.id)
    },

    optionsObtained: ({ option, feature }) => {
      if (!feature || !option?.prerequisites?.optionsObtained?.length) return true
      return option?.prerequisites?.optionsObtained?.some((o) =>
        data?.features?.filter((f) => f.id === feature.id).flatMap((f) => f.options?.some((fO) => fO.id === o))
      )
    },

    featuresObtained: ({ option }) => {
      if (!option?.prerequisites?.featuresObtained?.length) return true
      return option?.prerequisites?.featuresObtained?.some((fO) => data?.features?.some((f) => f.id === fO))
    },

    abilityScore: ({ option }) => {
      if (data?.__typename !== 'Character') return true
      // Get the required abilities and score
      const requiredAbilities = option?.prerequisites?.abilityScore?.abilities
      const requiredScore = option?.prerequisites?.abilityScore?.score

      if (!requiredAbilities || !requiredScore) return true

      // Check if every required ability meets the minimum score
      return requiredAbilities.every((ability) => {
        const abilityScore = data?.abilities?.scores?.find((s) => s.ability === ability)?.calculatedScore || 0
        return abilityScore >= requiredScore
      })
    },

    spellsObtained: ({ option }) => {
      if (!option?.prerequisites?.spellsObtained?.length || data?.__typename !== 'Character') return true

      // Check for the spell in all possible locations
      const inKnown =
        data?.spellcasting?.known?.some((s) =>
          s.spells?.some((spell) => option?.prerequisites?.spellsObtained?.includes(spell.id))
        ) || false

      const inPrepared =
        data?.spellcasting?.prepared?.some((s) =>
          s.spells?.some((spell) => option?.prerequisites?.spellsObtained?.includes(spell.id))
        ) || false

      const inAdditional =
        data?.spellcasting?.additional?.some((spell) => option?.prerequisites?.spellsObtained?.includes(spell.id)) ||
        false

      return inKnown || inPrepared || inAdditional
    },
  }

  const filterOptionsByPrerequisites = (
    options: Array<{ id: string; label: string; value: string }>,
    feature: FactoryFeature,
    optionIndex: string
  ) => {
    return options.filter((option) => {
      const fullFeature = getFullFeature(feature)
      const fullOption = fullFeature?.options?.find((o) => o.id === option.id)

      if (!fullOption?.prerequisites || !fullOption?.prerequisites?.options?.length) return true

      return fullOption.prerequisites?.options?.every((prereqOption) => {
        const prereq = getKeyFromId(prereqOption, Prerequisites)

        if (!prereq || !prerequisiteProcessors[prereq]) {
          return true
        }

        return prerequisiteProcessors[prereq]({ option: fullOption, feature, optionIndex })
      })
    })
  }

  const getFullFeature = useCallback(
    (feature: CharacterFeature | FactoryFeature) => {
      if (data?.__typename !== 'Character') return null

      if (feature?.classId) {
        return classes?.find((c) => c.id === feature.classId)?.features?.find((f) => f.id === feature.id) || null
      }
      if (feature?.raceId) {
        return races.find((r) => r.id === feature.raceId)?.features?.find((f) => f?.id === feature?.id)
      }
      if (feature?.ancestryId) {
        return (
          races
            .find((r) => r.id === data?.race)
            ?.ancestry?.options?.find((a) => a?.id === feature?.ancestryId)
            ?.features?.find((f) => f.id === feature.id) || null
        )
      }
      if (feature?.backgroundId) {
        return (
          backgrounds?.find((b) => b.id === feature.backgroundId)?.features?.find((f) => f.id === feature.id) || null
        )
      }
      if (feature?.featId) {
        return feats?.find((f) => f.id === feature.featId)?.features?.find((f) => f.id === feature.id) || null
      }
      if (feature.equipmentId) {
        return equipment?.find((e) => e.id === feature.equipmentId)?.features?.find((f) => f.id === feature.id) || null
      }
    },
    [classes, races, backgrounds, feats, equipment, data]
  )

  const getFeatureOptions = ({ feature, optionIndex }: GetFeatureOptionsProps): GetFeatureOptionsResult<Character> => {
    if (data?.__typename === 'Character') {
      const featureIndex =
        data?.features?.findIndex((f) => {
          return f.id === feature.id && f.level === feature.level
        }) || 0
      const existIndex = data?.features?.[featureIndex]?.options?.findIndex(
        (o) => o.optionIndex === optionIndex && feature.level === o.featureLevel
      )

      const featureOptionIndex =
        existIndex && existIndex > -1 ? existIndex : data?.features?.[featureIndex]?.options?.length || 0

      const exist = existIndex && existIndex > -1 ? data?.features?.[featureIndex]?.options?.[existIndex] : null

      const path: DeepKeyOf<Character> = `features.${featureIndex}.options.${featureOptionIndex}`

      const fullFeature = getFullFeature(feature)

      // Map options to our expected format
      let options =
        fullFeature?.options?.map((option) => ({
          id: option.id,
          label: option.label,
          value: option.value,
        })) || []

      // Filter options based on prerequisites
      if (options?.length) {
        // Filter the options
        options = filterOptionsByPrerequisites(options, feature, optionIndex)
      }

      return { path, exist: exist?.id, options }
    }

    return { path: null, options: [] }
  }

  const featureProcessor = useMemo(() => {
    return {
      classes: () => {
        if (data?.__typename !== 'Character' || !data?.classes || !data?.classes?.length) return []

        const features: FactoryFeature[] = []

        const existingFeatures: FactoryFeature[] =
          data?.features
            ?.filter((feature) => feature?.classId && sourcePropertyMap(data).classId(feature?.classId))
            .map((eF) => {
              const fullFeature = getFullFeature(eF)
              if (fullFeature) {
                // Convert null to undefined for level
                const level = eF.level === null ? undefined : eF.level

                if (eF?.options?.length) {
                  return {
                    ...fullFeature,
                    classId: eF.classId || undefined,
                    level,
                    options: eF.options,
                  }
                }
                return {
                  ...fullFeature,
                  classId: eF.classId || undefined,
                  level,
                  options: null,
                }
              }
              return { id: '', label: '', value: '', level: undefined }
            }) || []

        features.push(...existingFeatures)

        data?.classes?.forEach((fC) => {
          const fullClass = classes.find((c) => c.id === fC.id)
          fullClass?.features?.forEach((feature) => {
            let levels: (number | string)[] = []

            if (feature?.levelAvailable) {
              levels = feature?.levelAvailable?.split(/\s*,\s*/)
            }

            if (feature?.optionsByLevel?.length) {
              const filteredFeatureOptions = feature?.optionsByLevel?.filter(
                (o) => o.level !== null && o.level !== undefined
              )
              levels = filteredFeatureOptions.map((o) => o.level as number)
            }

            if (levels?.length) {
              levels.forEach((featureLevel) => {
                if (
                  !existingFeatures?.some(
                    (existingFeature) =>
                      existingFeature.id === feature.id &&
                      existingFeature.level === Number(featureLevel) &&
                      existingFeature.classId === fullClass.id
                  )
                ) {
                  features.push({
                    ...feature,
                    classId: fullClass?.id,
                    level: Number(featureLevel),
                    options: null,
                  })
                }
              })
            }
          })

          if (fC.subclass) {
            const fullSubclass = classes.find((c) => c.id === fC?.subclass?.id)

            fullSubclass?.features?.forEach((feature) => {
              let levels: (number | string)[] = []

              if (feature?.levelAvailable) {
                levels = feature?.levelAvailable?.split(/\s*,\s*/)
              }

              if (feature?.optionsByLevel?.length) {
                const filteredFeatureOptions = feature?.optionsByLevel?.filter(
                  (o) => o.level !== null && o.level !== undefined
                )
                levels = filteredFeatureOptions.map((o) => o.level as number)
              }

              if (levels?.length) {
                levels.forEach((featureLevel) => {
                  if (
                    !existingFeatures?.some(
                      (existingFeature) =>
                        existingFeature.id === feature.id &&
                        existingFeature.level === Number(featureLevel) &&
                        existingFeature.classId === fullSubclass.id
                    )
                  ) {
                    features.push({
                      ...feature,
                      classId: fullSubclass?.id,
                      level: Number(featureLevel),
                      options: null,
                    })
                  }
                })
              }
            })
          }
        })

        return features
      },
      race: () => {
        if (data?.__typename !== 'Character' || !data?.race) return []

        const fullRace = races.find((r) => r.id === data?.race)

        if (!fullRace) return []

        const features: FactoryFeature[] = []

        const existingFeatures =
          data?.features
            ?.filter((feature) => feature?.raceId && sourcePropertyMap(data).raceId(feature?.raceId))
            .map((eF) => {
              const fullFeature = getFullFeature(eF)
              if (fullFeature) {
                // Convert null to undefined for level
                const level = eF.level === null ? undefined : eF.level

                if (eF?.options?.length) {
                  return {
                    ...fullFeature,
                    raceId: eF.raceId || undefined,
                    level,
                    options: eF.options,
                  }
                }
                return {
                  ...fullFeature,
                  raceId: eF.raceId || undefined,
                  level,
                  options: null,
                }
              }
              return { id: '', label: '', value: '', level: undefined, raceId: undefined }
            }) || []

        features.push(...existingFeatures)
        fullRace.features?.forEach((feature) => {
          if (
            !existingFeatures?.some(
              (existingFeature) => existingFeature.id === feature.id && existingFeature?.raceId === fullRace.id
            )
          ) {
            features.push({
              ...feature,
              raceId: fullRace?.id,
              options: null,
            })
          }
        })

        return features
      },
      ancestry: () => {
        if (data?.__typename !== 'Character' || !data?.race) return []

        const features: FactoryFeature[] = []

        const existingFeatures =
          data?.features
            ?.filter((feature) => feature?.ancestryId && sourcePropertyMap(data).ancestryId(feature?.ancestryId))
            .map((eF) => {
              const fullFeature = getFullFeature(eF)
              if (fullFeature) {
                // Convert null to undefined for level
                const level = eF.level === null ? undefined : eF.level

                if (eF?.options?.length) {
                  return {
                    ...fullFeature,
                    ancestryId: eF.ancestryId || undefined,
                    level,
                    options: eF.options,
                  }
                }
                return {
                  ...fullFeature,
                  ancestryId: eF.ancestryId || undefined,
                  level,
                  options: null,
                }
              }
              return { id: '', label: '', value: '', level: undefined, ancestryId: undefined }
            }) || []

        features.push(...existingFeatures)

        const fullAncestry = races
          ?.find((r) => r?.id === data?.race)
          ?.ancestry?.options?.find((a) => a?.id === data?.ancestry?.id)

        if (fullAncestry) {
          fullAncestry.features?.forEach((feature) => {
            if (
              !existingFeatures?.some(
                (existingFeature) =>
                  existingFeature?.id === feature?.id && existingFeature?.ancestryId === fullAncestry?.id
              )
            ) {
              features.push({
                ...feature,
                ancestryId: fullAncestry?.id,
                options: null,
              })
            }
          })
        }

        return features
      },
      equipment: () => {
        if (data?.__typename !== 'Character' || !data?.equipment || !data?.equipment?.length) return []

        const features: FactoryFeature[] = []

        const existingFeatures =
          data?.features
            ?.filter((feature) => feature?.equipmentId && sourcePropertyMap(data).equipmentId(feature?.equipmentId))
            .map((eF) => {
              const fullFeature = getFullFeature(eF)
              if (fullFeature) {
                // Convert null to undefined for level
                const level = eF.level === null ? undefined : eF.level

                if (eF?.options?.length) {
                  return {
                    ...fullFeature,
                    equipmentId: eF.equipmentId || undefined,
                    level,
                    options: eF.options,
                  }
                }
                return {
                  ...fullFeature,
                  equipmentId: eF.equipmentId || undefined,
                  level,
                  options: null,
                }
              }
              return { id: '', label: '', value: '', level: undefined, equipmentId: undefined }
            }) || []

        features.push(...existingFeatures)

        const checkEquipment = (featureEquipment: Contains) => {
          if (featureEquipment.equipped) {
            const fullEquipment = equipment?.find((e) => e.id === featureEquipment.id)

            const attunementRequired = fullEquipment?.attributes?.some(
              (attribute) => attribute === Attributes.requireAttunement
            )

            if (!attunementRequired || (attunementRequired && featureEquipment.attuned)) {
              fullEquipment?.features?.forEach((feature) => {
                if (
                  !existingFeatures?.some(
                    (existingFeature) =>
                      existingFeature.id === feature.id && existingFeature.equipmentId === fullEquipment.id
                  )
                ) {
                  features.push({
                    ...feature,
                    equipmentId: fullEquipment?.id,
                    options: null,
                  })
                }
              })
            }
          }
          if (featureEquipment.contains?.length) {
            featureEquipment.contains.forEach((fE) => {
              checkEquipment(fE)
            })
          }
        }

        data?.equipment?.forEach((fE) => {
          checkEquipment(fE)
        })

        return features
      },
      feats: () => {
        if (data?.__typename !== 'Character' || !data?.feats || !data?.feats?.length) return []

        const features: FactoryFeature[] = []

        const existingFeatures =
          data?.features
            ?.filter((feature) => feature?.featId && sourcePropertyMap(data).featId(feature?.featId))
            .map((eF) => {
              const fullFeature = getFullFeature(eF)
              if (fullFeature) {
                // Convert null to undefined for level
                const level = eF.level === null ? undefined : eF.level

                if (eF?.options?.length) {
                  return {
                    ...fullFeature,
                    featId: eF.featId || undefined,
                    level,
                    options: eF.options,
                  }
                }
                return {
                  ...fullFeature,
                  featId: eF.featId || undefined,
                  level,
                  options: null,
                }
              }
              return { id: '', label: '', value: '', level: undefined, featId: undefined }
            }) || []

        features.push(...existingFeatures)

        data?.feats?.forEach((feat) => {
          const fullFeat = feats?.find((f) => f.id === feat.featId)

          if (fullFeat) {
            fullFeat.features?.forEach((feature) => {
              if (
                !existingFeatures?.some(
                  (existingFeature) => existingFeature.id === feature.id && existingFeature.featId === fullFeat.id
                )
              ) {
                features.push({
                  ...feature,
                  featId: fullFeat?.id,
                  options: null,
                })
              }
            })
          }
        })
        return features
      },
      background: () => {
        if (data?.__typename !== 'Character' || !data?.background) return []

        const features: FactoryFeature[] = []

        const existingFeatures =
          data?.features
            ?.filter((feature) => feature?.backgroundId && sourcePropertyMap(data).backgroundId(feature?.backgroundId))
            .map((eF) => {
              const fullFeature = getFullFeature(eF)
              if (fullFeature) {
                // Convert null to undefined for level
                const level = eF.level === null ? undefined : eF.level

                if (eF?.options?.length) {
                  return {
                    ...fullFeature,
                    backgroundId: eF.backgroundId || undefined,
                    level,
                    options: eF.options,
                  }
                }
                return {
                  ...fullFeature,
                  backgroundId: eF.backgroundId || undefined,
                  level,
                  options: null,
                }
              }
              return { id: '', label: '', value: '', level: undefined, backgroundId: undefined }
            }) || []

        features.push(...existingFeatures)

        const fullBackground = backgrounds?.find((b) => b.id === data?.background)

        fullBackground?.features?.forEach((feature) => {
          if (
            !existingFeatures?.some(
              (existingFeature) =>
                existingFeature.id === feature.id && existingFeature.backgroundId === fullBackground?.id
            )
          ) {
            features.push({
              ...feature,
              backgroundId: fullBackground?.id,
              options: null,
            })
          }
        })

        return features
      },
      base: () => {
        if (!data?.features || data?.features?.length === 0 || data?.__typename === 'Character') return []

        const features: FactoryFeature[] = []

        if (data?.features?.length) {
          if (data?.__typename === 'Class') {
            data?.features?.forEach((feature) => {
              const levels = feature?.levelAvailable?.split(',')
              levels?.forEach((level) => {
                features.push({
                  ...feature,
                  level: parseInt(level),
                  options: null,
                })
              })
            })
          } else {
            features.push(
              ...data.features.map((feature) => {
                const featureObj: FactoryFeature = { ...feature, options: null }
                return featureObj
              })
            )

            if (data?.__typename === 'Race') {
              const lineages = races.filter((sRace) => data?.lineages?.includes(sRace.id))

              lineages.forEach(
                (lineage) =>
                  lineage?.features?.length &&
                  features.push(
                    ...lineage.features.map((feature) => {
                      const featureObj: FactoryFeature = { ...feature, options: null }
                      return featureObj
                    })
                  )
              )
            }
          }
        }

        return features
      },
    }
  }, [data, backgrounds, classes, feats, equipment, races, getFullFeature])

  const createFeatures = useCallback(() => {
    let features: FactoryFeature[] = []
    Object.values(featureProcessor).forEach((processor) => {
      features = [...features, ...processor()]
    })

    return features
  }, [featureProcessor])

  return { createFeatures, getFeatureOptions, getFullFeature, sourcePropertyMap }
}
export default useGetFeatures
