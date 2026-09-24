import { expect as playwrightExpect, type Page } from '@playwright/test'
import {
  encounterCommandResultDtoSchema,
  encounterExecuteInputSchema,
  type EncounterCommandResultDto,
  type ResolveEncounterActionInputDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'

const expect = playwrightExpect.configure({ timeout: 90_000 })

export type CapturedEncounterCommand = {
  command: ResolveEncounterActionInputDto | ResolveRuleOccurrenceInputDto
  result?: EncounterCommandResultDto
  error?: string
}

export function captureEncounterCommands(
  page: Page,
  diagnostics: string[],
  stage: () => string
): Map<string, CapturedEncounterCommand> {
  const commands = new Map<string, CapturedEncounterCommand>()
  page.on('websocket', (socket) => {
    const url = new URL(socket.url())
    if (!/^\/api\/[^/]+\/sync$/.test(url.pathname)) return
    const requests = new Map<string, CapturedEncounterCommand>()
    socket.on('framesent', ({ payload }) => {
      const message: unknown = JSON.parse(payload.toString())
      if (
        !message ||
        typeof message !== 'object' ||
        !('type' in message) ||
        (message.type !== 'Mutation' && message.type !== 'Action') ||
        !('udfPath' in message) ||
        (message.type === 'Mutation'
          ? message.udfPath !== 'encounters/commands:execute'
          : message.udfPath !== 'encounters/commandActions:execute') ||
        !('requestId' in message) ||
        typeof message.requestId !== 'number' ||
        !('args' in message) ||
        !Array.isArray(message.args)
      )
        return
      const parsed = encounterExecuteInputSchema.safeParse(message.args[0])
      if (
        !parsed.success ||
        (parsed.data.command.type !== 'RESOLVE_ACTION' &&
          parsed.data.command.type !== 'RESOLVE_RULE_OCCURRENCE')
      )
        return
      if (
        message.type === 'Mutation'
          ? parsed.data.command.type !== 'RESOLVE_ACTION'
          : parsed.data.command.type !== 'RESOLVE_RULE_OCCURRENCE'
      )
        return
      const captured = commands.get(parsed.data.command.commandId) ?? {
        command: parsed.data.command
      }
      commands.set(parsed.data.command.commandId, captured)
      requests.set(message.type + 'Response:' + message.requestId, captured)
    })
    socket.on('framereceived', ({ payload }) => {
      const message: unknown = JSON.parse(payload.toString())
      if (!message || typeof message !== 'object') return
      if (
        'type' in message &&
        (message.type === 'MutationResponse' || message.type === 'ActionResponse') &&
        'requestId' in message &&
        typeof message.requestId === 'number'
      ) {
        const captured = requests.get(message.type + ':' + message.requestId)
        if (!captured || !('result' in message)) return
        if ('success' in message && message.success === true) {
          const parsed = encounterCommandResultDtoSchema.safeParse(message.result)
          if (parsed.success) captured.result = parsed.data
          else captured.error = 'Encounter response did not match its shared DTO.'
        } else
          captured.error =
            typeof message.result === 'string' ? message.result : 'Encounter command failed.'
      }
      if ('modifications' in message && Array.isArray(message.modifications)) {
        const modifications: unknown[] = message.modifications
        for (const modification of modifications) {
          if (
            modification &&
            typeof modification === 'object' &&
            'type' in modification &&
            modification.type === 'QueryFailed' &&
            'errorMessage' in modification &&
            typeof modification.errorMessage === 'string'
          )
            diagnostics.push(stage() + ': ' + modification.errorMessage)
        }
      }
    })
  })
  return commands
}

export async function waitForCommand(
  commands: Map<string, CapturedEncounterCommand>,
  priorCount: number
): Promise<{
  command: ResolveEncounterActionInputDto | ResolveRuleOccurrenceInputDto
  result: EncounterCommandResultDto
}> {
  await expect.poll(() => commands.size).toBe(priorCount + 1)
  const captured = [...commands.values()][priorCount]
  if (!captured) throw new Error('Browser did not submit an Encounter command.')
  await expect.poll(() => captured.result ?? captured.error).not.toBeUndefined()
  if (captured.error) throw new Error(captured.error)
  if (!captured.result) throw new Error('Browser did not receive an Encounter response.')
  return { command: captured.command, result: captured.result }
}
