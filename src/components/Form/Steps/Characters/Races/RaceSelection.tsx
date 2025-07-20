import { Fragment, useState } from 'react'
import {
  card_group,
  card_header,
  card_header_title,
  main_card,
  subrace_card,
  RaceDetail,
  withForm,
} from '@/components/Form'
import clsx from 'clsx'
import { Categories } from '@/enums'
import type { RaceListItem, CharacterInput } from '@/types'
import { Grid } from '@mantine/core'
import { useRaceData } from '@/hooks'
import { CharacterInputSchema } from '@/schemas'
import { useTypedFormStore } from '@/store'
import { z } from 'zod/v4'

const RaceSelection = withForm({
  defaultValues: {} as z.input<typeof CharacterInputSchema>,
  render: function Render({ form }) {
    const { AppField } = form

    const store = useTypedFormStore<CharacterInput>()
    const updateField = store((state) => state.updateField)

    const [race, setRace] = useState<RaceListItem | null>(null)

    const {
      baseRaces,
      subraces,
      races: { findByLineage, findLineages },
      metaData,
    } = useRaceData()

    const findLineage = (id: string) => {
      const lineages = findByLineage(id)
      if (lineages?.length) {
        return lineages
      }
      return null
    }

    return (
      <>
        {baseRaces.map((race, rIndex) => {
          if (metaData.categories?.find((c) => c.id === Categories.BASE)?.raceIds?.includes(race.id)) {
            return (
              <Grid.Col key={rIndex} className={card_group}>
                <div
                  className={clsx(main_card, {
                    ['clickable']: metaData.playable?.find((p) => p.id === 'false')?.raceIds?.includes(race.id),
                  })}
                  onClick={() => !findLineage(race.id)?.length && setRace(race)}
                >
                  <h3 className={clsx(card_header_title, card_header)}>{race.label}</h3>
                </div>
                <>
                  {subraces.map((subrace, sIndex) => {
                    const lineages = findLineages(subrace?.id)
                    return (
                      lineages?.some((lineage) => lineage.id === race.id) &&
                      subrace && (
                        <Fragment key={sIndex}>
                          <div className={clsx(subrace_card, main_card, 'clickable')} onClick={() => setRace(subrace)}>
                            <h3 className={clsx(card_header_title, card_header)}>{subrace.label}</h3>
                          </div>
                        </Fragment>
                      )
                    )
                  })}
                </>
              </Grid.Col>
            )
          }
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
  },
})
export default RaceSelection
