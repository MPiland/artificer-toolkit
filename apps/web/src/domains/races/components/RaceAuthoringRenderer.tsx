import { createAuthoringFormRenderer } from '#forms'
import {
  createEmptyBaseRace,
  toRaceFormValues
} from '../raceAuthoring.utils'

const raceRendererDefaults = toRaceFormValues(createEmptyBaseRace({ systemId: '' }))

export const RaceAuthoringRenderer = createAuthoringFormRenderer({
  defaultValues: raceRendererDefaults
})
