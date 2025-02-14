import Collapse from '../../../Collapse/Collapse'
import Dropdown from '../../../Dropdown/Dropdown'
import { startCase } from 'lodash'
import { feature_card_header, option_dropdown } from '../Character.css'
import { numberToWords } from '../../../../utils/formatting'
import { Character, CharacterClass, Class } from '../../../../../amplify/gql/types'
import { UpdateState } from '../../../../types/form'
import useGetSections from '../../../../hooks/useGetSectionState'

const ClassProficiencies = ({
  fullClass,
  classIndex,
  formData,
  updateFormData,
}: {
  fullClass: Class
  uClass: CharacterClass
  classIndex: number
  formData: Character
  updateFormData: (state: UpdateState<Character>) => void
}) => {
  const { getSectionOptions, createClassProficiencyText } = useGetSections({ formData })

  // Memoize the proficiency array
  const proficiencies = createClassProficiencyText({ fullClass })

  return (
    <Collapse>
      <Collapse.Header title='Proficiencies' className={feature_card_header} />
      <Collapse.Body>
        {proficiencies &&
          Object.entries(proficiencies).map(([key, value], pIndex) => {
            const typeArray = value?.type
            const selectionCount = value?.selectionCount
            const propertyArray = value?.property ?? []

            const fullProficiency = fullClass.proficiencies.find(
              (proficiency) => proficiency.id === value.proficiencyId
            )

            const dropdowns = () =>
              Array.from({ length: selectionCount ?? 0 }, (_, index) => {
                const optionIndex = index & pIndex & classIndex

                const { options, path, exist } = getSectionOptions({
                  section: fullProficiency,
                  sectionStep: 'proficiencies',
                  optionIndex,
                })

                // Render the Dropdown component inside the loop
                return (
                  <Dropdown
                    key={index}
                    name={path}
                    className={option_dropdown}
                    label={`${startCase(key)} Option`}
                    options={options}
                    onChange={updateFormData}
                    value={exist}
                  />
                )
              })

            let typeText: string = ''

            if (propertyArray.length > 0) {
              if (selectionCount > 0) {
                typeText = `Choose ${numberToWords(selectionCount)} from `
              }
              propertyArray.forEach((iProperty, pIndex) => {
                if (selectionCount != null) {
                  typeText += `${iProperty.value}s`
                }

                if (propertyArray.length > 1 && propertyArray.length < 3) {
                  if (pIndex !== propertyArray.length - 1) {
                    if (selectionCount != null) {
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
                    if (selectionCount != null) {
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
                      if (selectionCount != null) {
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
                      if (selectionCount != null) {
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
              <div key={key}>
                <strong>{`${startCase(key)}: `}</strong>
                {typeText}
                {selectionCount > 0 && dropdowns()}
              </div>
            )
          })}
      </Collapse.Body>
    </Collapse>
  )
}

export default ClassProficiencies
