import { createFormHook } from '@tanstack/react-form'
import { fieldContext, formContext } from './AppForm.context'
import {
  FormActions,
  FormStack,
  MultiSelectField,
  NumberField,
  RichTextField,
  SelectField,
  TagsField,
  TextField,
  TextareaField
} from '../fields/AppFormFields'

export { useFieldContext } from './AppForm.context'
export type { AppFieldProps, AppSelectFieldProps } from '../fields/AppFormFields'

const appFieldComponents = {
  TextField,
  TextareaField,
  NumberField,
  SelectField,
  MultiSelectField,
  TagsField,
  RichTextField
}

const appFormComponents = {
  FormActions,
  FormStack
}

export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: appFieldComponents,
  formComponents: appFormComponents
})
