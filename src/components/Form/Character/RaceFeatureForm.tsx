import parse from 'html-react-parser'
import { Fragment, useEffect, useState } from 'react'
import { getSectionNames } from '../../../utils/formUtils'
import { ReducerActionType, SectionName } from '../../../utils/types'
import Dropdown from '../../Dropdown/Dropdown'
import { get, isEqual } from 'lodash'
import { sprinkles } from '../../../css/sprinkles.css'
import { feature_card, feature_card_body, feature_card_header } from './Character.css'
import { option_dropdown } from './Character.css'
import ScrollArea from '../../ScrollArea/ScrollArea'
import { form_content } from '../Form.css'

interface RaceFeatureFormProps {
  selectedRace: any
  setFormState: (arg: ReducerActionType) => void
  formState: any
  races: any
}

const RaceFeatureForm = ({ formState, selectedRace, setFormState, races }: RaceFeatureFormProps) => {
  const [initialRace, setInitialRace] = useState<any>(null)
  const [formFeatures, setFormFeatures] = useState<any[]>([])

  const sectionNames = getSectionNames()

  // Set initial Race for comparison later
  useEffect(() => {
    if (selectedRace && initialRace === null) {
      setInitialRace(selectedRace)
    }
  }, [selectedRace, initialRace])

  // Set initial Race
  useEffect(() => {
    if (!formState.race && selectedRace) {
      setFormState({
        target: {
          name: 'race',
          value: { name: selectedRace?.name, value: selectedRace?.value, _id: selectedRace?._id },
        },
      })
    }
  }, [formState.race, selectedRace, setFormState])

  // Set/Remove Race Features
  useEffect(() => {
    let formClone = JSON.parse(JSON.stringify(formState))
    if (formClone.race) {
      const cloneFeatures: any[] = []
      const formFeatureClone: any[] = []
      if (selectedRace.lineage?.length > 0) {
        selectedRace.lineage?.forEach((lineage: any) => {
          const lineageRace = races.find((race: any) => race._id === lineage._id)
          if (lineageRace.feature?.length > 0) {
            lineageRace.feature?.map((feature: any) => {
              if (!feature.attribute?.some((attribute: any) => attribute.name === 'hideOnSheet')) {
                cloneFeatures.push({
                  name: feature.name,
                  value: feature.value,
                  _id: feature._id,
                  raceId: lineageRace._id,
                })
              }
              formFeatureClone.push({ ...feature, raceId: lineageRace._id })
            })
          }
        })
      }
      if (selectedRace.feature?.length > 0) {
        selectedRace.feature?.map((feature: any) => {
          if (!feature.attribute?.some((attribute: any) => attribute.name === 'hideOnSheet')) {
            cloneFeatures.push({
              name: feature.name,
              value: feature.value,
              _id: feature._id,
              raceId: selectedRace._id,
            })
          }
          formFeatureClone.push({ ...feature, raceId: selectedRace._id })
        })
      }
      if (formClone.feature?.length > 0) {
        formClone.feature?.forEach((feature: any) => {
          if (feature.raceId == null) {
            cloneFeatures.push(feature)
            formFeatureClone.push(feature)
          }
        })
      }
      if (!(cloneFeatures?.length > 0) && formClone.feature?.length > 0) {
        setFormState({
          type: 'removed',
          target: { name: 'feature' },
        })

        setFormFeatures([])
      } else if (!isEqual(cloneFeatures, formClone.feature) && cloneFeatures?.length > 0) {
        formClone = { ...formClone, feature: cloneFeatures }

        setFormState({
          target: {
            name: 'feature',
            value: get(formClone, 'feature'),
          },
        })
      }
      setFormFeatures(formFeatureClone)
    } else {
      const cloneFeatures = formClone.feature?.filter((feature: any) => feature.raceId == null)
      setFormState({ target: { name: 'feature', value: cloneFeatures } })
    }
    if (formClone?.ancestry) {
      let ancestryFound = false
      const formFeatureClone: any[] = []
      const ancestryFeatures: any[] = []
      if (selectedRace.ancestry?.option?.length > 0) {
        const selectedAncestry = selectedRace.ancestry?.option?.find(
          (option: any) => option._id === formClone.ancestry._id
        )
        if (selectedAncestry) {
          ancestryFound = true
          selectedAncestry?.feature.forEach((feature: any) => {
            if (!feature.attribute?.some((attribute: any) => attribute.name === 'hideOnSheet')) {
              ancestryFeatures.push({
                name: feature.name,
                value: feature.value,
                _id: feature._id,
                ancestryId: selectedAncestry._id,
                featureId: feature._id,
              })
            }
            formFeatureClone.push({ ...feature, ancestryId: feature._id })
          })

          if (ancestryFeatures?.length > 0) {
            if (formClone.feature?.length > 0) {
              const cloneFeatures = formClone.feature?.filter((feature: any) => feature.ancestryId == null)
              ancestryFeatures.map((feature: any) => {
                cloneFeatures.push(feature)
                formFeatureClone.push(feature)
              })

              if (!isEqual(formClone.feature, cloneFeatures)) {
                formClone = { ...formClone, feature: [...cloneFeatures] }

                setFormState({
                  target: { name: 'feature', value: get(formClone, 'feature') },
                })
              }
            } else {
              setFormState({
                target: { name: 'feature', value: ancestryFeatures },
              })

              setFormFeatures(ancestryFeatures)
            }
          }
        }
      } else if (selectedRace.lineage?.length > 0) {
        selectedRace.lineage?.forEach((lineage: any) => {
          const selectedAncestry = lineage.ancestry?.option?.find(
            (option: any) => option._id === formClone.ancestry._id
          )
          if (selectedAncestry) {
            ancestryFound = true
            selectedAncestry?.feature.forEach((feature: any) => {
              if (!feature.attribute?.some((attribute: any) => attribute.name === 'hideOnSheet')) {
                ancestryFeatures.push({
                  name: feature.name,
                  value: feature.value,
                  _id: feature._id,
                  ancestryId: selectedAncestry._id,
                  featureId: feature._id,
                })
              }
              formFeatureClone.push({ ...feature, ancestryId: feature._id })
            })

            if (ancestryFeatures?.length > 0) {
              if (formClone.feature?.length > 0) {
                const cloneFeatures = formClone.feature?.filter((feature: any) => feature.ancestryId == null)
                ancestryFeatures.map((feature: any) => {
                  cloneFeatures.push(feature)
                  formFeatureClone.push(feature)
                })

                if (!isEqual(formClone.feature, cloneFeatures)) {
                  formClone = { ...formClone, feature: [...cloneFeatures] }

                  setFormState({
                    target: { name: 'feature', value: get(formClone, 'feature') },
                  })
                }
              } else {
                console.log({ ancestryFeatures })
                setFormState({
                  target: { name: 'feature', value: ancestryFeatures },
                })
              }

              setFormFeatures(ancestryFeatures)
            }
          }
        })
      }
      if (!ancestryFound) {
        if (formClone?.feature?.length > 0) {
          const featureClone = formClone?.feature?.filter((feature: any) => feature.ancestryId == null)
          setFormState({
            target: { name: 'feature', value: featureClone },
          })

          setFormFeatures(formFeatureClone)
        }

        setFormState({
          type: 'removed',
          target: { name: 'ancestry' },
        })
      }
    } else if (!formClone.feature?.every((feature: any) => feature.ancestryId == null)) {
      const cloneFeatures = formClone.feature?.filter((feature: any) => feature.ancestryId == null)
      setFormState({ target: { name: 'feature', value: cloneFeatures } })
    }
  }, [selectedRace, races, formState, setFormState])

  // Update sections from Race features
  // useEffect(() => {
  //   const formClone = JSON.parse(JSON.stringify(formState))
  //   sectionNames.forEach((sectionName: any) => {
  //     if (sectionName !== 'feature' && sectionName !== 'option') {
  //       let sectionObject: any = {}
  //       const cloneSectionObject: any = get(formClone, `${sectionName}`)
  //       if (formClone.race) {
  //         if (selectedRace.lineage?.length > 0) {
  //           selectedRace.lineage?.forEach((lineage: any) => {
  //             const lineageRace = races.find((race: any) => race._id === lineage._id)
  //             if (lineageRace.feature?.length > 0) {
  //               lineageRace.feature?.forEach((feature: any) => {
  //                 if (feature[sectionName]?.length > 0) {
  //                   feature[sectionName].forEach((section: any) => {
  //                     const sectionArray: any[] = []
  //                     let pathName = ''

  //                     if (section.category?.name) {
  //                       pathName += `${sectionName}.${section.category.name}`
  //                     } else {
  //                       pathName += `${sectionName}`
  //                     }

  //                     const cloneArray = get(formClone, pathName)

  //                     if (cloneArray?.length > 0) {
  //                       cloneArray?.forEach((section: any) => {
  //                         if (section.raceId == null) {
  //                           sectionArray.push(section)
  //                         }
  //                       })
  //                     }

  //                     if (section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
  //                       const optionClone = get(formClone, pathName)?.find((sectionClone: any) => {
  //                         if (section.category?.name) {
  //                           return section[section.category?.name]?.type?.some(
  //                             (section: any) => section._id === sectionClone._id
  //                           )
  //                         } else {
  //                           return section?.type?.some((section: any) => section._id === sectionClone._id)
  //                         }
  //                       })

  //                       if (optionClone) {
  //                         if (section.category?.name) {
  //                           sectionObject = {
  //                             ...sectionObject,
  //                             [section.category?.name]: [...sectionObject[section.category?.name], { ...optionClone }],
  //                           }
  //                         } else {
  //                           sectionObject = [...sectionObject, { ...optionClone }]
  //                         }
  //                       }
  //                     }

  //                     if (!section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
  //                       if (section.category?.name) {
  //                         const categoryName = section.category?.name

  //                         if (section[categoryName]?.type?.length > 0) {
  //                           if (sectionObject[categoryName]?.type?.length > 0) {
  //                             const existArray = sectionObject[categoryName]?.type
  //                             sectionArray.push(...existArray)
  //                           }
  //                           section[categoryName]?.type?.map((type: any) => {
  //                             let typeObject: any = { ...type, raceId: lineageRace._id, featureId: feature._id }

  //                             if (section[categoryName]?.method) {
  //                               typeObject = { ...typeObject, method: section[categoryName]?.method }
  //                             }
  //                             if (section[categoryName]?.mode) {
  //                               typeObject = { ...typeObject, mode: section[categoryName]?.mode }
  //                             }
  //                             if (section[categoryName]?.level) {
  //                               typeObject = { ...typeObject, level: section[categoryName]?.level }
  //                             }
  //                             if (section[categoryName]?.multiplier) {
  //                               typeObject = { ...typeObject, multiplier: section[categoryName]?.multiplier }
  //                             }
  //                             if (section[categoryName]?.maxValue) {
  //                               typeObject = { ...typeObject, maxValue: section[categoryName]?.maxValue }
  //                             }
  //                             if (section[categoryName]?.minLevel) {
  //                               typeObject = { ...typeObject, minLevel: section[categoryName]?.minLevel }
  //                             }
  //                             if (section[categoryName]?.setValue) {
  //                               typeObject = { ...typeObject, setValue: section[categoryName]?.setValue }
  //                             }
  //                             if (section[categoryName]?.dieCount) {
  //                               typeObject = { ...typeObject, dieCount: section[categoryName]?.dieCount }
  //                             }
  //                             if (section[categoryName]?.dieValue) {
  //                               typeObject = { ...typeObject, dieValue: section[categoryName]?.dieValue }
  //                             }
  //                             if (section[categoryName]?.modAbility) {
  //                               typeObject = { ...typeObject, modAbility: section[categoryName]?.modAbility }
  //                             }
  //                             if (section[categoryName]?.modSkill) {
  //                               typeObject = { ...typeObject, modSkill: section[categoryName]?.modSkill }
  //                             }

  //                             sectionArray.push(typeObject)
  //                           })

  //                           if (sectionArray?.length > 0) {
  //                             sectionObject = {
  //                               ...sectionObject,
  //                               [categoryName]: [...sectionArray],
  //                             }
  //                           }
  //                         }
  //                       }
  //                       if (section.type?.length > 0) {
  //                         if (sectionObject?.type?.length > 0) {
  //                           const existArray = sectionObject?.type
  //                           sectionArray.push(...existArray)
  //                         }
  //                         section?.type?.map((type: any) => {
  //                           const typeObject: any = { ...type, raceId: selectedRace._id, featureId: feature._id }

  //                           sectionArray.push(typeObject)
  //                         })

  //                         if (sectionArray?.length > 0) {
  //                           sectionObject = [...sectionArray]
  //                         }
  //                       }
  //                     }
  //                   })
  //                 }
  //               })
  //             }
  //           })
  //         }
  //         if (selectedRace.feature?.length > 0) {
  //           selectedRace.feature?.forEach((feature: any) => {
  //             if (feature[sectionName]?.length > 0) {
  //               feature[sectionName].forEach((section: any) => {
  //                 const sectionArray: any[] = []
  //                 let pathName = ''

  //                 if (section.category?.name) {
  //                   pathName += `${sectionName}.${section.category.name}`
  //                 } else {
  //                   pathName += `${sectionName}`
  //                 }

  //                 const cloneArray = get(formClone, pathName)

  //                 if (cloneArray?.length > 0) {
  //                   cloneArray?.forEach((section: any) => {
  //                     if (section.raceId == null) {
  //                       sectionArray.push(section)
  //                     }
  //                   })
  //                 }

  //                 if (section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
  //                   const optionClone = get(formClone, pathName)?.find((sectionClone: any) => {
  //                     if (section.category?.name) {
  //                       return section[section.category?.name]?.type?.some(
  //                         (section: any) => section._id === sectionClone._id
  //                       )
  //                     } else {
  //                       return section?.type?.some((section: any) => section._id === sectionClone._id)
  //                     }
  //                   })

  //                   if (optionClone) {
  //                     if (section.category?.name) {
  //                       sectionObject = {
  //                         ...sectionObject,
  //                         [section.category?.name]: [...sectionObject[section.category?.name], { ...optionClone }],
  //                       }
  //                     } else {
  //                       sectionObject = [...sectionObject, { ...optionClone }]
  //                     }
  //                   }
  //                 }

  //                 if (!section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
  //                   if (section.category?.name) {
  //                     const categoryName = section.category?.name

  //                     if (section[categoryName]?.type?.length > 0) {
  //                       if (sectionObject[categoryName]?.length > 0) {
  //                         const existArray = sectionObject[categoryName]
  //                         sectionArray.push(...existArray)
  //                       }
  //                       section[categoryName]?.type?.forEach((type: any) => {
  //                         console.log({ type })
  //                         let typeObject: any = { ...type, raceId: selectedRace._id, featureId: feature._id }

  //                         if (section[categoryName]?.method) {
  //                           typeObject = { ...typeObject, method: section[categoryName]?.method }
  //                         }
  //                         if (section[categoryName]?.mode) {
  //                           typeObject = { ...typeObject, mode: section[categoryName]?.mode }
  //                         }
  //                         if (section[categoryName]?.level) {
  //                           typeObject = { ...typeObject, level: section[categoryName]?.level }
  //                         }
  //                         if (section[categoryName]?.multiplier) {
  //                           typeObject = { ...typeObject, multiplier: section[categoryName]?.multiplier }
  //                         }
  //                         if (section[categoryName]?.maxValue) {
  //                           typeObject = { ...typeObject, maxValue: section[categoryName]?.maxValue }
  //                         }
  //                         if (section[categoryName]?.minLevel) {
  //                           typeObject = { ...typeObject, minLevel: section[categoryName]?.minLevel }
  //                         }
  //                         if (section[categoryName]?.setValue) {
  //                           typeObject = { ...typeObject, setValue: section[categoryName]?.setValue }
  //                         }
  //                         if (section[categoryName]?.dieCount) {
  //                           typeObject = { ...typeObject, dieCount: section[categoryName]?.dieCount }
  //                         }
  //                         if (section[categoryName]?.dieValue) {
  //                           typeObject = { ...typeObject, dieValue: section[categoryName]?.dieValue }
  //                         }
  //                         if (section[categoryName]?.modAbility) {
  //                           typeObject = { ...typeObject, modAbility: section[categoryName]?.modAbility }
  //                         }
  //                         if (section[categoryName]?.modSkill) {
  //                           typeObject = { ...typeObject, modSkill: section[categoryName]?.modSkill }
  //                         }

  //                         sectionArray.push(typeObject)
  //                       })

  //                       if (sectionArray?.length > 0) {
  //                         sectionObject = { ...sectionObject, [categoryName]: [...sectionArray] }
  //                       }
  //                     }
  //                   }
  //                   if (section.type?.length > 0) {
  //                     if (sectionObject?.length > 0) {
  //                       const existArray = sectionObject
  //                       sectionArray.push(...existArray)
  //                     }
  //                     section?.type?.map((type: any) => {
  //                       const typeObject: any = { ...type, raceId: selectedRace._id, featureId: feature._id }

  //                       sectionArray.push(typeObject)
  //                     })

  //                     if (sectionArray?.length > 0) {
  //                       sectionObject = [...sectionArray]
  //                     }
  //                   }
  //                 }
  //               })
  //             }
  //           })
  //         }
  //       }
  //       if (formClone.ancestry) {
  //         if (selectedRace.lineage?.length > 0) {
  //           selectedRace.lineage?.forEach((lineage: any) => {
  //             const lineageRace = races.find((race: any) => race._id === lineage._id)
  //             if (lineageRace.ancestry?.option?.length > 0) {
  //               const selectedAncestry = lineage.ancestry?.option?.find(
  //                 (option: any) => option._id === formClone?.ancestry?._id
  //               )
  //               if (selectedAncestry?.[sectionName]?.length > 0) {
  //                 selectedAncestry[sectionName].forEach((section: any) => {
  //                   const sectionArray: any[] = []
  //                   let pathName = ''

  //                   if (section.category?.name) {
  //                     pathName += `${sectionName}.${section.category.name}`
  //                   } else {
  //                     pathName += `${sectionName}`
  //                   }

  //                   const cloneArray = get(formClone, pathName)

  //                   if (cloneArray?.length > 0) {
  //                     cloneArray?.forEach((section: any) => {
  //                       if (section.ancestryId == null) {
  //                         sectionArray.push(section)
  //                       }
  //                     })
  //                   }

  //                   if (section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
  //                     const optionClone = get(formClone, pathName)?.find((sectionClone: any) => {
  //                       if (section.category?.name) {
  //                         return section[section.category?.name]?.type?.some(
  //                           (section: any) => section._id === sectionClone._id
  //                         )
  //                       } else {
  //                         return section?.type?.some((section: any) => section._id === sectionClone._id)
  //                       }
  //                     })

  //                     if (optionClone) {
  //                       if (section.category?.name) {
  //                         sectionObject = {
  //                           ...sectionObject,
  //                           [section.category?.name]: [...sectionObject[section.category?.name], { ...optionClone }],
  //                         }
  //                       } else {
  //                         sectionObject = [...sectionObject, { ...optionClone }]
  //                       }
  //                     }
  //                   }

  //                   if (!section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
  //                     if (section.category?.name) {
  //                       const categoryName = section.category?.name

  //                       if (section[categoryName]?.type?.length > 0) {
  //                         if (sectionObject[categoryName]?.length > 0) {
  //                           const existArray = sectionObject[categoryName]
  //                           sectionArray.push(...existArray)
  //                         }
  //                         section[categoryName]?.type?.map((type: any) => {
  //                           let typeObject: any = { ...type, ancestryId: selectedAncestry._id }

  //                           if (section[categoryName]?.method) {
  //                             typeObject = { ...typeObject, method: section[categoryName]?.method }
  //                           }
  //                           if (section[categoryName]?.mode) {
  //                             typeObject = { ...typeObject, mode: section[categoryName]?.mode }
  //                           }
  //                           if (section[categoryName]?.level) {
  //                             typeObject = { ...typeObject, level: section[categoryName]?.level }
  //                           }
  //                           if (section[categoryName]?.multiplier) {
  //                             typeObject = { ...typeObject, multiplier: section[categoryName]?.multiplier }
  //                           }
  //                           if (section[categoryName]?.maxValue) {
  //                             typeObject = { ...typeObject, maxValue: section[categoryName]?.maxValue }
  //                           }
  //                           if (section[categoryName]?.minLevel) {
  //                             typeObject = { ...typeObject, minLevel: section[categoryName]?.minLevel }
  //                           }
  //                           if (section[categoryName]?.setValue) {
  //                             typeObject = { ...typeObject, setValue: section[categoryName]?.setValue }
  //                           }
  //                           if (section[categoryName]?.dieCount) {
  //                             typeObject = { ...typeObject, dieCount: section[categoryName]?.dieCount }
  //                           }
  //                           if (section[categoryName]?.dieValue) {
  //                             typeObject = { ...typeObject, dieValue: section[categoryName]?.dieValue }
  //                           }
  //                           if (section[categoryName]?.modAbility) {
  //                             typeObject = { ...typeObject, modAbility: section[categoryName]?.modAbility }
  //                           }
  //                           if (section[categoryName]?.modSkill) {
  //                             typeObject = { ...typeObject, modSkill: section[categoryName]?.modSkill }
  //                           }

  //                           sectionArray.push(typeObject)
  //                         })

  //                         if (sectionArray?.length > 0) {
  //                           sectionObject = { ...sectionObject, [categoryName]: [...sectionArray] }
  //                         }
  //                       }
  //                     }
  //                     if (section.type?.length > 0) {
  //                       if (sectionObject?.length > 0) {
  //                         const existArray = sectionObject
  //                         sectionArray.push(...existArray)
  //                       }
  //                       section?.type?.map((type: any) => {
  //                         const typeObject: any = { ...type, ancestryId: selectedAncestry._id }

  //                         sectionArray.push(typeObject)
  //                       })

  //                       if (sectionArray?.length > 0) {
  //                         sectionObject = [...sectionArray]
  //                       }
  //                     }
  //                   }
  //                 })
  //               }
  //             }
  //           })
  //         }
  //         if (selectedRace.ancestry?.option?.length > 0) {
  //           const selectedAncestry = selectedRace.ancestry?.option?.find(
  //             (option: any) => option._id === formClone?.ancestry?._id
  //           )
  //           if (selectedAncestry?.[sectionName]?.length > 0) {
  //             selectedAncestry[sectionName].forEach((section: any) => {
  //               const sectionArray: any[] = []
  //               let pathName = ''

  //               if (section.category?.name) {
  //                 pathName += `${sectionName}.${section.category.name}`
  //               } else {
  //                 pathName += `${sectionName}`
  //               }

  //               const cloneArray = get(formClone, pathName)

  //               if (cloneArray?.length > 0) {
  //                 cloneArray?.forEach((section: any) => {
  //                   if (section.ancestryId == null) {
  //                     sectionArray.push(section)
  //                   }
  //                 })
  //               }

  //               if (section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
  //                 const optionClone = get(formClone, pathName)?.find((sectionClone: any) => {
  //                   if (section.category?.name) {
  //                     return section[section.category?.name]?.type?.some(
  //                       (section: any) => section._id === sectionClone._id
  //                     )
  //                   } else {
  //                     return section?.type?.some((section: any) => section._id === sectionClone._id)
  //                   }
  //                 })

  //                 if (optionClone) {
  //                   if (section.category?.name) {
  //                     sectionObject = {
  //                       ...sectionObject,
  //                       [section.category?.name]: [...sectionObject[section.category?.name], { ...optionClone }],
  //                     }
  //                   } else {
  //                     sectionObject = [...sectionObject, { ...optionClone }]
  //                   }
  //                 }
  //               }

  //               if (!section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
  //                 if (section.category?.name) {
  //                   const categoryName = section.category?.name

  //                   if (section[categoryName]?.type?.length > 0) {
  //                     if (sectionObject[categoryName]?.length > 0) {
  //                       const existArray = sectionObject[categoryName]
  //                       sectionArray.push(...existArray)
  //                     }
  //                     section[categoryName]?.type?.map((type: any) => {
  //                       let typeObject: any = { ...type, ancestryId: selectedAncestry._id }

  //                       if (section[categoryName]?.method) {
  //                         typeObject = { ...typeObject, method: section[categoryName]?.method }
  //                       }
  //                       if (section[categoryName]?.mode) {
  //                         typeObject = { ...typeObject, mode: section[categoryName]?.mode }
  //                       }
  //                       if (section[categoryName]?.level) {
  //                         typeObject = { ...typeObject, level: section[categoryName]?.level }
  //                       }
  //                       if (section[categoryName]?.multiplier) {
  //                         typeObject = { ...typeObject, multiplier: section[categoryName]?.multiplier }
  //                       }
  //                       if (section[categoryName]?.maxValue) {
  //                         typeObject = { ...typeObject, maxValue: section[categoryName]?.maxValue }
  //                       }
  //                       if (section[categoryName]?.minLevel) {
  //                         typeObject = { ...typeObject, minLevel: section[categoryName]?.minLevel }
  //                       }
  //                       if (section[categoryName]?.setValue) {
  //                         typeObject = { ...typeObject, setValue: section[categoryName]?.setValue }
  //                       }
  //                       if (section[categoryName]?.dieCount) {
  //                         typeObject = { ...typeObject, dieCount: section[categoryName]?.dieCount }
  //                       }
  //                       if (section[categoryName]?.dieValue) {
  //                         typeObject = { ...typeObject, dieValue: section[categoryName]?.dieValue }
  //                       }
  //                       if (section[categoryName]?.modAbility) {
  //                         typeObject = { ...typeObject, modAbility: section[categoryName]?.modAbility }
  //                       }
  //                       if (section[categoryName]?.modSkill) {
  //                         typeObject = { ...typeObject, modSkill: section[categoryName]?.modSkill }
  //                       }

  //                       sectionArray.push(typeObject)
  //                     })

  //                     if (sectionArray?.length > 0) {
  //                       sectionObject = { ...sectionObject, [categoryName]: [...sectionArray] }
  //                     }
  //                   }
  //                 }
  //                 if (section.type?.length > 0) {
  //                   if (sectionObject?.length > 0) {
  //                     const existArray = sectionObject
  //                     sectionArray.push(...existArray)
  //                   }
  //                   section?.type?.map((type: any) => {
  //                     const typeObject: any = { ...type, ancestryId: selectedAncestry._id }

  //                     sectionArray.push(typeObject)
  //                   })

  //                   if (sectionArray?.length > 0) {
  //                     sectionObject = [...sectionArray]
  //                   }
  //                 }
  //               }
  //             })
  //           }
  //         }
  //       } else {
  //         if (sectionObject != null) {
  //           Object?.entries(sectionObject)?.forEach(([key]) => {
  //             if (sectionObject[key]?.length > 0) {
  //               const updatedArray = sectionObject[key].filter((entry: any) => entry.ancestryId == null)

  //               if (updatedArray.length > 0 && !isEqual(updatedArray, sectionObject[key])) {
  //                 sectionObject[key] = updatedArray
  //               }
  //             }
  //           })
  //         }
  //       }

  //       if (Object.keys(sectionObject).length > 0) {
  //         if (!isEqual(sectionObject, cloneSectionObject)) {
  //           setFormState({
  //             target: { name: `${sectionName}`, value: sectionObject },
  //           })
  //         }
  //       }
  //     }
  //   })
  // }, [formFeatures, sectionNames, setFormState, formState, races, selectedRace])

  return (
    <ScrollArea scrollDirection='vertical' className={form_content}>
      {selectedRace.lineage?.length > 0 &&
        selectedRace.lineage?.forEach(
          (lineage: any, index: number) =>
            lineage?.ancestry?.option?.length > 0 && (
              <div className={feature_card} key={index}>
                <div className={feature_card_header}>
                  <h2>{lineage?.ancestry.value}</h2>
                </div>
                <div className={feature_card_body}>
                  {lineage?.ancestry.desc && parse(lineage?.ancestry.desc)}
                  <Dropdown
                    name={`lineage.${index}.ancestry`}
                    className={option_dropdown}
                    label='Ancestry Option'
                    options={lineage?.ancestry.option.map((option: any) => ({
                      name: option.name,
                      value: option.value,
                      desc: option.desc,
                      _id: option._id,
                      raceId: lineage._id,
                    }))}
                    optionalKey={['desc', 'raceId']}
                    onChange={setFormState}
                    value={formState.ancestry}
                  />
                  {formState?.ancestry && (
                    <div
                      className={sprinkles({
                        mt: 'size-3',
                        mx: 'size-15',
                        width: 'auto',
                      })}
                    >
                      <strong>{formState.ancestry.desc && parse(formState.ancestry.desc)}</strong>
                    </div>
                  )}
                </div>
              </div>
            )
        )}
      {selectedRace?.ancestry?.option?.length > 0 && (
        <div className={feature_card}>
          <div className={feature_card_header}>
            <h2>{selectedRace?.ancestry.value}</h2>
          </div>
          <ScrollArea scrollDirection='horizontal' className={feature_card_body}>
            {selectedRace?.ancestry.desc && parse(selectedRace?.ancestry.desc)}
            <Dropdown
              name='ancestry'
              className={option_dropdown}
              label='Ancestry Option'
              options={selectedRace?.ancestry.option.map((option: any) => ({
                name: option.name,
                value: option.value,
                desc: option.desc,
                _id: option._id,
                raceId: selectedRace._id,
              }))}
              optionalKey={['desc', 'raceId']}
              onChange={setFormState}
              value={formState.ancestry}
            />
            {formState?.ancestry && (
              <div
                className={sprinkles({
                  mt: 'size-3',
                  mx: 'size-15',
                  width: 'auto',
                })}
              >
                <strong>{formState.ancestry.desc && parse(formState.ancestry.desc)}</strong>
              </div>
            )}
          </ScrollArea>
        </div>
      )}
      {formFeatures?.length > 0 &&
        formFeatures
          ?.sort((a: any, b: any) => a.value.localeCompare(b.value))
          .map((feature: any, featureIndex: number) => {
            if (!feature.attribute?.some((attribute: any) => attribute.name === 'hideInBuilder')) {
              return (
                <div key={featureIndex} className={feature_card}>
                  <div className={feature_card_header}>
                    <h3>{feature.value}</h3>
                  </div>
                  <ScrollArea scrollDirection='horizontal' className={feature_card_body}>
                    {feature.desc && parse(feature.desc)}
                    {sectionNames.map((sectionName: SectionName, nameIndex: number) => (
                      <Fragment key={nameIndex}>
                        {feature[sectionName]?.length > 0 &&
                          feature[sectionName].map((section: any, sectionIndex: number) => {
                            if (
                              section.attribute?.some((attributeItem: any) => attributeItem.name === 'providesOptions')
                            ) {
                              let sectionArray: any[] = []
                              let optionIndex
                              let pathName = ''

                              if (section.category?.name) {
                                const categoryName = section?.category?.name
                                sectionArray = section[categoryName]?.type

                                pathName += `${sectionName}.${categoryName}`

                                optionIndex =
                                  formState[sectionName]?.[categoryName]?.length > 0
                                    ? formState[sectionName]?.[categoryName]?.length
                                    : 0
                              } else {
                                sectionArray = section?.type

                                optionIndex = formState[sectionName]?.length > 0 ? formState[sectionName]?.length : 0

                                pathName += `${sectionName}`
                              }

                              let label = ''
                              if (section.category?.length === 1) {
                                label = section?.category[0]?.value
                              } else {
                                label = section?.category?.value
                              }

                              return (
                                <Fragment key={sectionIndex}>
                                  <Dropdown
                                    name={`${pathName}.${optionIndex}`}
                                    className={sprinkles({
                                      mx: 'size-15',
                                      width: 'auto',
                                    })}
                                    label={`${label} Option`}
                                    options={sectionArray.map((section: any) => ({
                                      ...section,
                                      raceId: feature.raceId,
                                      featureId: feature._id,
                                    }))}
                                    optionalKey={['raceId', 'featureId', 'ancestryId']}
                                    onChange={setFormState}
                                    value={get(formState, `${pathName}`)?.find((option: any) =>
                                      sectionArray?.some((section: any) => option?._id === section._id)
                                    )}
                                  />
                                </Fragment>
                              )
                            }
                          })}
                      </Fragment>
                    ))}
                  </ScrollArea>
                </div>
              )
            }
          })}
    </ScrollArea>
  )
}

export default RaceFeatureForm
