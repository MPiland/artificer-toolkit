import CharacterClass from './CharacterClass'
import { useAppForm } from '@/components/Form'
import { Grid } from '@mantine/core'
import { CharacterInputSchema } from '@/schemas'
import { useFormStore } from '@/store'
import type { CharacterInput } from '@/types'
import { useEffect } from 'react'

const ClassesStep = () => {
  const formStore = useFormStore()

  const form = useAppForm({
    defaultValues: CharacterInputSchema.parse(formStore.current as CharacterInput),
  })

  const { AppField } = form

  useEffect(() => {
    if (!formStore.steps[formStore.stepIndex].reset) {
      formStore.registerForm(form.reset)
    }
  }, [form.reset, formStore, form])

  useEffect(() => {
    return form.store.subscribe((state) => {
      const isValid = state.currentVal.isValid
      if (formStore.steps[formStore.stepIndex].isValid !== isValid) {
        formStore.setValidForm(isValid)
      }
    })
  }, [formStore, form.store])

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
                      formStore.removeField({ path: 'classes' })
                      field.setValue([])
                    } else {
                      formStore.removeField({ path: `classes[${i}]` })
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
}

export default ClassesStep
