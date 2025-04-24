import { use } from 'react'
import type { Character } from '@/types'
import Dropdown from '@/components/Dropdown'
import Grid from '@/components/Grid'
import { option_dropdown } from '../../../Character.css'
import { FormContext } from '../../../FormContext'
import { useGetFeatures, type FactoryFeature } from '@/hooks'

interface FeatureOptionProps {
  feature: FactoryFeature
  featureIndex: number
  classIndex?: number
}

const FeatureOption = ({ feature, featureIndex, classIndex }: FeatureOptionProps) => {
  const {
    formStore: { data },
  } = use(FormContext) as {
    formStore: {
      data: Character
    }
  }

  const { getFullFeature } = useGetFeatures({ data })

  const optionByLevel = getFullFeature(feature)?.optionsByLevel?.find(
    (option) => Number(option.level) >= Number(data?.features?.[featureIndex]?.level)
  )

  const selectionCount = optionByLevel?.count || 1

  const { getFeatureOptions } = useGetFeatures({ data: data })

  return Array.from({ length: selectionCount }, (_, index) => {
    const optionIndex = `${index}${featureIndex}${classIndex || 0}`

    const { path, exist, options } = getFeatureOptions({
      feature,
      optionIndex,
    })

    if (path) {
      return (
        <Grid.Item key={path + optionIndex} align='center' justify='center' flexDirection='column'>
          <Dropdown<Character>
            name={path}
            label={`${feature.label} Option`}
            options={options}
            className={option_dropdown}
            onChange={{
              updateField: ({ path, value }) => ({
                path: path,
                value: {
                  id: value,
                  optionIndex,
                  featureLevel: feature.level,
                },
              }),
              removeField: ({ path }) => ({ path: path }),
            }}
            value={exist}
          />
        </Grid.Item>
      )
    }
  })
}
export default FeatureOption
