import { createFormHook } from '@tanstack/react-form'
import { fieldContext, formContext } from './AppForm.context'
import {
  FormActions,
  FormStack,
  MultiSelectField,
  NumberField,
  RichTextField,
  SelectField,
  SubmitButton,
  TagsField,
  TextField,
  TextareaField
} from './AppFormFields'

export { useFieldContext, useFormContext } from './AppForm.context'
export type { RuntimeFieldProps, RuntimeSelectFieldProps } from './AppFormFields'

export const {
  useAppForm,
  withForm,
  withFieldGroup,
  useTypedAppFormContext
} = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    TextareaField,
    NumberField,
    SelectField,
    MultiSelectField,
    TagsField,
    RichTextField
  },
  formComponents: {
    SubmitButton,
    FormActions,
    FormStack
  }
})
