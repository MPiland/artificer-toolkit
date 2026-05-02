import { createFormHookContexts } from '@tanstack/react-form'

const appFormContexts = createFormHookContexts()

export const fieldContext = appFormContexts.fieldContext
export const formContext = appFormContexts.formContext
export const useFieldContext = appFormContexts.useFieldContext
