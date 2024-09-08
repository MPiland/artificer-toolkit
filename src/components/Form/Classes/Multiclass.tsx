import { useForm } from '../../../hooks/UseForm'
import Collapse from '../../Collapse/Collapse'
import Row from '../../Row/Row'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import { sprinkles } from '../../../css/sprinkles.css'
import { useGetBuildersQuery } from '../../../features/builders/buildersApi'

const Multiclass = () => {
  const { formState, setFormState, context } = useForm()

  const { data: builders } = useGetBuildersQuery()
  return (
    formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'primaryAbility') && (
      <>
        <Collapse>
          <Collapse.Header title={'Multiclass Ability Requirements'} startOpened={context.type === 'new'} />
          <Collapse.Body>
            <Row className={sprinkles({ mb: 'space-3' })}>
              {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'primaryAbility') && (
                <>
                  <Dropdown
                    name='multiclass.primaryAbility.type'
                    label='Primary Ability'
                    value={formState?.multiclass?.primaryAbility?.type}
                    options={builders.abilities.type
                      .filter(
                        (abilityItem: any) => abilityItem._id !== formState.multiclass?.secondaryAbility?.type?._id
                      )
                      .filter(
                        (abilityItem: any) => abilityItem._id !== formState.multiclass?.optionalAbility?.type?._id
                      )}
                    required={true}
                    onChange={setFormState}
                  />
                  <Input
                    name='multiclass.primaryAbility.minValue'
                    autoComplete='off'
                    label='Primary Score'
                    required={true}
                    value={formState?.multiclass?.primaryAbility?.minValue}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={setFormState}
                  />
                </>
              )}
              {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'secondaryAbility') && (
                <>
                  <Dropdown
                    name='multiclass.secondaryAbility.type'
                    label='Secondary Ability'
                    value={formState?.multiclass?.secondaryAbility?.type}
                    options={builders.abilities.type
                      .filter((abilityItem: any) => abilityItem._id !== formState.multiclass?.primaryAbility?.type?._id)
                      .filter(
                        (abilityItem: any) => abilityItem._id !== formState.multiclass?.optionalAbility?.type?._id
                      )}
                    required={true}
                    onChange={setFormState}
                  />
                  <Input
                    name='multiclass.secondaryAbility.minValue'
                    autoComplete='off'
                    label='Secondary Score'
                    required={true}
                    value={formState?.multiclass?.secondaryAbility?.minValue}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={setFormState}
                  />
                </>
              )}
              {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'optionalAbility') && (
                <>
                  <Dropdown
                    name='multiclass.optionalAbility.type'
                    label='Optional Ability'
                    value={formState?.multiclass?.optionalAbility?.type}
                    options={builders.abilities.type
                      .filter((abilityItem: any) => abilityItem._id !== formState.multiclass?.primaryAbility?.type?._id)
                      .filter(
                        (abilityItem: any) => abilityItem._id !== formState.multiclass?.secondaryAbility?.type?._id
                      )}
                    required={true}
                    onChange={setFormState}
                  />
                  <Input
                    name='multiclass.optional.ability.minValue'
                    autoComplete='off'
                    label='Optional Score'
                    required={true}
                    value={formState?.multiclass?.optional.ability?.minValue}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={setFormState}
                  />
                </>
              )}
            </Row>
          </Collapse.Body>
        </Collapse>
      </>
    )
  )
}

export default Multiclass
