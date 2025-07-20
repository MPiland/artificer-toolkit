import parse from 'html-react-parser'
import Collapsible from '@/components/Collapse'
import { option_dropdown, CharacterFeatures, withForm } from '@/components/Form'
import { Grid } from '@mantine/core'
import { useGetFeatures, useRaceData, useFieldUpdates, useFeatureData } from '@/hooks'
import { CharacterInputSchema } from '@/schemas'
import { useTypedFormStore } from '@/store'
import { z } from 'zod/v4'
import type { CharacterInput } from '@/types'

const RaceFeatures = withForm({
  defaultValues: {} as z.input<typeof CharacterInputSchema>,
  render: function Render({ form }) {
    const { AppField } = form

    const store = useTypedFormStore<CharacterInput>()
    const stepIndex = store((state) => state.stepIndex)
    const current = store((state) => state.current)

    const { fieldListeners } = useFieldUpdates({ data: 'form', stepIndex })

    const {
      races: { findRace, findLineages },
    } = useRaceData()
    const { createFeatures } = useGetFeatures()
    const {
      ancestryOptions: { findAncestryOption, findAncestryOptions },
    } = useFeatureData()

    const features = createFeatures({ data: current || undefined })

    const raceLineages = findLineages(current?.race || '') || []

    const fullRace = findRace(current?.race || '')

    const fullAncestry = findAncestryOption(current?.ancestry?.id || '')

    return (
      <>
        {raceLineages?.length &&
          raceLineages?.map((l, index) => {
            const lineage = findRace(l.id)
            return (
              lineage?.ancestry?.options?.length && (
                <Grid.Col key={index}>
                  <Collapsible
                    props={{
                      trigger: {
                        title: lineage?.ancestry.label,
                      },
                    }}
                  >
                    <Grid>
                      <Grid.Col>{lineage?.ancestry.desc && parse(lineage?.ancestry.desc)}</Grid.Col>
                      <AppField name='ancestry.id' listeners={fieldListeners}>
                        {({ DropdownField }) => (
                          <Grid.Col>
                            <DropdownField
                              label='Ancestry Option'
                              className={option_dropdown}
                              options={findAncestryOptions(lineage?.ancestry?.options) || []}
                            />
                          </Grid.Col>
                        )}
                      </AppField>
                      {fullAncestry && (
                        <Grid.Col>
                          <strong>{fullAncestry.desc && parse(fullAncestry.desc)}</strong>
                        </Grid.Col>
                      )}
                    </Grid>
                  </Collapsible>
                </Grid.Col>
              )
            )
          })}
        {fullRace?.ancestry?.options?.length && (
          <Grid.Col>
            <Collapsible
              props={{
                trigger: {
                  title: fullRace.ancestry.label,
                },
              }}
            >
              <Grid>
                <Grid.Col>{fullRace.ancestry.desc && parse(fullRace.ancestry.desc)}</Grid.Col>
                <AppField name='ancestry.id' listeners={fieldListeners}>
                  {({ DropdownField }) => (
                    <Grid.Col>
                      <DropdownField
                        label='Ancestry Option'
                        className={option_dropdown}
                        options={findAncestryOptions(fullRace.ancestry?.options) || []}
                      />
                    </Grid.Col>
                  )}
                </AppField>
                {fullAncestry && (
                  <Grid.Col>
                    <strong>{fullAncestry?.desc && parse(fullAncestry?.desc)}</strong>
                  </Grid.Col>
                )}
              </Grid>
            </Collapsible>
          </Grid.Col>
        )}
        {features?.filter((f) => f?.raceId === fullRace?.id)?.length && (
          <CharacterFeatures
            raceId={fullRace?.id}
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
          />
        )}
        {fullAncestry && features?.filter((feature) => feature?.ancestryId != null)?.length && (
          <CharacterFeatures
            raceId={fullRace?.id}
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
          />
        )}
      </>
    )
  },
})
export default RaceFeatures
