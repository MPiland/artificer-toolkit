import { Scene } from '@/components/Dice'
import { createPortal } from 'react-dom'
import { AbilityGenMethods } from '@/enums'
import Collapsible from '@/components/Collapsible'
import { useSystemData, useFieldUpdates } from '@/hooks'
import { Grid } from '@mantine/core'
import { CharacterInputSchema } from '@/schemas'
import { useAppForm, StandardArray, ManualArray, AbilityCard, PointBuy } from '@/components/Form'
import { useFormStore } from '@/store'
import { useEffect } from 'react'
import { useStore } from '@tanstack/react-form'

const AbilitiesStep = () => {
  const formStore = useFormStore()

  const form = useAppForm({
    defaultValues: CharacterInputSchema.parse(formStore.current),
  })

  const { AppField, Subscribe } = form

  const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'form' })

  const {
    rules,
    abilities: { findAbility },
  } = useSystemData()

  const formType: HTMLFormElement = document.getElementById('form-content') as HTMLFormElement

  useEffect(() => {
    formStore.registerForm(form.reset)
  }, [form.reset, formStore])

  const { isValid } = useStore(form.store, (state) => ({
    isValid: state.isValid,
  }))

  useEffect(() => {
    formStore.setValidForm(isValid)
  }, [formStore, isValid])

  return (
    <Grid>
      {formType && createPortal(<Scene />, formType)}
      <Subscribe selector={(state) => state.values.abilities?.selectedSystem}>
        {(selectedSystem) => (
          <>
            <Grid.Col>
              <Grid>
                <AppField
                  name='abilities.selectedSystem'
                  validators={fieldValidators({
                    onBlur: 'Please select an ability point system',
                  })}
                  listeners={fieldListeners}
                >
                  {({ DropdownField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <DropdownField options={rules.abilityGenerateMethod} label='Point System' />
                    </Grid.Col>
                  )}
                </AppField>
                {selectedSystem === AbilityGenMethods.MANUAL && (
                  <AppField
                    name='abilities.manualRolled.configuration'
                    validators={fieldValidators({
                      onChange: { type: 'roll', name: 'Roll configuration' },
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <TextField label='Roll Configuration' />
                      </Grid.Col>
                    )}
                  </AppField>
                )}
              </Grid>
            </Grid.Col>
            {selectedSystem === AbilityGenMethods.POINT_BUY && <PointBuy form={form} fields='abilities' />}
            {selectedSystem === AbilityGenMethods.MANUAL && <ManualArray form={form} fields='abilities' />}
            {selectedSystem === AbilityGenMethods.STANDARD_ARRAY && <StandardArray form={form} fields='abilities' />}
            <Grid.Col>
              <Collapsible defaultOpen={true}>
                <Collapsible.Trigger title='Abilities' />
                <Collapsible.Content>
                  <Grid>
                    <AppField name='abilities.scores' mode='array'>
                      {(field) =>
                        field.state.value?.map((score, index) => {
                          const ability = findAbility(score.ability)
                          if (ability) {
                            return <AbilityCard key={index} score={score} ability={ability} />
                          }
                        })
                      }
                    </AppField>
                  </Grid>
                </Collapsible.Content>
              </Collapsible>
            </Grid.Col>
          </>
        )}
      </Subscribe>
    </Grid>
  )
}

export default AbilitiesStep
