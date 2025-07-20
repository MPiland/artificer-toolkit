import CharacterClass from './CharacterClass'
import { withForm } from '@/components/Form'
import { Grid } from '@mantine/core'
import { CharacterInputSchema } from '@/schemas'
import { useTypedFormStore } from '@/store'
import { z } from 'zod/v4'
import { CharacterInput } from '@/types'

const ClassesStep = withForm({
  defaultValues: {} as z.input<typeof CharacterInputSchema>,
  render: function Render({ form }) {
    const { AppField } = form

    const store = useTypedFormStore<CharacterInput>()
    const removeField = store((state) => state.removeField)

    return (
      <Grid>
        <AppField name='classes' mode='array'>
          {(field) =>
            field.state.value?.length &&
            field.state.value?.map(
              (c, i) =>
                c && (
                  <CharacterClass
                    form={form}
                    fields={{
                      classInput: `classes[${i}]`,
                      features: 'features',
                      modifiers: 'modifiers',
                      expertise: 'expertise',
                      proficiencies: 'proficiencies',
                      senses: 'senses',
                      feats: 'feats',
                      spellcasting: 'spellcasting',
                      abilities: 'abilities',
                    }}
                    classIndex={i}
                    key={i}
                    removeFn={() => {
                      if (field.state.value?.length === 1) {
                        removeField({ path: 'classes' })
                        field.setValue([])
                      } else {
                        removeField({ path: `classes[${i}]` })
                        field.removeValue(i)
                      }
                    }}
                  />
                )
            )
          }
        </AppField>
      </Grid>
    )
  },
})

export default ClassesStep
