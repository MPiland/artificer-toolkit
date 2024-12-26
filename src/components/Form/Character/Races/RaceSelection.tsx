import { Fragment } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { card_group, card_header, card_header_title, main_card, subrace_card } from '../Character.css'
import clsx from 'clsx'
import { useListRacesQuery } from '../../../../features/races/racesApi'
import { Categories } from '../../../../types/enums'

const RaceSelection = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { data: races } = useListRacesQuery()
  const handleShowDetail = (item: any, context: string) => {
    navigate(`race/detail/short/${item.name}`, {
      state: {
        background: location,
        item: item,
        size: 'sm',
        context: context,
      },
    })
  }

  return races
    ?.filter((race) => race.category === Categories.base)
    .map((race, raceIndex: number) => {
      return (
        <div key={raceIndex} className={card_group}>
          <div
            className={clsx(main_card, {
              ['clickable']: !races
                ?.filter((race) => race.category === Categories.subrace)
                .some((subrace) => subrace?.lineage?.some((lineage) => lineage === race.id)),
            })}
            onClick={() =>
              !races
                ?.filter((race) => race.category === Categories.subrace)
                .some((subrace) => subrace?.lineage.some((lineage) => lineage === race.id)) &&
              handleShowDetail(race, 'race')
            }
          >
            <h3 className={clsx(card_header_title, card_header)}>{race.value}</h3>
          </div>
          {races
            ?.filter((race) => race.category === Categories.subrace)
            .some((subrace) => subrace?.lineage.some((lineage) => lineage === race.id)) && (
            <>
              {races
                ?.filter((race) => race.category === Categories.subrace)
                .filter((subrace) => subrace?.lineage.some((lineage) => lineage === race.id))
                .map((subrace, subraceIndex: number) => (
                  <Fragment key={subraceIndex}>
                    <div
                      className={clsx(subrace_card, main_card, 'clickable')}
                      onClick={() => handleShowDetail(subrace, 'race')}
                    >
                      <h3 className={clsx(card_header_title, card_header)}>{subrace.value}</h3>
                    </div>
                  </Fragment>
                ))}
            </>
          )}
        </div>
      )
    })
}

export default RaceSelection
