import { use, useEffect } from 'react'
import { FeatureContext } from '../Features/FeatureContext'
import { Grid } from '@mantine/core'
import Collapsible from '@/components/Collapsible'
import { useEnumChecks } from '@/hooks'
import Input from '@/components/Input'
import type { OnChange, AncestryFeature, Feature } from '@/types'

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
    <Grid.Col>
      <Collapsible>
        <Collapsible.Trigger title='Select Options By Level' />
        <Collapsible.Content>
          <Grid>
            <Grid.Col>
              <Grid>
                <Grid.Col >Level</Grid.Col>
                <Grid.Col >Count</Grid.Col>
                {replaceAtLevel && <Grid.Col >Replace Count</Grid.Col>}
              </Grid>
            </Grid.Col>
            {data?.optionsByLevel?.map((option, index) => (
              <Grid.Col key={index}>
                <Grid>
                  <Grid.Col >
                    <Input
                      name={`optionsByLevel.${index}.level`}
                      value={option.level}
                      validation='num'
                      required={true}
                      onChange={{ updateField }}
                    />
                  </Grid.Col>
                  <Grid.Col >
                    <Input
                      name={`optionsByLevel.${index}.count`}
                      value={option.count}
                      validation='num'
                      required={true}
                      onChange={{ updateField }}
                    />
                  </Grid.Col>
                  {replaceAtLevel && (
                    <Grid.Col >
                      <Input
                        name={`optionsByLevel.${index}.replaceCount`}
                        value={option.replaceCount}
                        validation='num'
                        required={true}
                        onChange={{ updateField }}
                      />
                    </Grid.Col>
                  )}
                </Grid>
              </Grid.Col>
            ))}
          </Grid>
        </Collapsible.Content>
      </Collapsible>
    </Grid.Col>
  )
}
export default SelectOptionsByLevel
