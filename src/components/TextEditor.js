import '../css/textEditor.css'
import { useState } from 'react'
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

const TextEditor = ({
  onChange,
  placeholder,
  name,
  className,
  noMenuBar,
  value,
  size,
}) => {
  const [content] = useState(value)
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
    editorProps: {
      attributes: {
        class: `text-editor-content ${className ?? ''}`,
      },
    },
    content: content,
    onUpdate: ({ editor }) => {
      const value = editor.getHTML()
      onChange({ payload: { target: { name: name, value: value } } })
    },
  })

  return (
    <div className={`textEditor${size ? ` ${size} mx-1` : ' mb-2'}`}>
      <MenuBar editor={editor} noMenuBar={noMenuBar} />
      <EditorContent editor={editor} />
    </div>
  )
}

export default TextEditor
