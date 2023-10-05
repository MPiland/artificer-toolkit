import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import TextAlign from '@tiptap/extension-text-align'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import useDebounce from '../hooks/useDebounce'
import useAutosave from '../hooks/useAutosave'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import {
  FaBold,
  FaItalic,
  FaListOl,
  FaListUl,
  FaStrikethrough,
  FaUnderline,
} from 'react-icons/fa'
import { RiDeleteColumn, RiDeleteRow } from 'react-icons/ri'
import {
  TbTablePlus,
  TbTableMinus,
  TbBlockquote,
  TbColumnInsertLeft,
  TbColumnInsertRight,
  TbRowInsertBottom,
  TbRowInsertTop,
} from 'react-icons/tb'

const MenuBar = ({ editor, noMenuBar }) => {
  if (!editor || noMenuBar) {
    return null
  }

  const selectHandler = (e) => {
    if (Number(e.target.value) === 0) {
      editor
        .chain()
        .focus()
        .toggleHeading(editor.getAttributes('heading'))
        .run()
    } else {
      editor
        .chain()
        .focus()
        .toggleHeading({ level: Number(e.target.value) })
        .run()
    }
  }

  return (
    <div className='menuBar'>
      <div className='row g-0'>
        <div className='col-auto p-0'>
          <select className='btn border-0' onChange={(e) => selectHandler(e)}>
            <option value='0'>No Heading</option>
            <option value='1'>Header 1</option>
            <option value='2'>Header 2</option>
            <option value='3'>Header 3</option>
            <option value='4'>Header 4</option>
            <option value='5'>Header 5</option>
          </select>
          <span
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`${editor.isActive('bold') ? 'is_active' : ''} btn`}
            type='button'
            title='Bold'
          >
            <FaBold />
          </span>
        </div>
        <div className='col-auto p-0'>
          <span
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`${editor.isActive('italic') ? 'is_active' : ''} btn`}
            type='button'
            title='Italics'
          >
            <FaItalic />
          </span>
          <span
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`${editor.isActive('underline') ? 'is_active' : ''} btn`}
            type='button'
            title='Underline'
          >
            <FaUnderline />
          </span>
        </div>
        <div className='col-auto p-0'>
          <span
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`${editor.isActive('strike') ? 'is_active' : ''} btn`}
            type='button'
            title='Strikethrough'
          >
            <FaStrikethrough />
          </span>
          <span
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`${
              editor.isActive('bulletList') ? 'is_active' : ''
            } btn`}
            type='button'
            title='Bulleted List'
          >
            <FaListUl />
          </span>
          <span
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`${
              editor.isActive('orderedList') ? 'is_active' : ''
            } btn`}
            type='button'
            title='Numbered List'
          >
            <FaListOl />
          </span>
        </div>
        <div className='col-auto p-0'>
          <span
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`${
              editor.isActive('blockquote') ? 'is_active' : ''
            } btn`}
            type='button'
            title='Quote'
          >
            <TbBlockquote />
          </span>
          <span
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
            className={`${editor.isActive('table') ? 'is_active' : ''} btn`}
            type='button'
            title='Add Table'
          >
            <TbTablePlus />
          </span>
          <span
            onClick={() =>
              editor
                .chain()
                .focus()
                .deleteTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
            className={`${editor.isActive('table') ? 'is_active' : ''} btn`}
            type='button'
            title='Remove Table'
          >
            <TbTableMinus />
          </span>
        </div>
        <div className='col-auto p-0'>
          <span
            onClick={() => editor.chain().focus().deleteColumn().run()}
            className={`${
              editor.isActive('deleteColumn') ? 'is_active' : ''
            } btn`}
            type='button'
            title='Delete Column'
          >
            <RiDeleteColumn />
          </span>
          <span
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            className={`${
              editor.isActive('insertColumnBefore') ? 'is_active' : ''
            } btn`}
            type='button'
            title='Insert Column Before'
          >
            <TbColumnInsertLeft />
          </span>
        </div>
        <div className='col-auto p-0'>
          <span
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            className={`${
              editor.isActive('insertColumnAfter') ? 'is_active' : ''
            } btn`}
            type='button'
            title='Insert Column After'
          >
            <TbColumnInsertRight />
          </span>
          <span
            onClick={() => editor.chain().focus().deleteRow().run()}
            className={`${editor.isActive('deleteRow') ? 'is_active' : ''} btn`}
            type='button'
            title='Delete Row'
          >
            <RiDeleteRow />
          </span>
        </div>
        <div className='col-auto p-0'>
          <span
            onClick={() => editor.chain().focus().addRowBefore().run()}
            className={`${
              editor.isActive('insertRowBefore') ? 'is_active' : ''
            } btn`}
            type='button'
            title='Insert Row Above'
          >
            <TbRowInsertTop />
          </span>
          <span
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className={`${
              editor.isActive('insertRowAfter') ? 'is_active' : ''
            } btn`}
            type='button'
            title='Insert Row Below'
          >
            <TbRowInsertBottom />
          </span>
        </div>
      </div>
    </div>
  )
}

const TextEditor = forwardRef(
  (
    { onChange, placeholder, name, short, noMenuBar, value, size, className },
    ref
  ) => {
    const [initialState] = useState(value)
    const [isChanges, setIsChanges] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const isEmpty = () => !editor?.state?.doc?.textContent?.trim().length

    let content

    const debounceChanges = useDebounce(
      function (editor) {
        content = editor.getHTML()
        debounceSave(content)
      },
      250,
      name
    )

    // debounce save after no activity in editor
    const debounceSave = useDebounce(function (content) {
      handleSave(content)
    }, 1 * 1000)

    useAutosave(
      (content) => {
        if (isChanges && !isSaving) {
          handleSave(content)
        }
      },
      60 * 1000,
      name
    )

    const handleSave = (content) => {
      setIsSaving(true)
      onChange({ payload: { target: { name: name, value: content } } })
      setIsSaving(false)
      setIsChanges(false)
    }

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3, 4, 5],
          },
        }),
        Underline,
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
        TextAlign,
      ],
      editorProps: {
        attributes: {
          class: `text-editor-content`,
        },
      },
      content: '',
      onUpdate: ({ editor }) => {
        debounceChanges(editor)
        setIsChanges(true)
      },
    })

    useEffect(() => {
      if (!content) {
        editor?.commands.setContent(initialState)
      }
    }, [editor, content, initialState])

    useImperativeHandle(ref, () => ({
      resetState() {
        editor?.commands.setContent(null)
      },
      revertState() {
        editor?.commands.setContent(initialState)
      },
      getName() {
        return name
      },
    }))

    return (
      <div className={`${size ? ` ${size}` : ' mb-2'}`}>
        <div
          className={`textEditor ${short ? 'shortDesc' : ''} ${
            className ? className : ''
          }`}
        >
          <MenuBar editor={editor} noMenuBar={noMenuBar} />
          <div className='label-container'>
            <div className={`text-editor-label ${!isEmpty() ? 'filled' : ''}`}>
              {placeholder}
            </div>
          </div>
          <EditorContent editor={editor} />
        </div>
      </div>
    )
  }
)

export default TextEditor
