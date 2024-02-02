import { useState, useEffect, FC } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import MenuBar from './MenuBar'
import CustomTableHeader from './CustomTableHeader'
import CustomTableCell from './CustomTableCell'
import { Action } from '../../utils/types'
import TextAlign from '@tiptap/extension-text-align'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import useDebounce, { UseDebounceCallback } from '../../hooks/useDebounce'
import useAutosave from '../../hooks/useAutosave'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import {
  editor_container,
  editor_label,
  editor_content_container,
  editor_content,
  editor_table,
  editor_table_th,
  editor_table_td,
} from './RichTextEditor.css'
import clsx from 'clsx'

interface TextEditorProps {
  onChange: (arg: Action) => void
  label: string
  name: string
  value: any
  className?: string | number | symbol | any
}

const TextEditor: FC<TextEditorProps> = ({
  onChange,
  label,
  name,
  value,
  className,
}) => {
  const [debouncing, setDebouncing] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const [isChanges, setIsChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // debounce save after no activity in editor
  const debounceSave = useDebounce(
    ((editor: any) => {
      setDebouncing(true)
      setInputValue(editor.getHTML())
      handleSave(editor.getHTML())
    }) as UseDebounceCallback,
    0.3 * 1000
  )

  useAutosave(
    (content) => {
      if (isChanges && !isSaving) {
        handleSave(content)
      }
    },
    60 * 1000,
    name
  )

  const handleSave = (content: any) => {
    setIsSaving(true)
    onChange({ payload: { target: { name: name, value: content } } })
    setIsSaving(false)
    setIsChanges(false)
    setDebouncing(false)
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Underline,
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
      TextAlign,
    ],
    editorProps: {
      attributes: {
        class: editor_content,
      },
    },
    content: '',
    onUpdate: ({ editor }) => {
      debounceSave(editor)
      setIsChanges(true)
    },
  })

  useEffect(() => {
    if (editor?.getHTML() === '' && value) {
      editor?.commands.setContent(value)
      setInputValue(value)
    }
  }, [editor, value])

  useEffect(() => {
    if (inputValue !== value && !debouncing) {
      setInputValue(value)
      editor?.commands.setContent(value)
    }
  }, [debouncing, editor, inputValue, value])

  return (
    <>
      <label className={editor_label}>{label}</label>
      <div
        className={clsx(editor_container, { [className]: className })}
        tabIndex={-1}
      >
        <MenuBar editor={editor} />
        <EditorContent editor={editor} className={editor_content_container} />
      </div>
    </>
  )
}

export default TextEditor
