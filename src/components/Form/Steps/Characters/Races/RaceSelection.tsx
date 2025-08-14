import { Fragment, useState } from 'react'
import { card_group, card_header, card_header_title, main_card, subrace_card, RaceDetail } from '~/components/Form'
import clsx from 'clsx'
import { Categories } from '~/enums'
import type { RaceListItem, CharacterInput } from '~/types'
import { Grid } from '@mantine/core'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import { useListRaces } from '~/apis'
import { useFormField } from '~/hooks'

const RaceSelection = () => {
  const store = useTypedFormStore<CharacterInput>()

  const { AppField } = useFormField({ store })

  const { updateField } = useOptimizedSelector(store, (state) => ({
    updateField: state.updateField,
  }))

  const [race, setRace] = useState<RaceListItem | null>(null)

  const {
    data: { races, metaData },
  } = useListRaces()

  const baseRaces = races.filter((race) =>
    metaData.categories?.filter((c) => c.id === Categories.BASE && c.raceIds?.includes(race.id))
  )

  const subraces = races.filter((race) =>
    metaData.categories?.find((c) => c.id === Categories.SUBRACE && c.raceIds?.includes(race.id))
  )

  return (
    <>
      {baseRaces.map((race, rIndex) => {
        const playable = metaData.playable?.find((p) => p.id === 'false')?.raceIds?.includes(race.id)
        return (
          <Grid.Col key={rIndex} className={card_group}>
            <div
              className={clsx(main_card, {
                ['clickable']: playable,
              })}
              onClick={() => setRace(race)}
            >
              <h3 className={clsx(card_header_title, card_header)}>{race.label}</h3>
            </div>
            <>
              {subraces
                .filter((subrace) =>
                  metaData.lineages?.some((l) => l.raceIds?.includes(subrace.id) && l.id === race.id)
                )
                .map((subrace, sIndex) => {
                  return (
                    <Fragment key={sIndex}>
                      <div className={clsx(subrace_card, main_card, 'clickable')} onClick={() => setRace(subrace)}>
                        <h3 className={clsx(card_header_title, card_header)}>{subrace.label}</h3>
                      </div>
                    </Fragment>
                  )
                })}
            </>
          </Grid.Col>
        )
      })}
      {race && (
        <AppField name='race'>
          {(field) => (
            <RaceDetail
              race={race}
              setRace={() => setRace(null)}
              addRace={() => {
                updateField({ path: 'race', value: race.id })
                field.setValue(race.id)
              }}
            />
          )}
        </AppField>
      )}
    </>
  )
}
export default RaceSelection
