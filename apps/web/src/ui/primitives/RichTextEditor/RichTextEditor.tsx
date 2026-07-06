import { RichTextEditor as MantineRichTextEditor, Link } from '@mantine/tiptap'
import {
  useEffect,
  useId,
  type ComponentPropsWithRef,
  type DetailedHTMLProps,
  type HTMLAttributes
} from 'react'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Superscript from '@tiptap/extension-superscript'
import SubScript from '@tiptap/extension-subscript'
import { TableKit } from '@tiptap/extension-table'
import Placeholder from '@tiptap/extension-placeholder'
import CustomTableHeader from './CustomTableHeader'
import CustomTableCell from './CustomTableCell'
import Toolbar from './Toolbar'
import * as editorStyles from './RichTextEditor.css'
import type { EditorState } from '@tiptap/pm/state'
import clsx from 'clsx'

export interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  required?: boolean
  onBlur?: ({ target: { name, value } }: { target: { name: string; value: string } }) => void
  name: string
  readOnly?: boolean
  className?: string
}

const RichTextEditor = ({
  value,
  onChange,
  placeholder,
  label,
  required,
  onBlur,
  name,
  readOnly,
  className
}: RichTextEditorProps) => {
  const labelId = useId()
  const editorAttributes:
    | { [name: string]: string }
    | ((state: EditorState) => { [name: string]: string }) = {
    'aria-labelledby': label ? labelId : '',
    'aria-label': label ? '' : name,
    'aria-required': required ? 'true' : 'false'
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false
      }),
      Underline,
      Link,
      Superscript,
      SubScript,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TableKit.configure({
        table: {
          HTMLAttributes: {
            class: editorStyles.editor_table
          },
          resizable: true
        },
        tableCell: false,
        tableHeader: false
      }),
      CustomTableHeader.configure({
        HTMLAttributes: {
          class: editorStyles.editor_table_th
        }
      }),
      CustomTableCell.configure({
        HTMLAttributes: {
          class: editorStyles.editor_table_td
        }
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' })
    ],
    content: value,
    editable: !readOnly,
    editorProps: {
      attributes: editorAttributes
    },
    onUpdate: ({ editor }) => {
      const nextValue = normalizeRichTextValue(editor.getHTML())
      if (!readOnly && !areRichTextValuesEquivalent(nextValue, value)) onChange(nextValue)
    },
    onBlur: ({ editor }) => {
      if (onBlur) {
        onBlur({ target: { name: name, value: normalizeRichTextValue(editor.getHTML()) } })
      }
    }
  })

  useEffect(() => {
    editor?.setEditable(!readOnly)
  }, [editor, readOnly])

  useEffect(() => {
    if (editor && !areRichTextValuesEquivalent(editor.getHTML(), value)) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  return (
    <>
      {label ? (
        <span id={labelId} className={editorStyles.editorLabel}>
          {label}
          {required ? <span className={editorStyles.editorRequired}> *</span> : null}
        </span>
      ) : null}
      <MantineRichTextEditor
        editor={editor}
        classNames={{
          root: clsx(editorStyles.editorRoot, className),
          toolbar: editorStyles.editorToolbar,
          content: editorStyles.editorContent,
          control: editorStyles.editorControl,
          controlIcon: editorStyles.editorControlIcon,
          controlsGroup: editorStyles.editorControlsGroup,
          Typography: editorStyles.editorTypography
        }}
      >
        {!readOnly ? <Toolbar /> : null}

        <MantineRichTextEditor.Content />
      </MantineRichTextEditor>
    </>
  )
}

function normalizeRichTextValue(value: string): string {
  const trimmed = value.trim()
  return trimmed === '<p></p>' || trimmed === '<p><br></p>' ? '' : value
}

function areRichTextValuesEquivalent(left: string, right: string): boolean {
  return toComparableRichTextValue(left) === toComparableRichTextValue(right)
}

function toComparableRichTextValue(value: string): string {
  const normalized = normalizeRichTextValue(value).trim()
  if (normalized.length === 0) return ''
  if (/<[a-z][\s\S]*>/i.test(normalized)) return normalized
  return `<p>${escapeHtml(normalized)}</p>`
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default RichTextEditor
