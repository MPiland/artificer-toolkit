import { useSystemData, useFieldUpdates, useFormField } from '~hooks'
import { Grid } from '@mantine/core'
import { useTypedFormStore } from '~store'
import type { CharacterInput } from '~types'

const DetailsStep = () => {
  const store = useTypedFormStore<CharacterInput>()

  const { AppField } = useFormField({ store })

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const { characters } = useSystemData()

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
        name='advancement'
        validators={fieldValidators({
          onBlur: 'Please select a level advancement method',
        })}
        listeners={fieldListeners}
      >
        {({ DropdownField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <DropdownField label='Advancement Type' options={characters.advancementMethods} required={true} />
          </Grid.Col>
        )}
      </AppField>
      <AppField
        name='hitpoint.method'
        validators={fieldValidators({
          onBlur: 'Please select a hitpoint calculation method',
        })}
        listeners={fieldListeners}
      >
        {({ DropdownField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <DropdownField label='Hit Point Type' options={characters.hitpointCalcMethods} required={true} />
          </Grid.Col>
        )}
      </AppField>
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
