import {
  LuHeading1,
  LuHeading2,
  LuHeading3,
  LuHeading4,
  LuHeading5,
  LuHeading6,
} from 'react-icons/lu'
import {
  TbStrikethrough,
  TbBold,
  TbUnderline,
  TbItalic,
  TbTablePlus,
  TbTableMinus,
  TbBlockquote,
  TbColumnInsertLeft,
  TbColumnInsertRight,
  TbRowInsertBottom,
  TbRowInsertTop,
  TbList,
  TbListNumbers,
  TbRowRemove,
  TbColumnRemove,
} from 'react-icons/tb'
import {
  editor_button,
  editor_button_group,
  editor_menu_bar,
} from './RichTextEditor.css'
import clsx from 'clsx'

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null
  }

  return (
    <div className={editor_menu_bar} tabIndex={-1}>
      <span className={editor_button_group}>
        <span
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={clsx(editor_button, {
            ['active']: editor.isActive('heading', { level: 1 }),
          })}
          title='Heading 1'
        >
          <LuHeading1 />
        </span>
        <span
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={clsx(editor_button, {
            ['active']: editor.isActive('heading', { level: 2 }),
          })}
          title='Heading 2'
        >
          <LuHeading2 />
        </span>
        <span
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={clsx(editor_button, {
            ['active']: editor.isActive('heading', { level: 3 }),
          })}
          title='Heading 3'
        >
          <LuHeading3 />
        </span>
        <span
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 4 }).run()
          }
          className={clsx(editor_button, {
            ['active']: editor.isActive('heading', { level: 4 }),
          })}
          title='Heading 4'
        >
          <LuHeading4 />
        </span>
        <span
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 5 }).run()
          }
          className={clsx(editor_button, {
            ['active']: editor.isActive('heading', { level: 5 }),
          })}
          title='Heading 5'
        >
          <LuHeading5 />
        </span>
        <span
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 6 }).run()
          }
          className={clsx(editor_button, {
            ['active']: editor.isActive('heading', { level: 6 }),
          })}
          title='Heading 6'
        >
          <LuHeading6 />
        </span>
      </span>
      <span className={editor_button_group}>
        <span
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={clsx(editor_button, {
            ['active']: editor.isActive('bold'),
          })}
          title='Bold'
        >
          <TbBold />
        </span>
        <span
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={clsx(editor_button, {
            ['active']: editor.isActive('italic'),
          })}
          title='Italics'
        >
          <TbItalic />
        </span>
        <span
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={clsx(editor_button, {
            ['active']: editor.isActive('underline'),
          })}
          title='Underline'
        >
          <TbUnderline />
        </span>
        <span
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={clsx(editor_button, {
            ['active']: editor.isActive('strike'),
          })}
          title='Strikethrough'
        >
          <TbStrikethrough />
        </span>
      </span>
      <span className={editor_button_group}>
        <span
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={clsx(editor_button, {
            ['active']: editor.isActive('bulletList'),
          })}
          title='Bulleted List'
        >
          <TbList />
        </span>
        <span
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={clsx(editor_button, {
            ['active']: editor.isActive('orderedList'),
          })}
          title='Numbered List'
        >
          <TbListNumbers />
        </span>
        <span
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={clsx(editor_button, {
            ['active']: editor.isActive('blockquote'),
          })}
          title='Quote'
        >
          <TbBlockquote />
        </span>
      </span>
      <span className={editor_button_group}>
        <span
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          className={editor_button}
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
          className={editor_button}
          title='Remove Table'
        >
          <TbTableMinus />
        </span>
        <span
          onClick={() => editor.chain().focus().deleteColumn().run()}
          className={editor_button}
          title='Delete Column'
        >
          <TbColumnRemove />
        </span>
        <span
          onClick={() => editor.chain().focus().addColumnBefore().run()}
          className={editor_button}
          title='Insert Column Before'
        >
          <TbColumnInsertLeft />
        </span>
        <span
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          className={editor_button}
          title='Insert Column After'
        >
          <TbColumnInsertRight />
        </span>
        <span
          onClick={() => editor.chain().focus().deleteRow().run()}
          className={editor_button}
          title='Delete Row'
        >
          <TbRowRemove />
        </span>
        <span
          onClick={() => editor.chain().focus().addRowBefore().run()}
          className={editor_button}
          title='Insert Row Above'
        >
          <TbRowInsertTop />
        </span>
        <span
          onClick={() => editor.chain().focus().addRowAfter().run()}
          className={editor_button}
          title='Insert Row Below'
        >
          <TbRowInsertBottom />
        </span>
      </span>
    </div>
  )
}

export default MenuBar
