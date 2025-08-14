import { Scene } from '~/components/Dice'
import { createPortal } from 'react-dom'
import { AbilityGenMethods } from '~/enums'
import Collapsible from '~/components/Collapse'
import { useSystemData, useFieldUpdates, useFormField } from '~/hooks'
import { Grid } from '@mantine/core'
import { StandardArray, ManualArray, AbilityCard, PointBuy } from '~/components/Form'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import { CharacterInput } from '~/types'

const AbilitiesStep = () => {
  const store = useTypedFormStore<CharacterInput>()

  const { AppField } = useFormField({ store })

  const { selectedSystem } = useOptimizedSelector(store, (state) => ({
    selectedSystem: state.current?.abilities?.selectedSystem,
  }))

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const {
    rules,
    abilities: { findAbility },
  } = useSystemData()

  const formType: HTMLFormElement = document.getElementById('form-content') as HTMLFormElement

  return (
    <Grid>
      {formType && createPortal(<Scene />, formType)}
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
        {selectedSystem === AbilityGenMethods.POINT_BUY && <PointBuy />}
        {selectedSystem === AbilityGenMethods.MANUAL && <ManualArray />}
        {selectedSystem === AbilityGenMethods.STANDARD_ARRAY && <StandardArray />}
        <Grid.Col>
          <Collapsible
            props={{
              trigger: {
                title: 'Abilities',
              },
            }}
          >
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
          </Collapsible>
        </Grid.Col>
      </>
    </Grid>
  )
}

export default AbilitiesStep
