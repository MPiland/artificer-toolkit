import { describe, expect, it } from 'vitest'

import type { ReusableDefinitionRootRecord } from '@artificer-toolkit/db'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import type { ReusableDefinitionDraftDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { integerRangeEvidenceRuleOperation } from '@artificer-toolkit/shared/rules'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  createReusableDefinitionService,
  RULE_RUNTIME_GRAPH_FAMILY_KEY,
  type ReusableDefinitionStore
} from '../../reusableDefinitionService.js'
import {
  RuleDefinitionCompilationError,
  RuleRuntimeConfigurationError
} from '../../rulesRuntimeService.js'
import { createDnd5eCharacterActionRuntime } from './characterActionRuntime.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { dnd5eEffectActionCapability, dnd5eSaveTestOperation } from './effectActionCompiler.js'
import {
  createDnd5eConcentrationCheckDefinition,
  DND5E_CONCENTRATION_APPLIED_DAMAGE_FACT_KEY,
  DND5E_CONCENTRATION_CHECK_DEFINITION_ID,
  DND5E_CONCENTRATION_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
  DND5E_CONCENTRATION_DAMAGE_DC_OPERATION_KEY,
  dnd5eConcentrationDamageDcOperation,
  resolveDnd5eConcentrationSaveFacts,
  validateDnd5eConcentrationContributors,
  DND5E_CONCENTRATION_SAVE_MODIFIER_FACT_KEY,
  DND5E_CONCENTRATION_TARGET_ACTOR_FACT_KEY
} from './concentrationPolicy.js'

const ACTOR_ID = '00000000-0000-4000-8000-0000000000c3'
const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000000c4'
const CONTRIBUTOR_CHECKSUM = 'b'.repeat(64)
const USER_ID = '00000000-0000-4000-8000-0000000000c7'
const SOURCE_ID = '00000000-0000-4000-8000-0000000000c8'

function runtime() {
  return createDnd5eCharacterActionRuntime({
    continuationIntegrityKey: new Uint8Array(32).fill(1),
    definitions: {
      async requireCurrent() {
        return createDnd5eConcentrationCheckDefinition()
      }
    }
  })
}

function facts(input: { appliedDamage: number; modifier?: number }) {
  return {
    [DND5E_CONCENTRATION_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
    [DND5E_CONCENTRATION_APPLIED_DAMAGE_FACT_KEY]: input.appliedDamage,
    [DND5E_CONCENTRATION_SAVE_MODIFIER_FACT_KEY]: input.modifier ?? 2,
    [DND5E_CONCENTRATION_CONTRIBUTOR_CHECKSUM_FACT_KEY]: CONTRIBUTOR_CHECKSUM
  }
}

function userDefinitionRoot(): ReusableDefinitionRootRecord {
  return {
    id: DND5E_CONCENTRATION_CHECK_DEFINITION_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    contentSourceId: SOURCE_ID,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    label: 'Concentration damage check',
    description: null,
    version: 0,
    draftVersion: null,
    sourceKind: 'USER',
    sourceOwnerUserId: USER_ID,
    current: null
  }
}

function reusableDefinitionStore(): ReusableDefinitionStore {
  const root = userDefinitionRoot()
  let draft: ReusableDefinitionDraftDto | null = null
  return {
    async requireCurrent() {
      throw new Error('This publication-seam fixture does not read current definitions.')
    },
    async saveDraft(input) {
      input.authorize(root)
      const savedDraft: ReusableDefinitionDraftDto = {
        definitionId: root.id,
        gameSystemId: root.gameSystemId,
        authorUserId: input.actorUserId,
        document: ruleGraphDefinitionDtoSchema.parse(input.document),
        checksum: input.checksum,
        baseDefinitionVersion: root.version,
        version: input.expectedDraftVersion === null ? 0 : input.expectedDraftVersion + 1,
        createdAt: '2026-08-26T00:00:00.000Z',
        updatedAt: '2026-08-26T00:00:00.000Z'
      }
      draft = savedDraft
      return savedDraft
    },
    async publishDraft(input) {
      input.authorize(root)
      const savedDraft = draft
      if (!savedDraft) throw new Error('Draft must be saved before publication.')
      await input.validate(root, savedDraft, [])
      return {
        id: root.id,
        gameSystemId: root.gameSystemId,
        contentSourceId: root.contentSourceId,
        definitionFamilyKey: root.definitionFamilyKey,
        label: root.label,
        description: root.description,
        document: savedDraft.document,
        checksum: savedDraft.checksum,
        contractVersion: 1,
        version: root.version + 1,
        publishedAt: '2026-08-26T00:00:00.000Z',
        publishedBy: input.actorUserId
      }
    }
  }
}

describe('D&D concentration policy graph', () => {
  it.each([
    [1, 10],
    [20, 10],
    [21, 10],
    [22, 11]
  ])('derives DC %i from finalized applied damage %i', (appliedDamage, dc) => {
    expect(dnd5eConcentrationDamageDcOperation.execute({ appliedDamage })).toEqual({ dc })
  })

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid finalized damage %s',
    (appliedDamage) => {
      expect(() => dnd5eConcentrationDamageDcOperation.execute({ appliedDamage })).toThrow(
        'Applied damage must be a positive safe integer.'
      )
    }
  )

  it('derives only exact policy-selected save facts and contributor evidence', () => {
    const resolved = resolveDnd5eConcentrationSaveFacts({
      targetActorId: ACTOR_ID,
      appliedDamage: 13,
      rulePolicyOutput: {
        savingThrowDefinitions: [
          {
            abilityDefinitionId: '00000000-0000-0000-0011-000300000000',
            modifier: 4,
            rollMode: 'ADVANTAGE',
            contributors: [
              {
                sourceId: 'feature:resilient',
                grantId: 'grant:resilient',
                domainKey: 'SAVE:CONSTITUTION',
                influence: 'ADVANTAGE'
              }
            ]
          }
        ]
      }
    })
    expect(resolved).toMatchObject({
      modifier: 4,
      rollMode: 'ADVANTAGE',
      facts: {
        [DND5E_CONCENTRATION_TARGET_ACTOR_FACT_KEY]: ACTOR_ID,
        [DND5E_CONCENTRATION_APPLIED_DAMAGE_FACT_KEY]: 13,
        [DND5E_CONCENTRATION_SAVE_MODIFIER_FACT_KEY]: 4
      }
    })
    expect(resolved.contributorChecksum).toBe(
      checksumRuleDocument([
        {
          sourceId: 'feature:resilient',
          grantId: 'grant:resilient',
          domainKey: 'SAVE:CONSTITUTION',
          influence: 'ADVANTAGE'
        }
      ])
    )
    expect(resolved.contributors).toEqual([
      {
        sourceId: 'feature:resilient',
        grantId: 'grant:resilient',
        domainKey: 'SAVE:CONSTITUTION',
        influence: 'ADVANTAGE'
      }
    ])
    expect(() =>
      resolveDnd5eConcentrationSaveFacts({
        targetActorId: ACTOR_ID,
        appliedDamage: 1,
        rulePolicyOutput: {
          savingThrowDefinitions: []
        }
      })
    ).toThrow('D&D concentration saving throw is unavailable')
    expect(() =>
      resolveDnd5eConcentrationSaveFacts({
        targetActorId: ACTOR_ID,
        appliedDamage: 1,
        rulePolicyOutput: {
          savingThrowDefinitions: [
            {
              abilityDefinitionId: '00000000-0000-0000-0011-000500000000',
              modifier: 4,
              rollMode: 'NORMAL',
              contributors: []
            }
          ]
        }
      })
    ).toThrow('D&D concentration saving throw is unavailable')
  })

  it('rejects altered or noncanonical concentration contributor evidence', () => {
    const contributors = [
      { sourceId: 'a', grantId: null, domainKey: null, influence: 'ADVANTAGE' as const },
      { sourceId: 'b', grantId: null, domainKey: null, influence: 'DISADVANTAGE' as const }
    ]
    const checksum = checksumRuleDocument(contributors)
    expect(() => validateDnd5eConcentrationContributors(contributors, checksum)).not.toThrow()
    expect(() =>
      validateDnd5eConcentrationContributors([...contributors].reverse(), checksum)
    ).toThrow('not canonical')
    expect(() =>
      validateDnd5eConcentrationContributors([contributors[0]!, contributors[0]!], checksum)
    ).toThrow('not canonical')
    expect(() => validateDnd5eConcentrationContributors(contributors, '0'.repeat(64))).toThrow(
      'contributor evidence is invalid'
    )
  })

  it('canonicalizes mixed-case, punctuation, non-ASCII, and colon-containing contributors', () => {
    const contributors = [
      { sourceId: 'é', grantId: null, domainKey: null, influence: 'ADVANTAGE' as const },
      {
        sourceId: 'a:source',
        grantId: 'grant:two',
        domainKey: '[]',
        influence: 'DISADVANTAGE' as const
      },
      { sourceId: 'Z!', grantId: null, domainKey: 'domain:one', influence: 'ADVANTAGE' as const },
      { sourceId: 'a', grantId: 'grant.two', domainKey: null, influence: 'DISADVANTAGE' as const }
    ]
    const resolved = resolveDnd5eConcentrationSaveFacts({
      targetActorId: ACTOR_ID,
      appliedDamage: 1,
      rulePolicyOutput: {
        savingThrowDefinitions: [
          {
            abilityDefinitionId: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
            modifier: 3,
            rollMode: 'NORMAL',
            contributors
          }
        ]
      }
    })
    const expected = [contributors[2]!, contributors[3]!, contributors[1]!, contributors[0]!]
    expect(resolved.contributors).toEqual(expected)
    expect(resolved.contributorChecksum).toBe(checksumRuleDocument(expected))
    expect(() =>
      validateDnd5eConcentrationContributors(expected, resolved.contributorChecksum)
    ).not.toThrow()
  })

  it('compiles the canonical reusable definition and resumes exactly one d20 check', async () => {
    const published = createDnd5eConcentrationCheckDefinition()
    expect(published).toMatchObject({
      id: DND5E_CONCENTRATION_CHECK_DEFINITION_ID,
      gameSystemId: DND5E_SYSTEM_ID,
      definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
      definition: {
        nodes: [
          { operation: { key: DND5E_CONCENTRATION_DAMAGE_DC_OPERATION_KEY } },
          { operation: { key: 'evidence.integer-range' } },
          { operation: { key: 'dnd5e.save-test-resolution' } }
        ]
      }
    })
    expect(published.checksum).toBe(checksumRuleDocument(published.definition))

    const started = await runtime().executeResolved({
      command: {
        definitionId: published.id,
        occurrenceId: OCCURRENCE_ID,
        facts: facts({ appliedDamage: 22 })
      },
      published
    })
    expect(started).toMatchObject({
      status: 'PAUSED',
      continuation: {
        request: { kind: 'INTEGER_RANGE', min: 1, max: 20, nodeId: 'd20', ordinal: 1 }
      }
    })
    if (started.status !== 'PAUSED') throw new Error('Expected a single d20 request.')

    const completed = await runtime().resume({
      continuation: started.continuation,
      response: { requestId: started.continuation.request.requestId, value: 9 }
    })
    expect(completed).toMatchObject({
      status: 'COMPLETE',
      outputs: {
        targetActorId: ACTOR_ID,
        appliedDamage: 22,
        dc: 11,
        naturalD20: 9,
        total: 11,
        resultPath: 'ON_SAVE_SUCCESS',
        contributorChecksum: CONTRIBUTOR_CHECKSUM
      },
      evidence: {
        facts: facts({ appliedDamage: 22 }),
        trace: [
          { nodeId: 'damage_dc' },
          { nodeId: 'd20', evidence: { kind: 'INTEGER_RANGE', value: 9 } },
          { nodeId: 'save', outputs: { resultPath: 'ON_SAVE_SUCCESS' } }
        ]
      }
    })

    const failedStart = await runtime().executeResolved({
      command: {
        definitionId: published.id,
        occurrenceId: '00000000-0000-4000-8000-0000000000c5',
        facts: facts({ appliedDamage: 22, modifier: 0 })
      },
      published
    })
    if (failedStart.status !== 'PAUSED') throw new Error('Expected a single d20 request.')
    await expect(
      runtime().resume({
        continuation: failedStart.continuation,
        response: { requestId: failedStart.continuation.request.requestId, value: 10 }
      })
    ).resolves.toMatchObject({
      status: 'COMPLETE',
      outputs: { resultPath: 'ON_SAVE_FAIL', total: 10, dc: 11 }
    })
  })

  it('validates and publishes through the neutral reusable-definition seam', async () => {
    const published = createDnd5eConcentrationCheckDefinition()
    const definitions = createReusableDefinitionService({
      store: reusableDefinitionStore(),
      capabilities: [
        {
          ...dnd5eEffectActionCapability,
          definitionFamilyKeys: [RULE_RUNTIME_GRAPH_FAMILY_KEY]
        }
      ],
      operations: [
        integerRangeEvidenceRuleOperation,
        dnd5eConcentrationDamageDcOperation,
        dnd5eSaveTestOperation
      ]
    })
    await expect(
      definitions.saveDraft({
        definitionId: published.id,
        actorUserId: USER_ID,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: null,
        document: published.definition
      })
    ).resolves.toMatchObject({ checksum: published.checksum, version: 0 })
    await expect(
      definitions.publishDraft({
        definitionId: published.id,
        actorUserId: USER_ID,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })
    ).resolves.toMatchObject({
      definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
      document: published.definition,
      checksum: published.checksum
    })
  })

  it('fails closed for an unregistered System, operation, or operation version', async () => {
    const published = createDnd5eConcentrationCheckDefinition()
    const service = runtime()
    const unknownSystemDefinition = {
      ...published.definition,
      gameSystemId: '00000000-0000-4000-8000-0000000000c6'
    }
    await expect(
      service.executeResolved({
        command: {
          definitionId: published.id,
          occurrenceId: OCCURRENCE_ID,
          facts: facts({ appliedDamage: 1 })
        },
        published: {
          ...published,
          gameSystemId: unknownSystemDefinition.gameSystemId,
          checksum: checksumRuleDocument(unknownSystemDefinition),
          definition: unknownSystemDefinition
        }
      })
    ).rejects.toBeInstanceOf(RuleRuntimeConfigurationError)

    for (const operation of [
      { key: 'dnd5e.unknown-concentration-operation', contractVersion: 1 },
      { key: DND5E_CONCENTRATION_DAMAGE_DC_OPERATION_KEY, contractVersion: 2 }
    ]) {
      const definition = {
        ...published.definition,
        nodes: published.definition.nodes.map((node, index) =>
          index === 0 ? { ...node, operation } : node
        )
      }
      await expect(
        service.executeResolved({
          command: {
            definitionId: published.id,
            occurrenceId: OCCURRENCE_ID,
            facts: facts({ appliedDamage: 1 })
          },
          published: { ...published, checksum: checksumRuleDocument(definition), definition }
        })
      ).rejects.toBeInstanceOf(RuleDefinitionCompilationError)
    }
  })
})
