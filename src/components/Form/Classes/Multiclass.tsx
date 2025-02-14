import Collapse from '../../Collapse/Collapse'
import Row from '../../Row/Row'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import { sprinkles } from '../../../css/sprinkles.css'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { Class } from '../../../../amplify/gql/types'
import { UpdateState } from '../../../types/form'
import { Attributes } from '../../../types/enums'

const Multiclass = ({
  formData,
  updateFormData,
}: {
  formData: Class
  updateFormData: (arg: UpdateState<Class>) => void
}) => {
  const { data: system } = useGetSystemQuery()

  return (
    <Collapse>
      <Collapse.Header title={'Multiclass Ability Requirements'} startOpened={formData.id == null} />
      <Collapse.Body>
        <Row className={sprinkles({ mb: 'space-3' })}>
          {formData?.attributes?.some((attribute) => attribute === Attributes.primaryAbility) && (
            <>
              <Dropdown
                name='multiclass.primaryAbility.id'
                label='Primary Ability'
                value={formData?.multiclass?.primaryAbility?.id}
                options={system.abilities
                  .filter((ability) => ability.id !== formData.multiclass?.secondaryAbility?.id)
                  .filter((ability) => ability.id !== formData.multiclass?.optionalAbility?.id)}
                required={true}
                onChange={updateFormData}
              />
              <Input
                name='multiclass.primaryAbility.minAmount'
                autoComplete='off'
                label='Primary Score'
                required={true}
                value={formData?.multiclass?.primaryAbility?.minAmount}
                validation='num'
                errorMsg='Must contain whole numbers only'
                onChange={updateFormData}
              />
            </>
          )}
          {formData?.attributes?.some((attribute) => attribute === Attributes.secondaryAbility) && (
            <>
              <Dropdown
                name='multiclass.secondaryAbility.id'
                label='Secondary Ability'
                value={formData?.multiclass?.secondaryAbility?.id}
                options={system.abilities
                  .filter((ability) => ability.id !== formData.multiclass?.primaryAbility?.id)
                  .filter((ability) => ability.id !== formData.multiclass?.optionalAbility?.id)}
                required={true}
                onChange={updateFormData}
              />
              <Input
                name='multiclass.secondaryAbility.minAmount'
                autoComplete='off'
                label='Secondary Score'
                required={true}
                value={formData?.multiclass?.secondaryAbility?.minAmount}
                validation='num'
                errorMsg='Must contain whole numbers only'
                onChange={updateFormData}
              />
            </>
          )}
          {formData?.attributes?.some((attribute) => attribute === Attributes.optionalAbility) && (
            <>
              <Dropdown
                name='multiclass.optionalAbility.id'
                label='Optional Ability'
                value={formData?.multiclass?.optionalAbility?.id}
                options={system.abilities
                  .filter((ability) => ability.id !== formData.multiclass?.primaryAbility?.id)
                  .filter((ability) => ability.id !== formData.multiclass?.secondaryAbility?.id)}
                required={true}
                onChange={updateFormData}
              />
              <Input
                name='multiclass.optionalAbility.minAmount'
                autoComplete='off'
                label='Optional Score'
                required={true}
                value={formData?.multiclass?.optionalAbility?.minAmount}
                validation='num'
                errorMsg='Must contain whole numbers only'
                onChange={updateFormData}
              />
            </>
          )}
        </Row>
      </Collapse.Body>
    </Collapse>
  )
}

export default Multiclass
