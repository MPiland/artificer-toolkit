import {
  createRulePackRepository,
  type DBLike,
  type RulePackRevisionRecord
} from '@artificer-toolkit/db'
import {
  rulePackDocumentDtoSchema,
  type ActivateRulePackRevisionInputDto,
  type ListRulePackRevisionsInputDto,
  type RetireRulePackInputDto,
  type RulePackDocumentDto,
  type RulePackRevisionDto,
  type RulePackSummaryDto,
  type SaveRulePackDraftInputDto,
  type SimulateRulePackInputDto,
  type SimulateRulePackResultDto
} from '@artificer-toolkit/schema/api/rules'
import { ENCOUNTER_ACTOR_MODEL_KEY } from '@artificer-toolkit/schema/api/encounterActorRules'
import { CHARACTER_GRANT_FOLD_MODEL_KEY } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import { CHARACTER_ACTION_MODEL_KEY } from '@artificer-toolkit/schema/api/characterActionRules'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { assertRulePackConformance } from './ruleConformance.js'
import { RuleDocumentValidationError, validateRulePackDocument } from './ruleDocumentValidation.js'
import {
  RULE_EVALUATOR_KIND,
  RULE_EVALUATOR_VERSION,
  RULE_MODEL_CONTRACT_VERSION
} from './ruleModelContracts.js'
import { evaluateZenRuleModel } from './zenRuleEngine.js'

const DND5E_RULESET_CODE = 'dnd5e'
const DND5E_2014_RULESET_VERSION = '2014'

export class RuleAccessError extends Error {
  constructor() {
    super('Superadmin access is required.')
    this.name = 'RuleAccessError'
  }
}

export class RuleNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleNotFoundError'
  }
}

export class RuleConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleConflictError'
  }
}

function requireSuperAdmin(isSuperAdmin: boolean): void {
  if (!isSuperAdmin) throw new RuleAccessError()
}

function requireRulesetOwnedModels(
  document: RulePackDocumentDto,
  rulesetCode: string,
  rulesetVersion: string
): void {
  if (rulesetCode !== DND5E_RULESET_CODE || rulesetVersion !== DND5E_2014_RULESET_VERSION) return

  const missing = [
    CHARACTER_GRANT_FOLD_MODEL_KEY,
    CHARACTER_ACTION_MODEL_KEY,
    ENCOUNTER_ACTOR_MODEL_KEY
  ].filter((modelKey) => !Object.hasOwn(document.models, modelKey))
  if (missing.length > 0) {
    throw new RuleDocumentValidationError(
      `The ${DND5E_RULESET_CODE}/${DND5E_2014_RULESET_VERSION} rule pack requires repository-owned models: ${missing.join(', ')}.`
    )
  }
}

function toRulePackRevisionDto(record: RulePackRevisionRecord): RulePackRevisionDto {
  return {
    id: record.id,
    packId: record.rulePackId,
    revision: record.revision,
    lifecycle: record.state,
    evaluatorKind: record.evaluatorKind,
    evaluatorVersion: record.evaluatorVersion,
    modelContractVersion: record.modelContractVersion,
    checksum: record.checksum,
    document: rulePackDocumentDtoSchema.parse(record.document),
    createdBy: record.createdBy,
    activatedBy: record.activatedBy,
    activatedAt: record.activatedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }
}

export async function listRulePacks(
  db: DBLike,
  _userId: string,
  isSuperAdmin: boolean
): Promise<RulePackSummaryDto[]> {
  requireSuperAdmin(isSuperAdmin)
  return (await createRulePackRepository(db).listPacks()).map((record) => ({
    id: record.id,
    rulesetCode: record.rulesetCode,
    rulesetVersion: record.version,
    activeRevisionId: record.activeRevisionId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }))
}

export async function listRulePackRevisions(
  db: DBLike,
  _userId: string,
  isSuperAdmin: boolean,
  input: ListRulePackRevisionsInputDto
): Promise<RulePackRevisionDto[]> {
  requireSuperAdmin(isSuperAdmin)
  return (await createRulePackRepository(db).listRevisions(input.packId)).map(toRulePackRevisionDto)
}

export async function getRulePackRevision(
  db: DBLike,
  _userId: string,
  isSuperAdmin: boolean,
  revisionId: string
): Promise<RulePackRevisionDto> {
  requireSuperAdmin(isSuperAdmin)
  const revision = await createRulePackRepository(db).getRevision(revisionId)
  if (!revision) throw new RuleNotFoundError('Rule pack revision was not found.')
  return toRulePackRevisionDto(revision)
}

export async function saveRulePackDraft(
  db: DBLike,
  userId: string,
  isSuperAdmin: boolean,
  input: SaveRulePackDraftInputDto
): Promise<RulePackRevisionDto> {
  requireSuperAdmin(isSuperAdmin)
  const document = rulePackDocumentDtoSchema.parse(input.document)
  validateRulePackDocument(document)
  requireRulesetOwnedModels(document, input.rulesetCode, input.rulesetVersion)

  const repository = createRulePackRepository(db)
  const pack = await repository.findOrCreatePack(input.rulesetCode, input.rulesetVersion)
  const draft = await repository.saveDraft({
    rulePackId: pack.id,
    expectedUpdatedAt: input.expectedUpdatedAt ?? null,
    evaluatorKind: RULE_EVALUATOR_KIND,
    evaluatorVersion: RULE_EVALUATOR_VERSION,
    modelContractVersion: RULE_MODEL_CONTRACT_VERSION,
    document,
    checksum: checksumRuleDocument(document),
    createdBy: userId
  })
  if (!draft) throw new RuleConflictError('Rule pack draft was changed by another editor.')
  return toRulePackRevisionDto(draft)
}

export async function simulateRulePack(
  _db: DBLike,
  _userId: string,
  isSuperAdmin: boolean,
  input: SimulateRulePackInputDto
): Promise<SimulateRulePackResultDto> {
  requireSuperAdmin(isSuperAdmin)
  const document = rulePackDocumentDtoSchema.parse(input.document)
  requireRulesetOwnedModels(document, input.rulesetCode, input.rulesetVersion)
  return evaluateZenRuleModel({
    document,
    modelKey: input.modelKey,
    context: input.input,
    trace: true
  })
}

export async function activateRulePackRevision(
  db: DBLike,
  userId: string,
  isSuperAdmin: boolean,
  input: ActivateRulePackRevisionInputDto
): Promise<RulePackRevisionDto> {
  requireSuperAdmin(isSuperAdmin)
  const repository = createRulePackRepository(db)
  const stored = await repository.getRevisionWithPack(input.revisionId)
  if (!stored) throw new RuleNotFoundError('Rule pack revision was not found.')
  const { pack, revision } = stored
  if (revision.state !== 'DRAFT') {
    throw new RuleConflictError('Only draft rule pack revisions can be activated.')
  }
  if (revision.checksum !== input.expectedChecksum) {
    throw new RuleConflictError('Rule pack revision was changed by another editor.')
  }
  if (
    revision.evaluatorKind !== RULE_EVALUATOR_KIND ||
    revision.evaluatorVersion !== RULE_EVALUATOR_VERSION ||
    revision.modelContractVersion !== RULE_MODEL_CONTRACT_VERSION
  ) {
    throw new RuleConflictError('Rule pack revision uses an unsupported runtime contract.')
  }

  const document: RulePackDocumentDto = rulePackDocumentDtoSchema.parse(revision.document)
  requireRulesetOwnedModels(document, pack.rulesetCode, pack.version)
  await assertRulePackConformance(document)
  const activated = await repository.activateDraft({
    rulePackId: revision.rulePackId,
    revisionId: revision.id,
    checksum: input.expectedChecksum,
    actorId: userId
  })
  if (!activated) throw new RuleConflictError('Rule pack revision was changed by another editor.')
  return toRulePackRevisionDto(activated)
}

export async function retireRulePack(
  db: DBLike,
  _userId: string,
  isSuperAdmin: boolean,
  input: RetireRulePackInputDto
): Promise<{ ok: true }> {
  requireSuperAdmin(isSuperAdmin)
  const retired = await createRulePackRepository(db).retireActiveRevision({
    rulePackId: input.packId,
    expectedRevisionId: input.expectedRevisionId
  })
  if (!retired) throw new RuleConflictError('The active rule pack revision was changed.')
  return { ok: true }
}
