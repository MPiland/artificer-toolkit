import type { GameSystemEncounterTier } from '../../../platformEncounterPolicy.js'
import { dnd5eEncounterTier } from '../../../systems/dnd5e/encounterTier.js'
import { tracerEncounterTier } from '../encounterTier.js'

export const installedEncounterSystems: readonly GameSystemEncounterTier[] = [
  dnd5eEncounterTier,
  tracerEncounterTier
]
