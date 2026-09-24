import type { ReusableDefinitionWorkspaceDto } from '@artificer-toolkit/schema/api/reusableDefinitions'
import { senseReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/combatPerception'

function createStarterDocument(workspace: ReusableDefinitionWorkspaceDto): unknown {
  if (workspace.definitionFamilyKey === 'sense') {
    return {
      schemaVersion: 1,
      kind: 'SENSE',
      id: workspace.id,
      gameSystemId: workspace.gameSystemId,
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
    }
  }
  return {
    schemaVersion: 1,
    id: workspace.id,
    gameSystemId: workspace.gameSystemId,
    definitionFamilyKey: workspace.definitionFamilyKey
  }
}

export function createDefinitionEditorState(workspace: ReusableDefinitionWorkspaceDto) {
  const document =
    workspace.draft?.document ?? workspace.current?.document ?? createStarterDocument(workspace)
  const documentText = JSON.stringify(document, null, 2)
  return {
    documentText,
    savedDocumentText: documentText,
    definitionVersion: workspace.version,
    draftVersion: workspace.draftVersion
  }
}

export function parseSenseDocument(value: string) {
  try {
    const parsed = senseReusableDefinitionDocumentDtoSchema.safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function formatDefinitionFamily(value: string) {
  return value
    .split(/[.-]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

export function definitionErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The definition could not be saved.'
}
