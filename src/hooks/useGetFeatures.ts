import type {
  DeepKeyOf,
  Character,
  FormDataType,
  SystemInput,
  SpellInput,
  CharacterFeatureInput,
  FeatureInput,
  AncestryFeatureInput,
  CharacterFeatureOptionInput,
  CharacterEquipmentObjectInput,
  FeatureOptionInput,
  AncestryFeature,
  Feature,
} from '@/types'
import { useCallback, useMemo } from 'react'
import { getKeyFromId, sourcePropertyMap } from '@/components/Form'
import { useClassData, useRaceData, useFeatData, useEquipmentData, useBackgroundData } from '@/hooks'
import { Prerequisites, Attributes } from '@/enums'
import { CamelCase } from 'type-fest'
import { AncestryFeatureInputSchema, FeatureInputSchema } from '@/schemas'

export interface FactoryFeature extends Omit<FeatureInput | AncestryFeatureInput, 'options'> {
  level?: number
  classId?: string
  backgroundId?: string
  equipmentId?: string
  raceId?: string
  featId?: string
  ancestryId?: string
  options?: CharacterFeatureOptionInput[] | null | undefined
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
  [key in CamelCase<keyof typeof Prerequisites>]?: ({
    option,
    feature,
    optionIndex,
  }: {
    option: FeatureOptionInput
    feature?: FactoryFeature
    optionIndex?: string
  }) => boolean
}

const useGetFeatures = ({ data }: { data: Exclude<FormDataType, SystemInput | SpellInput> }) => {
  const { classes } = useClassData()
  const { races } = useRaceData()
  const { feats } = useFeatData()
  const { equipment } = useEquipmentData()
  const { backgrounds } = useBackgroundData()

  const prerequisiteProcessors: PrerequisiteProcessor = {
    optionNotObtained: ({ option, feature, optionIndex }): boolean => {
      if (data?.__kind !== 'CharacterInput' || !feature) return true
      // Get already selected options
      const alreadySelectedOptions =
        data?.features
          ?.filter((f) => f.id === feature.id && f.options?.length)
          .flatMap((f) =>
            f.options?.filter((o) => !(o.optionIndex === optionIndex && o.id === option.id)).map((o) => o.id)
          ) || []

      return !alreadySelectedOptions.includes(option.id)
    },

    optionsObtained: ({ option, feature }): boolean => {
      if (!feature || !option?.prerequisites?.optionsObtained?.length) return true
      return option?.prerequisites?.optionsObtained?.some((o) =>
        data?.features?.filter((f) => f.id === feature.id).flatMap((f) => f.options?.some((fO) => fO.id === o))
      )
    },

    featuresObtained: ({ option }): boolean => {
      if (!option?.prerequisites?.featuresObtained?.length) return true
      return option?.prerequisites?.featuresObtained?.some((fO) => data?.features?.some((f) => f.id === fO))
    },

    abilityScore: ({ option }): boolean => {
      if (data?.__kind !== 'CharacterInput') return true
      // Get the required abilities and score
      const requiredAbilities = option?.prerequisites?.abilityScore?.abilities
      const requiredScore = option?.prerequisites?.abilityScore?.score

      if (!requiredAbilities || !requiredScore) return true

      // Check if every required ability meets the minimum score
      return requiredAbilities.every((ability): boolean => {
        const abilityScore = data?.abilities?.scores?.find((s) => s.ability === ability)?.calculatedScore || 0
        return abilityScore >= requiredScore
      })
    },

    spellsObtained: ({ option }): boolean => {
      if (!option?.prerequisites?.spellsObtained?.length || data?.__kind !== 'CharacterInput') return true

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
  ): { id: string; label: string; value: string }[] => {
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
    (feature: CharacterFeatureInput | FactoryFeature): FeatureInput | AncestryFeatureInput | null | undefined => {
      if (data?.__kind !== 'CharacterInput') return null

      if (feature?.classId) {
        const classFeature =
          FeatureInputSchema.parse(classes?.findClass(feature.classId)?.features?.find((f) => f.id === feature.id)) ||
          null
        return classFeature
      }
      if (feature?.raceId) {
        const raceFeature =
          FeatureInputSchema.parse(races.findRace(feature.raceId)?.features?.find((f) => f?.id === feature?.id)) || null
        return raceFeature
      }
      if (feature?.ancestryId) {
        const ancestryFeature =
          AncestryFeatureInputSchema.parse(
            races
              .findRace(data?.race)
              ?.ancestry?.options?.find((a) => a?.id === feature?.ancestryId)
              ?.features?.find((f) => f.id === feature.id)
          ) || null
        return ancestryFeature
      }
      if (feature?.backgroundId) {
        const backgroundFeature =
          FeatureInputSchema.parse(
            backgrounds?.findBackground(feature.backgroundId)?.features?.find((f) => f.id === feature.id)
          ) || null
        return backgroundFeature
      }
      if (feature?.featId) {
        const featFeature =
          FeatureInputSchema.parse(feats?.findFeat(feature.featId)?.features?.find((f) => f.id === feature.id)) || null
        return featFeature
      }
      if (feature?.equipmentId) {
        const equipmentFeature =
          FeatureInputSchema.parse(
            equipment?.findEquipment(feature.equipmentId)?.features?.find((f) => f.id === feature.id)
          ) || null
        return equipmentFeature
      }
    },
    [classes, races, backgrounds, feats, equipment, data]
  )

  const getFeatureOptions = ({ feature, optionIndex }: GetFeatureOptionsProps): GetFeatureOptionsResult<Character> => {
    if (data?.__kind === 'CharacterInput') {
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
          id: option.id!,
          label: option.label || 'Option',
          value: option.value || 'option',
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
      classes: (): FactoryFeature[] => {
        if (data?.__kind !== 'CharacterInput' || !data?.classes || !data?.classes?.length) return []

        const features: FactoryFeature[] = []

        const existingFeatures: FactoryFeature[] =
          data?.features
            ?.filter((feature) => feature?.classId && sourcePropertyMap(data).classId(feature?.classId))
            .map((eF) => {
              const fullFeature = FeatureInputSchema.parse(getFullFeature(eF))
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
              return FeatureInputSchema.omit({ options: true }).parse({})
            }) || []

        features.push(...existingFeatures)

        data?.classes?.forEach((fC) => {
          if (!fC) return
          const fullClass = classes.findClass(fC.id)
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
                  const featureInput = FeatureInputSchema.omit({ options: true }).parse({
                    ...feature,
                    id: feature.id,
                    classId: fullClass.id,
                    level: Number(featureLevel),
                    options: null,
                  })
                  features.push(featureInput)
                }
              })
            }
          })

          if (fC.subclass) {
            const fullSubclass = classes.findClass(fC?.subclass?.id)

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
                    const featureInput = FeatureInputSchema.omit({ options: true }).parse({
                      ...feature,
                      id: feature.id,
                      classId: fullSubclass.id,
                      level: Number(featureLevel),
                      options: null,
                    })
                    features.push(featureInput)
                  }
                })
              }
            })
          }
        })

        return features
      },
      race: (): FactoryFeature[] => {
        if (data?.__kind !== 'CharacterInput' || !data?.race) return []

        const fullRace = races.findRace(data?.race)

        if (!fullRace) return []

        const features: FactoryFeature[] = []

        const existingFeatures =
          data?.features
            ?.filter((feature) => feature?.raceId && sourcePropertyMap(data).raceId(feature?.raceId))
            .map((eF) => {
              const fullFeature = FeatureInputSchema.parse(getFullFeature(eF))
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
              return FeatureInputSchema.omit({ options: true }).parse({})
            }) || []

        features.push(...existingFeatures)
        fullRace.features?.forEach((feature) => {
          if (
            !existingFeatures?.some(
              (existingFeature) => existingFeature.id === feature.id && existingFeature?.raceId === fullRace.id
            )
          ) {
            const featureInput = FeatureInputSchema.omit({ options: true }).parse({
              ...feature,
              raceId: fullRace?.id,
              options: null,
            })
            features.push(featureInput)
          }
        })

        return features
      },
      ancestry: (): FactoryFeature[] => {
        if (data?.__kind !== 'CharacterInput' || !data?.race) return []

        const features: FactoryFeature[] = []

        const existingFeatures =
          data?.features
            ?.filter((feature) => feature?.ancestryId && sourcePropertyMap(data).ancestryId(feature?.ancestryId))
            .map((eF) => {
              const fullFeature = FeatureInputSchema.parse(getFullFeature(eF))
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
              return FeatureInputSchema.omit({ options: true }).parse({})
            }) || []

        features.push(...existingFeatures)

        const fullAncestry = races?.findRace(data?.race)?.ancestry?.options?.find((a) => a?.id === data?.ancestry?.id)

        if (fullAncestry) {
          fullAncestry.features?.forEach((feature) => {
            if (
              !existingFeatures?.some(
                (existingFeature) =>
                  existingFeature?.id === feature?.id && existingFeature?.ancestryId === fullAncestry?.id
              )
            ) {
              const featureInput = FeatureInputSchema.omit({ options: true }).parse({
                ...feature,
                ancestryId: fullAncestry?.id,
                options: null,
              })
              features.push(featureInput)
            }
          })
        }

        return features
      },
      equipment: (): FactoryFeature[] => {
        if (data?.__kind !== 'CharacterInput' || !data?.equipment || !data?.equipment?.inventory?.length) return []

        const features: FactoryFeature[] = []

        const existingFeatures =
          data?.features
            ?.filter((feature) => feature?.equipmentId && sourcePropertyMap(data).equipmentId(feature?.equipmentId))
            .map((eF) => {
              const fullFeature = FeatureInputSchema.parse(getFullFeature(eF))
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
              return FeatureInputSchema.omit({ options: true }).parse({})
            }) || []

        features.push(...existingFeatures)

        const checkEquipment = (featureEquipment: CharacterEquipmentObjectInput) => {
          if (data?.equipment?.equipped?.includes(featureEquipment.id)) {
            const fullEquipment = equipment?.findEquipment(featureEquipment.id)

            const attunementRequired = fullEquipment?.attributes?.some(
              (attribute) => attribute === Attributes.REQUIRE_ATTUNEMENT
            )

            if (
              !attunementRequired ||
              (attunementRequired && data?.equipment?.attuned?.includes(featureEquipment.id))
            ) {
              fullEquipment?.features?.forEach((feature) => {
                if (
                  !existingFeatures?.some(
                    (existingFeature) =>
                      existingFeature.id === feature.id && existingFeature.equipmentId === fullEquipment.id
                  )
                ) {
                  const featureInput = FeatureInputSchema.omit({ options: true }).parse({
                    ...feature,
                    equipmentId: fullEquipment?.id,
                    options: null,
                  })
                  features.push(featureInput)
                }
              })
            }
          }
        }

        data?.equipment?.inventory?.forEach((fE) => {
          checkEquipment(fE)
        })

        return features
      },
      feats: (): FactoryFeature[] => {
        if (data?.__kind !== 'CharacterInput' || !data?.feats || !data?.feats?.length) return []

        const features: FactoryFeature[] = []

        const existingFeatures =
          data?.features
            ?.filter((feature) => feature?.featId && sourcePropertyMap(data).featId(feature?.featId))
            .map((eF) => {
              const fullFeature = FeatureInputSchema.parse(getFullFeature(eF))
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
              return FeatureInputSchema.omit({ options: true }).parse({})
            }) || []

        features.push(...existingFeatures)

        data?.feats?.forEach((feat) => {
          const fullFeat = feats?.findFeat(feat.featId)

          if (fullFeat) {
            fullFeat.features?.forEach((feature) => {
              if (
                !existingFeatures?.some(
                  (existingFeature) => existingFeature.id === feature.id && existingFeature.featId === fullFeat.id
                )
              ) {
                const featureInput = FeatureInputSchema.omit({ options: true }).parse({
                  ...feature,
                  featId: fullFeat?.id,
                  options: null,
                })
                features.push(featureInput)
              }
            })
          }
        })
        return features
      },
      background: (): FactoryFeature[] => {
        if (data?.__kind !== 'CharacterInput' || !data?.background) return []

        const features: FactoryFeature[] = []

        const existingFeatures =
          data?.features
            ?.filter((feature) => feature?.backgroundId && sourcePropertyMap(data).backgroundId(feature?.backgroundId))
            .map((eF) => {
              const fullFeature = FeatureInputSchema.parse(getFullFeature(eF))
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
              return FeatureInputSchema.omit({ options: true }).parse({})
            }) || []

        features.push(...existingFeatures)

        const fullBackground = backgrounds?.findBackground(data?.background)

        fullBackground?.features?.forEach((feature) => {
          if (
            !existingFeatures?.some(
              (existingFeature) =>
                existingFeature.id === feature.id && existingFeature.backgroundId === fullBackground?.id
            )
          ) {
            const featureInput = FeatureInputSchema.omit({ options: true }).parse({
              ...feature,
              backgroundId: fullBackground?.id,
              options: null,
            })
            features.push(featureInput)
          }
        })

        return features
      },
      base: (): FactoryFeature[] => {
        if (!data?.features || data?.features?.length === 0 || data?.__kind === 'CharacterInput') return []

        const features: FactoryFeature[] = []

        if (data?.features?.length) {
          if (data?.__kind === 'ClassInput') {
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

            if (data?.__kind === 'RaceInput') {
              const lineages = races.filter((sRace) => data?.lineages?.includes(sRace.id))

              lineages.forEach((l) => {
                const lineage = races.findRace(l.id)
                return (
                  lineage?.features?.length &&
                  features.push(
                    ...lineage.features.map((feature) => {
                      const featureObj: FactoryFeature = FeatureInputSchema.omit({ options: true }).parse({
                        ...feature,
                        options: null,
                      })
                      return featureObj
                    })
                  )
                )
              })
            }
          }
        }

        return features
      },
    }
  }, [data, backgrounds, classes, feats, equipment, races, getFullFeature])

  const createFeatures = useCallback((): FactoryFeature[] => {
    let features: FactoryFeature[] = []
    Object.values(featureProcessor).forEach((processor) => {
      features = [...features, ...processor()]
    })

    return features
  }, [featureProcessor])

  return { createFeatures, getFeatureOptions, getFullFeature, sourcePropertyMap }
}
export default useGetFeatures
