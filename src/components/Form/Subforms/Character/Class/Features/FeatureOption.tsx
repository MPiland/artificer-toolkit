import { use } from 'react'
import { Character } from '../../../../../../../amplify/gql/types'
import { UpdateState } from '../../../../../../types/form'
import Dropdown from '../../../../../Dropdown/Dropdown'
import Grid from '../../../../../Grid/Grid'
import { option_dropdown } from '../../../../Character.css'
import { FormContext } from '../../../../FormContext'
import useGetFeatures, { FactoryFeature } from '../../../../../../hooks/useGetFeatures'

interface FeatureOptionProps {
  feature: FactoryFeature
  featureIndex: number
  classIndex?: number
}

const FeatureOption = ({ feature, featureIndex, classIndex }: FeatureOptionProps) => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
  }

  const { getFullFeature } = useGetFeatures({ data: formData })

  const optionByLevel = getFullFeature(feature)?.optionsByLevel?.find(
    (option) => Number(option.level) >= Number(formData?.features?.[featureIndex]?.level)
  )

  const selectionCount = optionByLevel?.count || 1

  const { getFeatureOptions } = useGetFeatures({ data: formData })

  return Array.from({ length: selectionCount }, (_, index) => {
    const optionIndex = `${index}${featureIndex}${classIndex || 0}`

    const { path, exist, options } = getFeatureOptions({
      feature,
      optionIndex,
    })

    if (path) {
      return (
        <Grid.Item key={path + optionIndex} align='center' justify='center' flexDirection='column'>
          <Dropdown
            name={path}
            label={`${feature.label} Option`}
            options={options}
            className={option_dropdown}
            onChange={(e) => {
              if (e.type === 'update') {
                updateFormData({
                  type: e.type,
                  path: path,
                  value: {
                    id: e.value,
                    optionIndex,
                    featureLevel: feature.level,
                  },
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
    }
  })
}
export default FeatureOption
