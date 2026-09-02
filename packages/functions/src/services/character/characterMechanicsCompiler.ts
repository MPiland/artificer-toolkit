import {
  checksumCharacterMechanicsCommandState,
  checksumCharacterMechanicsCommandLane,
  checksumCharacterMechanicsProjection,
  createAuthoredVersionRepository,
  createReusableDefinitionRepository,
  normalizeCanonicalJson,
  type AuthoredVersionRecord,
  type DBLike
} from '@artificer-toolkit/db'
import {
  characterMechanicsProjectionSchema,
  characterMechanicsRuleSnapshotSchema,
  type CharacterMechanicsProjection,
  type CharacterMechanicsRuleSnapshot
} from '@artificer-toolkit/schema/projections/characterMechanics'
import {
  pinnedSenseDefinitionSchema,
  type PinnedSenseDefinition
} from '@artificer-toolkit/schema/projections/characterMechanics'
import type {
  AuthoredSubjectKind,
  AuthoredVersionVector
} from '@artificer-toolkit/schema/projections/identity'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import { normalizeAbilityKey } from '@artificer-toolkit/shared/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import type { CompiledActionEntryPoint } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { CharacterInitiativeActorFacts } from '@artificer-toolkit/schema/projections/characterMechanics'
import { senseReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/combatPerception'

import type { CharacterRuleBinding } from './characterRuleBinding.js'
import { collectCharacterRuleOutputSpellIds } from './characterSpellRuleFacts.js'
import {
  findCampaignCharacterSource,
  type CampaignCharacterContentOverlay
} from './campaignCharacterContent.js'

export const CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION = 2

export interface CharacterMechanicsCompilerInput {
  authoredVersionVector: CharacterMechanicsProjection['authoredVersionVector']
  characterId: string
  characterCommandState: CharacterAuthored
  characterStreamVersion: number
  ruleBinding: CharacterRuleBinding
  rulePolicyInput: CharacterRulePolicyInput
  rulePolicyOutput: CharacterRulePolicyOutput
  compiledActionEntryPoints: readonly CompiledActionEntryPoint[]
  /** Additional v4 spell-cast entries sealed by the caller's exact authored vector. */
  compiledSpellActionEntryPoints?: readonly CompiledActionEntryPoint[]
  ruleRegistry: CharacterAssemblyRegistry | CharacterMechanicsProjection['ruleRegistry']
  ruleSnapshot: CharacterBuildSnapshot | CharacterMechanicsProjection['ruleSnapshot']
  pinnedSenseDefinitions?: readonly PinnedSenseDefinition[]
  vocabularySnapshot: Pick<SystemVocabularySnapshot, 'checksum' | 'snapshotId' | 'snapshotVersion'>
}

export async function resolvePinnedCharacterSenseDefinitions(input: {
  db: DBLike
  gameSystemId: string
  senses: CharacterRulePolicyOutput['senses']
}): Promise<PinnedSenseDefinition[]> {
  const uniqueSenseIds = [...new Set(input.senses.map((sense) => sense.senseDefinitionId))].sort(
    (left, right) => left.localeCompare(right)
  )
  if (uniqueSenseIds.length !== input.senses.length) {
    throw new Error('Final Character senses must have unique definition identities.')
  }
  const repository = createReusableDefinitionRepository(input.db)
  const currentById = new Map(
    await Promise.all(
      uniqueSenseIds.map(
        async (senseDefinitionId) =>
          [senseDefinitionId, await repository.requireCurrent(senseDefinitionId)] as const
      )
    )
  )
  return uniqueSenseIds.map((senseDefinitionId) => {
    const current = currentById.get(senseDefinitionId)
    const sense = input.senses.find(
      (candidate) => candidate.senseDefinitionId === senseDefinitionId
    )
    if (!current || !sense)
      throw new Error('Character sense definition resolution changed unexpectedly.')
    const document = senseReusableDefinitionDocumentDtoSchema.parse(current.document)
    if (
      current.definitionFamilyKey !== 'sense' ||
      current.id !== senseDefinitionId ||
      current.gameSystemId !== input.gameSystemId ||
      document.id !== senseDefinitionId ||
      document.gameSystemId !== input.gameSystemId
    ) {
      throw new Error('Character sense definition is not a current same-System sense document.')
    }
    if (checksumRuleDocument(document) !== current.checksum) {
      throw new Error('Character sense definition checksum does not match its current document.')
    }
    return pinnedSenseDefinitionSchema.parse({
      senseDefinitionId,
      definitionVersion: current.version,
      definitionContractVersion: current.contractVersion,
      definitionChecksum: current.checksum,
      document,
      range: sense.range
    })
  })
}

export function carryPinnedCharacterSenseDefinitions(input: {
  prior: readonly PinnedSenseDefinition[]
  senses: CharacterRulePolicyOutput['senses']
}): PinnedSenseDefinition[] {
  const priorById = new Map(input.prior.map((pin) => [pin.senseDefinitionId, pin]))
  return [...input.senses]
    .sort((left, right) => left.senseDefinitionId.localeCompare(right.senseDefinitionId))
    .map((sense) => {
      const prior = priorById.get(sense.senseDefinitionId)
      if (!prior) {
        throw new Error('A republished Character sense has no prior immutable definition pin.')
      }
      return pinnedSenseDefinitionSchema.parse({ ...prior, range: sense.range })
    })
}

function toCharacterMechanicsRuleSnapshot(
  snapshot: CharacterBuildSnapshot | CharacterMechanicsProjection['ruleSnapshot']
): CharacterMechanicsRuleSnapshot {
  if (!('totalLevel' in snapshot)) return characterMechanicsRuleSnapshotSchema.parse(snapshot)
  return characterMechanicsRuleSnapshotSchema.parse({
    characterId: snapshot.characterId,
    systemId: snapshot.systemId,
    classes: snapshot.classes.map(({ classId, subclassId }) => ({
      classId,
      ...(subclassId ? { subclassId } : {})
    })),
    features: snapshot.features.map(({ featureId, source }) => ({
      featureId,
      source
    })),
    equipmentItems: snapshot.equipmentItems.map(({ instanceId, contentRef, compiledItem }) => ({
      instanceId,
      contentRef,
      compiledItem: { category: compiledItem.category }
    }))
  })
}

/**
 * Extracts exact actor facts from the same compiled authored snapshot that is
 * pinned into a Character mechanics projection. The shared engine carries
 * only these codes; a System policy decides whether a given property or size
 * has mechanical significance.
 */
function toCharacterInitiativeActorFacts(input: {
  snapshot: CharacterBuildSnapshot | CharacterMechanicsProjection['ruleSnapshot']
  registry: CharacterAssemblyRegistry | CharacterMechanicsProjection['ruleRegistry']
  rulePolicyOutput: CharacterRulePolicyOutput
}): CharacterInitiativeActorFacts {
  if (!('totalLevel' in input.snapshot)) {
    // Historical compact rule snapshots intentionally do not carry the
    // source facts. They remain readable but cannot authorize declared-action
    // initiative without a freshly compiled Character projection.
    return { effectiveSize: null, checkTotals: {}, equippedItems: [] }
  }
  const registry = input.registry as CharacterAssemblyRegistry
  const checkTotals: Record<string, number> = {}
  if (registry.system?.schemaVersion === 4) {
    const skillsById = new Map<
      string,
      CharacterRulePolicyOutput['derivedStats']['skills'][number]
    >()
    for (const skill of input.rulePolicyOutput.derivedStats.skills) {
      if (skillsById.has(skill.skillId)) {
        throw new Error(`Character rule policy produced duplicate skill "${skill.skillId}".`)
      }
      skillsById.set(skill.skillId, skill)
    }
    const abilitiesById = new Map<string, string>()
    for (const ability of registry.system.abilities ?? []) {
      const abilityCode = normalizeAbilityKey(ability.code)
      if (!abilityCode || abilitiesById.has(ability.id)) {
        throw new Error(`System ability definition "${ability.id}" is ambiguous.`)
      }
      abilitiesById.set(ability.id, abilityCode)
    }
    const checkIds = new Set<string>()
    const checkSkillIds = new Set<string>()
    for (const check of [...(registry.system.skills ?? [])].sort((left, right) =>
      left.id.localeCompare(right.id)
    )) {
      if (check.governingAbilityDefinitionId === null) continue
      if (!check.governingAbilityDefinitionId) {
        throw new Error(`System check definition "${check.id}" has no governing ability.`)
      }
      const governingAbility = abilitiesById.get(check.governingAbilityDefinitionId)
      const skillId = check.code?.toLowerCase().trim().replace(/_/g, '-').replace(/\s+/g, '-')
      const skill = skillId ? skillsById.get(skillId) : undefined
      if (
        !skillId ||
        !skill ||
        !governingAbility ||
        checkIds.has(check.id) ||
        checkSkillIds.has(skillId) ||
        skill.governingAbility.effective !== governingAbility
      ) {
        throw new Error(
          `System check definition "${check.id}" does not match Character rule policy.`
        )
      }
      checkIds.add(check.id)
      checkSkillIds.add(skillId)
      checkTotals[check.id] = skill.total.effective
    }
    if (checkSkillIds.size !== skillsById.size) {
      throw new Error(
        'Character rule policy skills do not map one-to-one to System check definitions.'
      )
    }
  }
  const raceId = input.snapshot.subraceId ?? input.snapshot.raceId
  const effectiveSize = raceId ? (registry.races[raceId]?.size ?? null) : null
  const equippedItems = input.snapshot.equipmentItems
    .filter((item) => item.equippedState !== undefined)
    .map((item) => ({
      itemInstanceId: item.instanceId,
      equipmentDefinitionId: item.contentRef.definitionId,
      properties: [...new Set(item.compiledItem.properties ?? [])].sort()
    }))
    .sort((left, right) => left.itemInstanceId.localeCompare(right.itemInstanceId))
  return { effectiveSize, checkTotals, equippedItems }
}

function sortAuthoredVersionVector(
  vector: CharacterMechanicsProjection['authoredVersionVector']
): CharacterMechanicsProjection['authoredVersionVector'] {
  return [...vector].sort((left, right) => {
    const leftKey = `${left.subjectKind}:${left.subjectId}`
    const rightKey = `${right.subjectKind}:${right.subjectId}`
    return leftKey.localeCompare(rightKey)
  })
}

function addSubjectId(
  requirements: Map<AuthoredSubjectKind, Set<string>>,
  subjectKind: AuthoredSubjectKind,
  subjectId: string | undefined
): void {
  if (!subjectId) return
  requirements.get(subjectKind)?.add(subjectId)
}

export function collectCharacterAuthoredVersionRequirements(input: {
  character: CharacterAuthored
  rulePolicyOutput: CharacterRulePolicyOutput
  ruleRegistry: CharacterAssemblyRegistry
}): Map<AuthoredSubjectKind, Set<string>> {
  const requirements = new Map<AuthoredSubjectKind, Set<string>>()
  for (const subjectKind of [
    'BACKGROUND',
    'CLASS',
    'CREATURE',
    'EQUIPMENT',
    'FEAT',
    'RACE',
    'SPELL',
    'VEHICLE'
  ] as const) {
    requirements.set(subjectKind, new Set<string>())
  }
  const { character } = input

  addSubjectId(requirements, 'BACKGROUND', character.intent.background.backgroundId)
  addSubjectId(requirements, 'RACE', character.intent.race.raceId)
  addSubjectId(requirements, 'RACE', character.intent.race.subraceId)
  for (const entry of character.intent.classes) {
    addSubjectId(requirements, 'CLASS', entry.classId)
    addSubjectId(requirements, 'CLASS', entry.subclassId)
  }
  for (const creature of character.state.creatures ?? []) {
    addSubjectId(requirements, 'CREATURE', creature.creatureId)
  }
  for (const vehicle of character.state.vehicles ?? []) {
    addSubjectId(requirements, 'VEHICLE', vehicle.vehicleId)
  }
  for (const equipment of character.state.equipment.inventory) {
    addSubjectId(requirements, 'EQUIPMENT', equipment.equipmentId)
  }
  for (const featId of Object.keys(input.ruleRegistry.feats)) {
    addSubjectId(requirements, 'FEAT', featId)
  }
  for (const equipmentId of Object.keys(input.ruleRegistry.equipment)) {
    addSubjectId(requirements, 'EQUIPMENT', equipmentId)
  }
  for (const spellId of collectCharacterRuleOutputSpellIds(input.rulePolicyOutput)) {
    addSubjectId(requirements, 'SPELL', spellId)
  }

  return requirements
}

export async function loadCurrentCharacterAuthoredVersionVector(input: {
  campaignContent?: CampaignCharacterContentOverlay | null
  character: CharacterAuthored
  db: DBLike
  rulePolicyOutput: CharacterRulePolicyOutput
  ruleRegistry: CharacterAssemblyRegistry
}): Promise<CharacterMechanicsProjection['authoredVersionVector']> {
  const requirements = collectCharacterAuthoredVersionRequirements(input)
  const repository = createAuthoredVersionRepository(input.db)
  const subjectKinds: AuthoredSubjectKind[] = [
    'BACKGROUND',
    'CLASS',
    'CREATURE',
    'EQUIPMENT',
    'FEAT',
    'RACE',
    'SPELL',
    'VEHICLE'
  ]
  const activeRequirements = new Map<AuthoredSubjectKind, string[]>()
  for (const subjectKind of subjectKinds) {
    activeRequirements.set(
      subjectKind,
      [...(requirements.get(subjectKind) ?? [])].filter(
        (subjectId) =>
          !findCampaignCharacterSource(input.campaignContent ?? null, subjectKind, subjectId)
      )
    )
  }
  const recordsByKind = await Promise.all(
    subjectKinds.map(
      async (subjectKind) =>
        [
          subjectKind,
          await repository.findActiveByIds({
            subjectKind,
            subjectIds: activeRequirements.get(subjectKind) ?? [],
            systemId: input.character.systemId,
            userId: input.character.userId,
            includeMaster: true
          })
        ] as const
    )
  )

  const vectorByRoot = new Map<string, AuthoredVersionVector[number]>()
  const recordsByRoot = new Map<string, AuthoredVersionRecord>()
  const dependenciesToLoad = new Map<string, AuthoredVersionVector[number]>()
  const rootKey = (entry: Pick<AuthoredVersionVector[number], 'subjectKind' | 'subjectId'>) =>
    `${entry.subjectKind}:${entry.subjectId}`
  const addVectorEntry = (entry: AuthoredVersionVector[number]) => {
    const key = rootKey(entry)
    const existing = vectorByRoot.get(key)
    if (
      existing &&
      (existing.versionId !== entry.versionId ||
        existing.version !== entry.version ||
        existing.checksum !== entry.checksum)
    ) {
      throw new Error(
        `Character "${input.character.id}" resolves conflicting ${entry.subjectKind} versions for "${entry.subjectId}".`
      )
    }
    vectorByRoot.set(key, entry)
  }
  const addRecord = (record: AuthoredVersionRecord) => {
    const entry = {
      subjectKind: record.authored.subjectKind,
      subjectId: record.authored.subjectId,
      versionId: record.authored.versionId,
      version: record.authored.version,
      checksum: record.authored.checksum
    } as const
    addVectorEntry(entry)
    recordsByRoot.set(rootKey(entry), record)
  }

  for (const [subjectKind, records] of recordsByKind) {
    for (const subjectId of requirements.get(subjectKind) ?? []) {
      const campaign = findCampaignCharacterSource(
        input.campaignContent ?? null,
        subjectKind,
        subjectId
      )
      if (campaign) {
        addVectorEntry({
          subjectKind,
          subjectId,
          versionId: campaign.authoredVersionId,
          version: campaign.authoredVersion,
          checksum: campaign.authoredChecksum
        })
        for (const dependency of campaign.authoredDependencies) {
          addVectorEntry(dependency)
          dependenciesToLoad.set(rootKey(dependency), dependency)
        }
        continue
      }
      const record = records.get(subjectId)
      if (!record) {
        throw new Error(
          `Character "${input.character.id}" requires an active ${subjectKind} "${subjectId}" version.`
        )
      }
      addRecord(record)
    }
  }
  const visitedRoots = new Set<string>()
  while (true) {
    for (const [key, record] of recordsByRoot) {
      if (visitedRoots.has(key)) continue
      visitedRoots.add(key)
      for (const dependency of record.compiled.authoredDependencies) {
        addVectorEntry(dependency)
        if (!recordsByRoot.has(rootKey(dependency))) {
          dependenciesToLoad.set(rootKey(dependency), dependency)
        }
      }
    }
    const pending = [...dependenciesToLoad.values()].filter(
      (dependency) => !recordsByRoot.has(rootKey(dependency))
    )
    if (pending.length === 0) break
    dependenciesToLoad.clear()
    const resolved = await repository.findExactVersions({ entries: pending })
    for (const record of resolved.values()) addRecord(record)
  }
  return sortAuthoredVersionVector([...vectorByRoot.values()])
}

export function compileCharacterMechanicsProjection(
  input: CharacterMechanicsCompilerInput
): CharacterMechanicsProjection {
  const commandStateChecksum = checksumCharacterMechanicsCommandState(input.characterCommandState)
  const laneCandidate = {
    characterId: input.characterId,
    commandState: input.characterCommandState,
    commandStateChecksum,
    projectionSchemaVersion: CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
    commandLaneChecksum: '0'.repeat(64),
    projectionChecksum: '0'.repeat(64),
    characterStreamVersion: input.characterStreamVersion,
    authoredVersionVector: sortAuthoredVersionVector(input.authoredVersionVector),
    systemVocabularySnapshotId: input.vocabularySnapshot.snapshotId,
    systemVocabularySnapshotVersion: input.vocabularySnapshot.snapshotVersion,
    systemVocabularySnapshotChecksum: input.vocabularySnapshot.checksum,
    ruleRevisionId: input.ruleBinding.revisionId,
    ruleRevisionChecksum: input.ruleBinding.checksum,
    evaluatorVersion: input.ruleBinding.evaluatorVersion,
    modelContractVersion: input.ruleBinding.modelContractVersion,
    ruleSnapshot: toCharacterMechanicsRuleSnapshot(input.ruleSnapshot),
    rulePolicyInput: input.rulePolicyInput,
    rulePolicyOutput: input.rulePolicyOutput,
    initiativeActorFacts: toCharacterInitiativeActorFacts({
      snapshot: input.ruleSnapshot,
      registry: input.ruleRegistry,
      rulePolicyOutput: input.rulePolicyOutput
    }),
    pinnedSenseDefinitions: input.pinnedSenseDefinitions ?? [],
    compiledActionEntryPoints: [
      ...input.compiledActionEntryPoints,
      ...(input.compiledSpellActionEntryPoints ?? [])
    ],
    ruleRegistry: normalizeCanonicalJson(input.ruleRegistry)
  } as const
  const candidate = characterMechanicsProjectionSchema.parse({
    ...laneCandidate,
    commandLaneChecksum: checksumCharacterMechanicsCommandLane(laneCandidate)
  })

  return {
    ...candidate,
    projectionChecksum: checksumCharacterMechanicsProjection(candidate)
  }
}

/**
 * Advances only canonical Sheet command state from an already verified
 * committed projection. The immutable authored, vocabulary, rule, and
 * evaluator inputs remain byte-identical while both checksums are rebuilt.
 */
export function advanceCharacterMechanicsProjectionCommandState(input: {
  characterCommandState: CharacterAuthored
  characterStreamVersion: number
  current: CharacterMechanicsProjection
}): CharacterMechanicsProjection {
  const commandStateChecksum = checksumCharacterMechanicsCommandState(input.characterCommandState)
  const laneCandidate = {
    ...input.current,
    characterStreamVersion: input.characterStreamVersion,
    commandState: input.characterCommandState,
    commandStateChecksum,
    commandLaneChecksum: '0'.repeat(64),
    projectionChecksum: '0'.repeat(64)
  }
  const candidate = characterMechanicsProjectionSchema.parse({
    ...laneCandidate,
    commandLaneChecksum: checksumCharacterMechanicsCommandLane(laneCandidate)
  })
  return {
    ...candidate,
    projectionChecksum: checksumCharacterMechanicsProjection(candidate)
  }
}

/**
 * Advances a committed Character action-state evaluation after aggregate-owned
 * resource usage changes. Authored, vocabulary, graph, and entry-point pins
 * remain unchanged; only the evaluated action/resource policy state advances.
 */
export function advanceCharacterMechanicsProjectionActionState(input: {
  characterStreamVersion: number
  current: CharacterMechanicsProjection
  rulePolicyInput: CharacterRulePolicyInput
  rulePolicyOutput: CharacterRulePolicyOutput
}): CharacterMechanicsProjection {
  const commandStateChecksum = checksumCharacterMechanicsCommandState(input.current.commandState)
  const laneCandidate = {
    ...input.current,
    characterStreamVersion: input.characterStreamVersion,
    commandStateChecksum,
    rulePolicyInput: input.rulePolicyInput,
    rulePolicyOutput: input.rulePolicyOutput,
    commandLaneChecksum: '0'.repeat(64),
    projectionChecksum: '0'.repeat(64)
  }
  const candidate = characterMechanicsProjectionSchema.parse({
    ...laneCandidate,
    commandLaneChecksum: checksumCharacterMechanicsCommandLane(laneCandidate)
  })
  return {
    ...candidate,
    projectionChecksum: checksumCharacterMechanicsProjection(candidate)
  }
}
