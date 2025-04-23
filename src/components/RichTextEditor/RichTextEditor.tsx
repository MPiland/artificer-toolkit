import { useState, useEffect, useCallback } from 'react'
import { useEditor, EditorContent, Editor } from '@tiptap/react'
import MenuBar from './MenuBar'
import CustomTableHeader from './CustomTableHeader'
import CustomTableCell from './CustomTableCell'
import TextAlign from '@tiptap/extension-text-align'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import {
  editor_container,
  editor_content_container,
  editor_content,
  editor_table,
  editor_table_th,
  editor_table_td,
  editor_blockquote,
} from './RichTextEditor.css'
import clsx from 'clsx'
import ScrollArea from '../ScrollArea/ScrollArea'
import { useDebounceCallback } from 'usehooks-ts'
import { sprinkles } from '../../css/sprinkles.css'
import type { DeepKeyOf, OnChange } from '../../types/types'

interface RichTextEditorProps<T> {
  onChange: {
    updateField: OnChange<T>['updateField']
  }
  label?: string
  name: DeepKeyOf<T>
  value: any
  className?: string | number | symbol | any
}

const RichTextEditor = <T,>({ onChange, label, name, value, className }: RichTextEditorProps<T>) => {
  const [debouncing, setDebouncing] = useState<boolean>(false)
  const [inputValue, setInputValue] = useState<string>(value)

  const debounceSave = useDebounceCallback(
    useCallback(
      (content) => {
        onChange.updateField({ path: name, value: content })
        setDebouncing(false)
      },
      [name, onChange]
    ),
    300
  )

  const handleChanges = useCallback(
    (editor: Editor) => {
      debounceSave.cancel()
      const content = editor.getHTML()
      setInputValue(content)
      setDebouncing(true)
      debounceSave(content)
    },
    [debounceSave]
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        blockquote: {
          HTMLAttributes: {
            class: editor_blockquote,
          },
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
    content: inputValue ?? '',
    onUpdate: ({ editor }) => handleChanges(editor),
  })

  useEffect(() => {
    if (value !== inputValue && !debouncing) {
      setInputValue(value)
    }
  }, [inputValue, value, debouncing])

  useEffect(() => {
    if (editor && editor.getHTML() !== inputValue && !debouncing) {
      editor.commands.setContent(inputValue)
    }
  }, [editor, inputValue, debouncing])

  return (
    <>
      {label && <span>{label}</span>}
      <div className={clsx(editor_container, { [className]: className })} tabIndex={-1}>
        <MenuBar editor={editor} />
        <ScrollArea scrollDirection='vertical' wrapperClassName={sprinkles({ pb: 'space-3' })}>
          <EditorContent editor={editor} className={editor_content_container} />
        </ScrollArea>
      </div>
    </>
  )
}

export default RichTextEditor
