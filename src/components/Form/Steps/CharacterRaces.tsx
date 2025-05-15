import RaceFeatures from '../Substeps/Character/Race/RaceFeatures'
import RaceSelection from '../Substeps/Character/Race/RaceSelection'
import { use } from 'react'
import { FormContext } from '../FormContext'
import type { Character } from '@/types'
import { useRaceData } from '@/hooks'
import { Grid } from '@mantine/core'

const RacesStep = () => {
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

export default RacesStep
