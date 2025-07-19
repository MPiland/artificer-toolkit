import Collapsible from '@/components/Collapse'
import { startCase } from 'lodash'
import { card_header, option_dropdown } from '@/components/Form'
import { numberToWords } from '@/utils'
import type { CharacterClassInput, CharacterInput, CharacterProficiencyInput } from '@/types'
import { useGetSections, useGetProficiencies, useClassData, useFieldUpdates } from '@/hooks'
import { Grid } from '@mantine/core'
import { Fragment, useMemo, type ReactElement } from 'react'
import { withFieldGroup } from '@/components/Form'
import { CharacterProficiencyInputSchema, FeatureProficiencyInputSchema } from '@/schemas'
import { useStore, type DeepKeys } from '@tanstack/react-form'
import { useFormStore } from '@/store'

const ClassProficiencies = withFieldGroup({
  defaultValues: {
    proficiencies: [] as CharacterProficiencyInput[] | null | undefined,
    classInput: {} as CharacterClassInput | null | undefined,
  },
  props: {
    classIndex: 0,
  },
  render: function Render({ group, classIndex }) {
    const { getSectionOptions } = useGetSections()
    const {
      classes: { findClass },
    } = useClassData()
    const { AppField } = group

    const formStore = useFormStore()

    const { fieldListeners } = useFieldUpdates({ data: 'form' })

    const { classInput, formProficiencies } = useStore(group.store, (state) => ({
      classInput: state.values.classInput,
      formProficiencies: state.values.proficiencies,
    }))

    const fullClass = findClass(classInput?.id)!

    // Memoize the proficiency array
    const proficiencies = useGetProficiencies({ fullClass })

    const dropdowns = useMemo(() => {
      let element: ReactElement = <></>
      const dropdowns: ReactElement[] = []
      if (proficiencies) {
        Object.entries(proficiencies).map(([key, value], pIndex) => {
          const typeArray = value?.type
          const selectionCount = value?.selectionCount || 1
          const propertyArray = value?.property ?? []

          const fullProficiency = fullClass?.proficiencies?.find((proficiency) => proficiency.id === value.id)

          if (fullProficiency) {
            for (let index = 0; index < selectionCount; index++) {
              const optionIndex = `${index}${pIndex}${classIndex}`

              const { options, label, path, exist } = getSectionOptions({
                data: {
                  proficiencies: formProficiencies,
                },
                section: FeatureProficiencyInputSchema.parse(fullProficiency),
                sectionStep: 'proficiencies',
                optionIndex,
              }) as {
                options: { id: string; label: string }[]
                label: string
                path: DeepKeys<Pick<CharacterInput, 'proficiencies'>>
                exist: string | undefined
              }

              dropdowns.push(
                <Grid.Col key={`${path + optionIndex}-proficiencies`}>
                  <AppField
                    name={path}
                    listeners={{
                      ...fieldListeners,
                      onChange: ({ value }) => {
                        if (value != null) {
                          return formStore.updateField({
                            path,
                            value: CharacterProficiencyInputSchema.parse({
                              id: value,
                              classId: fullClass.id,
                              optionIndex,
                            }),
                          })
                        }
                        return formStore.removeField({ path })
                      },
                    }}
                  >
                    {({ DropdownField }) => (
                      <DropdownField label={label} options={options} className={option_dropdown} exist={exist} />
                    )}
                  </AppField>
                </Grid.Col>
              )
            }

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

            element = (
              <Fragment key={key}>
                <Grid.Col>
                  <strong>{`${startCase(key)}: `}</strong>
                  {typeText}
                  {dropdowns}
                </Grid.Col>
              </Fragment>
            )
          }
        })
      }
      return element
    }, [
      classIndex,
      getSectionOptions,
      fullClass,
      formProficiencies,
      AppField,
      proficiencies,
      fieldListeners,
      formStore,
    ])

    return (
      <Grid.Col>
        <Collapsible
          props={{
            trigger: {
              title: 'Proficiencies',
              className: card_header,
            },
          }}
        >
          <Grid>{dropdowns}</Grid>
        </Collapsible>
      </Grid.Col>
    )
  },
})

export default ClassProficiencies
