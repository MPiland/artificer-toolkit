import { use } from 'react'
import { Character } from '../../../../../../../amplify/gql/types'
import useGetSections from '../../../../../../hooks/useGetSectionState'
import { SectionDataType, SectionName, UpdateState } from '../../../../../../types/form'
import Dropdown from '../../../../../Dropdown/Dropdown'
import Grid from '../../../../../Grid/Grid'
import { option_dropdown } from '../../../../Character.css'
import { FormContext } from '../../../../FormContext'
import { proficiencyKey, sectionIdKey, typename } from '../../../../../../utils/formatting'
import { getKeyFromId } from '../../../../../../utils/form'
import { ProficiencyCategories } from '../../../../../../types/enums'

interface FeatureOptionProps {
  section: SectionDataType
  sectionStep: SectionName
  featureIndex: number
  classIndex?: number
  classId?: string
  raceId?: string
  backgroundId?: string
  equipmentId?: string
  featId?: string
  optionId?: string
}

const FeatureSection = ({
  section,
  sectionStep,
  featureIndex,
  classIndex,
  classId,
  optionId,
  raceId,
  backgroundId,
  equipmentId,
  featId,
}: FeatureOptionProps) => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
  }

  const { getSectionOptions } = useGetSections({ formData })

  const feature = formData?.features[featureIndex]

  // Check if selectionCount exists and is greater than 0
  const selectionCount = section?.selectionCount || 1

  // Repeat Dropdown component based on selectionCount
  return Array.from({ length: selectionCount }, (_, index) => {
    const optionIndex = `${index}${featureIndex}${classIndex || 0}`

    const { options, label, path, exist } = getSectionOptions({
      section,
      sectionStep,
      optionIndex,
    })

    console.log({ path, options, exist, optionIndex })

    const type = sectionIdKey(sectionStep)

    return (
      <Grid.Item key={path + optionIndex} justify='center'>
        <Dropdown
          key={index}
          name={path}
          className={option_dropdown}
          label={`${label} Option`}
          options={options}
          onChange={(e) => {
            if (e.type === 'update') {
              const valueObject = {
                [`${type}`]: e.value,
                optionIndex,
                featureId: feature.id,
                __typename: typename(sectionStep as Exclude<SectionName, 'spells'>, 'typename'),
              }

              // Add prop properties
              if (feature.level) {
                valueObject.featureLevel = feature.level
              }
              if (classId) valueObject.classId = classId
              if (raceId) valueObject.raceId = raceId
              if (backgroundId) valueObject.backgroundId = backgroundId
              if (optionId) valueObject.optionId = optionId
              if (featId) valueObject.featId = featId
              if (equipmentId) valueObject.equipmentId = equipmentId

              // Add category-specific properties for proficiencies and expertise
              if (section.__typename === 'FeatureProficiency' || section.__typename === 'FeatureExpertise') {
                const categoryId = section.category
                const categoryName = getKeyFromId(categoryId, ProficiencyCategories)

                // If we have a valid category, add the appropriate property
                if (categoryName && categoryName !== 'initiative') {
                  // Use the proficiencyKey helper to get the correct property name
                  const propertyName = proficiencyKey(
                    categoryName as Exclude<keyof typeof ProficiencyCategories, 'initiative'>
                  )
                  if (propertyName) {
                    // Set the property using the selected value
                    valueObject[propertyName] = e.value
                  }
                }
              }

              updateFormData({
                type: e.type,
                path: path,
                value: valueObject,
              })
            }
            if (e.type === 'remove') {
              updateFormData({
                type: 'remove',
                path: path,
              })
            }
          }}
          value={exist}
        />
      </Grid.Item>
    )
  })
}
export default FeatureSection
