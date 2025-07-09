import Collapsible from '@/components/Collapsible'
import parse from 'html-react-parser'
import { useBackgroundData, useGetFeatures, useFieldUpdates } from '@/hooks'
import { Grid } from '@mantine/core'
import {
  useAppForm,
  option_dropdown,
  CharacterEquipmentOptions,
  CharacterFeature,
  CharacterCurrency,
} from '@/components/Form'
import { CharacterInputSchema } from '@/schemas'
import { useStore } from '@tanstack/react-form'
import { useFormStore } from '@/store'
import { useEffect } from 'react'

const BackgroundStep = () => {
  const formStore = useFormStore()

  const form = useAppForm({
    defaultValues: CharacterInputSchema.parse(formStore.current),
  })

  const { AppField, Subscribe } = form

  const { fieldListeners } = useFieldUpdates({ data: 'form' })

  useEffect(() => {
    formStore.registerForm(form.reset)
  }, [form.reset, formStore])

  const { isValid } = useStore(form.store, (state) => ({
    isValid: state.isValid,
  }))

  useEffect(() => {
    formStore.setValidForm(isValid)
  }, [formStore, isValid])

  const { backgrounds } = useBackgroundData()
  const values = useStore(form.store, (state) => state.values)
  const { createFeatures } = useGetFeatures()

  const features = createFeatures({ data: values })

  return (
    <Grid>
      <AppField
        name='background'
        listeners={fieldListeners}
      >
        {({ DropdownField }) => (
          <Grid.Col>
            <DropdownField label='Background' options={backgrounds} className={option_dropdown} />
          </Grid.Col>
        )}
      </AppField>
      <Subscribe selector={(state) => state.values.background}>
        {(background) => {
          const backgroundData = backgrounds.findBackground(background)
          if (backgroundData) {
            return (
              <>
                {backgroundData?.desc && (
                  <Grid.Col>
                    <Collapsible>
                      <Collapsible.Trigger title='Description' />
                      <Collapsible.Content>{backgroundData?.desc && parse(backgroundData?.desc)}</Collapsible.Content>
                    </Collapsible>
                  </Grid.Col>
                )}
                {features?.map((f, i) => {
                  return (
                    <CharacterFeature
                      key={`${i}-character-feature`}
                      form={form}
                      fields={{
                        modifiers: 'modifiers',
                        expertise: 'expertise',
                        spellcasting: 'spellcasting',
                        proficiencies: 'proficiencies',
                        senses: 'senses',
                        features: 'features',
                        abilities: 'abilities',
                        feats: 'feats',
                      }}
                      backgroundId={background}
                      feature={f}
                    />
                  )
                })}
                <Grid.Col>
                  <Collapsible>
                    <Collapsible.Trigger title='Starting Equipment' />
                    <Collapsible.Content>
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
                    </Collapsible.Content>
                  </Collapsible>
                </Grid.Col>
                <CharacterCurrency form={form} fields='currencyGroups' />
              </>
            )
          } else {
            return null
          }
        }}
      </Subscribe>
    </Grid>
  )
}

export default BackgroundStep
