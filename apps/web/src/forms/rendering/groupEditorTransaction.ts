import type { AnyFieldLikeMetaBase, AnyFieldMeta } from '@tanstack/react-form'
import type { GroupEditorTransaction } from './FormRenderer.context'

const EMPTY_FIELD_META: AnyFieldLikeMetaBase = {
  _arrayVersion: 0,
  _pendingValidationsCount: 0,
  errorMap: {},
  errorSourceMap: {},
  isBlurred: false,
  isDirty: false,
  isTouched: false,
  isValidating: false
}

type FieldMetaRecord = Readonly<Partial<Record<string, AnyFieldMeta>>>

function isEditorField(fieldName: string, collectionFieldName: string, rowIndex: number) {
  if (fieldName === collectionFieldName) return true

  const rowFieldName = `${collectionFieldName}[${rowIndex}]`
  return (
    fieldName === rowFieldName ||
    fieldName.startsWith(`${rowFieldName}.`) ||
    fieldName.startsWith(`${rowFieldName}[`)
  )
}

function toFieldMetaBase(meta: AnyFieldMeta): AnyFieldLikeMetaBase {
  return {
    _arrayVersion: meta._arrayVersion,
    _pendingValidationsCount: meta._pendingValidationsCount,
    errorMap: { ...meta.errorMap },
    errorSourceMap: { ...meta.errorSourceMap },
    isBlurred: meta.isBlurred,
    isDirty: meta.isDirty,
    isTouched: meta.isTouched,
    isValidating: meta.isValidating
  }
}

export function captureGroupEditorSnapshot({
  collection,
  collectionFieldName,
  fieldMeta,
  rowIndex
}: {
  collection: readonly unknown[]
  collectionFieldName: string
  fieldMeta: FieldMetaRecord
  rowIndex: number
}): Pick<GroupEditorTransaction, 'collectionSnapshot' | 'fieldMetaSnapshot'> {
  const fieldMetaSnapshot = Object.fromEntries(
    Object.entries(fieldMeta)
      .filter(
        (entry): entry is [string, AnyFieldMeta] =>
          entry[1] !== undefined && isEditorField(entry[0], collectionFieldName, rowIndex)
      )
      .map(([fieldName, meta]) => [fieldName, toFieldMetaBase(meta)])
  )

  return {
    collectionSnapshot: structuredClone(collection),
    fieldMetaSnapshot
  }
}

export function restoreGroupEditorTransaction({
  currentFieldMeta,
  editor,
  restoreCollection,
  restoreFieldMeta
}: {
  currentFieldMeta: FieldMetaRecord
  editor: GroupEditorTransaction
  restoreCollection: (collection: readonly unknown[]) => void
  restoreFieldMeta: (fieldName: string, meta: AnyFieldLikeMetaBase) => void
}) {
  restoreCollection(structuredClone(editor.collectionSnapshot))

  const currentEditorFieldNames = Object.keys(currentFieldMeta).filter((fieldName) =>
    isEditorField(fieldName, editor.fieldName, editor.rowIndex)
  )
  const fieldNames = new Set([...currentEditorFieldNames, ...Object.keys(editor.fieldMetaSnapshot)])

  for (const fieldName of fieldNames) {
    restoreFieldMeta(fieldName, editor.fieldMetaSnapshot[fieldName] ?? EMPTY_FIELD_META)
  }
}
