import '../css/textEditor.css'
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
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
  FaQuoteLeft,
  FaTable,
} from 'react-icons/fa'
import {
  RiDeleteColumn,
  RiInsertColumnLeft,
  RiInsertColumnRight,
  RiDeleteRow,
  RiInsertRowBottom,
  RiInsertRowTop,
} from 'react-icons/ri'

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
            <FaQuoteLeft />
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
            <FaTable />
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
            <RiInsertColumnLeft />
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
            <RiInsertColumnRight />
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
            <RiInsertRowTop />
          </span>
          <span
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className={`${
              editor.isActive('insertRowAfter') ? 'is_active' : ''
            } btn`}
            type='button'
            title='Insert Row Below'
          >
            <RiInsertRowBottom />
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
        debounceSave(content) // trigger save for any changes
      },
      250,
      name
    ) // every .25 of a second max

    // debounce save after no activity in editor
    const debounceSave = useDebounce(function (content) {
      handleSave(content)
    }, 3 * 1000) // every 3 seconds max

    useAutosave(
      (content) => {
        // run save if changes and not already saving
        if (isChanges && !isSaving) {
          handleSave(content)
        }
      },
      60 * 1000,
      name
    ) // autosave every minute

    const handleSave = (content) => {
      console.log('saving')
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
    }))

    return (
      <div
        className={`textEditor${size ? ` ${size}` : ' mb-2'} ${
          short ? 'shortDesc' : ''
        } ${className ? className : ''}`}
      >
        <MenuBar editor={editor} noMenuBar={noMenuBar} />
        <div className='label-container'>
          <div className={`text-editor-label ${!isEmpty() ? 'filled' : ''}`}>
            {placeholder}
          </div>
        </div>
        <EditorContent editor={editor} />
      </div>
    )
  }
)

export default TextEditor
