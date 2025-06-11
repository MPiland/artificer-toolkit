import { SubscribeAlert, SubscribeButton, SubscribeSubmit, TextField, DropdownField, RichTextEditorField, AccordionField } from '../Fields'
import { createFormHook, createFormHookContexts } from '@tanstack/react-form'

export const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()
export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldComponents: {
    TextField,
    DropdownField,
    RichTextEditorField,
    AccordionField
  },
  formComponents: {
    SubscribeButton,
    SubscribeSubmit,
    SubscribeAlert,
  },
  fieldContext,
  formContext,
})
