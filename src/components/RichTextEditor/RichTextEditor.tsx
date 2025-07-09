import { RichTextEditor as MantineRichTextEditor, Link } from '@mantine/tiptap'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Superscript from '@tiptap/extension-superscript'
import SubScript from '@tiptap/extension-subscript'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import Placeholder from '@tiptap/extension-placeholder'
import CustomTableHeader from './CustomTableHeader'
import CustomTableCell from './CustomTableCell'
import { editor_table, editor_table_th, editor_table_td } from './RichTextEditor.css'

export interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  onBlur?: ({ target: { name, value } }: { target: { name: string; value: string } }) => void
  name: string
}

const RichTextEditor = ({ value, onChange, placeholder, label, onBlur, name }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
      Superscript,
      SubScript,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({
        HTMLAttributes: {
          class: editor_table,
        },
        resizable: true,
      }),
      TableRow,
      CustomTableHeader.configure({
        HTMLAttributes: {
          class: editor_table_th,
        },
      }),
      CustomTableCell.configure({
        HTMLAttributes: {
          class: editor_table_td,
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    onBlur: ({ editor }) => {
      if (onBlur) {
        onBlur({ target: { name: name, value: editor.getHTML() } })
      }
    },
  })

  return (
    <>
      {label && <span>{label}</span>}
      <MantineRichTextEditor editor={editor}>
        <MantineRichTextEditor.Toolbar sticky stickyOffset='var(--docs-header-height)'>
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

        <MantineRichTextEditor.Content />
      </MantineRichTextEditor>
    </>
  )
}

export default RichTextEditor
