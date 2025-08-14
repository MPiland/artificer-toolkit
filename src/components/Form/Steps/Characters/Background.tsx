import Collapsible from '~/components/Collapse'
import parse from 'html-react-parser'
import { useFieldUpdates, useFormField } from '~/hooks'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import { useListBackgrounds, useGetBackground } from '~/apis'
import { Grid } from '@mantine/core'
import { option_dropdown, CharacterEquipmentOptions, CharacterFeatures, CharacterCurrency } from '~/components/Form'
import type { CharacterInput } from '~/types'

const BackgroundStep = () => {
  const store = useTypedFormStore<CharacterInput>()

  const { AppField } = useFormField({ store })

  const backgroundId = useOptimizedSelector(store, (state) => state.current?.background)

  const { fieldListeners } = useFieldUpdates()

  // Get list of all backgrounds for dropdown
  const {
    data: { backgrounds },
  } = useListBackgrounds()

  // Get specific background data if ID exists
  const backgroundQuery = useGetBackground(backgroundId || '')
  const backgroundData = backgroundId ? backgroundQuery.data : null

  return (
    <Grid>
      <AppField name='background' listeners={fieldListeners}>
        {({ DropdownField }) => {
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
                      featuresArray.state.value?.length && <CharacterFeatures backgroundId={backgroundData.id} />
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
                        <CharacterEquipmentOptions dataSource={backgroundData} />
                      </Grid>
                    </Collapsible>
                  </Grid.Col>
                  <CharacterCurrency />
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
