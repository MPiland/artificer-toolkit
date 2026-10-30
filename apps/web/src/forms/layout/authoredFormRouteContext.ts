import type { AuthoredFormDomain } from '../factories/authoredFormFactories.types'
import type { AuthoringFormMode } from './AuthoringFormContext'

export type AuthoredFormRouteMode = Extract<AuthoringFormMode, 'create' | 'edit'>

type AuthoredFormRouteContext = {
  authoring: {
    kind: 'authored-form'
    domain: AuthoredFormDomain
    mode: AuthoredFormRouteMode
  }
}

type AuthoredFormRouteLoaderData<TData = unknown> = {
  authoringData: TData
}

export function createAuthoredFormRouteContext(
  domain: AuthoredFormDomain,
  mode: AuthoredFormRouteMode
): AuthoredFormRouteContext {
  return {
    authoring: {
      kind: 'authored-form',
      domain,
      mode
    }
  }
}

export function createAuthoredFormRouteLoaderData<TData>(
  authoringData: TData
): AuthoredFormRouteLoaderData<TData> {
  return { authoringData }
}

export const createAuthoringRouteLoaderData = createAuthoredFormRouteLoaderData
