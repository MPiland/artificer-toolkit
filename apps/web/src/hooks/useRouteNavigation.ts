import { useMemo } from 'react'
import type { FormType } from '@types'
import type { FileRoutesByFullPath } from '../routeTree.gen'
import { ToOptions, NavigateOptions } from '@tanstack/react-router'

// Mapping from plural form types to singular forms
const FORM_SINGULAR_MAP = {
  spells: 'spell',
  feats: 'feat',
  equipment: 'equipment',
  races: 'race',
  classes: 'class',
  backgrounds: 'background',
  characters: 'character'
} as const

// Type to extract route parameters from FileRoutesByFullPath
type ViewRouteParams<T extends FormType>
  = Extract<keyof FileRoutesByFullPath, `/${T}/$${string}`> extends infer R
    ? R extends `/${T}/$action/${string}` ? never
      : R extends `/${T}/$${infer Param}` ? `$${Param}`
        : never
    : never

// Type extraction for action routes
type ActionRouteParams<T extends FormType>
  = Extract<keyof FileRoutesByFullPath, `/${T}/$action/$${string}`> extends `/${T}/$action/$${infer Param}` ? `$${Param}`
    : never

// Extract parameter names without the $ prefix
type ViewParamName<T extends FormType> = ViewRouteParams<T> extends `$${infer Param}` ? Param : never
type ActionParamName<T extends FormType> = ActionRouteParams<T> extends `$${infer Param}` ? Param : never

// Type for a route destination entry
type RouteDestinationEntry<T extends FormType> = {
  view: ViewRouteParams<T>
  action: ActionRouteParams<T>
  viewParam: ViewParamName<T>
  actionParam: ActionParamName<T>
  viewPath: Extract<keyof FileRoutesByFullPath, `/${T}/${ViewRouteParams<T>}`>
  formPath: Extract<keyof FileRoutesByFullPath, `/${T}/$action/${ActionRouteParams<T>}`>
}

// Helper function to create route destination entries based on form type
function createRouteDestinationFromForm<T extends FormType>(form: T): RouteDestinationEntry<T> {
  const singular = FORM_SINGULAR_MAP[form]

  // Generate parameter names based on singular form
  const viewParam = `${singular}Id` as ViewParamName<T>
  const actionParam = `_${singular}Id` as ActionParamName<T>

  // Generate route parameters
  const view = `$${viewParam}` as ViewRouteParams<T>
  const action = `$${actionParam}` as ActionRouteParams<T>

  // Generate full paths
  const viewPath = `/${form}/${view}` as Extract<keyof FileRoutesByFullPath, `/${T}/${ViewRouteParams<T>}`>
  const formPath = `/${form}/$action/${action}` as Extract<
    keyof FileRoutesByFullPath,
    `/${T}/$action/${ActionRouteParams<T>}`
  >

  return {
    view,
    action,
    viewParam,
    actionParam,
    viewPath,
    formPath
  }
}

// Define navigation link types
export type NavigationLink = {
  to: ToOptions['to']
  params: NavigateOptions['params']
  mask?: {
    to: ToOptions['to']
    params: NavigateOptions['params']
  }
}

// Define the return type of the hook
export type ListNavigationResult = {
  forItem: (
    id: string,
    label: string
  ) => {
    view: NavigationLink
    edit: NavigationLink
    copy: NavigationLink
  }
  new: NavigationLink
}

// Hook for navigation in a list context with proper typing
const useRouteNavigation = <T extends FormType>(form: T): ListNavigationResult => {
  return useMemo(() => {
    const routeDest = createRouteDestinationFromForm(form)
    return {
      forItem: (id: string, label: string) => {
        return {
          view: {
            to: routeDest.viewPath,
            params: {
              [routeDest.viewParam]: id
            },
            mask: {
              to: routeDest.viewPath,
              params: {
                [routeDest.viewParam]: label
              }
            }
          },
          edit: {
            to: routeDest.formPath,
            params: {
              action: 'edit',
              [routeDest.actionParam]: id
            },
            mask: {
              to: routeDest.formPath,
              params: {
                action: 'edit',
                [routeDest.actionParam]: label
              }
            }
          },
          copy: {
            to: routeDest.formPath,
            params: {
              action: 'new',
              [routeDest.actionParam]: id
            },
            mask: {
              to: routeDest.formPath,
              params: {
                action: 'new',
                [routeDest.actionParam]: undefined
              }
            }
          }
        }
      },
      new: {
        to: routeDest.formPath,
        params: {
          action: 'new'
        }
      }
    }
  }, [form])
}

export default useRouteNavigation
