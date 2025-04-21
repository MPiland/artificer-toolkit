import RaceFeatures from '../../../Subforms/Character/Race/RaceFeatures'
import RaceSelection from '../../../Subforms/Character/Race/RaceSelection'
import { use } from 'react'
import { FormContext } from '../../../FormContext'
import { Character } from '../../../../../../amplify/gql/types'
import Grid from '../../../../Grid/Grid'
import useRaceData from '../../../../../hooks/useRaceData'

const Races = () => {
  const {
    formStore: { data },
    changeRace,
  } = use(FormContext) as {
    formStore: {
      data: Character
    }
    changeRace: boolean
  }

  const {
    races: { findRace, findLineages },
  } = useRaceData()

  const fullRace = findRace(data.race)
  const raceLineages = findLineages(data.race) || []
  const fullAncestry = fullRace?.ancestry?.options?.find((option) => option?.id === data?.ancestry?.id)

  return (
    <Grid>
      {data?.race && fullRace && !changeRace ?
        <RaceFeatures raceId={data.race} fullRace={fullRace} raceLineages={raceLineages} fullAncestry={fullAncestry} />
      : <RaceSelection />}
    </Grid>
  )
}

export default Races
