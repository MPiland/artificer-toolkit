import type {
  FormDataType,
  SystemInput,
  SpellInput,
  FeatureInput,
  CharacterFeatureOptionInput,
  CharacterEquipmentObjectInput,
  FeatureOptionInput,
  CharacterInput,
} from '@/types'
import { useCallback, useMemo } from 'react'
import { getKeyFromId, sourcePropertyMap } from '@/components/Form'
import { useClassData, useRaceData, useFeatData, useEquipmentData, useBackgroundData } from '@/hooks'
import { Prerequisites, Attributes } from '@/enums'
import { CamelCase } from 'type-fest'
import { FeatureInputSchema, FeatureOptionInputSchema } from '@/schemas'
import useFeatureData from './useFeatureData'
import type { DeepKeys } from '@tanstack/react-form'

export interface FactoryFeature extends Omit<FeatureInput, 'options'> {
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
  features: CharacterInput['features']
  abilities?: CharacterInput['abilities']
  spellcasting?: CharacterInput['spellcasting']
}

export interface GetFeatureOptionsResult<T> {
  options: { id: string; label: string }[]
  path: `features${DeepKeys<T>}`
  exist?: string // Making this optional since it might not always be set
}

type PrerequisiteProcessor = {
  [key in CamelCase<keyof typeof Prerequisites>]?: ({
    option,
    feature,
    optionIndex,
  }: {
    features?: CharacterInput['features']
    abilities?: CharacterInput['abilities']
    spellcasting?: CharacterInput['spellcasting']
    option: FeatureOptionInput
    feature?: FactoryFeature
    optionIndex?: string
  }) => boolean
}

const useGetFeatures = () => {
  const { classes } = useClassData()
  const { races } = useRaceData()
  const { feats } = useFeatData()
  const { equipment } = useEquipmentData()
  const { backgrounds } = useBackgroundData()
  const { features: featureData, featureOptions, ancestryOptions } = useFeatureData()

  const prerequisiteProcessors: PrerequisiteProcessor = {
    optionNotObtained: ({ features, option, feature, optionIndex }): boolean => {
      if (!feature) return true
      // Get already selected options
      const alreadySelectedOptions =
        features
          ?.filter((f) => f.id === feature.id && f.options?.length)
          .flatMap((f) =>
            f.options?.filter((o) => !(o.optionIndex === optionIndex && o.id === option.id)).map((o) => o.id)
          ) || []

      return !alreadySelectedOptions.includes(option.id)
    },

    optionsObtained: ({ features, option, feature }): boolean => {
      if (!feature || !option?.prerequisites?.optionsObtained?.length) return true
      return option?.prerequisites?.optionsObtained?.some((o) =>
        features?.filter((f) => f.id === feature.id).flatMap((f) => f.options?.some((fO) => fO.id === o))
      )
    },

    featuresObtained: ({ features, option }): boolean => {
      if (!option?.prerequisites?.featuresObtained?.length) return true
      return option?.prerequisites?.featuresObtained?.some((fO) => features?.some((f) => f.id === fO))
    },

    abilityScore: ({ abilities, option }): boolean => {
      // Get the required abilities and score
      const requiredAbilities = option?.prerequisites?.abilityScore?.abilities
      const requiredScore = option?.prerequisites?.abilityScore?.score

      if (!requiredAbilities || !requiredScore) return true

      // Check if every required ability meets the minimum score
      return requiredAbilities.every((ability): boolean => {
        const abilityScore = abilities?.scores?.find((s) => s.ability === ability)?.calculatedScore || 0
        return abilityScore >= requiredScore
      })
    },

    spellsObtained: ({ spellcasting, option }): boolean => {
      if (!option?.prerequisites?.spellsObtained?.length) return true

      // Check for the spell in all possible locations
      const inKnown =
        spellcasting?.known?.some((s) =>
          s.spells?.some((spell) => option?.prerequisites?.spellsObtained?.includes(spell.id))
        ) || false

      const inPrepared =
        spellcasting?.prepared?.some((s) =>
          s.spells?.some((spell) => option?.prerequisites?.spellsObtained?.includes(spell.id))
        ) || false

      const inAdditional =
        spellcasting?.additional?.some((spell) => option?.prerequisites?.spellsObtained?.includes(spell.id)) || false

      return inKnown || inPrepared || inAdditional
    },
  }

  const filterOptionsByPrerequisites = ({
    features,
    abilities,
    spellcasting,
    feature,
    optionIndex,
    options,
  }: {
    options: Array<{ id: string; label: string }>
    feature: FactoryFeature
    optionIndex: string
    features?: CharacterInput['features']
    abilities?: CharacterInput['abilities']
    spellcasting?: CharacterInput['spellcasting']
  }): { id: string; label: string }[] => {
    return options.filter((option) => {
      const fullFeature = featureData.findFeature(feature.id)
      const fullOption = featureOptions?.findFeatureOption(option.id)

      if (
        !fullOption?.prerequisites ||
        !fullOption?.prerequisites?.options?.length ||
        !fullFeature?.options?.includes(fullOption.id)
      )
        return true

      return fullOption.prerequisites?.options?.every((prereqOption) => {
        const prereq = getKeyFromId(prereqOption, Prerequisites)

        if (!prereq || !prerequisiteProcessors[prereq]) {
          return true
        }

        const optionInput = FeatureOptionInputSchema.parse(fullOption)

        return prerequisiteProcessors[prereq]({
          features,
          abilities,
          spellcasting,
          option: optionInput,
          feature,
          optionIndex,
        })
      })
    })
  }

  const getFeatureOptions = ({
    features,
    abilities,
    spellcasting,
    feature,
    optionIndex,
  }: GetFeatureOptionsProps): GetFeatureOptionsResult<NonNullable<CharacterInput['features']>> => {
    const featureIndex =
      features?.findIndex((f) => {
        return f.id === feature.id && f.level === feature.level
      }) || 0
    const existIndex = features?.[featureIndex]?.options?.findIndex(
      (o) => o.optionIndex === optionIndex && feature.level === o.featureLevel
    )

    const featureOptionIndex =
      existIndex && existIndex > -1 ? existIndex : features?.[featureIndex]?.options?.length || 0

    const exist = existIndex && existIndex > -1 ? features?.[featureIndex]?.options?.[existIndex] : null

    const path: `features${DeepKeys<NonNullable<CharacterInput['features']>>}` = `features[${featureIndex}].options[${featureOptionIndex}]`

    const fullFeature = featureData.findFeature(feature.id)

    // Map options to our expected format
    let options =
      fullFeature?.options?.map((option) => {
        const optionInput = FeatureInputSchema.parse(featureOptions.findFeatureOption(option))
        return {
          id: optionInput.id!,
          label: optionInput.label || 'Option',
        }
      }) || []

    // Filter options based on prerequisites
    if (options?.length) {
      // Filter the options
      options = filterOptionsByPrerequisites({ features, abilities, spellcasting, options, feature, optionIndex })
    }

    return { path, exist: exist?.id, options }
  }

  const featureProcessor = useMemo(() => {
    return {
      classes: ({ data }: { data: Exclude<FormDataType, SystemInput | SpellInput> }): FactoryFeature[] => {
        if (data?.__kind !== 'CharacterInput' || !data?.classes || !data?.classes?.length) return []

        const features: FactoryFeature[] = []

        const existingFeatures: FactoryFeature[] =
          data?.features
            ?.filter((feature) => feature?.classId && sourcePropertyMap(data).classId(feature?.classId))
            .map((eF) => {
              const featureState = featureData.findFeature(eF.id)

              if (featureState) {
                const fullFeature = FeatureInputSchema.omit({ options: true }).parse(featureState)
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

            const featureState = featureData.findFeature(feature)

            if (!featureState) return

            if (featureState?.levelAvailable) {
              levels = featureState?.levelAvailable?.split(/\s*,\s*/)
            }

            if (featureState?.optionsByLevel?.length) {
              const filteredFeatureOptions = featureState?.optionsByLevel?.filter(
                (o) => o.level !== null && o.level !== undefined
              )
              levels = filteredFeatureOptions.map((o) => o.level as number)
            }

            if (levels?.length) {
              levels.forEach((featureLevel) => {
                if (
                  !existingFeatures?.some(
                    (existingFeature) =>
                      existingFeature.id === featureState.id &&
                      existingFeature.level === Number(featureLevel) &&
                      existingFeature.classId === fullClass.id
                  )
                ) {
                  const featureInput = FeatureInputSchema.omit({ options: true }).parse({
                    ...featureState,
                    id: featureState.id,
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

              const featureState = featureData.findFeature(feature)

              if (!featureState) return

              if (featureState?.levelAvailable) {
                levels = featureState?.levelAvailable?.split(/\s*,\s*/)
              }

              if (featureState?.optionsByLevel?.length) {
                const filteredFeatureOptions = featureState?.optionsByLevel?.filter(
                  (o) => o.level !== null && o.level !== undefined
                )
                levels = filteredFeatureOptions.map((o) => o.level as number)
              }

              if (levels?.length) {
                levels.forEach((featureLevel) => {
                  if (
                    !existingFeatures?.some(
                      (existingFeature) =>
                        existingFeature.id === featureState.id &&
                        existingFeature.level === Number(featureLevel) &&
                        existingFeature.classId === fullSubclass.id
                    )
                  ) {
                    const featureInput = FeatureInputSchema.omit({ options: true }).parse({
                      ...featureState,
                      id: featureState.id,
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
      race: ({ data }: { data: Exclude<FormDataType, SystemInput | SpellInput> }): FactoryFeature[] => {
        if (data?.__kind !== 'CharacterInput' || !data?.race) return []

        const fullRace = races.findRace(data?.race)

        if (!fullRace) return []

        const features: FactoryFeature[] = []

        const existingFeatures: FactoryFeature[] =
          data?.features
            ?.filter((feature) => feature?.raceId && sourcePropertyMap(data).raceId(feature?.raceId))
            .map((eF) => {
              const featureState = featureData.findFeature(eF.id)

              if (featureState) {
                const fullFeature = FeatureInputSchema.omit({ options: true }).parse(featureState)

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
          const featureState = featureData.findFeature(feature)
          if (
            !existingFeatures?.some(
              (existingFeature) => existingFeature.id === featureState?.id && existingFeature?.raceId === fullRace.id
            )
          ) {
            const featureInput = FeatureInputSchema.omit({ options: true }).parse({
              ...featureState,
              raceId: fullRace?.id,
              options: null,
            })
            features.push(featureInput)
          }
        })

        return features
      },
      ancestry: ({ data }: { data: Exclude<FormDataType, SystemInput | SpellInput> }): FactoryFeature[] => {
        if (data?.__kind !== 'CharacterInput' || !data?.race) return []

        const features: FactoryFeature[] = []

        const existingFeatures: FactoryFeature[] =
          data?.features
            ?.filter((feature) => feature?.ancestryId && sourcePropertyMap(data).ancestryId(feature?.ancestryId))
            .map((eF) => {
              const featureState = featureData.findFeature(eF.id)

              if (featureState) {
                const fullFeature = FeatureInputSchema.omit({ options: true }).parse(featureState)
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

        const fullAncestry = ancestryOptions.findAncestryOption(data?.ancestry?.id)

        if (fullAncestry) {
          fullAncestry.features?.forEach((f) => {
            const featureState = featureData.findFeature(f)

            if (!featureState) return

            if (
              !existingFeatures?.some(
                (existingFeature) =>
                  existingFeature?.id === featureState?.id && existingFeature?.ancestryId === fullAncestry?.id
              )
            ) {
              const featureInput = FeatureInputSchema.omit({ options: true }).parse({
                ...featureState,
                ancestryId: fullAncestry?.id,
                options: null,
              })
              features.push(featureInput)
            }
          })
        }

        return features
      },
      equipment: ({ data }: { data: Exclude<FormDataType, SystemInput | SpellInput> }): FactoryFeature[] => {
        if (data?.__kind !== 'CharacterInput' || !data?.equipment || !data?.equipment?.inventory?.length) return []

        const features: FactoryFeature[] = []

        const existingFeatures: FactoryFeature[] =
          data?.features
            ?.filter((feature) => feature?.equipmentId && sourcePropertyMap(data).equipmentId(feature?.equipmentId))
            .map((eF) => {
              const featureState = featureData.findFeature(eF.id)

              if (featureState) {
                const fullFeature = FeatureInputSchema.omit({ options: true }).parse(featureState)
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
              fullEquipment?.features?.forEach((eF) => {
                const fullFeature = FeatureInputSchema.parse(featureData.findFeature(eF))

                if (
                  !existingFeatures?.some(
                    (existingFeature) =>
                      existingFeature.id === fullFeature.id && existingFeature.equipmentId === fullEquipment.id
                  )
                ) {
                  const featureInput = FeatureInputSchema.omit({ options: true }).parse({
                    ...fullFeature,
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
      feats: ({ data }: { data: Exclude<FormDataType, SystemInput | SpellInput> }): FactoryFeature[] => {
        if (data?.__kind !== 'CharacterInput' || !data?.feats || !data?.feats?.length) return []

        const features: FactoryFeature[] = []

        const existingFeatures: FactoryFeature[] =
          data?.features
            ?.filter((feature) => feature?.featId && sourcePropertyMap(data).featId(feature?.featId))
            .map((eF) => {
              const featureState = featureData.findFeature(eF.id)

              if (featureState) {
                const fullFeature = FeatureInputSchema.omit({ options: true }).parse(featureState)
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
              const featureState = featureData.findFeature(feature)

              if (!featureState) return

              if (
                !existingFeatures?.some(
                  (existingFeature) => existingFeature.id === featureState.id && existingFeature.featId === fullFeat.id
                )
              ) {
                const featureInput = FeatureInputSchema.omit({ options: true }).parse({
                  ...featureState,
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
      background: ({ data }: { data: Exclude<FormDataType, SystemInput | SpellInput> }): FactoryFeature[] => {
        if (data?.__kind !== 'CharacterInput' || !data?.background) return []

        const features: FactoryFeature[] = []

        const existingFeatures: FactoryFeature[] =
          data?.features
            ?.filter((feature) => feature?.backgroundId && sourcePropertyMap(data).backgroundId(feature?.backgroundId))
            .map((eF) => {
              const featureState = featureData.findFeature(eF.id)

              if (featureState) {
                const fullFeature = FeatureInputSchema.omit({ options: true }).parse(featureState)
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
          const featureState = featureData.findFeature(feature)

          if (!featureState) return

          if (
            !existingFeatures?.some(
              (existingFeature) =>
                existingFeature.id === featureState.id && existingFeature.backgroundId === fullBackground?.id
            )
          ) {
            const featureInput = FeatureInputSchema.omit({ options: true }).parse({
              ...featureState,
              backgroundId: fullBackground?.id,
              options: null,
            })
            features.push(featureInput)
          }
        })

        return features
      },
      base: ({ data }: { data: Exclude<FormDataType, SystemInput | SpellInput> }): FactoryFeature[] => {
        if (!data?.features || data?.features?.length === 0 || data?.__kind === 'CharacterInput') return []

        const features: FactoryFeature[] = []

        if (data?.features?.length) {
          if (data?.__kind === 'ClassInput') {
            data?.features?.forEach((feature) => {
              const featureState = FeatureInputSchema.parse(featureData.findFeature(feature))
              const levels = featureState?.levelAvailable?.split(',')
              levels?.forEach((level) => {
                features.push({
                  ...featureState,
                  level: parseInt(level),
                  options: null,
                })
              })
            })
          } else {
            features.push(
              ...data.features.map((feature) => {
                const featureState = FeatureInputSchema.parse(featureData.findFeature(feature))
                const featureObj: FactoryFeature = { ...featureState, options: null }
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
                      const featureState = featureData.findFeature(feature)
                      const featureObj: FactoryFeature = FeatureInputSchema.omit({ options: true }).parse({
                        ...featureState,
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
  }, [backgrounds, classes, feats, equipment, races, ancestryOptions, featureData])

  const createFeatures = useCallback(
    ({ data }: { data: Exclude<FormDataType, SystemInput | SpellInput> }): FactoryFeature[] => {
      let features: FactoryFeature[] = []
      Object.values(featureProcessor).forEach((processor) => {
        features = [...features, ...processor({ data })]
      })

      return features
    },
    [featureProcessor]
  )

  return { createFeatures, getFeatureOptions, sourcePropertyMap }
}
export default useGetFeatures
