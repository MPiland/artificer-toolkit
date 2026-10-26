import type { GameSystemEncounterTier } from '../../platformEncounterPolicy.js'
import { dnd5eEncounterTier } from '../dnd5e/encounterTier.js'

/** The installed Systems' Encounter-only tier (D195). */
export const installedEncounterSystems: readonly GameSystemEncounterTier[] = [dnd5eEncounterTier]
