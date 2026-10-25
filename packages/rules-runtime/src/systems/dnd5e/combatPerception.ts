import type { CombatPerceptionCapabilityAdapter } from '../../combatPerceptionCapabilityRegistry.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  type CombatPerceptionAccessGrade,
  type CombatPerceptionRequirement,
  type CombatPerceptionIlluminationAccess,
  type CombatPerceptionObscurement,
  type CombatPerceptionObscurementAccess,
  type CombatPerceptionCapability,
  type CombatPerceptionRange,
  type CombatPerceptionCapabilityInstance,
  type CombatPerceptionEnvironment,
  type CombatPerceptionRejectionReason,
  type CombatPerceptionIdentity,
  type CombatPerceptionRejection,
  type CombatPerceptionResult,
  type CombatPerceptionSenseDefinitionDocument,
  type CombatPerceptionAccessLimitContribution,
  type CombatPerceptionContribution,
  type CombatPerceptionContributionSourceIdentity,
  type CombatPerceptionContributionSource,
  type CombatPerceptionContributionResult,
  type SceneIlluminationLevel
} from '@artificer-toolkit/shared/vtt'

import { DND5E_SYSTEM_ID } from './identity.js'

/** Mirrors the existing bounded Character sense-grant input collection. */
/** 100 finalized Character senses, each with at most 8 published capabilities. */
export const MAX_COMBAT_PERCEPTION_CAPABILITY_INSTANCES = 800
export const MAX_COMBAT_PERCEPTION_CONTRIBUTION_SOURCES_PER_RELATION = 256

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/
const channelValues = ['VISUAL', 'AUDITORY', 'VIBRATION', 'NONVISUAL'] as const
const accessGradeValues = ['DETECTED', 'LOCATED', 'PRECISE'] as const
const requirementValues = ['DETECT', 'LOCATE', 'PRECISE', 'SEE'] as const
/** SRD light: no light dispels magical darkness, and darkvision sees only ordinary darkness. */
const DND5E_ILLUMINATION_LEVELS = [
  { code: 'BRIGHT', label: 'Bright light', renderClass: 'LIT', suppressesLight: false },
  { code: 'DIM', label: 'Dim light', renderClass: 'DIM', suppressesLight: false },
  {
    code: 'ORDINARY_DARKNESS',
    label: 'Ordinary darkness',
    renderClass: 'DARK',
    suppressesLight: false
  },
  {
    code: 'MAGICAL_DARKNESS',
    label: 'Magical darkness',
    renderClass: 'DARK',
    suppressesLight: true
  }
] as const satisfies readonly SceneIlluminationLevel[]
const illuminationValues = DND5E_ILLUMINATION_LEVELS.map(({ code }) => code)
const illuminationAccessValues = [
  'BRIGHT_ONLY',
  'DIM',
  'ORDINARY_DARKNESS',
  'MAGICAL_DARKNESS',
  'IGNORE'
] as const
const obscurementValues = ['NONE', 'LIGHT', 'HEAVY'] as const
const obscurementAccessValues = ['NONE', 'LIGHT', 'HEAVY', 'IGNORE'] as const
const physicalConstraintValues = ['LINE_OF_EFFECT', 'SHARED_SURFACE'] as const

const illuminationAccessRank: Readonly<
  Record<Exclude<CombatPerceptionIlluminationAccess, 'IGNORE'>, number>
> = {
  BRIGHT_ONLY: 0,
  DIM: 1,
  ORDINARY_DARKNESS: 2,
  MAGICAL_DARKNESS: 3
}
const obscurementRank: Readonly<Record<CombatPerceptionObscurement, number>> = {
  NONE: 0,
  LIGHT: 1,
  HEAVY: 2
}
const obscurementAccessRank: Readonly<
  Record<Exclude<CombatPerceptionObscurementAccess, 'IGNORE'>, number>
> = { NONE: 0, LIGHT: 1, HEAVY: 2 }

function normalizeIdentity(instance: CombatPerceptionCapabilityInstance): CombatPerceptionIdentity {
  const instanceId = instance.instanceId.toLowerCase()
  const definitionId = instance.definitionId.toLowerCase()
  const checksum = instance.checksum
  if (!UUID_PATTERN.test(instanceId))
    throw new Error('Combat perception capability instance ID must be a UUID.')
  if (!UUID_PATTERN.test(definitionId))
    throw new Error('Combat perception definition ID must be a UUID.')
  if (!CHECKSUM_PATTERN.test(checksum))
    throw new Error('Combat perception checksum must be a lowercase SHA-256 hex digest.')
  if (!Number.isSafeInteger(instance.capabilityOrdinal) || instance.capabilityOrdinal < 0) {
    throw new Error('Combat perception capability ordinal must be a nonnegative safe integer.')
  }
  if (
    instance.range.rangeKind === 'DISTANCE' &&
    (!Number.isFinite(instance.range.amount) || instance.range.amount < 0)
  ) {
    throw new Error(
      'Combat perception capability range must be unlimited or a finite nonnegative distance.'
    )
  }
  return { instanceId, definitionId, checksum, capabilityOrdinal: instance.capabilityOrdinal }
}

function requiredAccessGrade(
  requirement: CombatPerceptionRequirement
): CombatPerceptionAccessGrade {
  switch (requirement) {
    case 'DETECT':
      return 'DETECTED'
    case 'LOCATE':
      return 'LOCATED'
    case 'PRECISE':
    case 'SEE':
      return 'PRECISE'
  }
}

function accessGradeRank(grade: CombatPerceptionAccessGrade): number {
  return grade === 'DETECTED' ? 0 : grade === 'LOCATED' ? 1 : 2
}

function identityKey(identity: CombatPerceptionIdentity): string {
  return `${identity.instanceId}:${identity.definitionId}:${identity.checksum}:${identity.capabilityOrdinal}`
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`)
  }
  return value as Record<string, unknown>
}

function requireExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  name: string
): void {
  const actualKeys = Object.keys(value)
  if (actualKeys.length !== keys.length || actualKeys.some((key) => !keys.includes(key))) {
    throw new Error(`${name} contains unsupported or missing fields.`)
  }
}

function requireBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean.`)
  return value
}

function requireFiniteNonnegative(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite nonnegative number.`)
  }
  return value
}

function parseRange(value: unknown, name: string): CombatPerceptionRange {
  const range = requireRecord(value, name)
  switch (range.rangeKind) {
    case 'UNLIMITED':
      requireExactKeys(range, ['rangeKind'], name)
      return { rangeKind: 'UNLIMITED' }
    case 'DISTANCE':
      requireExactKeys(range, ['rangeKind', 'amount'], name)
      return { rangeKind: 'DISTANCE', amount: requireFiniteNonnegative(range.amount, name) }
    default:
      throw new Error(`${name} must be unlimited or a distance.`)
  }
}

function requireNonnegativeSafeInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a nonnegative safe integer.`)
  }
  return value
}

function requireEnum<T extends string>(value: unknown, values: readonly T[], name: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new Error(`${name} is not a supported value.`)
  }
  return value as T
}

function requireUniqueEnumArray<T extends string>(
  value: unknown,
  values: readonly T[],
  minimum: number,
  maximum: number,
  name: string
): readonly T[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new Error(`${name} must contain between ${minimum} and ${maximum} values.`)
  }
  const parsed = value.map((entry) => requireEnum(entry, values, name))
  if (new Set(parsed).size !== parsed.length) throw new Error(`${name} values must be unique.`)
  return parsed
}

function parseCapability(value: unknown): CombatPerceptionCapability {
  const rawCapability = requireRecord(value, 'Combat perception capability')
  requireExactKeys(
    rawCapability,
    [
      'channel',
      'accessGrade',
      'satisfies',
      'illuminationAccess',
      'obscurementAccess',
      'perceivesInvisible',
      'physicalConstraints'
    ],
    'Combat perception capability'
  )
  const capability = {
    channel: requireEnum(rawCapability.channel, channelValues, 'Combat perception channel'),
    accessGrade: requireEnum(
      rawCapability.accessGrade,
      accessGradeValues,
      'Combat perception access grade'
    ),
    satisfies: requireUniqueEnumArray(
      rawCapability.satisfies,
      requirementValues,
      1,
      4,
      'Combat perception requirement'
    ),
    illuminationAccess: requireEnum(
      rawCapability.illuminationAccess,
      illuminationAccessValues,
      'Combat perception illumination access'
    ),
    obscurementAccess: requireEnum(
      rawCapability.obscurementAccess,
      obscurementAccessValues,
      'Combat perception obscurement access'
    ),
    perceivesInvisible: requireBoolean(
      rawCapability.perceivesInvisible,
      'Combat perception invisibility access'
    ),
    physicalConstraints: requireUniqueEnumArray(
      rawCapability.physicalConstraints,
      physicalConstraintValues,
      0,
      2,
      'Combat perception physical constraint'
    )
  }
  if (capability.satisfies.includes('LOCATE') && capability.accessGrade === 'DETECTED') {
    throw new Error('LOCATE requires a LOCATED or PRECISE combat perception capability.')
  }
  if (
    (capability.satisfies.includes('PRECISE') || capability.satisfies.includes('SEE')) &&
    capability.accessGrade !== 'PRECISE'
  ) {
    throw new Error('PRECISE and SEE require a PRECISE combat perception capability.')
  }
  return capability
}

function parseCapabilityInstance(value: unknown): CombatPerceptionCapabilityInstance {
  const instance = requireRecord(value, 'Combat perception capability instance')
  requireExactKeys(
    instance,
    ['instanceId', 'definitionId', 'checksum', 'capabilityOrdinal', 'range', 'capability'],
    'Combat perception capability instance'
  )
  const range = parseRange(instance.range, 'Combat perception capability range')
  const capability = parseCapability(instance.capability)
  return {
    instanceId: requireUuid(instance.instanceId, 'Combat perception capability instance ID'),
    definitionId: requireUuid(instance.definitionId, 'Combat perception definition ID'),
    checksum: requireChecksum(instance.checksum, 'Combat perception checksum'),
    capabilityOrdinal: requireNonnegativeSafeInteger(
      instance.capabilityOrdinal,
      'Combat perception capability ordinal'
    ),
    range,
    capability
  }
}

function parseRuntimeInput(input: unknown): {
  requirement: CombatPerceptionRequirement
  environment: CombatPerceptionEnvironment
  capabilities: readonly CombatPerceptionCapabilityInstance[]
} {
  const value = requireRecord(input, 'Combat perception input')
  requireExactKeys(value, ['requirement', 'environment', 'capabilities'], 'Combat perception input')
  const environment = requireRecord(value.environment, 'Combat perception environment')
  requireExactKeys(
    environment,
    [
      'distance',
      'lineOfEffect',
      'sharedSurface',
      'illumination',
      'obscurement',
      'invisibleChannels',
      'suppressedChannels'
    ],
    'Combat perception environment'
  )
  if (
    !Array.isArray(value.capabilities) ||
    value.capabilities.length > MAX_COMBAT_PERCEPTION_CAPABILITY_INSTANCES
  ) {
    throw new Error(
      `Combat perception capabilities must contain at most ${MAX_COMBAT_PERCEPTION_CAPABILITY_INSTANCES} entries.`
    )
  }
  return {
    requirement: requireEnum(value.requirement, requirementValues, 'Combat perception requirement'),
    environment: {
      distance: requireFiniteNonnegative(environment.distance, 'Combat perception distance'),
      lineOfEffect: requireBoolean(environment.lineOfEffect, 'Combat perception line of effect'),
      sharedSurface: requireBoolean(environment.sharedSurface, 'Combat perception shared surface'),
      illumination: requireEnum(
        environment.illumination,
        illuminationValues,
        'Combat perception illumination'
      ),
      obscurement: requireEnum(
        environment.obscurement,
        obscurementValues,
        'Combat perception obscurement'
      ),
      invisibleChannels: requireUniqueEnumArray(
        environment.invisibleChannels,
        channelValues,
        0,
        channelValues.length,
        'Combat perception invisible channel'
      ),
      suppressedChannels: requireUniqueEnumArray(
        environment.suppressedChannels,
        channelValues,
        0,
        channelValues.length,
        'Combat perception suppressed channel'
      )
    },
    capabilities: value.capabilities.map(parseCapabilityInstance)
  }
}

function requireUuid(value: unknown, name: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.toLowerCase())) {
    throw new Error(`${name} must be a UUID.`)
  }
  return value.toLowerCase()
}

function requireChecksum(value: unknown, name: string): string {
  if (typeof value !== 'string' || !CHECKSUM_PATTERN.test(value)) {
    throw new Error(`${name} must be a lowercase SHA-256 hex digest.`)
  }
  return value
}

function requirePositiveSafeInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new Error(`${name} must be a positive safe integer.`)
  return value as number
}

function parseSenseDocument(value: unknown): CombatPerceptionSenseDefinitionDocument {
  const document = requireRecord(value, 'Combat perception sense document')
  requireExactKeys(
    document,
    ['schemaVersion', 'kind', 'id', 'gameSystemId', 'capabilities'],
    'Combat perception sense document'
  )
  if (document.schemaVersion !== 1 || document.kind !== 'SENSE')
    throw new Error('Combat perception sense document has an unsupported contract.')
  if (
    !Array.isArray(document.capabilities) ||
    document.capabilities.length < 1 ||
    document.capabilities.length > 8
  )
    throw new Error('Combat perception sense document must contain between 1 and 8 capabilities.')
  return {
    schemaVersion: 1,
    kind: 'SENSE',
    id: requireUuid(document.id, 'Combat perception sense definition ID'),
    gameSystemId: requireUuid(document.gameSystemId, 'Combat perception sense Game System ID'),
    capabilities: document.capabilities.map(parseCapability)
  }
}

function parseContribution(value: unknown): CombatPerceptionContribution {
  const contribution = requireRecord(value, 'Combat perception contribution')
  const order = requireNonnegativeSafeInteger(
    contribution.order,
    'Combat perception contribution order'
  )
  if (order > 9_999) throw new Error('Combat perception contribution order must be at most 9999.')
  const base = {
    id: requireUuid(contribution.id, 'Combat perception contribution ID'),
    order
  }
  const kind = requireEnum(
    contribution.kind,
    [
      'SENSE_GRANT',
      'SENSE_SUPPRESS',
      'ACCESS_LIMIT',
      'EMISSION_SUPPRESS',
      'ILLUMINATION_EFFECT'
    ] as const,
    'Combat perception contribution kind'
  )
  switch (kind) {
    case 'SENSE_GRANT': {
      requireExactKeys(
        contribution,
        [
          'id',
          'order',
          'kind',
          'senseDefinitionId',
          'definitionVersion',
          'definitionContractVersion',
          'definitionChecksum',
          'document',
          'range'
        ],
        'Combat perception sense grant contribution'
      )
      const senseDefinitionId = requireUuid(
        contribution.senseDefinitionId,
        'Combat perception granted sense definition ID'
      )
      const document = parseSenseDocument(contribution.document)
      if (document.id !== senseDefinitionId)
        throw new Error(
          'Combat perception granted sense document identity must match its definition.'
        )
      const definitionChecksum = requireChecksum(
        contribution.definitionChecksum,
        'Combat perception granted sense definition checksum'
      )
      if (checksumRuleDocument(document) !== definitionChecksum)
        throw new Error('Combat perception granted sense checksum must match its document.')
      const definitionContractVersion = requirePositiveSafeInteger(
        contribution.definitionContractVersion,
        'Combat perception granted sense contract version'
      )
      if (definitionContractVersion > 10_000)
        throw new Error('Combat perception granted sense contract version must be at most 10000.')
      return {
        ...base,
        kind,
        senseDefinitionId,
        definitionVersion: requirePositiveSafeInteger(
          contribution.definitionVersion,
          'Combat perception granted sense definition version'
        ),
        definitionContractVersion,
        definitionChecksum,
        document,
        range: parseRange(contribution.range, 'Combat perception granted range')
      }
    }
    case 'SENSE_SUPPRESS': {
      requireExactKeys(
        contribution,
        ['id', 'order', 'kind', 'senseDefinitionIds', 'channels'],
        'Combat perception sense suppression contribution'
      )
      const senseDefinitionIds = requireCanonicalUuidArray(
        contribution.senseDefinitionIds,
        0,
        32,
        'Combat perception suppressed sense definition IDs'
      )
      const channels = requireCanonicalEnumArray(
        contribution.channels,
        channelValues,
        0,
        channelValues.length,
        'Combat perception suppressed channels'
      )
      if (senseDefinitionIds.length === 0 && channels.length === 0)
        throw new Error('Combat perception sense suppression must match a definition or channel.')
      return { ...base, kind, senseDefinitionIds, channels }
    }
    case 'ACCESS_LIMIT': {
      requireExactKeys(
        contribution,
        [
          'id',
          'order',
          'kind',
          'channels',
          'maximumAccessGrade',
          'maximumIlluminationAccess',
          'maximumObscurementAccess',
          'perceivesInvisible'
        ],
        'Combat perception access limit contribution'
      )
      const maximumAccessGrade = nullableEnum(
        contribution.maximumAccessGrade,
        accessGradeValues,
        'Combat perception maximum access grade'
      )
      const maximumIlluminationAccess = nullableEnum(
        contribution.maximumIlluminationAccess,
        illuminationAccessValues,
        'Combat perception maximum illumination access'
      )
      const maximumObscurementAccess = nullableEnum(
        contribution.maximumObscurementAccess,
        obscurementAccessValues,
        'Combat perception maximum obscurement access'
      )
      const perceivesInvisible = contribution.perceivesInvisible
      if (perceivesInvisible !== null && perceivesInvisible !== false)
        throw new Error('Combat perception access limits can only disable invisibility access.')
      if (
        maximumAccessGrade === null &&
        maximumIlluminationAccess === null &&
        maximumObscurementAccess === null &&
        perceivesInvisible === null
      )
        throw new Error('Combat perception access limits require at least one limit.')
      return {
        ...base,
        kind,
        channels: requireCanonicalEnumArray(
          contribution.channels,
          channelValues,
          1,
          channelValues.length,
          'Combat perception limited channels'
        ),
        maximumAccessGrade,
        maximumIlluminationAccess,
        maximumObscurementAccess,
        perceivesInvisible
      }
    }
    case 'EMISSION_SUPPRESS':
      requireExactKeys(
        contribution,
        ['id', 'order', 'kind', 'channels', 'bypass'],
        'Combat perception emission suppression contribution'
      )
      return {
        ...base,
        kind,
        channels: requireCanonicalEnumArray(
          contribution.channels,
          channelValues,
          1,
          channelValues.length,
          'Combat perception suppressed emission channels'
        ),
        bypass: requireEnum(
          contribution.bypass,
          ['NONE', 'INVISIBILITY'] as const,
          'Combat perception emission suppression bypass'
        )
      }
    case 'ILLUMINATION_EFFECT': {
      requireExactKeys(
        contribution,
        ['id', 'order', 'kind', 'illumination', 'obscurement', 'precedence'],
        'Combat perception illumination contribution'
      )
      const illumination = nullableEnum(
        contribution.illumination,
        illuminationValues,
        'Combat perception contribution illumination'
      )
      const obscurement = nullableEnum(
        contribution.obscurement,
        obscurementValues,
        'Combat perception contribution obscurement'
      )
      if (illumination === null && obscurement === null)
        throw new Error('Combat perception illumination contributions require a value.')
      if (
        !Number.isSafeInteger(contribution.precedence) ||
        Math.abs(contribution.precedence as number) > 10_000
      )
        throw new Error('Combat perception illumination precedence must be a bounded safe integer.')
      return {
        ...base,
        kind,
        illumination,
        obscurement,
        precedence: contribution.precedence as number
      }
    }
  }
}

function nullableEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  name: string
): T | null {
  return value === null ? null : requireEnum(value, values, name)
}

function requireUuidArray(
  value: unknown,
  minimum: number,
  maximum: number,
  name: string
): readonly string[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum)
    throw new Error(`${name} must contain between ${minimum} and ${maximum} values.`)
  const parsed = value.map((entry) => requireUuid(entry, name))
  if (new Set(parsed).size !== parsed.length) throw new Error(`${name} must be unique.`)
  return parsed
}

function requireCanonicalUuidArray(
  value: unknown,
  minimum: number,
  maximum: number,
  name: string
): readonly string[] {
  const parsed = requireUuidArray(value, minimum, maximum, name)
  if (parsed.some((entry, index) => index > 0 && parsed[index - 1]! >= entry))
    throw new Error(`${name} must be sorted.`)
  return parsed
}

function requireCanonicalEnumArray<T extends string>(
  value: unknown,
  values: readonly T[],
  minimum: number,
  maximum: number,
  name: string
): readonly T[] {
  const parsed = requireUniqueEnumArray(value, values, minimum, maximum, name)
  if (parsed.some((entry, index) => index > 0 && parsed[index - 1]! >= entry))
    throw new Error(`${name} must be sorted.`)
  return parsed
}

function parseContributionSource(value: unknown): CombatPerceptionContributionSource {
  const source = requireRecord(value, 'Combat perception contribution source')
  requireExactKeys(
    source,
    ['instanceId', 'source', 'sourceOrdinal', 'contribution'],
    'Combat perception contribution source'
  )
  return {
    instanceId: requireUuid(source.instanceId, 'Combat perception contribution instance ID'),
    source: parseContributionSourceIdentity(source.source),
    sourceOrdinal: requireNonnegativeSafeInteger(
      source.sourceOrdinal,
      'Combat perception source ordinal'
    ),
    contribution: parseContribution(source.contribution)
  }
}

function parseContributionSourceIdentity(
  value: unknown
): CombatPerceptionContributionSourceIdentity {
  const source = requireRecord(value, 'Combat perception contribution source identity')
  if (source.kind === 'ACTIVE_EFFECT') {
    requireExactKeys(
      source,
      ['kind', 'activeEffectId', 'activeEffectVersion', 'activeEffectDefinitionChecksum'],
      'Combat perception active-effect source identity'
    )
    return {
      kind: 'ACTIVE_EFFECT',
      activeEffectId: requireUuid(source.activeEffectId, 'Combat perception active effect ID'),
      activeEffectVersion: requirePositiveSafeInteger(
        source.activeEffectVersion,
        'Combat perception active effect version'
      ),
      activeEffectDefinitionChecksum: requireChecksum(
        source.activeEffectDefinitionChecksum,
        'Combat perception active effect definition checksum'
      )
    }
  }
  if (source.kind === 'CONDITION_DEFINITION') {
    requireExactKeys(
      source,
      [
        'kind',
        'conditionDefinitionId',
        'conditionDefinitionVersion',
        'conditionDefinitionChecksum'
      ],
      'Combat perception condition-definition source identity'
    )
    return {
      kind: 'CONDITION_DEFINITION',
      conditionDefinitionId: requireUuid(
        source.conditionDefinitionId,
        'Combat perception condition definition ID'
      ),
      conditionDefinitionVersion: requirePositiveSafeInteger(
        source.conditionDefinitionVersion,
        'Combat perception condition definition version'
      ),
      conditionDefinitionChecksum: requireChecksum(
        source.conditionDefinitionChecksum,
        'Combat perception condition definition checksum'
      )
    }
  }
  throw new Error('Combat perception contribution source identity kind is invalid.')
}

/**
 * Resolves one System-authored perception requirement from exact pinned capability instances.
 * This portable primitive has no knowledge of sense names, labels, editions, or actor storage.
 */
export function resolveCombatPerception(input: {
  requirement: CombatPerceptionRequirement
  environment: CombatPerceptionEnvironment
  capabilities: readonly CombatPerceptionCapabilityInstance[]
}): CombatPerceptionResult {
  const parsed = parseRuntimeInput(input)
  return resolveParsedCombatPerception(parsed)
}

function resolveParsedCombatPerception(parsed: {
  requirement: CombatPerceptionRequirement
  environment: CombatPerceptionEnvironment
  capabilities: readonly CombatPerceptionCapabilityInstance[]
}): CombatPerceptionResult {
  const suppressedChannels = new Set(parsed.environment.suppressedChannels)
  const invisibleChannels = new Set(parsed.environment.invisibleChannels)
  const seen = new Set<string>()
  const ordered = parsed.capabilities
    .map((instance) => ({ instance, identity: normalizeIdentity(instance) }))
    .sort((left, right) =>
      left.identity.definitionId === right.identity.definitionId
        ? left.identity.capabilityOrdinal - right.identity.capabilityOrdinal ||
          left.identity.checksum.localeCompare(right.identity.checksum) ||
          left.identity.instanceId.localeCompare(right.identity.instanceId)
        : left.identity.definitionId.localeCompare(right.identity.definitionId)
    )

  const qualifying: CombatPerceptionIdentity[] = []
  const rejected: CombatPerceptionRejection[] = []
  for (const entry of ordered) {
    const key = identityKey(entry.identity)
    if (seen.has(key)) throw new Error('Combat perception capability identities must be unique.')
    seen.add(key)

    const { capability, range } = entry.instance
    const reasons: CombatPerceptionRejectionReason[] = []
    if (
      !capability.satisfies.includes(parsed.requirement) ||
      accessGradeRank(capability.accessGrade) <
        accessGradeRank(requiredAccessGrade(parsed.requirement))
    )
      reasons.push('REQUIREMENT_UNSATISFIED')
    if (suppressedChannels.has(capability.channel)) reasons.push('CHANNEL_SUPPRESSED')
    if (range.rangeKind === 'DISTANCE' && parsed.environment.distance > range.amount)
      reasons.push('OUT_OF_RANGE')
    if (
      capability.physicalConstraints.includes('LINE_OF_EFFECT') &&
      !parsed.environment.lineOfEffect
    )
      reasons.push('LINE_OF_EFFECT_REQUIRED')
    if (
      capability.physicalConstraints.includes('SHARED_SURFACE') &&
      !parsed.environment.sharedSurface
    )
      reasons.push('SHARED_SURFACE_REQUIRED')
    if (invisibleChannels.has(capability.channel) && !capability.perceivesInvisible)
      reasons.push('INVISIBLE_SUBJECT')
    if (
      capability.illuminationAccess !== 'IGNORE' &&
      illuminationValues.indexOf(parsed.environment.illumination) >
        illuminationAccessRank[capability.illuminationAccess]
    )
      reasons.push('ILLUMINATION_INSUFFICIENT')
    if (
      capability.obscurementAccess !== 'IGNORE' &&
      obscurementRank[parsed.environment.obscurement] >
        obscurementAccessRank[capability.obscurementAccess]
    )
      reasons.push('OBSCUREMENT_INSUFFICIENT')

    if (reasons.length === 0) qualifying.push(entry.identity)
    else rejected.push({ identity: entry.identity, reasons })
  }
  return { satisfied: qualifying.length > 0, qualifying, rejected }
}

function parseContributionRelation(
  value: unknown,
  allowedKinds: readonly CombatPerceptionContribution['kind'][],
  name: string
): readonly CombatPerceptionContributionSource[] {
  if (
    !Array.isArray(value) ||
    value.length > MAX_COMBAT_PERCEPTION_CONTRIBUTION_SOURCES_PER_RELATION
  )
    throw new Error(
      `${name} must contain at most ${MAX_COMBAT_PERCEPTION_CONTRIBUTION_SOURCES_PER_RELATION} entries.`
    )
  const sources = value.map(parseContributionSource)
  for (const source of sources) {
    if (!allowedKinds.includes(source.contribution.kind))
      throw new Error(`${name} contains a contribution for another relation.`)
  }
  return sources.sort(compareContributionSources)
}

function compareContributionSources(
  left: CombatPerceptionContributionSource,
  right: CombatPerceptionContributionSource
): number {
  return (
    left.sourceOrdinal - right.sourceOrdinal ||
    contributionSourceIdentityKey(left.source).localeCompare(
      contributionSourceIdentityKey(right.source)
    ) ||
    left.contribution.order - right.contribution.order ||
    left.contribution.id.localeCompare(right.contribution.id)
  )
}

function contributionSourceIdentityKey(source: CombatPerceptionContributionSourceIdentity): string {
  return source.kind === 'ACTIVE_EFFECT'
    ? `ACTIVE_EFFECT:${source.activeEffectId}`
    : `CONDITION_DEFINITION:${source.conditionDefinitionId}`
}

function sourceKey(source: CombatPerceptionContributionSource): string {
  return source.instanceId
}

function capabilityWithLimit(
  instance: CombatPerceptionCapabilityInstance,
  limit: CombatPerceptionAccessLimitContribution
): CombatPerceptionCapabilityInstance {
  if (!limit.channels.includes(instance.capability.channel)) return instance
  return {
    ...instance,
    capability: {
      ...instance.capability,
      accessGrade:
        limit.maximumAccessGrade === null
          ? instance.capability.accessGrade
          : lessPermissiveAccessGrade(instance.capability.accessGrade, limit.maximumAccessGrade),
      illuminationAccess:
        limit.maximumIlluminationAccess === null
          ? instance.capability.illuminationAccess
          : lessPermissiveIlluminationAccess(
              instance.capability.illuminationAccess,
              limit.maximumIlluminationAccess
            ),
      obscurementAccess:
        limit.maximumObscurementAccess === null
          ? instance.capability.obscurementAccess
          : lessPermissiveObscurementAccess(
              instance.capability.obscurementAccess,
              limit.maximumObscurementAccess
            ),
      perceivesInvisible:
        limit.perceivesInvisible === false ? false : instance.capability.perceivesInvisible
    }
  }
}

function lessPermissiveAccessGrade(
  current: CombatPerceptionAccessGrade,
  maximum: CombatPerceptionAccessGrade
): CombatPerceptionAccessGrade {
  return accessGradeRank(current) <= accessGradeRank(maximum) ? current : maximum
}

function illuminationAccessRankForLimit(value: CombatPerceptionIlluminationAccess): number {
  return value === 'IGNORE' ? 4 : illuminationAccessRank[value]
}

function lessPermissiveIlluminationAccess(
  current: CombatPerceptionIlluminationAccess,
  maximum: CombatPerceptionIlluminationAccess
): CombatPerceptionIlluminationAccess {
  return illuminationAccessRankForLimit(current) <= illuminationAccessRankForLimit(maximum)
    ? current
    : maximum
}

function obscurementAccessRankForLimit(value: CombatPerceptionObscurementAccess): number {
  return value === 'IGNORE' ? 3 : obscurementAccessRank[value]
}

function lessPermissiveObscurementAccess(
  current: CombatPerceptionObscurementAccess,
  maximum: CombatPerceptionObscurementAccess
): CombatPerceptionObscurementAccess {
  return obscurementAccessRankForLimit(current) <= obscurementAccessRankForLimit(maximum)
    ? current
    : maximum
}

function resolveLocalEnvironment(
  environment: CombatPerceptionEnvironment,
  sources: readonly CombatPerceptionContributionSource[]
): CombatPerceptionEnvironment {
  const illumination = resolveEnvironmentValue(
    environment.illumination,
    sources,
    (contribution) =>
      contribution.kind === 'ILLUMINATION_EFFECT' ? contribution.illumination : null,
    illuminationValues
  )
  const obscurement = resolveEnvironmentValue(
    environment.obscurement,
    sources,
    (contribution) =>
      contribution.kind === 'ILLUMINATION_EFFECT' ? contribution.obscurement : null,
    obscurementValues
  )
  return { ...environment, illumination, obscurement }
}

function resolveEnvironmentValue<T extends string>(
  base: T,
  sources: readonly CombatPerceptionContributionSource[],
  select: (contribution: CombatPerceptionContribution) => T | null,
  ranked: readonly T[]
): T {
  let selectedValue = base
  let selectedPrecedence: number | null = null
  for (const source of sources) {
    if (source.contribution.kind !== 'ILLUMINATION_EFFECT') continue
    const value = select(source.contribution)
    if (value === null) continue
    if (
      selectedPrecedence === null ||
      source.contribution.precedence > selectedPrecedence ||
      (source.contribution.precedence === selectedPrecedence &&
        ranked.indexOf(value) > ranked.indexOf(selectedValue))
    ) {
      selectedValue = value
      selectedPrecedence = source.contribution.precedence
    }
  }
  return selectedValue
}

/**
 * Applies frozen active-effect perception contributions then resolves the exact System requirement.
 * Relation placement is authoritative input: a contribution cannot change another relation's facts.
 */
export function resolveCombatPerceptionWithContributions(input: {
  requirement: CombatPerceptionRequirement
  environment: CombatPerceptionEnvironment
  capabilities: readonly CombatPerceptionCapabilityInstance[]
  observerContributions: readonly CombatPerceptionContributionSource[]
  subjectContributions: readonly CombatPerceptionContributionSource[]
  localAreaContributions: readonly CombatPerceptionContributionSource[]
}): CombatPerceptionContributionResult {
  const value = requireRecord(input, 'Combat perception contribution input')
  requireExactKeys(
    value,
    [
      'requirement',
      'environment',
      'capabilities',
      'observerContributions',
      'subjectContributions',
      'localAreaContributions'
    ],
    'Combat perception contribution input'
  )
  const parsed = parseRuntimeInput({
    requirement: value.requirement,
    environment: value.environment,
    capabilities: value.capabilities
  })
  const observerContributions = parseContributionRelation(
    value.observerContributions,
    ['SENSE_GRANT', 'SENSE_SUPPRESS', 'ACCESS_LIMIT'],
    'Combat perception observer contributions'
  )
  const subjectContributions = parseContributionRelation(
    value.subjectContributions,
    ['EMISSION_SUPPRESS'],
    'Combat perception subject contributions'
  )
  const localAreaContributions = parseContributionRelation(
    value.localAreaContributions,
    ['ILLUMINATION_EFFECT'],
    'Combat perception local-area contributions'
  )
  const appliedContributionSources = [
    ...observerContributions,
    ...subjectContributions,
    ...localAreaContributions
  ].sort(compareContributionSources)
  const seenSources = new Set<string>()
  for (const source of appliedContributionSources) {
    const key = sourceKey(source)
    if (seenSources.has(key))
      throw new Error('Combat perception contribution source identities must be unique.')
    seenSources.add(key)
  }

  let finalCapabilities = [...parsed.capabilities]
  for (const source of observerContributions) {
    const contribution = source.contribution
    if (contribution.kind === 'SENSE_GRANT') {
      finalCapabilities.push(
        ...contribution.document.capabilities.map((capability, capabilityOrdinal) => ({
          instanceId: source.instanceId,
          definitionId: contribution.senseDefinitionId,
          checksum: contribution.definitionChecksum,
          capabilityOrdinal,
          range: contribution.range,
          capability
        }))
      )
      continue
    }
    if (contribution.kind === 'SENSE_SUPPRESS') {
      finalCapabilities = finalCapabilities.filter(
        (instance) =>
          !contribution.senseDefinitionIds.includes(instance.definitionId.toLowerCase()) &&
          !contribution.channels.includes(instance.capability.channel)
      )
      continue
    }
    if (contribution.kind === 'ACCESS_LIMIT') {
      finalCapabilities = finalCapabilities.map((instance) =>
        capabilityWithLimit(instance, contribution)
      )
    }
  }
  if (finalCapabilities.length > MAX_COMBAT_PERCEPTION_CAPABILITY_INSTANCES)
    throw new Error(
      `Combat perception capabilities must contain at most ${MAX_COMBAT_PERCEPTION_CAPABILITY_INSTANCES} entries.`
    )

  const hardSuppressedChannels = new Set(parsed.environment.suppressedChannels)
  const invisibleChannels = new Set(parsed.environment.invisibleChannels)
  for (const source of subjectContributions) {
    const contribution = source.contribution
    if (contribution.kind !== 'EMISSION_SUPPRESS') continue
    const target = contribution.bypass === 'NONE' ? hardSuppressedChannels : invisibleChannels
    for (const channel of contribution.channels) target.add(channel)
  }
  const finalEnvironment = resolveLocalEnvironment(
    {
      ...parsed.environment,
      invisibleChannels: [...invisibleChannels].sort(),
      suppressedChannels: [...hardSuppressedChannels].sort()
    },
    localAreaContributions
  )
  const result = resolveParsedCombatPerception({
    requirement: parsed.requirement,
    environment: finalEnvironment,
    capabilities: finalCapabilities
  })
  return {
    ...result,
    finalCapabilities,
    finalEnvironment,
    appliedContributionSources: appliedContributionSources.map((source) => ({
      instanceId: source.instanceId,
      source: source.source,
      sourceOrdinal: source.sourceOrdinal,
      contributionId: source.contribution.id,
      contributionKind: source.contribution.kind,
      contributionOrder: source.contribution.order
    }))
  }
}

export const dnd5eCombatPerceptionCapabilityAdapter: CombatPerceptionCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  illuminationLevels: DND5E_ILLUMINATION_LEVELS,
  resolveCombatPerceptionWithContributions
}
