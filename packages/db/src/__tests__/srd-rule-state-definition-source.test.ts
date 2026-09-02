import { describe, expect, it } from 'vitest'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
  SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_BREATHING_CAPABILITY_DEFINITION_ID,
  SRD_CONDITION_RULE_STATE_DEFINITIONS,
  SRD_POSITIONAL_SUPPORT_CAPABILITY_DEFINITION_ID,
  SRD_REACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_CAPABILITY_DEFINITIONS
} from '../source-data/srd/ruleState.js'
import { SRD_CONDITION_TYPES, SRD_SYSTEM_ID } from '../source-data/srd/vocabulary.js'

describe('SRD rule-state definition source', () => {
  it('defines action, reaction, and positional-support capabilities with portable usage policy', () => {
    expect(SRD_RULE_CAPABILITY_DEFINITIONS.map(({ id, document }) => ({ id, document }))).toEqual([
      {
        id: SRD_BREATHING_CAPABILITY_DEFINITION_ID,
        document: {
          schemaVersion: 1,
          kind: 'RULE_CAPABILITY',
          id: SRD_BREATHING_CAPABILITY_DEFINITION_ID,
          gameSystemId: SRD_SYSTEM_ID,
          usage: null
        }
      },
      {
        id: SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
        document: {
          schemaVersion: 1,
          kind: 'RULE_CAPABILITY',
          id: SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
          gameSystemId: SRD_SYSTEM_ID,
          usage: null
        }
      },
      {
        id: SRD_REACTION_ALLOWANCE_DEFINITION_ID,
        document: {
          schemaVersion: 1,
          kind: 'RULE_CAPABILITY',
          id: SRD_REACTION_ALLOWANCE_DEFINITION_ID,
          gameSystemId: SRD_SYSTEM_ID,
          usage: { maximum: 1, refreshBoundary: 'START_OF_TURN' }
        }
      },
      {
        id: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
        document: {
          schemaVersion: 1,
          kind: 'RULE_CAPABILITY',
          id: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
          gameSystemId: SRD_SYSTEM_ID,
          usage: { maximum: 1, refreshBoundary: 'START_OF_TURN' }
        }
      },
      {
        id: SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
        document: {
          schemaVersion: 1,
          kind: 'RULE_CAPABILITY',
          id: SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
          gameSystemId: SRD_SYSTEM_ID,
          usage: { maximum: 1, refreshBoundary: 'START_OF_TURN' }
        }
      },
      {
        id: SRD_POSITIONAL_SUPPORT_CAPABILITY_DEFINITION_ID,
        document: {
          schemaVersion: 1,
          kind: 'RULE_CAPABILITY',
          id: SRD_POSITIONAL_SUPPORT_CAPABILITY_DEFINITION_ID,
          gameSystemId: SRD_SYSTEM_ID,
          usage: null
        }
      }
    ])
  })

  it('defines one UUID-backed capability policy for every condition vocabulary identity', () => {
    expect(SRD_CONDITION_RULE_STATE_DEFINITIONS.map((definition) => definition.id)).toEqual(
      SRD_CONDITION_TYPES.map((condition) => condition.id)
    )
    const suppressingCodes = SRD_CONDITION_TYPES.flatMap((condition, index) =>
      SRD_CONDITION_RULE_STATE_DEFINITIONS[index]!.document.kind === 'CONDITION_RULE_STATE' &&
      SRD_CONDITION_RULE_STATE_DEFINITIONS[index]!.document.capabilitySuppressions.length > 0
        ? [condition.code]
        : []
    )
    expect(suppressingCodes).toEqual([
      'INCAPACITATED',
      'PARALYZED',
      'PETRIFIED',
      'STUNNED',
      'UNCONSCIOUS'
    ])
    for (const definition of SRD_CONDITION_RULE_STATE_DEFINITIONS) {
      if (definition.document.kind !== 'CONDITION_RULE_STATE') continue
      if (definition.document.capabilitySuppressions.length === 0) continue
      expect(definition.document.capabilitySuppressions[0]?.capabilityDefinitionIds).toEqual(
        [
          SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
          SRD_ACTION_ALLOWANCE_DEFINITION_ID,
          SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
          SRD_POSITIONAL_SUPPORT_CAPABILITY_DEFINITION_ID,
          SRD_REACTION_ALLOWANCE_DEFINITION_ID
        ].sort()
      )
    }
    for (const definition of [
      ...SRD_RULE_CAPABILITY_DEFINITIONS,
      ...SRD_CONDITION_RULE_STATE_DEFINITIONS
    ]) {
      expect(definition.document).toMatchObject({
        id: definition.id,
        gameSystemId: SRD_SYSTEM_ID
      })
      expect(definition.checksum).toBe(checksumRuleDocument(definition.document))
    }
  })

  it('uses exact condition definition IDs for blinded observer sight and invisible subject emission', () => {
    const byId = new Map(
      SRD_CONDITION_RULE_STATE_DEFINITIONS.map((definition) => [definition.id, definition])
    )
    const blinded = byId.get('00000000-0000-0000-0002-000100000000')?.document
    const invisible = byId.get('00000000-0000-0000-0002-000800000000')?.document
    expect(blinded?.kind).toBe('CONDITION_RULE_STATE')
    expect(invisible?.kind).toBe('CONDITION_RULE_STATE')
    if (blinded?.kind !== 'CONDITION_RULE_STATE' || invisible?.kind !== 'CONDITION_RULE_STATE') {
      throw new Error('Expected normalized condition rule-state definitions.')
    }
    expect(blinded.perceptionContributions).toEqual([
      expect.objectContaining({ kind: 'SENSE_SUPPRESS', channels: ['VISUAL'] })
    ])
    expect(invisible.perceptionContributions).toEqual([
      expect.objectContaining({
        kind: 'EMISSION_SUPPRESS',
        channels: ['VISUAL'],
        bypass: 'INVISIBILITY'
      })
    ])
  })
})
