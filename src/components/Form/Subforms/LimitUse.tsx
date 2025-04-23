import { useEffect } from 'react'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import Collapse from '../../Collapse/Collapse'
import { AllEnum, type Feat, FeatureEnum, type FeatureSpell } from '../../../../amplify/gql/types'
import { ChargesLimits } from '../../../types/enums'
import Grid from '../../Grid/Grid'
import useSystemData from '../../../hooks/useSystemData'
import type { FeatureDataType, OnChange } from '../../../types/types'

const LimitUse = ({
  formStore: { data, addField, removeField, updateField },
}: {
  formStore: {
    data: Feat | FeatureDataType | FeatureSpell
    addField: OnChange<Feat | FeatureDataType | FeatureSpell>['addField']
    removeField: OnChange<Feat | FeatureDataType | FeatureSpell>['removeField']
    updateField: OnChange<Feat | FeatureDataType | FeatureSpell>['updateField']
  }
}) => {
  const { charges, abilities, skills } = useSystemData()

  //Add/remove Limit Use table
  useEffect(() => {
    if (data.charges && !data.charges?.usesPerLevel?.length && data?.charges?.limit === ChargesLimits.usesPerLevel) {
      addField({ path: 'charges.usesPerLevel' })
    }
    if (data.charges && data.charges?.limit !== ChargesLimits.usesPerLevel && data.charges?.usesPerLevel?.length) {
      removeField({ path: 'charges.usesPerLevel' })
    }
  }, [data, removeField, addField])

  return (
    <>
      <Grid.Item>
        <Grid>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='charges.limit'
              label='Limit Option'
              value={data?.charges?.limit}
              options={charges.limits.filter((limit) => {
                if (data.__typename === 'Feat') {
                  return limit?.feats?.length && limit?.feats?.includes(AllEnum.all)
                }
                return limit?.features?.length && limit?.features?.includes(FeatureEnum.all)
              })}
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
          {data?.charges?.limit === ChargesLimits.ability ?
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='charges.ability'
                label='Ability'
                value={data?.charges?.ability}
                options={abilities}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Item>
          : data.charges?.limit === ChargesLimits.skill ?
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='charges.skill'
                label='Skill'
                value={data?.charges?.skill}
                options={skills}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Item>
          : data.charges?.limit === ChargesLimits.setAmount ?
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                type='text'
                name='charges.setAmount'
                errorMsg='Must contain only numbers'
                label='Use Amount'
                value={data?.charges?.setAmount}
                required={true}
                onChange={{ updateField }}
              />
            </Grid.Item>
          : data.charges?.limit === ChargesLimits.resourcePoints && (
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Input
                  validation='num'
                  type='text'
                  name='charges.resourcePoints'
                  errorMsg='Must contain only numbers'
                  label='Use Amount'
                  value={data?.charges?.resourcePoints}
                  required={true}
                  onChange={{ updateField }}
                />
              </Grid.Item>
            )
          }
          {data?.charges?.limit != null &&
            data.charges?.limit !== ChargesLimits.setAmount &&
            data.charges?.limit !== ChargesLimits.usesPerLevel &&
            data?.charges?.limit !== ChargesLimits.resourcePoints && (
              <>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name='charges.multiplier'
                    autoComplete='off'
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    label='Multiplier'
                    value={data?.charges?.multiplier}
                    onChange={{ updateField }}
                  />
                </Grid.Item>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name='charges.addAmount'
                    autoComplete='off'
                    label='Additional Amount'
                    value={data?.charges?.addAmount}
                    onChange={{ updateField }}
                  />
                </Grid.Item>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name='charges.minAmount'
                    autoComplete='off'
                    label='Min. Value'
                    value={data?.charges?.minAmount}
                    onChange={{ updateField }}
                  />
                </Grid.Item>
              </>
            )}
          {data?.charges?.limit !== ChargesLimits.resourcePoints && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='charges.reset'
                label='Reset Option'
                value={data?.charges?.reset}
                options={charges.resets.filter(
                  (reset) => reset?.features?.length && reset?.features?.includes(FeatureEnum.all)
                )}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Item>
          )}
        </Grid>
      </Grid.Item>
      {data.charges?.limit === ChargesLimits.usesPerLevel && (
        <Grid.Item>
          <Collapse>
            <Collapse.Header title={'Limit Use Table'} />
            <Collapse.Body>
              <Grid>
                <Grid.Item>
                  <Grid>
                    <Grid.Item colSpan={'auto'}>Level</Grid.Item>
                    <Grid.Item colSpan={'auto'}>Uses</Grid.Item>
                  </Grid>
                </Grid.Item>
                {data?.charges?.usesPerLevel?.map((setLevel, index) => (
                  <Grid.Item key={index}>
                    <Grid>
                      <Grid.Item colSpan={'auto'}>
                        <Input
                          name={`charges.usesPerLevel.${index}.level`}
                          value={setLevel.level}
                          validation='num'
                          errorMsg='Please enter a whole number'
                          onChange={{ updateField }}
                          required={true}
                        />
                      </Grid.Item>
                      <Grid.Item colSpan={'auto'}>
                        <Input
                          name={`charges.usesPerLevel.${index}.uses`}
                          value={setLevel.uses}
                          validation='num'
                          errorMsg='Please enter a whole number'
                          onChange={{ updateField }}
                          required={true}
                        />
                      </Grid.Item>
                    </Grid>
                  </Grid.Item>
                ))}
              </Grid>
            </Collapse.Body>
          </Collapse>
        </Grid.Item>
      )}
    </>
  )
}

export default LimitUse
