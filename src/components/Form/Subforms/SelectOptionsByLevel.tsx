import { use, useEffect } from 'react'
import { FeatureContext } from '../Features/FeatureContext'
import Grid from '../../Grid/Grid'
import Collapse from '../../Collapse/Collapse'
import { useEnumChecks } from '../../../hooks/useEnumChecks'
import Input from '../../Input/Input'
import type { AncestryFeature, Feature } from '../../../../amplify/gql/types'
import type { OnChange } from '../../../types/types'

const SelectOptionsByLevel = () => {
  const {
    featureStore: { data, updateField, addField },
  } = use(FeatureContext) as {
    featureStore: {
      data: Feature | AncestryFeature
      updateField: OnChange<Feature | AncestryFeature>['updateField']
      addField: OnChange<Feature | AncestryFeature>['addField']
      removeField: OnChange<Feature | AncestryFeature>['removeField']
    }
  }

  const { replaceAtLevel } = useEnumChecks({ data: data })

  useEffect(() => {
    if (!data?.optionsByLevel) {
      addField({ path: 'optionsByLevel' })
    }
  }, [addField, data?.optionsByLevel])

  return (
    <Grid.Item>
      <Collapse>
        <Collapse.Header title='Select Options By Level' />
        <Collapse.Body>
          <Grid>
            <Grid.Item>
              <Grid>
                <Grid.Item colSpan={'auto'}>Level</Grid.Item>
                <Grid.Item colSpan={'auto'}>Count</Grid.Item>
                {replaceAtLevel && <Grid.Item colSpan={'auto'}>Replace Count</Grid.Item>}
              </Grid>
            </Grid.Item>
            {data?.optionsByLevel?.map((option, index) => (
              <Grid.Item key={index}>
                <Grid>
                  <Grid.Item colSpan={'auto'}>
                    <Input
                      name={`optionsByLevel.${index}.level`}
                      value={option.level}
                      validation='num'
                      required={true}
                      onChange={{ updateField }}
                    />
                  </Grid.Item>
                  <Grid.Item colSpan={'auto'}>
                    <Input
                      name={`optionsByLevel.${index}.count`}
                      value={option.count}
                      validation='num'
                      required={true}
                      onChange={{ updateField }}
                    />
                  </Grid.Item>
                  {replaceAtLevel && (
                    <Grid.Item colSpan={'auto'}>
                      <Input
                        name={`optionsByLevel.${index}.replaceCount`}
                        value={option.replaceCount}
                        validation='num'
                        required={true}
                        onChange={{ updateField }}
                      />
                    </Grid.Item>
                  )}
                </Grid>
              </Grid.Item>
            ))}
          </Grid>
        </Collapse.Body>
      </Collapse>
    </Grid.Item>
  )
}
export default SelectOptionsByLevel
