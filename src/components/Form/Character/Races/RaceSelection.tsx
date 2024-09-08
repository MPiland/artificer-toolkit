import { Fragment } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { card_group, card_header, card_header_title, main_card, subrace_card } from '../Character.css'
import clsx from 'clsx'
import { useGetRacesQuery } from '../../../../features/races/racesApi'

const RaceSelection = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { data: races } = useGetRacesQuery() as { data: any[] }

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
    ?.filter((race: any) => race.category.name === 'base')
    .map((race: any, raceIndex: number) => {
      return (
        <div key={raceIndex} className={card_group}>
          <div
            className={clsx(main_card, {
              ['clickable']: !races
                ?.filter((race: any) => race.category.name === 'subrace')
                .some((subrace: any) => subrace?.lineage?.some((lineage: any) => lineage._id === race._id)),
            })}
            onClick={() =>
              !races
                ?.filter((race: any) => race.category.name === 'subrace')
                .some((subrace: any) => subrace?.lineage.some((lineage: any) => lineage._id === race._id)) &&
              handleShowDetail(race, 'race')
            }
          >
            <h3 className={clsx(card_header_title, card_header)}>{race.value}</h3>
          </div>
          {races
            ?.filter((race: any) => race.category.name === 'subrace')
            .some((subrace: any) => subrace?.lineage.some((lineage: any) => lineage._id === race._id)) && (
            <>
              {races
                ?.filter((race: any) => race.category.name === 'subrace')
                .filter((subrace: any) => subrace?.lineage.some((lineage: any) => lineage._id === race._id))
                .map((subrace: any, subraceIndex: number) => (
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
