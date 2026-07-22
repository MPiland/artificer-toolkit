import { Group, NumberInput, Stack, Switch, TagsInput, TextInput, Textarea } from '@mantine/core'
import type { ReactNode } from 'react'
import RichTextEditor, { DeferredRichTextEditor } from '#ui/primitives/RichTextEditor'
import { AppMultiSelect, AppSelect } from '#ui/primitives/Select'
import * as inputStyles from '#ui/primitives/Select/Select.css'
import { useFieldContext } from '../app-form/AppForm.context'
import {
  getFieldError,
  toInputValue,
  uniqueSelectOptions,
  type SelectOption
} from '../utils/formUtils'

export type AppFieldProps = {
  label?: string
  description?: string
  error?: ReactNode
  placeholder?: string
  required?: boolean
  readOnly?: boolean
}

export type AppSelectFieldProps = AppFieldProps & {
  data: SelectOption[]
}

type AppStructuralFieldProps<TValue> = {
  changePending?: boolean
  onChangeRequest?: (value: TValue, commit: () => void) => void
}

type AppFieldRichTextProps = AppFieldProps & {
  className?: string
  deferActivation?: boolean
}

const fieldClassNames = {
  root: inputStyles.root,
  label: inputStyles.label,
  description: inputStyles.description,
  required: inputStyles.required,
  input: inputStyles.input
}

const pillsFieldClassNames = {
  ...fieldClassNames,
  pill: inputStyles.pill,
  pillsList: inputStyles.pillsList,
  inputField: inputStyles.inputField
}

export function TextField({
  label,
  description,
  error,
  placeholder,
  required,
  readOnly
}: AppFieldProps) {
  const field = useFieldContext<string>()

  return (
    <TextInput
      label={label}
      description={description}
      placeholder={placeholder}
      required={required}
      name={field.name}
      value={toInputValue(field.state.value)}
      error={error ?? getFieldError(field)}
      readOnly={readOnly}
      classNames={fieldClassNames}
      onBlur={field.handleBlur}
      onChange={(event) => {
        if (!readOnly) field.handleChange(event.currentTarget.value)
      }}
    />
  )
}

export function TextareaField({
  label,
  description,
  error,
  placeholder,
  required,
  readOnly
}: AppFieldProps) {
  const field = useFieldContext<string>()

  return (
    <Textarea
      autosize
      minRows={4}
      label={label}
      description={description}
      placeholder={placeholder}
      required={required}
      name={field.name}
      value={toInputValue(field.state.value)}
      error={error ?? getFieldError(field)}
      readOnly={readOnly}
      classNames={fieldClassNames}
      onBlur={field.handleBlur}
      onChange={(event) => {
        if (!readOnly) field.handleChange(event.currentTarget.value)
      }}
    />
  )
}

export function NumberField({
  label,
  description,
  error,
  placeholder,
  required,
  readOnly
}: AppFieldProps) {
  const field = useFieldContext<number | undefined>()

  return (
    <NumberInput
      hideControls
      label={label}
      description={description}
      placeholder={placeholder}
      required={required}
      name={field.name}
      value={field.state.value}
      error={error ?? getFieldError(field)}
      readOnly={readOnly}
      classNames={fieldClassNames}
      onBlur={field.handleBlur}
      onChange={(value) => {
        if (!readOnly) field.handleChange(typeof value === 'number' ? value : undefined)
      }}
    />
  )
}

export function ToggleField({
  label,
  description,
  error,
  required,
  readOnly,
  changePending,
  onChangeRequest
}: AppFieldProps & AppStructuralFieldProps<boolean>) {
  const field = useFieldContext<boolean | undefined>()

  return (
    <Switch
      label={label}
      description={description}
      required={required}
      name={field.name}
      checked={field.state.value ?? false}
      error={error ?? getFieldError(field)}
      disabled={readOnly || changePending}
      onBlur={field.handleBlur}
      onChange={(event) => {
        if (readOnly || changePending) return
        const value = event.currentTarget.checked
        const commit = () => field.handleChange(value)
        if (onChangeRequest) {
          onChangeRequest(value, commit)
        } else {
          commit()
        }
      }}
    />
  )
}

export function SelectField({
  label,
  description,
  error,
  placeholder,
  required,
  readOnly,
  data,
  changePending,
  onChangeRequest
}: AppSelectFieldProps & AppStructuralFieldProps<string | undefined>) {
  const field = useFieldContext<string | undefined>()

  return (
    <AppSelect
      label={label}
      description={description}
      placeholder={placeholder}
      required={required}
      data={uniqueSelectOptions(data)}
      name={field.name}
      value={field.state.value ?? null}
      error={error ?? getFieldError(field)}
      readOnly={readOnly}
      disabled={readOnly || changePending}
      onBlur={field.handleBlur}
      onChange={(value) => {
        if (readOnly || changePending) return
        const nextValue = value ?? undefined
        const commit = () => field.handleChange(nextValue)
        if (onChangeRequest) {
          onChangeRequest(nextValue, commit)
        } else {
          commit()
        }
      }}
    />
  )
}

export function MultiSelectField({
  label,
  description,
  error,
  placeholder,
  required,
  readOnly,
  data,
  changePending,
  onChangeRequest
}: AppSelectFieldProps & AppStructuralFieldProps<string[]>) {
  const field = useFieldContext<string[] | undefined>()

  return (
    <AppMultiSelect
      label={label}
      description={description}
      placeholder={placeholder}
      required={required}
      data={uniqueSelectOptions(data)}
      name={field.name}
      value={field.state.value ?? []}
      error={error ?? getFieldError(field)}
      readOnly={readOnly}
      disabled={readOnly || changePending}
      onBlur={field.handleBlur}
      onChange={(value) => {
        if (readOnly || changePending) return
        const commit = () => field.handleChange(value)
        if (onChangeRequest) {
          onChangeRequest(value, commit)
        } else {
          commit()
        }
      }}
    />
  )
}

export function TagsField({
  label,
  description,
  error,
  placeholder,
  required,
  readOnly
}: AppFieldProps) {
  const field = useFieldContext<string[] | undefined>()

  return (
    <TagsInput
      label={label}
      description={description}
      placeholder={placeholder}
      required={required}
      name={field.name}
      value={field.state.value ?? []}
      error={error ?? getFieldError(field)}
      readOnly={readOnly}
      classNames={pillsFieldClassNames}
      onBlur={field.handleBlur}
      onChange={(value) => {
        if (!readOnly) field.handleChange(value)
      }}
    />
  )
}

export function RichTextField({
  label,
  error,
  placeholder,
  required,
  readOnly,
  className,
  deferActivation
}: AppFieldRichTextProps) {
  const field = useFieldContext<string>()
  const Editor = deferActivation ? DeferredRichTextEditor : RichTextEditor

  return (
    <Editor
      label={label}
      error={error ?? getFieldError(field)}
      name={field.name}
      placeholder={placeholder}
      className={className}
      required={required}
      value={toInputValue(field.state.value)}
      readOnly={readOnly}
      onBlur={() => field.handleBlur()}
      onChange={(value) => {
        if (!readOnly) field.handleChange(value)
      }}
    />
  )
}

export function FormActions({ children }: { children: ReactNode }) {
  return <Group justify='flex-end'>{children}</Group>
}

export function FormStack({ children }: { children: ReactNode }) {
  return <Stack gap='md'>{children}</Stack>
}
