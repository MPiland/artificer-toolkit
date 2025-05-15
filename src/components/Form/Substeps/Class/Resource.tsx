import Collapsible from '@/components/Collapsible'
import Input from '@/components/Input'
import Dropdown from '@/components/Dropdown'
import RichTextEditor from '@/components/RichTextEditor'
import { Attributes, Classes } from '@/enums'
import { Grid } from '@mantine/core'
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
    <Grid.Col>
      <Collapsible defaultOpen={data.id == null} >
        <Collapsible.Trigger title='Resource Attributes' />
        <Collapsible.Content>
          <Grid>
            <Grid.Col>
              <Grid>
                <Grid.Col>
                  <Input
                    name='resource.label'
                    label='Resource Name'
                    autoComplete='off'
                    value={data?.resource?.label}
                    required={true}
                    onChange={{ updateField }}
                  />
                </Grid.Col>
                <Grid.Col>
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
                </Grid.Col>
                <Grid.Col>
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
                </Grid.Col>
                {data?.resource?.charges?.limit === Attributes.ABILITY && (
                  <Grid.Col>
                    <Dropdown
                      name='resource.charges.ability'
                      label='Ability'
                      value={data?.resource?.charges?.ability}
                      options={abilities}
                      required={true}
                      onChange={{ updateField, removeField }}
                    />
                  </Grid.Col>
                )}
                {data?.resource?.method === Attributes.SET_AMOUNT && (
                  <Grid.Col>
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
                  </Grid.Col>
                )}
                <Grid.Col>
                  <Dropdown
                    name='resource.charges.reset'
                    label='Resource Reset Option'
                    value={data?.resource?.charges?.reset}
                    options={charges.resets}
                    required={true}
                    onChange={{ updateField, removeField }}
                  />
                </Grid.Col>
              </Grid>
            </Grid.Col>
            <Grid.Col>
              <RichTextEditor
                name={'resource.desc'}
                value={data?.resource?.desc}
                label={'Description'}
                onChange={{ updateField }}
              />
            </Grid.Col>
          </Grid>
        </Collapsible.Content>
      </Collapsible>
    </Grid.Col>
  )
}

export default Resource
