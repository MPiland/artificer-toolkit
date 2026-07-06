import { HttpResponse } from 'msw'

export function trpcJson(data: unknown) {
  return HttpResponse.json([{ result: { data } }])
}

export function trpcBatchJson(data: readonly unknown[]) {
  return HttpResponse.json(data.map((item) => ({ result: { data: item } })))
}

export function readBatchedInput<TInput>(body: unknown): TInput {
  return readBatchedInputs<TInput>(body)[0]!
}

export function readBatchedInputs<TInput>(body: unknown): TInput[] {
  if (typeof body !== 'object' || body === null || !('0' in body)) {
    throw new Error('Expected batched tRPC input.')
  }

  return Object.entries(body as Record<string, TInput>)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, input]) => input)
}
