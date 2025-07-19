import {
  SubscribeAlert,
  SubscribeButton,
  SubscribeSubmit,
  TextField,
  DropdownField,
  RichTextField,
} from '@/components/Form'
import { createFormHook, createFormHookContexts } from '@tanstack/react-form'

export const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()
export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldComponents: {
    TextField,
    DropdownField,
    RichTextField,
  },
  formComponents: {
    SubscribeButton,
    SubscribeSubmit,
    SubscribeAlert,
  },
  fieldContext,
  formContext,
})
