import {
  selectAllRaces,
  useGetRacesQuery,
} from '../../features/race/raceApiSlice'
import Spinner from '../Spinner/Spinner'
import { ReducerActionType, FormContext } from '../../utils/types'
import { Fragment } from 'react'
import Collapse from '../Collapse/Collapse'
import parse from 'html-react-parser'
import ScrollArea from '../ScrollArea/ScrollArea'
import { sprinkles } from '../../css/sprinkles.css'
import { useLocation, useNavigate } from 'react-router-dom'
import CharacterFeatureForm from './CharacterFeatureForm'

interface RaceFormProps {
  context: FormContext
  formState: any
  setFormState: (arg: ReducerActionType) => void
  selectedRace: any
  setSelectedRace: (arg: any) => void
  changeRace: boolean
  setChangeRace: (arg: boolean) => void
}

const RaceForm = ({
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
    setFormState({
      target: { name: 'race', value: race },
    })
    setSelectedRace(race)
    setChangeRace(false)
  }

  return !races ? (
    <Spinner />
  ) : selectedRace !== null && changeRace === false ? (
    <CharacterFeatureForm
      item={selectedRace}
      setFormState={setFormState}
      formState={formState}
    />
  ) : (
    <ScrollArea scrollDirection='vertical'>
      {races.map((raceItem: any, raceIndex: number) => (
        <Collapse
          key={raceIndex}
          title={raceItem.value}
          className={sprinkles({ mb: 'size-3' })}
          headerButton={[
            {
              label: 'Race Detail',
              function: () => handleShowDetail(raceItem),
            },
            {
              label: 'Select Race',
              function: () => handleSelectRace(raceItem),
            },
          ]}
        >
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
      ))}
    </ScrollArea>
  )
}

export default RaceForm
