import Collapsible from '@/components/Collapse'
import parse from 'html-react-parser'
import { useBackgroundData, useFieldUpdates } from '@/hooks'
import { Grid } from '@mantine/core'
import {
  withForm,
  option_dropdown,
  CharacterEquipmentOptions,
  CharacterFeatures,
  CharacterCurrency,
} from '@/components/Form'
import { CharacterInputSchema } from '@/schemas'
import { useTypedFormStore } from '@/store'
import type { CharacterInput } from '@/types'
import type { z } from 'zod/v4'

const BackgroundStep = withForm({
  defaultValues: {} as z.input<typeof CharacterInputSchema>,
  render: function Render({ form }) {
    const { AppField } = form

    const store = useTypedFormStore<CharacterInput>()
    const stepIndex = store((state) => state.stepIndex)

    const { fieldListeners } = useFieldUpdates({ data: 'form', stepIndex })

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
  },
})

export default BackgroundStep
