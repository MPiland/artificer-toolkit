export const COMBAT_PERCEPTION_CHANNEL = {
  VISUAL: 'VISUAL',
  AUDITORY: 'AUDITORY',
  VIBRATION: 'VIBRATION',
  NONVISUAL: 'NONVISUAL'
} as const

export const COMBAT_PERCEPTION_ACCESS_GRADE = {
  DETECTED: 'DETECTED',
  LOCATED: 'LOCATED',
  PRECISE: 'PRECISE'
} as const

export const COMBAT_PERCEPTION_REQUIREMENT = {
  DETECT: 'DETECT',
  LOCATE: 'LOCATE',
  PRECISE: 'PRECISE',
  SEE: 'SEE'
} as const

export const COMBAT_PERCEPTION_ILLUMINATION = {
  BRIGHT: 'BRIGHT',
  DIM: 'DIM',
  ORDINARY_DARKNESS: 'ORDINARY_DARKNESS',
  MAGICAL_DARKNESS: 'MAGICAL_DARKNESS'
} as const

export const COMBAT_PERCEPTION_ILLUMINATION_ACCESS = {
  BRIGHT_ONLY: 'BRIGHT_ONLY',
  DIM: 'DIM',
  ORDINARY_DARKNESS: 'ORDINARY_DARKNESS',
  MAGICAL_DARKNESS: 'MAGICAL_DARKNESS',
  IGNORE: 'IGNORE'
} as const

export const COMBAT_PERCEPTION_OBSCUREMENT = {
  NONE: 'NONE',
  LIGHT: 'LIGHT',
  HEAVY: 'HEAVY'
} as const

export const COMBAT_PERCEPTION_OBSCUREMENT_ACCESS = {
  NONE: 'NONE',
  LIGHT: 'LIGHT',
  HEAVY: 'HEAVY',
  IGNORE: 'IGNORE'
} as const

export const COMBAT_PERCEPTION_PHYSICAL_CONSTRAINT = {
  LINE_OF_EFFECT: 'LINE_OF_EFFECT',
  SHARED_SURFACE: 'SHARED_SURFACE'
} as const

export type CombatPerceptionChannel =
  (typeof COMBAT_PERCEPTION_CHANNEL)[keyof typeof COMBAT_PERCEPTION_CHANNEL]
export type CombatPerceptionAccessGrade =
  (typeof COMBAT_PERCEPTION_ACCESS_GRADE)[keyof typeof COMBAT_PERCEPTION_ACCESS_GRADE]
export type CombatPerceptionRequirement =
  (typeof COMBAT_PERCEPTION_REQUIREMENT)[keyof typeof COMBAT_PERCEPTION_REQUIREMENT]
export type CombatPerceptionIllumination =
  (typeof COMBAT_PERCEPTION_ILLUMINATION)[keyof typeof COMBAT_PERCEPTION_ILLUMINATION]
export type CombatPerceptionIlluminationAccess =
  (typeof COMBAT_PERCEPTION_ILLUMINATION_ACCESS)[keyof typeof COMBAT_PERCEPTION_ILLUMINATION_ACCESS]
export type CombatPerceptionObscurement =
  (typeof COMBAT_PERCEPTION_OBSCUREMENT)[keyof typeof COMBAT_PERCEPTION_OBSCUREMENT]
export type CombatPerceptionObscurementAccess =
  (typeof COMBAT_PERCEPTION_OBSCUREMENT_ACCESS)[keyof typeof COMBAT_PERCEPTION_OBSCUREMENT_ACCESS]
export type CombatPerceptionPhysicalConstraint =
  (typeof COMBAT_PERCEPTION_PHYSICAL_CONSTRAINT)[keyof typeof COMBAT_PERCEPTION_PHYSICAL_CONSTRAINT]

export interface CombatPerceptionCapability {
  channel: CombatPerceptionChannel
  accessGrade: CombatPerceptionAccessGrade
  satisfies: readonly CombatPerceptionRequirement[]
  illuminationAccess: CombatPerceptionIlluminationAccess
  obscurementAccess: CombatPerceptionObscurementAccess
  perceivesInvisible: boolean
  physicalConstraints: readonly CombatPerceptionPhysicalConstraint[]
}

/** How far a sense reaches, in the Scene's units: unlimited, or a finite distance. */
export type CombatPerceptionRange =
  | { rangeKind: 'UNLIMITED' }
  | { rangeKind: 'DISTANCE'; amount: number }

export interface CombatPerceptionCapabilityInstance {
  instanceId: string
  definitionId: string
  checksum: string
  capabilityOrdinal: number
  range: CombatPerceptionRange
  capability: CombatPerceptionCapability
}

export interface CombatPerceptionEnvironment {
  distance: number
  lineOfEffect: boolean
  sharedSurface: boolean
  illumination: CombatPerceptionIllumination
  obscurement: CombatPerceptionObscurement
  invisibleChannels: readonly CombatPerceptionChannel[]
  suppressedChannels: readonly CombatPerceptionChannel[]
}

export type CombatPerceptionRejectionReason =
  | 'REQUIREMENT_UNSATISFIED'
  | 'CHANNEL_SUPPRESSED'
  | 'OUT_OF_RANGE'
  | 'LINE_OF_EFFECT_REQUIRED'
  | 'SHARED_SURFACE_REQUIRED'
  | 'INVISIBLE_SUBJECT'
  | 'ILLUMINATION_INSUFFICIENT'
  | 'OBSCUREMENT_INSUFFICIENT'

export interface CombatPerceptionIdentity {
  instanceId: string
  definitionId: string
  checksum: string
  capabilityOrdinal: number
}

export interface CombatPerceptionRejection {
  identity: CombatPerceptionIdentity
  reasons: readonly CombatPerceptionRejectionReason[]
}

export interface CombatPerceptionResult {
  satisfied: boolean
  qualifying: readonly CombatPerceptionIdentity[]
  rejected: readonly CombatPerceptionRejection[]
}

export interface CombatPerceptionSenseDefinitionDocument {
  schemaVersion: 1
  kind: 'SENSE'
  id: string
  gameSystemId: string
  capabilities: readonly CombatPerceptionCapability[]
}

interface CombatPerceptionContributionBase {
  id: string
  order: number
}

export interface CombatPerceptionSenseGrantContribution extends CombatPerceptionContributionBase {
  kind: 'SENSE_GRANT'
  senseDefinitionId: string
  definitionVersion: number
  definitionContractVersion: number
  definitionChecksum: string
  document: CombatPerceptionSenseDefinitionDocument
  /** A server-converted scene/System distance. */
  range: CombatPerceptionRange
}

export interface CombatPerceptionSenseSuppressContribution extends CombatPerceptionContributionBase {
  kind: 'SENSE_SUPPRESS'
  senseDefinitionIds: readonly string[]
  channels: readonly CombatPerceptionChannel[]
}

export interface CombatPerceptionAccessLimitContribution extends CombatPerceptionContributionBase {
  kind: 'ACCESS_LIMIT'
  channels: readonly CombatPerceptionChannel[]
  maximumAccessGrade: CombatPerceptionAccessGrade | null
  maximumIlluminationAccess: CombatPerceptionIlluminationAccess | null
  maximumObscurementAccess: CombatPerceptionObscurementAccess | null
  perceivesInvisible: false | null
}

export interface CombatPerceptionEmissionSuppressContribution extends CombatPerceptionContributionBase {
  kind: 'EMISSION_SUPPRESS'
  channels: readonly CombatPerceptionChannel[]
  bypass: 'NONE' | 'INVISIBILITY'
}

export interface CombatPerceptionIlluminationEffectContribution extends CombatPerceptionContributionBase {
  kind: 'ILLUMINATION_EFFECT'
  illumination: CombatPerceptionIllumination | null
  obscurement: CombatPerceptionObscurement | null
  precedence: number
}

export type CombatPerceptionContribution =
  | CombatPerceptionSenseGrantContribution
  | CombatPerceptionSenseSuppressContribution
  | CombatPerceptionAccessLimitContribution
  | CombatPerceptionEmissionSuppressContribution
  | CombatPerceptionIlluminationEffectContribution

/** Immutable server-owned identity for one resolved perception contribution. */
export type CombatPerceptionContributionSourceIdentity =
  | {
      kind: 'ACTIVE_EFFECT'
      activeEffectId: string
      activeEffectVersion: number
      activeEffectDefinitionChecksum: string
    }
  | {
      kind: 'CONDITION_DEFINITION'
      conditionDefinitionId: string
      conditionDefinitionVersion: number
      conditionDefinitionChecksum: string
    }

export interface CombatPerceptionContributionSource {
  /** Runtime UUID derived from immutable source identity plus contribution identity. */
  instanceId: string
  source: CombatPerceptionContributionSourceIdentity
  sourceOrdinal: number
  contribution: CombatPerceptionContribution
}

/** Safe ordered audit identity; it intentionally excludes contribution payload and labels. */
export interface CombatPerceptionAppliedContributionSource {
  instanceId: string
  source: CombatPerceptionContributionSourceIdentity
  sourceOrdinal: number
  contributionId: string
  contributionKind: CombatPerceptionContribution['kind']
  contributionOrder: number
}

export interface CombatPerceptionContributionResult extends CombatPerceptionResult {
  finalCapabilities: readonly CombatPerceptionCapabilityInstance[]
  finalEnvironment: CombatPerceptionEnvironment
  appliedContributionSources: readonly CombatPerceptionAppliedContributionSource[]
}
