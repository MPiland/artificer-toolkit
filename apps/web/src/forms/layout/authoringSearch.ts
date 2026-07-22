import { z } from 'zod'

declare module '@tanstack/history' {
  interface HistoryState {
    __authoringStepNavigation?: true
  }
}

export const authoringSearchSchema = z.object({
  step: z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined),
    z.string().optional()
  )
})

export type AuthoringSearch = z.infer<typeof authoringSearchSchema>

export function markAuthoringStepNavigationState<TState extends object>(state: TState) {
  return { ...state, __authoringStepNavigation: true as const }
}

export function isAuthoringStepNavigationState(state: unknown): boolean {
  return isRecord(state) && state.__authoringStepNavigation === true
}

export function readAuthoringStep(search: unknown): string | undefined {
  if (!isRecord(search)) return undefined
  const step = search.step
  return typeof step === 'string' && step.length > 0 ? step : undefined
}

export function getAuthoringStepHref(currentHref: string, stepId: string): string {
  const url = new URL(currentHref, 'http://authoring.local')
  url.searchParams.set('step', stepId)
  return `${url.pathname}${url.search}${url.hash}`
}

export function isAuthoringStepOnlyNavigation(
  current: { pathname: string; search: unknown },
  next: { pathname: string; search: unknown }
): boolean {
  if (current.pathname !== next.pathname) return false

  const currentSearch = withoutStep(current.search)
  const nextSearch = withoutStep(next.search)
  return (
    readAuthoringStep(current.search) !== readAuthoringStep(next.search) &&
    areSearchValuesEqual(currentSearch, nextSearch)
  )
}

function withoutStep(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {}
  const { step: _step, ...search } = value
  return search
}

function areSearchValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((entry, index) => areSearchValuesEqual(entry, right[index]))
    )
  }
  if (!isRecord(left) || !isRecord(right)) return false

  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) => key === rightKeys[index] && areSearchValuesEqual(left[key], right[key])
    )
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
