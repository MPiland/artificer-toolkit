import Collapsible from '@/components/Collapse'
import parse from 'html-react-parser'
import { useBackgroundData, useFieldUpdates } from '@/hooks'
import { Grid } from '@mantine/core'
import {
  useAppForm,
  option_dropdown,
  CharacterEquipmentOptions,
  CharacterFeatures,
  CharacterCurrency,
} from '@/components/Form'
import { CharacterInputSchema } from '@/schemas'
import { useFormStore } from '@/store'
import { useEffect } from 'react'
import type {
  CharacterInput,
  CharacterFeatureInput,
  CharacterEquipmentInput,
  BackgroundStartingEquipmentInput,
  CurrencyGroupInput,
  CharacterModifierInput,
  CharacterExpertiseInput,
  CharacterProficiencyInput,
  CharacterSenseInput,
  CharacterFeatInput,
  CharacterSpellcastingInput,
  CharacterAbilitiesInput,
} from '@/types'

const BackgroundStep = () => {
  const formStore = useFormStore()

  const currentData = CharacterInputSchema.parse(formStore.current as CharacterInput)

  const form = useAppForm({
    defaultValues: {
      background: currentData.background as string | null,
      features: currentData.features as CharacterFeatureInput[] | null,
      equipment: currentData.equipment as CharacterEquipmentInput | null,
      backgroundEquipment: currentData.backgroundEquipment as BackgroundStartingEquipmentInput | null,
      currencyGroups: currentData.currencyGroups as CurrencyGroupInput[] | null,
      modifiers: currentData.modifiers as CharacterModifierInput[] | null,
      expertise: currentData.expertise as CharacterExpertiseInput[] | null,
      proficiencies: currentData.proficiencies as CharacterProficiencyInput[] | null,
      senses: currentData.senses as CharacterSenseInput[] | null,
      feats: currentData.feats as CharacterFeatInput[] | null,
      spellcasting: currentData.spellcasting as CharacterSpellcastingInput | null,
      abilities: currentData.abilities as CharacterAbilitiesInput | null,
    },
  })

  const { AppField } = form

  const { fieldListeners } = useFieldUpdates({ data: 'form' })

  useEffect(() => {
    if (!formStore.steps[formStore.stepIndex].reset) {
      formStore.registerForm(form.reset)
    }
  }, [form.reset, formStore])

  useEffect(() => {
    return form.store.subscribe((state) => {
      const isValid = state.currentVal.isValid
      if (formStore.steps[formStore.stepIndex].isValid !== isValid) {
        formStore.setValidForm(isValid)
      }
    })
  }, [formStore, form.store])

  const { backgrounds } = useBackgroundData()

  return (
    <Grid>
      <AppField name='background' listeners={fieldListeners}>
        {({ DropdownField, state }) => {
          const backgroundData = backgrounds.findBackground(state.value)
          return (
            <>
              <Grid.Col>
                <DropdownField label='Background' options={backgrounds} className={option_dropdown} />
              </Grid.Col>
              {backgroundData && (
                <>
                  {backgroundData?.desc && (
                    <Grid.Col>
                      <Collapsible
                        props={{
                          trigger: {
                            title: 'Description',
                          },
                        }}
                      >
                        {backgroundData?.desc && parse(backgroundData?.desc)}
                      </Collapsible>
                    </Grid.Col>
                  )}
                  <AppField name='features' mode='array'>
                    {(featuresArray) =>
                      featuresArray.state.value?.length && (
                        <CharacterFeatures
                          form={form}
                          fields={{
                            features: 'features',
                            modifiers: 'modifiers',
                            expertise: 'expertise',
                            proficiencies: 'proficiencies',
                            senses: 'senses',
                            feats: 'feats',
                            spellcasting: 'spellcasting',
                            abilities: 'abilities',
                          }}
                          backgroundId={backgroundData.id}
                        />
                      )
                    }
                  </AppField>
                  <Grid.Col>
                    <Collapsible
                      props={{
                        trigger: {
                          title: 'Starting Equipment',
                        },
                      }}
                    >
                      <Grid>
                        <CharacterEquipmentOptions
                          form={form}
                          dataSource={backgroundData}
                          fields={{
                            equipment: 'backgroundEquipment',
                            currencyGroups: 'currencyGroups',
                            characterInventory: 'equipment.inventory',
                          }}
                        />
                      </Grid>
                    </Collapsible>
                  </Grid.Col>
                  <CharacterCurrency form={form} fields='currencyGroups' />
                </>
              )}
            </>
          )
        }}
      </AppField>
    </Grid>
  )
}

export default BackgroundStep
