import Collapsible from '@/components/Collapse'
import { Grid } from '@mantine/core'
import { useFieldUpdates, useSystemData } from '@/hooks'
import { collapse_grid, withFieldGroup } from '@/components/Form'
import type { MulticlassInput } from '@/types'
import { useTypedFormStore } from '@/store'
import type { ClassInput } from '@/types'
import { Attributes } from '@/enums'
import { v4 as uuidv4 } from 'uuid'

const Multiclass = withFieldGroup({
  defaultValues: {} as MulticlassInput,
  render: function Render({ group }) {
    const store = useTypedFormStore<ClassInput>()
    const primaryId = store((state) => state.current?.multiclass?.primaryAbility?.id)
    const secondaryId = store((state) => state.current?.multiclass?.secondaryAbility?.id)
    const optionalId = store((state) => state.current?.multiclass?.optionalAbility?.id)
    const attributes = store((state) => state.current?.attributes)
    const { AppField } = group
    const stepIndex = store((state) => state.stepIndex)

    const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'form', path: 'multiclass', stepIndex })

    const { abilities } = useSystemData()

    const secondaryAbility = attributes?.some((attribute) => attribute === Attributes.SECONDARY_ABILITY)
    const optionalAbility = attributes?.some((attribute) => attribute === Attributes.OPTIONAL_ABILITY)

    return (
      <Collapsible
        props={{
          trigger: {
            title: 'Multiclass Ability Requirements',
          },
        }}
      >
        <Grid className={collapse_grid} key={uuidv4()}>
          <AppField
            name='primaryAbility.id'
            validators={fieldValidators({
              onBlur: 'Select the type of action',
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => (
              <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                <DropdownField
                  required={true}
                  label='Primary Ability'
                  options={abilities
                    .filter((ability) => ability.id !== secondaryId)
                    .filter((ability) => ability.id !== optionalId)}
                />
              </Grid.Col>
            )}
          </AppField>
          <AppField
            name='primaryAbility.minAmount'
            validators={fieldValidators({
              onBlur: 'Please set a score requirement',
              onChange: { type: 'integer', min: 1, name: 'Primary Score' },
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => (
              <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                <TextField required={true} label='Primary Score' />
              </Grid.Col>
            )}
          </AppField>
          {secondaryAbility && (
            <>
              <AppField
                name='secondaryAbility.id'
                validators={fieldValidators({
                  onBlur: 'Select the type of action',
                })}
                listeners={fieldListeners}
              >
                {({ DropdownField }) => (
                  <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                    <DropdownField
                      required={true}
                      label='Secondary Ability'
                      options={abilities
                        .filter((ability) => ability.id !== optionalId)
                        .filter((ability) => ability.id !== primaryId)}
                    />
                  </Grid.Col>
                )}
              </AppField>
              <AppField
                name='secondaryAbility.minAmount'
                validators={fieldValidators({
                  onBlur: 'Please set a score requirement',
                  onChange: { type: 'integer', min: 1, name: 'Secondary Score' },
                })}
                listeners={fieldListeners}
              >
                {({ TextField }) => (
                  <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                    <TextField required={true} label='Secondary Score' />
                  </Grid.Col>
                )}
              </AppField>
            </>
          )}
          {optionalAbility && (
            <>
              <AppField
                name='optionalAbility.id'
                validators={fieldValidators({
                  onBlur: 'Select the type of action',
                })}
                listeners={fieldListeners}
              >
                {({ DropdownField }) => (
                  <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                    <DropdownField
                      required={true}
                      label='Optional Ability'
                      options={abilities
                        .filter((ability) => ability.id !== secondaryId)
                        .filter((ability) => ability.id !== primaryId)}
                    />
                  </Grid.Col>
                )}
              </AppField>
              <AppField
                name='optionalAbility.minAmount'
                validators={fieldValidators({
                  onBlur: 'Please set a minimum score requirement',
                  onChange: { type: 'integer', min: 1, name: 'Optional Score' },
                })}
                listeners={fieldListeners}
              >
                {({ TextField }) => (
                  <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                    <TextField required={true} label='Optional Score' />
                  </Grid.Col>
                )}
              </AppField>
            </>
          )}
        </Grid>
      </Collapsible>
    )
  },
})

export default Multiclass
