import {
  checksumCharacterMechanicsCommandState,
  checksumCharacterMechanicsCommandLane,
  checksumCharacterMechanicsProjection,
  createAuthoredVersionRepository,
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
import type {
  AuthoredSubjectKind,
  AuthoredVersionVector
} from '@artificer-toolkit/schema/projections/identity'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

import type { CharacterRuleBinding } from './characterRuleBinding.js'
import { collectCharacterRuleOutputSpellIds } from './characterSpellRuleFacts.js'
import {
  findCampaignCharacterSource,
  type CampaignCharacterContentOverlay
} from './campaignCharacterContent.js'

export const CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION = 1

export interface CharacterMechanicsCompilerInput {
  authoredVersionVector: CharacterMechanicsProjection['authoredVersionVector']
  characterId: string
  characterCommandState: CharacterAuthored
  characterStreamVersion: number
  ruleBinding: CharacterRuleBinding
  rulePolicyInput: CharacterRulePolicyInput
  rulePolicyOutput: CharacterRulePolicyOutput
  ruleRegistry: CharacterAssemblyRegistry | CharacterMechanicsProjection['ruleRegistry']
  ruleSnapshot: CharacterBuildSnapshot | CharacterMechanicsProjection['ruleSnapshot']
  vocabularySnapshot: Pick<SystemVocabularySnapshot, 'checksum' | 'snapshotId' | 'snapshotVersion'>
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
    features: snapshot.features.map(({ featureId, source }) => ({ featureId, source })),
    equipmentItems: snapshot.equipmentItems.map(({ instanceId, contentRef, compiledItem }) => ({
      instanceId,
      contentRef,
      compiledItem: { category: compiledItem.category }
    }))
  })
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
