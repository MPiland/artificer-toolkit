import { useEffect } from 'react'
import { useGetSystemQuery } from '../../../apis/systemsApi'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import Collapse from '../../Collapse/Collapse'
import { AllEnum, Feat, FeatureEnum, FeatureSpell } from '../../../../amplify/gql/types'
import { ChargesLimits } from '../../../types/enums'
import { FeatureDataType, UpdateState } from '../../../types/form'
import Grid from '../../Grid/Grid'

const LimitUse = ({
  formData,
  updateFormData,
}: {
  formData: FeatureDataType | Feat | FeatureSpell
  updateFormData: (state: UpdateState<FeatureDataType | Feat | FeatureSpell>) => void
}) => {
  const { data: system } = useGetSystemQuery()

  //Add/remove Limit Use table
  useEffect(() => {
    if (
      'charges' in formData &&
      !formData.charges?.usesPerLevel?.length &&
      formData?.charges?.limit === ChargesLimits.usesPerLevel
    ) {
      updateFormData({
        type: 'add',
        path: 'charges.usesPerLevel',
      })
    }
    if (
      'charges' in formData &&
      !(formData.charges?.limit === ChargesLimits.usesPerLevel) &&
      formData.charges?.usesPerLevel?.length
    ) {
      updateFormData({
        type: 'remove',
        path: 'charges.usesPerLevel',
      })
    }
  }, [formData, updateFormData])

  return (
    <>
      <Grid.Item>
        <Grid>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown<typeof formData>
              name='charges.limit'
              label='Limit Option'
              value={formData?.charges?.limit}
              options={system.charges.limits.filter((limit) => {
                if (formData.__typename === 'Feat') {
                  return limit?.feats?.length && limit?.feats?.includes(AllEnum.all)
                }
                return limit?.features?.length && limit?.features?.includes(FeatureEnum.all)
              })}
              required={true}
              onChange={updateFormData}
            />
          </Grid.Item>
          {formData?.charges?.limit === ChargesLimits.ability ?
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown<typeof formData>
                name='charges.ability'
                label='Ability'
                value={formData?.charges?.ability}
                options={system.abilities}
                required={true}
                onChange={updateFormData}
              />
            </Grid.Item>
          : formData.charges?.limit === ChargesLimits.skill ?
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown<typeof formData>
                name='charges.skill'
                label='Skill'
                value={formData?.charges?.skill}
                options={system.skills}
                required={true}
                onChange={updateFormData}
              />
            </Grid.Item>
          : formData.charges?.limit === ChargesLimits.setAmount ?
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input<typeof formData>
                validation='num'
                type='text'
                name='charges.setAmount'
                errorMsg='Must contain only numbers'
                label='Use Amount'
                value={formData?.charges?.setAmount}
                required={true}
                onChange={updateFormData}
              />
            </Grid.Item>
          : formData.charges?.limit === ChargesLimits.resourcePoints && (
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Input<typeof formData>
                  validation='num'
                  type='text'
                  name='charges.resourcePoints'
                  errorMsg='Must contain only numbers'
                  label='Use Amount'
                  value={formData?.charges?.resourcePoints}
                  required={true}
                  onChange={updateFormData}
                />
              </Grid.Item>
            )
          }
          {formData?.charges?.limit != null &&
            formData.charges?.limit !== ChargesLimits.setAmount &&
            formData.charges?.limit !== ChargesLimits.usesPerLevel &&
            formData?.charges?.limit !== ChargesLimits.resourcePoints && (
              <>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input<typeof formData>
                    name='charges.multiplier'
                    autoComplete='off'
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    label='Multiplier'
                    value={formData?.charges?.multiplier}
                    onChange={updateFormData}
                  />
                </Grid.Item>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input<typeof formData>
                    name='charges.addAmount'
                    autoComplete='off'
                    label='Additional Amount'
                    value={formData?.charges?.addAmount}
                    onChange={updateFormData}
                  />
                </Grid.Item>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input<typeof formData>
                    name='charges.minAmount'
                    autoComplete='off'
                    label='Min. Value'
                    value={formData?.charges?.minAmount}
                    onChange={updateFormData}
                  />
                </Grid.Item>
              </>
            )}
          {formData?.charges?.limit !== ChargesLimits.resourcePoints && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown<typeof formData>
                name='charges.reset'
                label='Reset Option'
                value={formData?.charges?.reset}
                options={system.charges.resets.filter(
                  (reset) => reset?.features?.length && reset?.features?.includes(FeatureEnum.all)
                )}
                required={true}
                onChange={updateFormData}
              />
            </Grid.Item>
          )}
        </Grid>
      </Grid.Item>
      {formData.charges?.limit === ChargesLimits.usesPerLevel && (
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
                {formData?.charges?.usesPerLevel?.map((setLevel, index) => (
                  <Grid.Item key={index}>
                    <Grid>
                      <Grid.Item colSpan={'auto'}>
                        <Input
                          name={`charges.usesPerLevel.${index}.level`}
                          value={setLevel.level}
                          validation='num'
                          errorMsg='Please enter a whole number'
                          onChange={updateFormData}
                          required={true}
                        />
                      </Grid.Item>
                      <Grid.Item colSpan={'auto'}>
                        <Input
                          name={`charges.usesPerLevel.${index}.uses`}
                          value={setLevel.uses}
                          validation='num'
                          errorMsg='Please enter a whole number'
                          onChange={updateFormData}
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
