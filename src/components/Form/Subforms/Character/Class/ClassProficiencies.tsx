import Collapse from '../../../../Collapse/Collapse'
import Dropdown from '../../../../Dropdown/Dropdown'
import { get, startCase } from 'lodash'
import { feature_card_header, option_dropdown } from '../../../Character.css'
import { numberToWords } from '../../../../../utils/formatting'
import { Character, CharacterProficiency, Class } from '../../../../../../amplify/gql/types'
import { UpdateState } from '../../../../../types/form'
import useGetSections from '../../../../../hooks/useGetSectionState'
import Grid from '../../../../Grid/Grid'
import { Fragment, use } from 'react'
import { FormContext } from '../../../FormContext'
import useGetProficiencies from '../../../../../hooks/useGetProficiencies'

const ClassProficiencies = <T extends Character>({
  fullClass,
  classIndex,
}: {
  fullClass: Class
  classIndex: number
}) => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: T
    updateFormData: (state: UpdateState<T>) => void
  }

  const { getSectionOptions } = useGetSections({ formData })

  // Memoize the proficiency array
  const proficiencies = useGetProficiencies({ fullClass })

  return (
    <Grid.Item>
      <Collapse>
        <Collapse.Header title='Proficiencies' className={feature_card_header} />
        <Collapse.Body>
          <Grid>
            {proficiencies &&
              Object.entries(proficiencies).map(([key, value], pIndex) => {
                const typeArray = value?.type
                const selectionCount = value?.selectionCount
                const propertyArray = value?.property ?? []

                const fullProficiency = fullClass?.proficiencies?.find(
                  (proficiency) => proficiency.id === value.proficiencyId
                )

                const dropdowns = () =>
                  Array.from({ length: selectionCount ?? 0 }, (_, index) => {
                    const optionIndex = `${index}${pIndex}${classIndex}`

                    const { options, path } = getSectionOptions({
                      section: fullProficiency,
                      sectionStep: 'proficiencies',
                      optionIndex,
                    })

                    // Render the Dropdown component inside the loop
                    return (
                      <Grid.Item key={index} justify='center'>
                        <Dropdown
                          name={path}
                          className={option_dropdown}
                          label={`${startCase(key)} Option`}
                          options={options}
                          onChange={(e) => {
                            if (e.type === 'update') {
                              updateFormData({
                                type: 'update',
                                path,
                                value: {
                                  proficiencyId: e.value,
                                  classId: fullClass.id,
                                  optionIndex,
                                  __typename: 'CharacterProficiency',
                                },
                              })
                            } else {
                              updateFormData({
                                type: 'remove',
                                path,
                              })
                            }
                          }}
                          value={(get(formData, path) as CharacterProficiency)?.proficiencyId}
                        />
                      </Grid.Item>
                    )
                  })

                let typeText: string = ''

                if (propertyArray.length > 0) {
                  if (selectionCount > 0) {
                    typeText = `Choose ${numberToWords(selectionCount)} from `
                  }
                  propertyArray.forEach((iProperty, pIndex) => {
                    if (selectionCount > 0) {
                      typeText += `${iProperty.label}s`
                    }

                    if (propertyArray.length > 1 && propertyArray.length < 3) {
                      if (pIndex !== propertyArray.length - 1) {
                        if (selectionCount > 0) {
                          typeText += ' or '
                        } else {
                          typeText += ', '
                        }
                      }
                    }
                    if (propertyArray.length > 2) {
                      if (pIndex !== propertyArray?.length - 2) {
                        typeText += ', '
                      } else {
                        if (selectionCount > 0) {
                          typeText += ' or '
                        } else {
                          typeText += ' and '
                        }
                      }
                    }
                  })
                } else {
                  if (typeArray?.some((type) => type.id === 'all')) {
                    if (selectionCount > 0) {
                      typeText = `Choose any ${numberToWords(selectionCount)}`
                    }
                  } else {
                    if (selectionCount > 0) {
                      typeText = `Choose ${numberToWords(selectionCount)} from `
                    }
                    typeArray?.map((type, tIndex) => {
                      typeText += `${type.label}`

                      if (typeArray.length > 1 && typeArray.length < 3) {
                        if (tIndex !== typeArray.length - 1) {
                          if (selectionCount > 0) {
                            typeText += ' or '
                          } else {
                            typeText += ', '
                          }
                        }
                      }
                      if (typeArray.length > 2) {
                        if (tIndex !== typeArray?.length - 1) {
                          typeText += ', '
                        }
                        if (tIndex == typeArray?.length - 2) {
                          if (selectionCount > 0) {
                            typeText += ' or '
                          } else {
                            typeText += ' and '
                          }
                        }
                      }
                    })
                  }
                }

                return (
                  <Fragment key={key}>
                    <Grid.Item key={key}>
                      <strong>{`${startCase(key)}: `}</strong>
                      {typeText}
                    </Grid.Item>
                    {selectionCount > 0 && dropdowns()}
                  </Fragment>
                )
              })}
          </Grid>
        </Collapse.Body>
      </Collapse>
    </Grid.Item>
  )
}

export default ClassProficiencies
