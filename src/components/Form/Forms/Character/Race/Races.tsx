import RaceFeatures from '../../../Subforms/Character/Race/RaceFeatures'
import RaceSelection from '../../../Subforms/Character/Race/RaceSelection'
import { use } from 'react'
import { FormContext } from '../../../FormContext'
import { Character } from '../../../../../../amplify/gql/types'
import { useListRacesQuery } from '../../../../../apis/racesApi'
import { UpdateState } from '../../../../../types/form'
import Grid from '../../../../Grid/Grid'

const Races = () => {
  const { formData, updateFormData, changeRace } = use(FormContext) as {
    formData: Character
    changeRace: boolean
    updateFormData: (arg: UpdateState<Character>) => void
  }

  const { data: races } = useListRacesQuery()

  const fullRace = races.find((race) => race.id === formData.race)
  const raceLineages = races.filter((race) => fullRace?.lineages?.map((lineage) => race.id === lineage))
  const fullAncestry = fullRace?.ancestry?.options?.find((option) => option?.id === formData?.ancestry?.id)

  return (
    <Grid>
      {formData?.race && fullRace && !changeRace ?
        <RaceFeatures
          formData={formData}
          raceId={formData.race}
          fullRace={fullRace}
          raceLineages={raceLineages}
          fullAncestry={fullAncestry}
          updateFormData={updateFormData}
        />
      : <RaceSelection />}
    </Grid>
  )
}

export default Races
