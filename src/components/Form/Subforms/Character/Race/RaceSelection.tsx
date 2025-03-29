import { Fragment, useState } from 'react'
import { card_group, card_header, card_header_title, main_card, subrace_card } from '../../../Character.css'
import clsx from 'clsx'
import { useListRacesQuery } from '../../../../../apis/racesApi'
import { Categories } from '../../../../../types/enums'
import { Race } from '../../../../../../amplify/gql/types'
import Grid from '../../../../Grid/Grid'
import RaceDetail from './RaceDetail'

const RaceSelection = () => {
  const [fullRace, setFullRace] = useState<Race | null>(null)

  const { data: races } = useListRacesQuery()

  return (
    <>
      {races.map((race, raceIndex) => {
        if (race.category === Categories.base) {
          return (
            <Grid.Item key={raceIndex} className={card_group}>
              <div
                className={clsx(main_card, {
                  ['clickable']: race.playable !== 'false',
                })}
                onClick={() =>
                  !races
                    ?.filter((race) => race.category === Categories.subrace)
                    .some((subrace) => subrace?.lineages?.some((lineage) => lineage === race.id)) && setFullRace(race)
                }
              >
                <h3 className={clsx(card_header_title, card_header)}>{race.label}</h3>
              </div>
              <>
                {races
                  ?.filter((race) => race.category === Categories.subrace)
                  .map((subrace, subraceIndex) => {
                    if (subrace.lineages?.some((lineage) => lineage === race.id)) {
                      return (
                        <Fragment key={subraceIndex}>
                          <div
                            className={clsx(subrace_card, main_card, 'clickable')}
                            onClick={() => setFullRace(subrace)}
                          >
                            <h3 className={clsx(card_header_title, card_header)}>{subrace.label}</h3>
                          </div>
                        </Fragment>
                      )
                    }
                  })}
              </>
            </Grid.Item>
          )
        }
      })}
      {fullRace && <RaceDetail fullRace={fullRace} setFullRace={() => setFullRace(null)} />}
    </>
  )
}

export default RaceSelection
