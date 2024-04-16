import { selectAllRaces, useGetRacesQuery } from '../../features/race/raceApiSlice'
import Spinner from '../Spinner/Spinner'
import { ReducerActionType, FormContext } from '../../utils/types'
import { Fragment } from 'react'
import Collapse from '../Collapse/Collapse'
import parse from 'html-react-parser'
import ScrollArea from '../ScrollArea/ScrollArea'
import { sprinkles } from '../../css/sprinkles.css'
import { useLocation, useNavigate } from 'react-router-dom'
import RaceFeatureForm from './RaceFeatureForm'
import { subrace_collapse } from './Form.css'

interface RaceFormProps {
  context: FormContext
  formState: any
  setFormState: (arg: ReducerActionType) => void
  selectedRace: any
  setSelectedRace: (arg: any) => void
  changeRace: boolean
  setChangeRace: (arg: boolean) => void
}

const RaceSelectionForm = ({
  context,
  formState,
  setFormState,
  selectedRace,
  setSelectedRace,
  changeRace,
  setChangeRace,
}: RaceFormProps) => {
  const navigate = useNavigate()
  const location = useLocation()

  const { races } = useGetRacesQuery(undefined, {
    selectFromResult: ({ data }) => ({ races: data && selectAllRaces(data) }),
  })

  const handleShowDetail = (race: any) => {
    navigate(`/race/${race.name}`, {
      state: {
        background: location,
        form: context.title,
        data: race,
        size: 'lg',
        title: race.value,
      },
    })
  }

  const handleSelectRace = (race: any) => {
    setSelectedRace(race)
    setChangeRace(false)
  }

  const handleHeaderButton = (raceItem: any) => {
    const headerButton = [
      {
        label: 'Race Detail',
        function: () => handleShowDetail(raceItem),
      },
    ]

    if (raceItem.playable?.name === 'true' || raceItem.category?.name === 'subrace') {
      headerButton.push({
        label: 'Select Race',
        function: () => handleSelectRace(raceItem),
      })
    }

    return headerButton
  }

  const subraces = races?.filter((raceItem: any) => raceItem.category.name === 'subrace') as any[]

  const baseRaces = races?.filter((raceItem: any) => raceItem.category.name === 'base') as any[]

  return !baseRaces ? (
    <Spinner />
  ) : selectedRace !== null && changeRace === false ? (
    <RaceFeatureForm selectedRace={selectedRace} setFormState={setFormState} formState={formState} races={races} />
  ) : (
    <ScrollArea scrollDirection='vertical'>
      {baseRaces.map((raceItem: any, raceIndex: number) => {
        return (
          <div key={raceIndex} className={sprinkles({ mb: 'size-3' })}>
            <Collapse title={raceItem.value} headerButton={handleHeaderButton(raceItem)}>
              {raceItem.desc && parse(raceItem.desc)}
              {raceItem.ancestry && (
                <section>
                  <h3>{raceItem.ancestry.value}</h3>
                  {raceItem.ancestry.desc && parse(raceItem.ancestry.desc)}
                </section>
              )}
              {raceItem.feature?.length > 0 &&
                raceItem.feature.map((featureItem: any, featureIndex: any) => (
                  <Fragment key={featureIndex}>
                    <h3>{featureItem.value}</h3>
                    {featureItem.desc && parse(featureItem.desc)}
                  </Fragment>
                ))}
            </Collapse>
            {subraces.some((subraceItem: any) =>
              subraceItem.lineage.some((lineageItem: any) => lineageItem._id === raceItem._id)
            ) && (
              <>
                {subraces
                  .filter((subraceItem: any) =>
                    subraceItem.lineage.some((lineageItem: any) => lineageItem._id === raceItem._id)
                  )
                  .map((subraceItem: any, subraceIndex: number) => (
                    <Fragment key={subraceIndex}>
                      <Collapse
                        title={subraceItem.value}
                        headerButton={handleHeaderButton(subraceItem)}
                        className={subrace_collapse}
                      >
                        <div>{subraceItem.desc && parse(subraceItem.desc)}</div>
                        {subraceItem.feature?.length > 0 &&
                          subraceItem.feature.map((featureItem: any, feautreIndex: number) => (
                            <div key={feautreIndex}>
                              <h4>{featureItem.value}</h4>
                              <div>{featureItem.desc && parse(featureItem.desc)}</div>
                            </div>
                          ))}
                      </Collapse>
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

export default RaceSelectionForm
