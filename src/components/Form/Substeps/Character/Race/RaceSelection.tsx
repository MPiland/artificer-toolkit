import { Fragment, useState } from 'react'
import { card_group, card_header, card_header_title, main_card, subrace_card } from '../../../Character.css'
import clsx from 'clsx'
import { Categories } from '@/enums'
import type { RaceListItem } from '../../../../../../amplify/gql/types'
import Grid from '@/components/Grid'
import RaceDetail from './RaceDetail'
import useRaceData from '../../../../../hooks/useRaceData'

const RaceSelection = () => {
  const [race, setRace] = useState<RaceListItem | null>(null)

  const {
    baseRaces,
    subraces,
    races: { findByLineage, findLineages },
    metaData,
  } = useRaceData()

  return (
    <>
      {baseRaces.map((race, rIndex) => {
        if (metaData.categories?.find((c) => c.id === Categories.BASE)?.raceIds?.includes(race.id)) {
          return (
            <Grid.Item key={rIndex} className={card_group}>
              <div
                className={clsx(main_card, {
                  ['clickable']: metaData.playable?.find((p) => p.id === 'false')?.raceIds?.includes(race.id),
                })}
                onClick={() => !findByLineage(race.id)?.length && setRace(race)}
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
            </Grid.Item>
          )
        }
      })}
      {race && <RaceDetail race={race} setRace={() => setRace(null)} />}
    </>
  )
}

export default RaceSelection
