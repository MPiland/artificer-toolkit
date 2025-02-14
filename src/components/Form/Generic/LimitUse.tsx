import { useEffect } from 'react'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import Row from '../../Row/Row'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import { sprinkles } from '../../../css/sprinkles.css'
import Collapse from '../../Collapse/Collapse'
import { AllEnum, Feat, FeatureEnum } from '../../../../amplify/gql/types'
import { ChargesLimits } from '../../../types/enums'
import { FeatureDataType, FormDataType, UpdateState } from '../../../types/form'

const LimitUse = ({
  formData,
  updateFormData,
}: {
  formData: FeatureDataType | Feat
  updateFormData: (state: UpdateState<FormDataType | FeatureDataType>) => void
}) => {
  const { data: system } = useGetSystemQuery()

  //Add/remove Limit Use table
  useEffect(() => {
    if (!(formData.charges?.usesPerLevel?.length > 0) && formData?.charges?.limit === ChargesLimits.usesPerLevel) {
      updateFormData({
        type: 'add',
        path: 'charges.usesPerLevel',
      })
    }
    if (!(formData.charges?.limit === ChargesLimits.usesPerLevel) && formData.charges?.usesPerLevel?.length > 0) {
      updateFormData({
        type: 'remove',
        path: 'charges.usesPerLevel',
      })
    }
  }, [formData, updateFormData])

  return (
    <>
      <Row className={sprinkles({ mb: 'space-3' })}>
        <Dropdown<typeof formData>
          name='charges.limit'
          label='Limit Option'
          value={formData?.charges?.limit}
          options={system.charges.limits.filter((limit) => {
            if (formData.__typename === 'Feat') {
              return limit?.feats?.length > 0 && limit?.feats?.includes(AllEnum.all)
            }
            return limit?.features?.length > 0 && limit?.features?.includes(FeatureEnum.all)
          })}
          required={true}
          onChange={updateFormData}
        />
        {formData?.charges?.limit === ChargesLimits.ability ? (
          <>
            <Dropdown<typeof formData>
              name='charges.ability'
              label='Ability'
              value={formData?.charges?.ability}
              options={system.abilities}
              required={true}
              onChange={updateFormData}
            />
          </>
        ) : formData.charges?.limit === ChargesLimits.skill ? (
          <Dropdown<typeof formData>
            name='charges.skill'
            label='Skill'
            value={formData?.charges?.skill}
            options={system.skills}
            required={true}
            onChange={updateFormData}
          />
        ) : formData.charges?.limit === ChargesLimits.setAmount ? (
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
        ) : (
          formData.charges?.limit === ChargesLimits.resourcePoints && (
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
          )
        )}
        {formData?.charges?.limit != null &&
          formData.charges?.limit !== ChargesLimits.setAmount &&
          formData.charges?.limit !== ChargesLimits.usesPerLevel &&
          formData?.charges?.limit !== ChargesLimits.resourcePoints && (
            <>
              <Input<typeof formData>
                name='charges.multiplier'
                autoComplete='off'
                validation='num'
                errorMsg='Must contain whole numbers only'
                label='Multiplier'
                value={formData?.charges?.multiplier}
                onChange={updateFormData}
              />
              <>
                <Input<typeof formData>
                  name='charges.addAmount'
                  autoComplete='off'
                  label='Additional Amount'
                  value={formData?.charges?.addAmount}
                  onChange={updateFormData}
                />
                <Input<typeof formData>
                  name='charges.minAmount'
                  autoComplete='off'
                  label='Min. Value'
                  value={formData?.charges?.minAmount}
                  onChange={updateFormData}
                />
              </>
            </>
          )}
        {formData?.charges?.limit !== ChargesLimits.resourcePoints && (
          <Dropdown<typeof formData>
            name='charges.reset'
            label='Reset Option'
            value={formData?.charges?.reset}
            options={system.charges.resets.filter(
              (reset) => reset?.features?.length > 0 && reset?.features?.includes(FeatureEnum.all)
            )}
            required={true}
            onChange={updateFormData}
          />
        )}
      </Row>
      {formData.charges?.limit === ChargesLimits.usesPerLevel && (
        <Collapse>
          <Collapse.Header title={'Limit Use Table'} />
          <Collapse.Body>
            <Row spacing='spaceBetween' cellSize='auto'>
              <span>Level</span>
              <span>Uses</span>
            </Row>
            {formData?.charges?.usesPerLevel?.map((setLevel, index) => (
              <Row key={index} spacing='spaceBetween' cellSize='auto'>
                <Input
                  name={`charges.usesPerLevel.${index}.level`}
                  value={setLevel.level}
                  validation='num'
                  errorMsg='Please enter a whole number'
                  onChange={updateFormData}
                  required={true}
                />
                <Input
                  name={`charges.usesPerLevel.${index}.uses`}
                  value={setLevel.uses}
                  validation='num'
                  errorMsg='Please enter a whole number'
                  onChange={updateFormData}
                  required={true}
                />
              </Row>
            ))}
          </Collapse.Body>
        </Collapse>
      )}
    </>
  )
}

export default LimitUse
