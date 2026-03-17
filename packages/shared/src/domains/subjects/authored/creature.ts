import type { AbilityCode, SizeCode } from '#core'
import type {
  DetailAuthored,
  FeatureAuthored,
  SpeedAuthored,
} from '#authored'

// ─── Category ────────────────────────────────────────────────────────────────
// Content/presentation bucket — what kind of creature this is.
// Legendary/lair/mount/companion mechanics are PROFILES (not categories)
// because they cut across categories: any creature can be legendary,
// any beast can be a mount, etc.

export type CreatureCategory = 'NPC' | 'MONSTER' | 'BEAST' | 'COMPANION' | 'SUMMON'

// ─── Action ──────────────────────────────────────────────────────────────────

export interface CreatureActionAuthored {
  id: string
  label: string
  description: string
  attackBonus?: number
  damage?: string
  recharge?: string
}

// ─── Optional rule profiles ───────────────────────────────────────────────────
// Presence = that mechanics module applies to this creature.

export interface CreatureLegendaryProfile {
  legendaryResistanceCount?: number   // uses per day (legendary resistance)
  actionsCount: number                // legendary actions per round
  actions: CreatureActionAuthored[]
}

export interface CreatureLairProfile {
  lairActions?: CreatureActionAuthored[]
  regionalEffects?: string[]
}

export interface CreatureMountProfile {
  mountType: 'CONTROLLED' | 'INDEPENDENT'
  capacity?: number
  riderCount?: number
  notes?: string
}

export interface CreatureCompanionProfile {
  bondType: 'FAMILIAR' | 'ANIMAL_COMPANION' | 'SUMMON'
  initiativeMode: 'USES_PC_INITIATIVE' | 'OWN_INITIATIVE'
  notes?: string
}

export interface CreatureNpcProfile {
  bonds?: string[]
  flaws?: string[]
  ideals?: string[]
  personalityTraits?: string[]
}

// ─── Root authored type ───────────────────────────────────────────────────────

export interface CreatureAuthored {
  id: string
  label: string
  quote?: string
  description?: string
  details?: DetailAuthored[]
  features?: FeatureAuthored[]          // traits, special abilities
  userId: string
  systemId: string

  // Identity
  category: CreatureCategory
  creatureTypeId: string               // vocabulary: ABERRATION, BEAST, HUMANOID, etc.
  size: SizeCode
  alignmentId?: string
  tags?: string[]

  // Core stats
  abilityScores: Record<AbilityCode, number>
  armorClass: number
  armorClassNote?: string
  hitPoints: number
  hitDice?: string                     // e.g. "5d8+10"

  // Movement
  speeds: SpeedAuthored[]
  senses?: string[]                    // sense IDs from vocabulary
  passivePerception?: number

  // Defenses
  savingThrowProficiencies?: AbilityCode[]
  skillProficiencies?: string[]
  damageVulnerabilities?: string[]
  damageResistances?: string[]
  damageImmunities?: string[]
  conditionImmunities?: string[]

  // Social/rules
  languages?: string[]
  challengeRatingId?: string
  xp?: number

  // Standard actions
  actions?: CreatureActionAuthored[]
  bonusActions?: CreatureActionAuthored[]
  reactions?: CreatureActionAuthored[]

  // Optional rule profiles (presence = that mechanics module applies)
  legendaryProfile?: CreatureLegendaryProfile
  lairProfile?: CreatureLairProfile
  mountProfile?: CreatureMountProfile
  companionProfile?: CreatureCompanionProfile
  npcProfile?: CreatureNpcProfile
}
