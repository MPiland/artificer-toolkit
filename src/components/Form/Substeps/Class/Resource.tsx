import Collapse from '@/components/Collapse'
import Input from '@/components/Input'
import Dropdown from '@/components/Dropdown'
import RichTextEditor from '@/components/RichTextEditor'
import { Attributes, Classes } from '@/enums'
import Grid from '@/components/Grid'
import { useSystemData } from '@/hooks'
import type { OnChange, Class } from '@/types'

const Resource = ({
  formStore: { data, updateField, removeField },
}: {
  formStore: {
    data: Class
    updateField: OnChange<Class>['updateField']
    removeField: OnChange<Class>['removeField']
  }
}) => {
  const { charges, abilities } = useSystemData()

  return (
    <Grid.Item>
      <Collapse>
        <Collapse.Header startOpened={data.id == null} title='Resource Attributes' />
        <Collapse.Body>
          <Grid>
            <Grid.Item>
              <Grid>
                <Grid.Item>
                  <Input
                    name='resource.label'
                    label='Resource Name'
                    autoComplete='off'
                    value={data?.resource?.label}
                    required={true}
                    onChange={{ updateField }}
                  />
                </Grid.Item>
                <Grid.Item>
                  <Input
                    name='resource.levelAvailable'
                    label='Level Available'
                    autoComplete='off'
                    value={data?.resource?.levelAvailable}
                    required={true}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={{ updateField }}
                  />
                </Grid.Item>
                <Grid.Item>
                  <Dropdown
                    name='resource.charges.limit'
                    label='Resource Limit Method'
                    value={data?.resource?.charges?.limit}
                    options={charges.limits.filter(
                      (limit) => limit?.classes?.length && limit?.classes?.includes(Classes.RESOURCE)
                    )}
                    required={true}
                    onChange={{ updateField, removeField }}
                  />
                </Grid.Item>
                {data?.resource?.charges?.limit === Attributes.ABILITY && (
                  <Grid.Item>
                    <Dropdown
                      name='resource.charges.ability'
                      label='Ability'
                      value={data?.resource?.charges?.ability}
                      options={abilities}
                      required={true}
                      onChange={{ updateField, removeField }}
                    />
                  </Grid.Item>
                )}
                {data?.resource?.method === Attributes.SET_AMOUNT && (
                  <Grid.Item>
                    <Input
                      name='resource.charges.setAmount'
                      label='Set Value'
                      validation='num'
                      errorMsg='Must contain whole numbers only'
                      value={data?.resource?.charges?.setAmount}
                      required={true}
                      onChange={{ updateField }}
                      autoComplete='off'
                    />
                  </Grid.Item>
                )}
                <Grid.Item>
                  <Dropdown
                    name='resource.charges.reset'
                    label='Resource Reset Option'
                    value={data?.resource?.charges?.reset}
                    options={charges.resets}
                    required={true}
                    onChange={{ updateField, removeField }}
                  />
                </Grid.Item>
              </Grid>
            </Grid.Item>
            <Grid.Item>
              <RichTextEditor
                name={'resource.desc'}
                value={data?.resource?.desc}
                label={'Description'}
                onChange={{ updateField }}
              />
            </Grid.Item>
          </Grid>
        </Collapse.Body>
      </Collapse>
    </Grid.Item>
  )
}

export default Resource
