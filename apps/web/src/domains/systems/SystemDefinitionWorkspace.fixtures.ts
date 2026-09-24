import {
  reusableDefinitionWorkspaceDtoSchema,
  type ReusableDefinitionWorkspaceDto
} from '@artificer-toolkit/schema/api/reusableDefinitions'
import type { ReusableDefinitionDocumentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { senseReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/combatPerception'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { authoredRouteStorySystem } from '#domains/authoredRouteStory.fixtures'

export const definitionId = '77777777-7777-4777-8777-777777777777'
const contentSourceId = '88888888-8888-4888-8888-888888888888'
const authorUserId = '99999999-9999-4999-8999-999999999999'
const timestamp = '2026-08-30T00:00:00.000Z'

export const senseDocument = senseReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'SENSE',
  id: definitionId,
  gameSystemId: authoredRouteStorySystem.id,
  capabilities: [
    {
      channel: 'VISUAL',
      accessGrade: 'PRECISE',
      satisfies: ['DETECT', 'LOCATE', 'PRECISE', 'SEE'],
      illuminationAccess: 'DIM',
      obscurementAccess: 'NONE',
      perceivesInvisible: false,
      physicalConstraints: ['LINE_OF_EFFECT']
    }
  ]
})

export function createDefinitionWorkspace(overrides: Partial<ReusableDefinitionWorkspaceDto> = {}) {
  return reusableDefinitionWorkspaceDtoSchema.parse({
    id: definitionId,
    gameSystemId: authoredRouteStorySystem.id,
    contentSourceId,
    definitionFamilyKey: 'sense',
    label: 'Keen sight',
    description: 'A homebrew visual sense.',
    version: 0,
    sourceKind: 'USER',
    editable: true,
    currentVersion: null,
    draftVersion: null,
    current: null,
    draft: null,
    ...overrides
  })
}

export function withDefinitionDraft(
  workspace: ReusableDefinitionWorkspaceDto,
  document: ReusableDefinitionDocumentDto = senseDocument
): ReusableDefinitionWorkspaceDto {
  const version = (workspace.draftVersion ?? -1) + 1
  return reusableDefinitionWorkspaceDtoSchema.parse({
    ...workspace,
    draftVersion: version,
    draft: {
      definitionId: workspace.id,
      gameSystemId: workspace.gameSystemId,
      authorUserId,
      document,
      checksum: checksumRuleDocument(document),
      baseDefinitionVersion: workspace.version,
      version,
      createdAt: workspace.draft?.createdAt ?? timestamp,
      updatedAt: timestamp
    }
  })
}

export function withDefinitionPublication(workspace: ReusableDefinitionWorkspaceDto) {
  if (!workspace.draft) throw new Error('Fixture requires a saved draft.')
  const version = workspace.version + 1
  return reusableDefinitionWorkspaceDtoSchema.parse({
    ...workspace,
    version,
    currentVersion: version,
    draftVersion: null,
    current: {
      id: workspace.id,
      gameSystemId: workspace.gameSystemId,
      contentSourceId: workspace.contentSourceId,
      definitionFamilyKey: workspace.definitionFamilyKey,
      label: workspace.label,
      description: workspace.description,
      document: workspace.draft.document,
      checksum: workspace.draft.checksum,
      contractVersion: 1,
      version,
      publishedAt: timestamp,
      publishedBy: authorUserId
    },
    draft: null
  })
}
