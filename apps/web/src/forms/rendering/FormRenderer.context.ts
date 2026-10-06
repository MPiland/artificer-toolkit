import {
  createContext,
  useContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import type { AnyFieldLikeMetaBase } from '@tanstack/react-form'
import type { AuthoringNavigationTarget } from '../layout/authoringNavigation'
import type { StructuralChangeGuard } from './useStructuralChangeGuard'

export type GroupEditorTransaction = {
  collectionSnapshot: readonly unknown[]
  fieldName: string
  fieldMetaSnapshot: Readonly<Record<string, AnyFieldLikeMetaBase>>
  label: string
  mode: 'add' | 'edit'
  opener: HTMLElement | null
  rowIndex: number
}

export type GroupRemoval = {
  fieldName: string
  kind?: string
  label: string
  rowIndex?: number
}

export type RenderChildAuthoringSchema = (options: {
  ancestors?: readonly Record<string, unknown>[]
  currentStepId?: string
  fieldPathPrefix?: string
  mapId: string
  model?: NodeRuntimeResolveResponseDto
  navigationTarget?: AuthoringNavigationTarget
  parentValues?: Record<string, unknown>
  readOnly: boolean
  renderAllSteps?: boolean
  renderNavigationTarget?: boolean
}) => ReactNode

export type AuthoringRendererScope = {
  childAncestors?: readonly Record<string, unknown>[]
  fieldPathPrefix?: string
  model?: NodeRuntimeResolveResponseDto
  readOnly: boolean
  renderChild: RenderChildAuthoringSchema
  renderAllSteps: boolean
  structuralChangeGuard: StructuralChangeGuard
  values: Record<string, unknown>
}

export type AuthoringRendererInteractions = {
  expandedInlineRowIds: ReadonlySet<string>
  groupEditor?: GroupEditorTransaction
  groupRemoval?: GroupRemoval
  setExpandedInlineRowIds: Dispatch<SetStateAction<ReadonlySet<string>>>
  setGroupEditor: Dispatch<SetStateAction<GroupEditorTransaction | undefined>>
  setGroupRemoval: Dispatch<SetStateAction<GroupRemoval | undefined>>
}

const AuthoringRendererScopeContext = createContext<AuthoringRendererScope | null>(null)
const AuthoringRendererInteractionsContext = createContext<AuthoringRendererInteractions | null>(
  null
)

export const AuthoringRendererScopeProvider = AuthoringRendererScopeContext.Provider
export const AuthoringRendererInteractionsProvider = AuthoringRendererInteractionsContext.Provider

export function useAuthoringRendererScope() {
  const value = useContext(AuthoringRendererScopeContext)
  if (!value) throw new Error('Authoring renderer scope is required')
  return value
}

export function useAuthoringRendererInteractions() {
  const value = useContext(AuthoringRendererInteractionsContext)
  if (!value) throw new Error('Authoring renderer interactions are required')
  return value
}
