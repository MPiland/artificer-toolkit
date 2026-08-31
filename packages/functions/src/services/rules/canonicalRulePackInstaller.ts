import {
  createRulePackRepository,
  type DBLike,
  type RulePackRevisionRecord
} from '@artificer-toolkit/db'
import {
  rulePackDocumentDtoSchema,
  type RulePackDocumentDto
} from '@artificer-toolkit/schema/api/rules'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { assertRulePackConformance } from './ruleConformance.js'
import { dnd5e2014CanonicalRulePackDocument } from './systems/dnd5e/2014/canonicalRulePack.js'
import {
  RULE_EVALUATOR_KIND,
  RULE_EVALUATOR_VERSION,
  RULE_MODEL_CONTRACT_VERSION
} from './ruleModelContracts.js'

const RULESET_CODE = 'dnd5e'
const RULESET_VERSION = '2014'

export type CanonicalRulePackInstallResult =
  | { status: 'activated'; revisionId: string; backfilledCharacters: number }
  | { status: 'unchanged'; revisionId: string; backfilledCharacters: number }

function mergeCanonicalDocument(
  activeDocument: RulePackDocumentDto | null,
  canonicalDocument: RulePackDocumentDto
): RulePackDocumentDto {
  const canonicalModelKeys = new Set(Object.keys(canonicalDocument.models))
  return rulePackDocumentDtoSchema.parse({
    schemaVersion: 1,
    models: {
      ...(activeDocument?.models ?? {}),
      ...canonicalDocument.models
    },
    fixtures: [
      ...(activeDocument?.fixtures.filter((fixture) => !canonicalModelKeys.has(fixture.modelKey)) ??
        []),
      ...canonicalDocument.fixtures
    ]
  })
}

function findDraft(revisions: RulePackRevisionRecord[]): RulePackRevisionRecord | null {
  return revisions.find((revision) => revision.state === 'DRAFT') ?? null
}

export async function installDnd5e2014CanonicalRulePack(
  db: DBLike
): Promise<CanonicalRulePackInstallResult> {
  const repository = createRulePackRepository(db)
  const seededRuleset = await repository.findSeededRuleset(RULESET_CODE, RULESET_VERSION)
  if (!seededRuleset?.ownerId) {
    throw new Error(
      'Seeded dnd5e/2014 system with an owner is required before rule-pack installation.'
    )
  }

  const pack = await repository.findOrCreatePack(RULESET_CODE, RULESET_VERSION)
  const active = await repository.findActiveByRuleset(RULESET_CODE, RULESET_VERSION)
  const activeDocument = active ? rulePackDocumentDtoSchema.parse(active.document) : null
  const document = mergeCanonicalDocument(activeDocument, dnd5e2014CanonicalRulePackDocument)
  await assertRulePackConformance(document)

  const checksum = checksumRuleDocument(document)
  if (
    active?.checksum === checksum &&
    active.evaluatorKind === RULE_EVALUATOR_KIND &&
    active.evaluatorVersion === RULE_EVALUATOR_VERSION &&
    active.modelContractVersion === RULE_MODEL_CONTRACT_VERSION
  ) {
    return {
      status: 'unchanged',
      revisionId: active.id,
      backfilledCharacters: await repository.backfillActiveCharacterRevision({
        rulesetCode: RULESET_CODE,
        version: RULESET_VERSION,
        revisionId: active.id
      })
    }
  }

  const draft = findDraft(await repository.listRevisions(pack.id))
  if (draft && draft.checksum !== checksum) {
    throw new Error(
      'Cannot install canonical dnd5e/2014 rules while a different admin draft exists.'
    )
  }
  const target = await repository.saveDraft({
    rulePackId: pack.id,
    expectedUpdatedAt: draft?.updatedAt ?? null,
    evaluatorKind: RULE_EVALUATOR_KIND,
    evaluatorVersion: RULE_EVALUATOR_VERSION,
    modelContractVersion: RULE_MODEL_CONTRACT_VERSION,
    document,
    checksum,
    createdBy: seededRuleset.ownerId
  })
  if (!target) throw new Error('Canonical dnd5e/2014 rule-pack draft could not be created.')

  const activated = await repository.activateDraft({
    rulePackId: pack.id,
    revisionId: target.id,
    checksum,
    actorId: seededRuleset.ownerId,
    expectedActiveRevisionId: active?.id ?? null
  })
  if (!activated) {
    throw new Error(
      'Canonical dnd5e/2014 rule-pack installation conflicted with another activation.'
    )
  }
  return {
    status: 'activated',
    revisionId: activated.id,
    backfilledCharacters: await repository.backfillActiveCharacterRevision({
      rulesetCode: RULESET_CODE,
      version: RULESET_VERSION,
      revisionId: activated.id
    })
  }
}
