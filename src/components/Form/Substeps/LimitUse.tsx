import { useEffect } from 'react'
import Dropdown from '@/components/Dropdown'
import Input from '@/components/Input'
import Collapsible from '@/components/Collapsible'
import { ChargesLimits, Features, Feats } from '@/enums'
import { Grid } from '@mantine/core'
import { useSystemData } from '@/hooks'
import type { FeatureDataType, OnChange, Feat, FeatureSpell } from '@/types'

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
    if (data.charges && !data.charges?.usesPerLevel?.length && data?.charges?.limit === ChargesLimits.USES_PER_LEVEL) {
      addField({ path: 'charges.usesPerLevel' })
    }
    if (data.charges && data.charges?.limit !== ChargesLimits.USES_PER_LEVEL && data.charges?.usesPerLevel?.length) {
      removeField({ path: 'charges.usesPerLevel' })
    }
  }, [data, removeField, addField])

  return (
    <>
      <Grid.Col>
        <Grid>
          <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='charges.limit'
              label='Limit Option'
              value={data?.charges?.limit}
              options={charges.limits.filter((limit) => {
                if (data.__typename === 'Feat') {
                  return limit?.feats?.length && limit?.feats?.includes(Feats.ALL)
                }
                return limit?.features?.length && limit?.features?.includes(Features.ALL)
              })}
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Col>
          {data?.charges?.limit === ChargesLimits.ABILITY ?
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='charges.ability'
                label='Ability'
                value={data?.charges?.ability}
                options={abilities}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Col>
          : data.charges?.limit === ChargesLimits.SKILL ?
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='charges.skill'
                label='Skill'
                value={data?.charges?.skill}
                options={skills}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Col>
          : data.charges?.limit === ChargesLimits.SET_AMOUNT ?
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
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
            </Grid.Col>
          : data.charges?.limit === ChargesLimits.RESOURCE_POINTS && (
              <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
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
              </Grid.Col>
            )
          }
          {data?.charges?.limit != null &&
            data.charges?.limit !== ChargesLimits.SET_AMOUNT &&
            data.charges?.limit !== ChargesLimits.USES_PER_LEVEL &&
            data?.charges?.limit !== ChargesLimits.RESOURCE_POINTS && (
              <>
                <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name='charges.multiplier'
                    autoComplete='off'
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    label='Multiplier'
                    value={data?.charges?.multiplier}
                    onChange={{ updateField }}
                  />
                </Grid.Col>
                <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name='charges.addAmount'
                    autoComplete='off'
                    label='Additional Amount'
                    value={data?.charges?.addAmount}
                    onChange={{ updateField }}
                  />
                </Grid.Col>
                <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name='charges.minAmount'
                    autoComplete='off'
                    label='Min. Value'
                    value={data?.charges?.minAmount}
                    onChange={{ updateField }}
                  />
                </Grid.Col>
              </>
            )}
          {data?.charges?.limit !== ChargesLimits.RESOURCE_POINTS && (
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='charges.reset'
                label='Reset Option'
                value={data?.charges?.reset}
                options={charges.resets.filter(
                  (reset) => reset?.features?.length && reset?.features?.includes(Features.ALL)
                )}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Col>
          )}
        </Grid>
      </Grid.Col>
      {data.charges?.limit === ChargesLimits.USES_PER_LEVEL && (
        <Grid.Col>
          <Collapsible>
            <Collapsible.Trigger title={'Limit Use Table'} />
            <Collapsible.Content>
              <Grid>
                <Grid.Col>
                  <Grid>
                    <Grid.Col >Level</Grid.Col>
                    <Grid.Col >Uses</Grid.Col>
                  </Grid>
                </Grid.Col>
                {data?.charges?.usesPerLevel?.map((setLevel, index) => (
                  <Grid.Col key={index}>
                    <Grid>
                      <Grid.Col >
                        <Input
                          name={`charges.usesPerLevel.${index}.level`}
                          value={setLevel.level}
                          validation='num'
                          errorMsg='Please enter a whole number'
                          onChange={{ updateField }}
                          required={true}
                        />
                      </Grid.Col>
                      <Grid.Col >
                        <Input
                          name={`charges.usesPerLevel.${index}.uses`}
                          value={setLevel.uses}
                          validation='num'
                          errorMsg='Please enter a whole number'
                          onChange={{ updateField }}
                          required={true}
                        />
                      </Grid.Col>
                    </Grid>
                  </Grid.Col>
                ))}
              </Grid>
            </Collapsible.Content>
          </Collapsible>
        </Grid.Col>
      )}
    </>
  )
}

export default LimitUse
