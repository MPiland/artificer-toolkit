import {
  createFormHook,
  type AppFieldExtendedReactFormApi,
  type FormAsyncValidateOrFn,
  type FormValidateOrFn
} from '@tanstack/react-form'
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
export type {
  AppFieldProps,
  AppSelectFieldProps
} from '../fields/AppFormFields'

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

export type AppFormApi<
  TFormData,
  TOnMount extends undefined | FormValidateOrFn<TFormData> = undefined,
  TOnChange extends undefined | FormValidateOrFn<TFormData> = undefined,
  TOnChangeAsync extends undefined | FormAsyncValidateOrFn<TFormData> = undefined,
  TOnBlur extends undefined | FormValidateOrFn<TFormData> = undefined,
  TOnBlurAsync extends undefined | FormAsyncValidateOrFn<TFormData> = undefined,
  TOnSubmit extends undefined | FormValidateOrFn<TFormData> = undefined,
  TOnSubmitAsync extends undefined | FormAsyncValidateOrFn<TFormData> = undefined,
  TOnDynamic extends undefined | FormValidateOrFn<TFormData> = undefined,
  TOnDynamicAsync extends undefined | FormAsyncValidateOrFn<TFormData> = undefined,
  TOnServer extends undefined | FormAsyncValidateOrFn<TFormData> = undefined,
  TSubmitMeta = unknown
> = AppFieldExtendedReactFormApi<
  TFormData,
  TOnMount,
  TOnChange,
  TOnChangeAsync,
  TOnBlur,
  TOnBlurAsync,
  TOnSubmit,
  TOnSubmitAsync,
  TOnDynamic,
  TOnDynamicAsync,
  TOnServer,
  TSubmitMeta,
  typeof appFieldComponents,
  typeof appFormComponents
>

export const {
  useAppForm,
  withForm,
  withFieldGroup
} = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: appFieldComponents,
  formComponents: appFormComponents
})
