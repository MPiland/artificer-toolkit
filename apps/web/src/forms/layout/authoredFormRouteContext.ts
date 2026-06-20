import type { AuthoredFormDomain } from '../factories/authoredFormFactories.types'
import type { AuthoringFormMode } from './AuthoringFormContext'

export type AuthoredFormRouteMode = Extract<AuthoringFormMode, 'create' | 'edit'>
export type CharacterBuilderRouteMode = Extract<AuthoringFormMode, 'create' | 'edit'>

export type AuthoredFormRouteContext = {
  authoring: {
    kind: 'authored-form'
    domain: AuthoredFormDomain
    mode: AuthoredFormRouteMode
  }
}

export type CharacterBuilderRouteContext = {
  authoring: {
    kind: 'character-builder'
    mode: CharacterBuilderRouteMode
  }
}

export type AuthoredFormRouteLoaderData<TData = unknown> = {
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

export function createCharacterBuilderRouteContext(
  mode: CharacterBuilderRouteMode
): CharacterBuilderRouteContext {
  return {
    authoring: {
      kind: 'character-builder',
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
