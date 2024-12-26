import RaceFeatures from './RaceFeatures'
import RaceSelection from './RaceSelection'
import { use } from 'react'
import FormContext from '../../FormContext'
import { Character } from '../../../../../amplify/API'
import { useListRacesQuery } from '../../../../features/races/racesApi'
import { UpdateState } from '../../../../types/form'

const Races = () => {
  const { formData, updateFormData, changeRace } = use(FormContext) as {
    formData: Character
    changeRace: boolean
    updateFormData: (arg: UpdateState<Character>) => void
  }

  const { data: races } = useListRacesQuery()

  const fullRace = races.find((race) => race.id === formData.race)
  const raceLineages = races.filter((race) => fullRace.lineage.map((lineage) => race.id === lineage))
  const fullAncestry = fullRace?.ancestry?.options?.find((option) => option.id === formData?.ancestry.id)

  return formData?.race != null && !changeRace ? (
    <RaceFeatures
      formData={formData}
      fullRace={fullRace}
      raceLineages={raceLineages}
      fullAncestry={fullAncestry}
      updateFormData={updateFormData}
    />
  ) : (
    <RaceSelection />
  )
}

export default Races
