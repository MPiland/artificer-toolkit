import { SpellReqs } from '~/enums'
import { useFieldUpdates, useFormField, useSystemData } from '~/hooks'
import { Grid } from '@mantine/core'
import { useListClasses } from '~/apis'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import type { SpellInput } from '~/types'

const DetailsStep = () => {
  const store = useTypedFormStore<SpellInput>()
  const { AppField } = useFormField({ store })
  const requirements = useOptimizedSelector(store, (state) => state.current?.requirements)

  const { fieldValidators, fieldListeners } = useFieldUpdates()

  const { spells } = useSystemData()
  const {
    data: { classes },
  } = useListClasses()

  return (
    <Grid>
      <AppField
        name='label'
        validators={fieldValidators({
          onBlur: 'Please enter a name',
        })}
        listeners={fieldListeners}
      >
        {({ TextField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <TextField label='Name' required={true} />
          </Grid.Col>
        )}
      </AppField>
      <AppField
        name='level'
        validators={fieldValidators({
          onBlur: 'Please enter a spell level',
          onChange: { type: 'integer', name: 'Spell level', min: 0 },
        })}
        listeners={fieldListeners}
      >
        {({ TextField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <TextField label='Level' required={true} />
          </Grid.Col>
        )}
      </AppField>
      <AppField
        name='school'
        validators={fieldValidators({
          onBlur: 'Please select a spell school',
        })}
        listeners={fieldListeners}
      >
        {({ DropdownField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <DropdownField label='School' required={true} options={spells.schools} />
          </Grid.Col>
        )}
      </AppField>
      <AppField name='requirements' listeners={fieldListeners}>
        {({ DropdownField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <DropdownField label='Requirements' options={spells.requirements} multiselect={true} />
          </Grid.Col>
        )}
      </AppField>
      <AppField
        name='classes'
        validators={fieldValidators({
          onBlur: 'Please select at least one class',
        })}
        listeners={fieldListeners}
      >
        {({ DropdownField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <DropdownField label='Class(es)' options={classes} multiselect={true} required={true} />
          </Grid.Col>
        )}
      </AppField>
      {requirements?.some((requirement) => requirement === SpellReqs.MATERIAL) && (
        <AppField
          name='materialDesc'
          validators={fieldValidators({
            onBlur: 'Please enter a material requirement description',
          })}
          listeners={fieldListeners}
        >
          {({ TextField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <TextField label='Material Desc.' required={true} />
            </Grid.Col>
          )}
        </AppField>
      )}
      <AppField name='desc' listeners={fieldListeners}>
        {({ RichTextField }) => (
          <Grid.Col>
            <RichTextField label='Description' />
          </Grid.Col>
        )}
      </AppField>
    </Grid>
  )
}
export default DetailsStep
