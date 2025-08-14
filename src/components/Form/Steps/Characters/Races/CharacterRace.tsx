import parse from 'html-react-parser'
import Collapsible from '~/components/Collapse'
import { option_dropdown, CharacterFeatures } from '~/components/Form'
import { Grid } from '@mantine/core'
import { useFieldUpdates, useCharacterFeatures, useFormField } from '~/hooks'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import type { AncestryOption, CharacterInput } from '~/types'
import { fetchRace, queryClient, useGetAncestryOption, useGetRace, useListRaces } from '~/apis'
import { useSuspenseQueries } from '@tanstack/react-query'

const CharacterRace = () => {
  const store = useTypedFormStore<CharacterInput>()

  const { AppField } = useFormField({ store })

  // Use optimized selector to get current character data with shallow comparison
  const { raceId, ancestryId } = useOptimizedSelector(store, (state) => ({
    raceId: state.current?.race || '',
    ancestryId: state.current?.ancestry?.id || '',
  }))

  const { fieldListeners } = useFieldUpdates()
  const {
    data: { metaData },
  } = useListRaces()

  const { data: features } = useCharacterFeatures()
  const { data: fullRace } = useGetRace(raceId)
  const { data: fullAncestry } = useGetAncestryOption(ancestryId)

  const ancestryOptions: AncestryOption[] = []

  const raceLineageIds = metaData.lineages?.filter((l) => l.raceIds?.includes(raceId)).map((l) => l.id)

  const { data: lineages } = useSuspenseQueries({
    queries:
      raceLineageIds?.map((id) => ({
        queryKey: ['race-lineage', id],
        queryFn: () => queryClient.fetchQuery(fetchRace(id)),
      })) || [],
    combine: (results) => ({
      data: results.map((result) => result.data),
    }),
  })

  lineages?.forEach((l) => {
    if (l?.ancestry?.options?.length) {
      ancestryOptions.push(...l.ancestry.options)
    }
  })

  return (
    <>
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
                      options={fullRace.ancestry?.options || []}
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
      {features?.filter((f) => f?.raceId === fullRace?.id)?.length && <CharacterFeatures raceId={fullRace?.id} />}
      {fullAncestry && features?.filter((feature) => feature?.ancestryId != null)?.length && (
        <CharacterFeatures ancestryId={fullAncestry?.id} />
      )}
    </>
  )
}
export default CharacterRace
