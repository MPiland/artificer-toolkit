import { selectAllRaces, useGetRacesQuery } from '../../../features/race/raceApiSlice'
import Spinner from '../../Spinner/Spinner'
import { Fragment, useContext, useEffect } from 'react'
import ScrollArea from '../../ScrollArea/ScrollArea'
import { useLocation, useNavigate } from 'react-router-dom'
import RaceFeatureForm from './RaceFeatureForm'
import { card_group, card_header_title, main_card, subrace_card } from './Character.css'
import { form_content } from '../Form.css'
import clsx from 'clsx'
import { isEqual } from 'lodash'
import { FormStepsContext } from '../FormStepsContext'

const RaceSelectionFormTest = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { selectedRace, setSelectedRace, changeRace, setChangeRace } = useContext(FormStepsContext)

  const raceSelected = location.state?.selected
  const formRace = location.state?.selection?.item
  const context = location.state?.selection?.context

  const { races } = useGetRacesQuery(undefined, {
    selectFromResult: ({ data }) => ({ races: data && selectAllRaces(data) }),
  })

  useEffect(() => {
    if (raceSelected && (!selectedRace || !isEqual(selectedRace, formRace)) && context === 'race') {
      setSelectedRace(formRace)
      if (changeRace) {
        setChangeRace(false)
      }
    }
  }, [context, formRace, raceSelected, selectedRace, setSelectedRace, changeRace, setChangeRace])

  const handleShowDetail = (item: any, context: string) => {
    navigate(`/${context}/${item.name}/short`, {
      state: {
        background: location,
        item: item,
        size: 'sm',
        context: context,
      },
    })
  }

  const subraces = races?.filter((race: any) => race.category.name === 'subrace') as any[]

  const baseRaces = races?.filter((race: any) => race.category.name === 'base') as any[]

  return !baseRaces ? (
    <Spinner />
  ) : selectedRace !== null && !changeRace ? (
    <RaceFeatureForm />
  ) : (
    <ScrollArea scrollDirection='vertical' className={form_content}>
      {baseRaces.map((race: any, raceIndex: number) => {
        return (
          <div key={raceIndex} className={card_group}>
            <div
              className={clsx(main_card, {
                ['clickable']: !subraces.some((subrace: any) =>
                  subrace.lineage.some((lineage: any) => lineage._id === race._id)
                ),
              })}
              onClick={() =>
                !subraces.some((subrace: any) => subrace.lineage.some((lineage: any) => lineage._id === race._id)) &&
                handleShowDetail(race, 'race')
              }
            >
              <h3 className={card_header_title}>{race.value}</h3>
            </div>
            {subraces.some((subrace: any) => subrace.lineage.some((lineage: any) => lineage._id === race._id)) && (
              <>
                {subraces
                  .filter((subrace: any) => subrace.lineage.some((lineage: any) => lineage._id === race._id))
                  .map((subrace: any, subraceIndex: number) => (
                    <Fragment key={subraceIndex}>
                      <div
                        className={clsx(subrace_card, main_card, 'clickable')}
                        onClick={() => handleShowDetail(subrace, 'race')}
                      >
                        <h3 className={card_header_title}>{subrace.value}</h3>
                      </div>
                    </Fragment>
                  ))}
              </>
            )}
          </div>
        )
      })}
    </ScrollArea>
  )
}

export default RaceSelectionFormTest
