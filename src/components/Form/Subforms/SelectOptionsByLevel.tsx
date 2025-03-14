import { use, useEffect } from 'react'
import { FeatureContext } from '../Features/FeatureContext'
import Grid from '../../Grid/Grid'
import Collapse from '../../Collapse/Collapse'
import { useEnumChecks } from '../../../hooks/useEnumChecks'
import Input from '../../Input/Input'

const SelectOptionsByLevel = () => {
  const { featureData, updateFeatureData } = use(FeatureContext)
  const { replaceAtLevel } = useEnumChecks({ data: featureData })

  useEffect(() => {
    if (!featureData?.optionsByLevel) {
      updateFeatureData({
        type: 'add',
        path: 'optionsByLevel',
      })
    }
  })

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
            {featureData?.optionsByLevel?.map((option, index) => (
              <Grid.Item key={index}>
                <Grid>
                  <Grid.Item colSpan={'auto'}>
                    <Input
                      name={`optionsByLevel.${index}.level`}
                      value={option.level}
                      validation='num'
                      required={true}
                      onChange={updateFeatureData}
                    />
                  </Grid.Item>
                  <Grid.Item colSpan={'auto'}>
                    <Input
                      name={`optionsByLevel.${index}.count`}
                      value={option.count}
                      validation='num'
                      required={true}
                      onChange={updateFeatureData}
                    />
                  </Grid.Item>
                  {replaceAtLevel && (
                    <Grid.Item colSpan={'auto'}>
                      <Input
                        name={`optionsByLevel.${index}.replaceCount`}
                        value={option.replaceCount}
                        validation='num'
                        required={true}
                        onChange={updateFeatureData}
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
