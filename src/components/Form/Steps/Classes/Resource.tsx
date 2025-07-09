import Collapsible from '@/components/Collapsible'
import { Attributes, Classes } from '@/enums'
import { Grid } from '@mantine/core'
import { useSystemData, useFieldUpdates } from '@/hooks'
import { withFieldGroup } from '@/components/Form'
import type { ResourceInput } from 'gql/types'

const Resource = withFieldGroup({
  defaultValues: {} as ResourceInput,
  render: function Render({ group }) {
    const { AppField, Subscribe } = group

    const { fieldListeners, fieldValidators } = useFieldUpdates({  data: 'form', path: 'resource' })

    const { charges, abilities } = useSystemData()

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
                    validators={fieldValidators({
                      onBlur: 'Please enter a resource name',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => (
                      <Grid.Col>
                        <TextField label='Resource Name' required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                  <AppField
                    name='levelAvailable'
                    validators={fieldValidators({
                      onBlur: 'Please enter a level the resource becomes available',
                      onChange: { type: 'number', min: 1, name: 'Level Available' },
                    })}
                    listeners={fieldListeners}
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
                      onBlur: ({ value }) => !value && 'Please enter a select a resource use limit method',
                    }}
                    listeners={fieldListeners}
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
                          validators={fieldValidators({
                            onBlur: 'Please select a resource limit ability',
                          })}
                          listeners={fieldListeners}
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
                          validators={fieldValidators({
                            onBlur: 'Please enter an amount of uses',
                            onChange: { type: 'integer', min: 1, name: 'Use Amount' },
                          })}
                          listeners={fieldListeners}
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
                    validators={fieldValidators({
                      onBlur: 'Please select a resource reset option',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col>
                        <DropdownField label='Resource Reset Option' required={true} options={charges.resets} />
                      </Grid.Col>
                    )}
                  </AppField>
                </Grid>
              </Grid.Col>
              <AppField name='desc' listeners={fieldListeners}>
                {({ RichTextField }) => (
                  <Grid.Col>
                    <RichTextField label='Description' />
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
