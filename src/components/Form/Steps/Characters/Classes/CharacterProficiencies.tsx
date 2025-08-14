import Collapsible from '~/components/Collapse'
import { startCase } from 'lodash-es'
import { card_header, option_dropdown } from '~/components/Form'
import { convertTypenameToKindInput, numberToWords } from '~/utils'
import type { CharacterInput, ClassProficiencyInput, FeatureProficiencyInput } from '~/types'
import {
  useClassProficiency,
  useFieldUpdates,
  ClassProficiencyOption,
  useCharacterFeatureSectionOptions,
} from '~/hooks'
import { Grid } from '@mantine/core'
import { Fragment, useMemo } from 'react'
import { useFormField } from '~/hooks'
import { CharacterProficiencyInputSchema, FeatureProficiencyInputSchema } from '~/schemas'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import { useGetClass } from '~/apis'

const CharacterProficiencies = ({ index }: { index: number }) => {
  const store = useTypedFormStore<CharacterInput>()

  const { AppField } = useFormField({ store })

  const { classId, updateField } = useOptimizedSelector(store, (state) => ({
    classId: state.current?.classes?.[index]?.id || '',
    updateField: state.updateField,
  }))

  const { fieldListeners } = useFieldUpdates()

  const { data: fullClass } = useGetClass(classId)

  // Memoize the proficiency array
  const proficiencies = useClassProficiency({ fullClass: fullClass! })

  const ProficiencyField = ({ section, optionIndex }: { section: FeatureProficiencyInput; optionIndex: string }) => {
    const { options, label, path, exist } = useCharacterFeatureSectionOptions({
      section: section,
      sectionStep: 'proficiencies',
      optionIndex,
    })
    return (
      <Grid.Col key={`${path + optionIndex}-proficiencies`}>
        <AppField
          name={path}
          listeners={{
            ...fieldListeners,
            onChange: ({ value }) => {
              if (value != null) {
                return updateField({
                  path,
                  value: CharacterProficiencyInputSchema.parse({
                    id: value,
                    classId: fullClass?.id,
                    optionIndex,
                  }),
                })
              }
              return updateField({ path: path, value: undefined })
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

  const ProficiencyItem = ({ key, value, pIndex }: { key: string; value: ClassProficiencyOption; pIndex: number }) => {
    const typeArray = value?.type
    const selectionCount = value?.selectionCount || 1
    const propertyArray = value?.property ?? []

    const fullProficiency = fullClass?.proficiencies?.find((proficiency) => proficiency.id === value.id)

    const optionIndices = useMemo(() => {
      return Array.from({ length: selectionCount || 1 }, (_, index) => ({
        index,
        optionIndex: `${value.id}-${pIndex}-${index}`,
      }))
    }, [pIndex, selectionCount, value.id])

    if (fullProficiency) {
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

      const valueInput = convertTypenameToKindInput(value) as ClassProficiencyInput

      const section = FeatureProficiencyInputSchema.parse({
        ...valueInput,
        __kind: 'FeatureProficiencyInput',
      })

      return (
        <Fragment key={key}>
          <Grid.Col>
            <strong>{`${startCase(key)}: `}</strong>
            {typeText}
            {optionIndices.map(({ optionIndex }) => (
              <ProficiencyField key={optionIndex} section={section} optionIndex={optionIndex} />
            ))}
          </Grid.Col>
        </Fragment>
      )
    }
  }

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
        <Grid>
          {Object.entries(proficiencies).map(([key, value], pIndex) => (
            <ProficiencyItem key={key} value={value} pIndex={pIndex} />
          ))}
        </Grid>
      </Collapsible>
    </Grid.Col>
  )
}

export default CharacterProficiencies
