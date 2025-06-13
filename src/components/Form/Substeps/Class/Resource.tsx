import { z } from 'zod/v4'
import Collapsible from '@/components/Collapsible'
import { Attributes, Classes } from '@/enums'
import { Grid } from '@mantine/core'
import { useSystemData } from '@/hooks'
import { withFieldGroup } from '../../utils/factory'
import { ResourceInputSchema } from '@/schemas'

const defaultValues: z.input<typeof ResourceInputSchema> = ResourceInputSchema.parse({})

const Resource = withFieldGroup({
  defaultValues,
  render: function Render({ group }) {
    const { charges, abilities } = useSystemData()
    const { AppField, Subscribe } = group

    return (
      <Grid.Col>
        <Collapsible>
          <Collapsible.Trigger title='Resource Attributes' />
          <Collapsible.Content>
            <Grid>
              <Grid.Col>
                <Grid>
                  <AppField
                    name='label'
                    validators={{
                      onSubmit: ({ value }) => !value && 'Please enter a resource name',
                    }}
                  >
                    {({ TextField }) => (
                      <Grid.Col>
                        <TextField label='Resource Name' required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                  <AppField
                    name='levelAvailable'
                    validators={{
                      onSubmit: ({ value }) => !value && 'Please enter a level the resource becomes available',
                      onChange: z.int('Level must be a whole number').gte(1, 'Level must be greater than 0'),
                    }}
                  >
                    {({ TextField }) => (
                      <Grid.Col>
                        <TextField label='Level Available' required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                  <AppField
                    name='charges.limit'
                    validators={{
                      onSubmit: ({ value }) => !value && 'Please enter a select a resource use limit method',
                    }}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col>
                        <DropdownField
                          label='Resource Limit Method'
                          required={true}
                          options={charges.limits.filter(
                            (limit) => limit?.classes?.length && limit?.classes?.includes(Classes.RESOURCE)
                          )}
                        />
                      </Grid.Col>
                    )}
                  </AppField>
                  <Subscribe
                    selector={(state) => ({
                      charges: state.values.charges,
                      method: state.values.method,
                    })}
                  >
                    {({ charges, method }) =>
                      charges?.limit === Attributes.ABILITY && (
                        <AppField
                          name='charges.ability'
                          validators={{
                            onSubmit: ({ value }) => !value && 'Please select a resource limit ability',
                          }}
                        >
                          {({ DropdownField }) => (
                            <Grid.Col>
                              <DropdownField label='Ability' options={abilities} required={true} />
                            </Grid.Col>
                          )}
                        </AppField>
                      ) &&
                      method === Attributes.SET_AMOUNT && (
                        <AppField
                          name='charges.setAmount'
                          validators={{
                            onSubmit: ({ value }) => !value && 'Please enter an amount of uses',
                            onChange: z
                              .int('Use amount must be a whole number')
                              .gte(1, 'Use amount must be greater than 0'),
                          }}
                        >
                          {({ TextField }) => (
                            <Grid.Col>
                              <TextField label='Set Amount' required={true} />
                            </Grid.Col>
                          )}
                        </AppField>
                      )
                    }
                  </Subscribe>
                  <AppField
                    name='charges.reset'
                    validators={{
                      onSubmit: ({ value }) => !value && 'Please select a use reset option',
                    }}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col>
                        <DropdownField label='Resource Reset Option' required={true} options={charges.resets} />
                      </Grid.Col>
                    )}
                  </AppField>
                </Grid>
              </Grid.Col>
              <AppField name='desc'>
                {({ RichTextEditorField }) => (
                  <Grid.Col>
                    <RichTextEditorField label='Description' />
                  </Grid.Col>
                )}
              </AppField>
            </Grid>
          </Collapsible.Content>
        </Collapsible>
      </Grid.Col>
    )
  },
})

export default Resource
