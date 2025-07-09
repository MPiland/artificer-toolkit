import { SubscribeAlert, SubscribeButton, SubscribeSubmit, TextField, DropdownField, RichTextField, AccordionField } from '@/components/Form'
import { createFormHook, createFormHookContexts } from '@tanstack/react-form'

export const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()
export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldComponents: {
    TextField,
    DropdownField,
    RichTextField,
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
