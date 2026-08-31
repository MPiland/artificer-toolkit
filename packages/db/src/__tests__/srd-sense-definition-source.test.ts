import { describe, expect, it } from 'vitest'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { SRD_SENSE_DEFINITIONS } from '../source-data/srd/senses.js'
import {
  SRD_BLINDSIGHT_SENSE_ID,
  SRD_DARKVISION_SENSE_ID,
  SRD_SENSES,
  SRD_SYSTEM_ID,
  SRD_TREMORSENSE_SENSE_ID,
  SRD_TRUESIGHT_SENSE_ID
} from '../source-data/srd/vocabulary.js'

describe('SRD sense definition source', () => {
  it('defines exactly the four vocabulary-backed UUID roots with strict canonical documents', () => {
    expect(SRD_SENSE_DEFINITIONS.map((definition) => definition.id)).toEqual([
      SRD_DARKVISION_SENSE_ID,
      SRD_BLINDSIGHT_SENSE_ID,
      SRD_TREMORSENSE_SENSE_ID,
      SRD_TRUESIGHT_SENSE_ID
    ])
    expect(new Set(SRD_SENSE_DEFINITIONS.map((definition) => definition.id)).size).toBe(4)
    expect(SRD_SENSE_DEFINITIONS.map(({ id, label }) => ({ id, label }))).toEqual(
      SRD_SENSES.map(({ id, label }) => ({ id, label }))
    )
    for (const definition of SRD_SENSE_DEFINITIONS) {
      expect(definition.document).toMatchObject({
        schemaVersion: 1,
        kind: 'SENSE',
        id: definition.id,
        gameSystemId: SRD_SYSTEM_ID
      })
      expect(definition.checksum).toBe(checksumRuleDocument(definition.document))
    }
  })

  it('uses only portable perception primitives for the canonical D&D capabilities', () => {
    expect(SRD_SENSE_DEFINITIONS.map(({ document }) => document.capabilities[0])).toEqual([
      {
        channel: 'VISUAL',
        accessGrade: 'PRECISE',
        satisfies: ['DETECT', 'LOCATE', 'PRECISE', 'SEE'],
        illuminationAccess: 'ORDINARY_DARKNESS',
        obscurementAccess: 'LIGHT',
        perceivesInvisible: false,
        physicalConstraints: ['LINE_OF_EFFECT']
      },
      {
        channel: 'NONVISUAL',
        accessGrade: 'PRECISE',
        satisfies: ['DETECT', 'LOCATE', 'PRECISE', 'SEE'],
        illuminationAccess: 'IGNORE',
        obscurementAccess: 'IGNORE',
        perceivesInvisible: true,
        physicalConstraints: ['LINE_OF_EFFECT']
      },
      {
        channel: 'VIBRATION',
        accessGrade: 'LOCATED',
        satisfies: ['DETECT', 'LOCATE'],
        illuminationAccess: 'IGNORE',
        obscurementAccess: 'IGNORE',
        perceivesInvisible: true,
        physicalConstraints: ['SHARED_SURFACE']
      },
      {
        channel: 'VISUAL',
        accessGrade: 'PRECISE',
        satisfies: ['DETECT', 'LOCATE', 'PRECISE', 'SEE'],
        illuminationAccess: 'MAGICAL_DARKNESS',
        obscurementAccess: 'LIGHT',
        perceivesInvisible: true,
        physicalConstraints: ['LINE_OF_EFFECT']
      }
    ])
  })
})
