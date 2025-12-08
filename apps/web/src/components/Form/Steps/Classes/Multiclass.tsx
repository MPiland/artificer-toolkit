import Collapsible from '~components/Collapse'
import { Grid } from '@mantine/core'
import { useFieldUpdates, useFormField, useSystemData } from '~hooks'
import { collapse_grid } from '~components/Form'
import { useOptimizedSelector, useTypedFormStore } from '~store'
import type { ClassInput } from '~types'
import { Attributes } from '~enums'
import { v4 as uuidv4 } from 'uuid'

const Multiclass = () => {
  const store = useTypedFormStore<ClassInput>()

  const { AppField } = useFormField({ store })

  const { primaryId, secondaryId, optionalId, attributes } = useOptimizedSelector(store, (state) => ({
    primaryId: state.current?.multiclass?.primaryAbility?.id,
    secondaryId: state.current?.multiclass?.secondaryAbility?.id,
    optionalId: state.current?.multiclass?.optionalAbility?.id,
    attributes: state.current?.attributes,
  }))

  const { fieldListeners, fieldValidators } = useFieldUpdates()

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
          name='multiclass.primaryAbility.id'
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
          name='multiclass.primaryAbility.minAmount'
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
              name='multiclass.secondaryAbility.id'
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
              name='multiclass.secondaryAbility.minAmount'
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
              name='multiclass.optionalAbility.id'
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
              name='multiclass.optionalAbility.minAmount'
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
}

export default Multiclass
