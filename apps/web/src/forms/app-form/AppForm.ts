import { createFormHook } from '@tanstack/react-form'
import { fieldContext, formContext } from './AppForm.context'
import {
  FormActions,
  FormStack,
  MultiSelectField,
  NumberField,
  NumberSelectField,
  RichTextField,
  SelectField,
  TagsField,
  TextField,
  ToggleField,
  TextareaField
} from '../fields/AppFormFields'

export { useFieldContext } from './AppForm.context'
export type { AppFieldProps, AppSelectFieldProps } from '../fields/AppFormFields'

const appFieldComponents = {
  TextField,
  TextareaField,
  NumberField,
  NumberSelectField,
  ToggleField,
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
