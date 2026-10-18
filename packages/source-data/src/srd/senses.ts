import {
  senseReusableDefinitionDocumentDtoSchema,
  type CombatPerceptionRequirementDto,
  type SenseReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/combatPerception'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  SRD_BLINDSIGHT_SENSE_ID,
  SRD_DARKVISION_SENSE_ID,
  SRD_SEE_INVISIBILITY_SENSE_ID,
  SRD_SYSTEM_ID,
  SRD_TREMORSENSE_SENSE_ID,
  SRD_TRUESIGHT_SENSE_ID
} from './vocabulary.js'

interface SrdSenseDefinitionSeed {
  id: string
  label: string
  description: string
  document: SenseReusableDefinitionDocumentDto
  checksum: string
}

function defineSense(input: Omit<SrdSenseDefinitionSeed, 'checksum'>): SrdSenseDefinitionSeed {
  const document = senseReusableDefinitionDocumentDtoSchema.parse(input.document)
  return { ...input, document, checksum: checksumRuleDocument(document) }
}

const allRequirements: CombatPerceptionRequirementDto[] = ['DETECT', 'LOCATE', 'PRECISE', 'SEE']

/**
 * Canonical D&D source documents. Labels identify the catalogue entry only;
 * runtime behavior comes exclusively from each strict UUID-backed document.
 */
export const SRD_SENSE_DEFINITIONS: readonly SrdSenseDefinitionSeed[] = [
  defineSense({
    id: SRD_DARKVISION_SENSE_ID,
    label: 'Darkvision',
    description: 'SRD 5.1 darkvision perception capability.',
    document: {
      schemaVersion: 1,
      kind: 'SENSE',
      id: SRD_DARKVISION_SENSE_ID,
      gameSystemId: SRD_SYSTEM_ID,
      capabilities: [
        {
          channel: 'VISUAL',
          accessGrade: 'PRECISE',
          satisfies: [...allRequirements],
          illuminationAccess: 'ORDINARY_DARKNESS',
          obscurementAccess: 'LIGHT',
          perceivesInvisible: false,
          physicalConstraints: ['LINE_OF_EFFECT']
        }
      ]
    }
  }),
  defineSense({
    id: SRD_BLINDSIGHT_SENSE_ID,
    label: 'Blindsight',
    description: 'SRD 5.1 blindsight perception capability.',
    document: {
      schemaVersion: 1,
      kind: 'SENSE',
      id: SRD_BLINDSIGHT_SENSE_ID,
      gameSystemId: SRD_SYSTEM_ID,
      capabilities: [
        {
          channel: 'NONVISUAL',
          accessGrade: 'PRECISE',
          satisfies: [...allRequirements],
          illuminationAccess: 'IGNORE',
          obscurementAccess: 'IGNORE',
          perceivesInvisible: true,
          physicalConstraints: ['LINE_OF_EFFECT']
        }
      ]
    }
  }),
  defineSense({
    id: SRD_TREMORSENSE_SENSE_ID,
    label: 'Tremorsense',
    description: 'SRD 5.1 tremorsense perception capability.',
    document: {
      schemaVersion: 1,
      kind: 'SENSE',
      id: SRD_TREMORSENSE_SENSE_ID,
      gameSystemId: SRD_SYSTEM_ID,
      capabilities: [
        {
          channel: 'VIBRATION',
          accessGrade: 'LOCATED',
          satisfies: ['DETECT', 'LOCATE'],
          illuminationAccess: 'IGNORE',
          obscurementAccess: 'IGNORE',
          perceivesInvisible: true,
          physicalConstraints: ['SHARED_SURFACE']
        }
      ]
    }
  }),
  defineSense({
    id: SRD_TRUESIGHT_SENSE_ID,
    label: 'Truesight',
    description: 'SRD 5.1 truesight perception capability.',
    document: {
      schemaVersion: 1,
      kind: 'SENSE',
      id: SRD_TRUESIGHT_SENSE_ID,
      gameSystemId: SRD_SYSTEM_ID,
      capabilities: [
        {
          channel: 'VISUAL',
          accessGrade: 'PRECISE',
          satisfies: [...allRequirements],
          illuminationAccess: 'MAGICAL_DARKNESS',
          obscurementAccess: 'LIGHT',
          perceivesInvisible: true,
          physicalConstraints: ['LINE_OF_EFFECT']
        }
      ]
    }
  }),
  defineSense({
    id: SRD_SEE_INVISIBILITY_SENSE_ID,
    label: 'See Invisibility',
    description: 'SRD 5.1 See Invisibility: ordinary sight that sees invisible creatures.',
    document: {
      schemaVersion: 1,
      kind: 'SENSE',
      id: SRD_SEE_INVISIBILITY_SENSE_ID,
      gameSystemId: SRD_SYSTEM_ID,
      capabilities: [
        {
          channel: 'VISUAL',
          accessGrade: 'PRECISE',
          satisfies: [...allRequirements],
          illuminationAccess: 'DIM',
          obscurementAccess: 'LIGHT',
          perceivesInvisible: true,
          physicalConstraints: ['LINE_OF_EFFECT']
        }
      ]
    }
  })
]
