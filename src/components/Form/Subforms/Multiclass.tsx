import Collapse from '../../Collapse/Collapse'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import { useGetSystemQuery } from '../../../apis/systemsApi'
import { Class } from '../../../../amplify/gql/types'
import { UpdateState } from '../../../types/form'
import { Attributes } from '../../../types/enums'
import Grid from '../../Grid/Grid'

const Multiclass = ({
  formData,
  updateFormData,
}: {
  formData: Class
  updateFormData: (arg: UpdateState<Class>) => void
}) => {
  const { data: system } = useGetSystemQuery()

  return (
    <Grid.Item>
      <Collapse>
        <Collapse.Header title={'Multiclass Ability Requirements'} startOpened={formData.id == null} />
        <Collapse.Body>
          <Grid>
            {formData?.attributes?.some((attribute) => attribute === Attributes.primaryAbility) && (
              <>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                </Grid.Item>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                </Grid.Item>
              </>
            )}
            {formData?.attributes?.some((attribute) => attribute === Attributes.secondaryAbility) && (
              <>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                </Grid.Item>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                </Grid.Item>
              </>
            )}
            {formData?.attributes?.some((attribute) => attribute === Attributes.optionalAbility) && (
              <>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                </Grid.Item>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                </Grid.Item>
              </>
            )}
          </Grid>
        </Collapse.Body>
      </Collapse>
    </Grid.Item>
  )
}

export default Multiclass
