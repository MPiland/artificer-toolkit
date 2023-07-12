import '../scss/style.scss'
import { useEditor, EditorContent } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
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

const MenuBar = ({ editor }) => {
  if (!editor) {
    return null
  }

  return (
    <div className='container menuBar'>
      <div className='row'>
        <div className='col-auto p-0'>
          <span
            className='btn dropdown-toggle'
            data-bs-toggle='dropdown'
            aria-expanded='false'
          >
            Heading
          </span>
          <ul className='dropdown-menu'>
            <li>
              <button
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 1 }).run()
                }
                className={
                  editor.isActive('heading', { level: 1 }) ? 'is_active' : ''
                }
                type='button'
              >
                <h1>Header 1</h1>
              </button>
            </li>
            <li>
              <button
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
                className={
                  editor.isActive('heading', { level: 2 }) ? 'is_active' : ''
                }
                type='button'
              >
                <h2>Header 2</h2>
              </button>
            </li>
            <li>
              <button
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 3 }).run()
                }
                className={
                  editor.isActive('heading', { level: 3 }) ? 'is_active' : ''
                }
                type='button'
              >
                <h3>Header 3</h3>
              </button>
            </li>
            <li>
              <button
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 4 }).run()
                }
                className={
                  editor.isActive('heading', { level: 4 }) ? 'is_active' : ''
                }
                type='button'
              >
                <h4>Header 4</h4>
              </button>
            </li>
            <li>
              <button
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 5 }).run()
                }
                className={
                  editor.isActive('heading', { level: 5 }) ? 'is_active' : ''
                }
                type='button'
              >
                <h5>Header 5</h5>
              </button>
            </li>
          </ul>
          <span
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`{editor.isActive('bold') ? 'is_active' : ''} btn`}
            type='button'
            title='Bold'
          >
            <FaBold />
          </span>
          <span
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`{editor.isActive('italic') ? 'is_active' : ''} btn`}
            type='button'
            title='Italics'
          >
            <FaItalic />
          </span>
        </div>
        <div className='col-auto p-0'>
          <span
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`{editor.isActive('underline') ? 'is_active' : ''} btn`}
            type='button'
            title='Underline'
          >
            <FaUnderline />
          </span>
          <span
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`{editor.isActive('strike') ? 'is_active' : ''} btn`}
            type='button'
            title='Strikethrough'
          >
            <FaStrikethrough />
          </span>
          <span
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`{editor.isActive('bulletList') ? 'is_active' : ''} btn`}
            type='button'
            title='Bulleted List'
          >
            <FaListUl />
          </span>
          <span
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`{editor.isActive('orderedList') ? 'is_active' : ''} btn`}
            type='button'
            title='Numbered List'
          >
            <FaListOl />
          </span>
          <span
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`{editor.isActive('blockquote') ? 'is_active' : ''} btn`}
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
            className={`{editor.isActive('table') ? 'is_active' : ''} btn`}
            type='button'
            title='Add Table'
          >
            <FaTable />
          </span>
          <span
            onClick={() => editor.chain().focus().deleteColumn().run()}
            className={`{editor.isActive('deleteColumn') ? 'is_active' : ''} btn`}
            type='button'
            title='Delete Column'
          >
            <RiDeleteColumn />
          </span>
          <span
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            className={`{editor.isActive('insertColumnBefore') ? 'is_active' : ''} btn`}
            type='button'
            title='Insert Column Before'
          >
            <RiInsertColumnLeft />
          </span>
          <span
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            className={`{editor.isActive('insertColumnAfter') ? 'is_active' : ''} btn`}
            type='button'
            title='Insert Column After'
          >
            <RiInsertColumnRight />
          </span>
          <span
            onClick={() => editor.chain().focus().deleteRow().run()}
            className={`{editor.isActive('deleteRow') ? 'is_active' : ''} btn`}
            type='button'
            title='Delete Row'
          >
            <RiDeleteRow />
          </span>
          <span
            onClick={() => editor.chain().focus().addRowBefore().run()}
            className={`{editor.isActive('insertRowBefore') ? 'is_active' : ''} btn`}
            type='button'
            title='Insert Row Above'
          >
            <RiInsertRowTop />
          </span>
          <span
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className={`{editor.isActive('insertRowAfter') ? 'is_active' : ''} btn`}
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

const TextEditor = ({ onChange, placeholder, name, className }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5],
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder: placeholder,
      }),
      Table.configure({ resizable: true, lastColumnResizable: true }),
      TableCell,
      TableRow,
      TableHeader,
    ],
    content: '',

    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange({ payload: { target: { name: name, value: html } } })
    },
  })

  return (
    <div className={`textEditor ${className}`}>
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

export default TextEditor
