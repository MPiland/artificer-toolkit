import Collapse from '../../Collapse/Collapse'
import Input from '../../Input/Input'
import Dropdown from '../../Dropdown/Dropdown'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { useGetSystemQuery } from '../../../apis/systemsApi'
import { Class, ClassesEnum } from '../../../../amplify/gql/types'

import { Attributes } from '../../../types/enums'
import { UpdateState } from '../../../types/form'
import Grid from '../../Grid/Grid'

const Resource = <T extends Class>({
  formData,
  updateFormData,
}: {
  formData: T
  updateFormData: (arg: UpdateState<T>) => void
}) => {
  const { data: system } = useGetSystemQuery()

  return (
    <Grid.Item>
      <Collapse>
        <Collapse.Header startOpened={formData.id == null} title='Resource Attributes' />
        <Collapse.Body>
          <Grid>
            <Grid.Item>
              <Grid>
                <Grid.Item>
                  <Input
                    name='resource.label'
                    label='Resource Name'
                    autoComplete='off'
                    value={formData?.resource?.label}
                    required={true}
                    onChange={updateFormData}
                  />
                </Grid.Item>
                <Grid.Item>
                  <Input
                    name='resource.levelAvailable'
                    label='Level Available'
                    autoComplete='off'
                    value={formData?.resource?.levelAvailable}
                    required={true}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={updateFormData}
                  />
                </Grid.Item>
                <Grid.Item>
                  <Dropdown
                    name='resource.charges.limit'
                    label='Resource Limit Method'
                    value={formData?.resource?.charges?.limit}
                    options={system.charges.limits.filter(
                      (limit) => limit?.classes?.length && limit?.classes?.includes(ClassesEnum.resources)
                    )}
                    required={true}
                    onChange={updateFormData}
                  />
                </Grid.Item>
                {formData?.resource?.charges?.limit === Attributes.ability && (
                  <Grid.Item>
                    <Dropdown
                      name='resource.charges.ability'
                      label='Ability'
                      value={formData?.resource?.charges?.ability}
                      options={system.abilities}
                      required={true}
                      onChange={updateFormData}
                    />
                  </Grid.Item>
                )}
                {formData?.resource?.method === Attributes.setAmount && (
                  <Grid.Item>
                    <Input
                      name='resource.charges.setAmount'
                      label='Set Value'
                      validation='num'
                      errorMsg='Must contain whole numbers only'
                      value={formData?.resource?.charges?.setAmount}
                      required={true}
                      onChange={updateFormData}
                      autoComplete='off'
                    />
                  </Grid.Item>
                )}
                <Grid.Item>
                  <Dropdown
                    name='resource.charges.reset'
                    label='Resource Reset Option'
                    value={formData?.resource?.charges?.reset}
                    options={system.charges.resets}
                    required={true}
                    onChange={updateFormData}
                  />
                </Grid.Item>
              </Grid>
            </Grid.Item>
            <Grid.Item>
              <RichTextEditor
                name={'resource.desc'}
                value={formData?.resource?.desc}
                label={'Description'}
                onChange={updateFormData}
              />
            </Grid.Item>
          </Grid>
        </Collapse.Body>
      </Collapse>
    </Grid.Item>
  )
}

export default Resource
