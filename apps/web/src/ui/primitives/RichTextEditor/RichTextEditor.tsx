import { RichTextEditor as MantineRichTextEditor, Link } from '@mantine/tiptap'
import { useEffect, useId } from 'react'
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
import { editor_table, editor_table_th, editor_table_td } from './RichTextEditor.css'

export interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  required?: boolean
  onBlur?: ({ target: { name, value } }: { target: { name: string, value: string } }) => void
  name: string
  readOnly?: boolean
}

const RichTextEditor = ({ value, onChange, placeholder, label, required, onBlur, name, readOnly }: RichTextEditorProps) => {
  const labelId = useId()
  const editorAttributes: Record<string, string> = label
    ? { 'aria-labelledby': labelId }
    : { 'aria-label': name }

  if (required) {
    editorAttributes['aria-required'] = 'true'
  }

  const editor = useEditor({
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
            class: editor_table
          },
          resizable: true
        },
        tableCell: false,
        tableHeader: false
      }),
      CustomTableHeader.configure({
        HTMLAttributes: {
          class: editor_table_th
        }
      }),
      CustomTableCell.configure({
        HTMLAttributes: {
          class: editor_table_td
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
      if (!readOnly) onChange(editor.getHTML())
    },
    onBlur: ({ editor }) => {
      if (onBlur) {
        onBlur({ target: { name: name, value: editor.getHTML() } })
      }
    }
  })

  useEffect(() => {
    editor?.setEditable(!readOnly)
  }, [editor, readOnly])

  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  return (
    <>
      {label && <span id={labelId}>{required ? `${label} *` : label}</span>}
      <MantineRichTextEditor editor={editor}>
        {!readOnly
          ? (
              <MantineRichTextEditor.Toolbar>
                <MantineRichTextEditor.ControlsGroup>
                  <MantineRichTextEditor.Bold />
                  <MantineRichTextEditor.Italic />
                  <MantineRichTextEditor.Underline />
                  <MantineRichTextEditor.Strikethrough />
                  <MantineRichTextEditor.ClearFormatting />
                  <MantineRichTextEditor.Highlight />
                  <MantineRichTextEditor.Code />
                </MantineRichTextEditor.ControlsGroup>

                <MantineRichTextEditor.ControlsGroup>
                  <MantineRichTextEditor.H1 />
                  <MantineRichTextEditor.H2 />
                  <MantineRichTextEditor.H3 />
                  <MantineRichTextEditor.H4 />
                </MantineRichTextEditor.ControlsGroup>

                <MantineRichTextEditor.ControlsGroup>
                  <MantineRichTextEditor.Blockquote />
                  <MantineRichTextEditor.Hr />
                  <MantineRichTextEditor.BulletList />
                  <MantineRichTextEditor.OrderedList />
                  <MantineRichTextEditor.Subscript />
                  <MantineRichTextEditor.Superscript />
                </MantineRichTextEditor.ControlsGroup>

                <MantineRichTextEditor.ControlsGroup>
                  <MantineRichTextEditor.Link />
                  <MantineRichTextEditor.Unlink />
                </MantineRichTextEditor.ControlsGroup>

                <MantineRichTextEditor.ControlsGroup>
                  <MantineRichTextEditor.AlignLeft />
                  <MantineRichTextEditor.AlignCenter />
                  <MantineRichTextEditor.AlignJustify />
                  <MantineRichTextEditor.AlignRight />
                </MantineRichTextEditor.ControlsGroup>

                <MantineRichTextEditor.ControlsGroup>
                  <MantineRichTextEditor.Undo />
                  <MantineRichTextEditor.Redo />
                </MantineRichTextEditor.ControlsGroup>
              </MantineRichTextEditor.Toolbar>
            )
          : null}

        <MantineRichTextEditor.Content />
      </MantineRichTextEditor>
    </>
  )
}

export default RichTextEditor
