import type { DBLike } from '@artificer-toolkit/db'
import { createSystemRepository } from '@artificer-toolkit/db'

const RESPONSE_MAX_BYTES = 10 * 1024 * 1024
const TIMEOUT_MS = 15_000

export class DndBeyondImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DndBeyondImportError'
  }
}

export interface DndBeyondResponseBudget {
  remainingBytes: number
}

export async function fetchDndBeyondCharacter(
  characterId: string,
  fetcher: typeof fetch,
  budget: DndBeyondResponseBudget
): Promise<unknown> {
  const endpoint = `https://character-service.dndbeyond.com/character/v5/character/${characterId}?includeCustomItems=true`
  const response = await fetcher(endpoint, {
    headers: { accept: 'application/json' },
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS)
  })
  if (!response.ok) {
    throw new DndBeyondImportError(
      response.status === 401 || response.status === 403 || response.status === 404
        ? 'The D&D Beyond character is private or unavailable.'
        : `D&D Beyond returned ${response.status}.`
    )
  }
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > RESPONSE_MAX_BYTES) {
    throw new DndBeyondImportError('The D&D Beyond character response is too large.')
  }
  if (Number.isFinite(contentLength) && contentLength > budget.remainingBytes) {
    throw new DndBeyondImportError('The D&D Beyond import batch exceeds 25 MiB.')
  }
  const text = await readCappedResponseText(response, RESPONSE_MAX_BYTES, budget)
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new DndBeyondImportError('D&D Beyond returned malformed character data.')
  }
}

export async function findDnd5e2014SystemId(db: DBLike): Promise<string> {
  const systems = await createSystemRepository(db).findAll()
  const system = systems.find(
    (candidate) =>
      candidate.rulesetCode.toLowerCase() === 'dnd5e' && candidate.rulesetVersion === '2014'
  )
  if (!system) {
    const error = new Error('D&D 5e 2014 is not configured.')
    error.name = 'ImportConfigurationError'
    throw error
  }
  return system.id
}

async function readCappedResponseText(
  response: Response,
  maximumBytes: number,
  budget: DndBeyondResponseBudget
): Promise<string> {
  if (!response.body) {
    const text = await response.text()
    const bytes = new TextEncoder().encode(text).byteLength
    consumeResponseBytes(bytes, maximumBytes, budget)
    return text
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  while (true) {
    const result = await reader.read()
    if (result.done) break
    bytes += result.value.byteLength
    if (bytes > maximumBytes || result.value.byteLength > budget.remainingBytes) {
      await reader.cancel()
      if (bytes > maximumBytes) {
        throw new DndBeyondImportError('The D&D Beyond character response is too large.')
      }
      budget.remainingBytes = 0
      throw new DndBeyondImportError('The D&D Beyond import batch exceeds 25 MiB.')
    }
    budget.remainingBytes -= result.value.byteLength
    chunks.push(result.value)
  }
  const combined = new Uint8Array(bytes)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(combined)
}

function consumeResponseBytes(
  bytes: number,
  maximumBytes: number,
  budget: DndBeyondResponseBudget
): void {
  if (bytes > maximumBytes) {
    throw new DndBeyondImportError('The D&D Beyond character response is too large.')
  }
  if (bytes > budget.remainingBytes) {
    budget.remainingBytes = 0
    throw new DndBeyondImportError('The D&D Beyond import batch exceeds 25 MiB.')
  }
  budget.remainingBytes -= bytes
}
