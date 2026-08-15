import {
  createRulePackRepository,
  type DBLike,
  type RulePackRevisionRecord
} from '@artificer-toolkit/db'

import {
  getRuleModelContract,
  RULE_EVALUATOR_KIND,
  RULE_EVALUATOR_VERSION
} from '../rules/ruleModelContracts.js'

export interface CharacterRuleBinding {
  revisionId: string
  checksum: string
  evaluatorKind: RulePackRevisionRecord['evaluatorKind']
  evaluatorVersion: string
  modelContractVersion: number
}

function bindingError(message: string): Error {
  const error = new Error(message)
  error.name = 'CharacterRuleBindingError'
  return error
}

function toBinding(revision: RulePackRevisionRecord): CharacterRuleBinding {
  const contract = getRuleModelContract('character-policy', revision.modelContractVersion)
  const models = revision.document.models
  if (
    !contract ||
    revision.evaluatorKind !== RULE_EVALUATOR_KIND ||
    revision.evaluatorVersion !== RULE_EVALUATOR_VERSION ||
    typeof models !== 'object' ||
    models === null ||
    Array.isArray(models) ||
    !Object.hasOwn(models, 'character-policy')
  ) {
    throw bindingError('The Character rule revision uses an unsupported evaluator contract.')
  }
  return {
    revisionId: revision.id,
    checksum: revision.checksum,
    evaluatorKind: revision.evaluatorKind,
    evaluatorVersion: revision.evaluatorVersion,
    modelContractVersion: revision.modelContractVersion
  }
}

export async function resolveCharacterRuleBinding(input: {
  db: DBLike
  systemId: string
  existingRevisionId: string | null
  expectedRevisionId?: string
}): Promise<CharacterRuleBinding> {
  const repository = createRulePackRepository(input.db)
  let binding: CharacterRuleBinding
  if (input.existingRevisionId) {
    const pinned = await repository.getRevisionWithPack(input.existingRevisionId)
    if (!pinned || pinned.revision.state === 'DRAFT') {
      throw bindingError("The Character's pinned rule revision is unavailable.")
    }

    const system = await repository.findRulesetForSystem(input.systemId)
    if (!system) throw bindingError('The Character references an unavailable game system.')
    if (pinned.pack.rulesetCode !== system.code || pinned.pack.version !== system.version) {
      throw bindingError(
        "The Character's pinned rule revision is incompatible with its game system."
      )
    }
    binding = toBinding(pinned.revision)
  } else {
    const system = await repository.findRulesetForSystem(input.systemId)
    if (!system) throw bindingError('The Character references an unavailable game system.')

    const revision = await repository.findActiveByRuleset(system.code, system.version)
    if (!revision) {
      throw bindingError(`No active rule revision exists for ${system.code} ${system.version}.`)
    }
    binding = toBinding(revision)
  }

  if (input.expectedRevisionId && binding.revisionId !== input.expectedRevisionId) {
    throw bindingError('The Character rule revision changed before the save could be completed.')
  }

  return binding
}
