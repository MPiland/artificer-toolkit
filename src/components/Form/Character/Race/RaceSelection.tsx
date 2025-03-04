import { Fragment } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { card_group, card_header, card_header_title, main_card, subrace_card } from '../../Character.css'
import clsx from 'clsx'
import { useListRacesQuery } from '../../../../features/races/racesApi'
import { Categories } from '../../../../types/enums'
import { Race } from '../../../../../amplify/gql/types'

const RaceSelection = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { data: races } = useListRacesQuery()
  const handleShowDetail = (item: Race, context: string) => {
    navigate(`race/detail/short/${item.value}`, {
      state: {
        background: location,
        item: item,
        size: 'sm',
        context: context,
      },
    })
  }

  return races.map((race, raceIndex) => {
    if (race.category === Categories.base) {
      return (
        <div key={raceIndex} className={card_group}>
          <div
            className={clsx(main_card, {
              ['clickable']: !races
                ?.filter((race) => race.category === Categories.subrace)
                .some((subrace) => subrace?.lineages?.some((lineage) => lineage === race.id)),
            })}
            onClick={() =>
              !races
                ?.filter((race) => race.category === Categories.subrace)
                .some((subrace) => subrace?.lineages?.some((lineage) => lineage === race.id)) &&
              handleShowDetail(race, 'race')
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
                        onClick={() => handleShowDetail(subrace, 'race')}
                      >
                        <h3 className={clsx(card_header_title, card_header)}>{subrace.label}</h3>
                      </div>
                    </Fragment>
                  )
                }
              })}
          </>
        </div>
      )
    }
  })
}

export default RaceSelection
