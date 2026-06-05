import { Menu } from '@mantine/core'
import { RichTextEditor as MantineRichTextEditor, useRichTextEditorContext } from '@mantine/tiptap'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Columns3,
  Heading,
  Pilcrow,
  Rows3,
  Table,
  TableCellsMerge,
  TableCellsSplit,
  Trash2
} from 'lucide-react'
import * as editorStyles from './RichTextEditor.css'

const headingLevels = [1, 2, 3, 4] as const
const alignments = [
  { value: 'left', label: 'Left', Icon: AlignLeft },
  { value: 'center', label: 'Center', Icon: AlignCenter },
  { value: 'right', label: 'Right', Icon: AlignRight },
  { value: 'justify', label: 'Justify', Icon: AlignJustify }
] as const

const Toolbar = () => {
  return (
    <MantineRichTextEditor.Toolbar>
      <MantineRichTextEditor.ControlsGroup>
        <MantineRichTextEditor.Bold />
        <MantineRichTextEditor.Italic />
        <MantineRichTextEditor.Underline />
      </MantineRichTextEditor.ControlsGroup>

      <HeadingMenu />

      <MantineRichTextEditor.ControlsGroup>
        <MantineRichTextEditor.BulletList />
        <MantineRichTextEditor.OrderedList />
      </MantineRichTextEditor.ControlsGroup>

      <TableMenu />

      <MantineRichTextEditor.ControlsGroup>
        <MantineRichTextEditor.Link />
        <MantineRichTextEditor.Unlink />
      </MantineRichTextEditor.ControlsGroup>

      <AlignmentMenu />

      <MantineRichTextEditor.ControlsGroup>
        <MantineRichTextEditor.Strikethrough />
        <MantineRichTextEditor.ClearFormatting />
        <MantineRichTextEditor.Highlight />
        <MantineRichTextEditor.Code />
      </MantineRichTextEditor.ControlsGroup>

      <MantineRichTextEditor.ControlsGroup>
        <MantineRichTextEditor.Blockquote />
        <MantineRichTextEditor.Hr />
        <MantineRichTextEditor.Subscript />
        <MantineRichTextEditor.Superscript />
      </MantineRichTextEditor.ControlsGroup>

      <MantineRichTextEditor.ControlsGroup>
        <MantineRichTextEditor.Undo />
        <MantineRichTextEditor.Redo />
      </MantineRichTextEditor.ControlsGroup>
    </MantineRichTextEditor.Toolbar>
  )
}

const TableMenu = () => {
  const { editor } = useRichTextEditorContext()
  const inTable = editor?.isActive('table') ?? false

  return (
    <MantineRichTextEditor.ControlsGroup>
      <Menu position='bottom-start' width={190} withinPortal>
        <Menu.Target>
          <MantineRichTextEditor.Control
            active={inTable}
            aria-label='Table tools'
            disabled={!editor}
            title='Table tools'
          >
            <span className={editorStyles.editorMenuControlContent}>
              <Table aria-hidden='true' className={editorStyles.editorMenuIcon} />
              <ChevronDown aria-hidden='true' className={editorStyles.editorMenuChevron} />
            </span>
          </MantineRichTextEditor.Control>
        </Menu.Target>
        <Menu.Dropdown className={editorStyles.editorMenuDropdown}>
          <Menu.Item
            className={editorStyles.editorMenuItem}
            leftSection={<Table aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          >
            Insert table
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            className={editorStyles.editorMenuItem}
            disabled={!inTable}
            leftSection={<Rows3 aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().addRowAfter().run()}
          >
            Add row
          </Menu.Item>
          <Menu.Item
            className={editorStyles.editorMenuItem}
            disabled={!inTable}
            leftSection={<Rows3 aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().deleteRow().run()}
          >
            Delete row
          </Menu.Item>
          <Menu.Item
            className={editorStyles.editorMenuItem}
            disabled={!inTable}
            leftSection={<Columns3 aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().addColumnAfter().run()}
          >
            Add column
          </Menu.Item>
          <Menu.Item
            className={editorStyles.editorMenuItem}
            disabled={!inTable}
            leftSection={<Columns3 aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().deleteColumn().run()}
          >
            Delete column
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            className={editorStyles.editorMenuItem}
            disabled={!inTable}
            leftSection={<TableCellsMerge aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().mergeCells().run()}
          >
            Merge cells
          </Menu.Item>
          <Menu.Item
            className={editorStyles.editorMenuItem}
            disabled={!inTable}
            leftSection={<TableCellsSplit aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().splitCell().run()}
          >
            Split cell
          </Menu.Item>
          <Menu.Item
            className={editorStyles.editorMenuItem}
            color='red'
            disabled={!inTable}
            leftSection={<Trash2 aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().deleteTable().run()}
          >
            Delete table
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </MantineRichTextEditor.ControlsGroup>
  )
}

const HeadingMenu = () => {
  const { editor } = useRichTextEditorContext()
  const hasActiveHeading = headingLevels.some((level) => editor?.isActive('heading', { level }))

  return (
    <MantineRichTextEditor.ControlsGroup>
      <Menu position='bottom-start' width={160} withinPortal>
        <Menu.Target>
          <MantineRichTextEditor.Control
            active={hasActiveHeading}
            aria-label='Text style'
            disabled={!editor}
            title='Text style'
          >
            <span className={editorStyles.editorMenuControlContent}>
              <Heading aria-hidden='true' className={editorStyles.editorMenuIcon} />
              <ChevronDown aria-hidden='true' className={editorStyles.editorMenuChevron} />
            </span>
          </MantineRichTextEditor.Control>
        </Menu.Target>
        <Menu.Dropdown className={editorStyles.editorMenuDropdown}>
          <Menu.Item
            className={editorStyles.editorMenuItem}
            data-active={editor?.isActive('paragraph') || undefined}
            leftSection={<Pilcrow aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().setParagraph().run()}
          >
            Paragraph
          </Menu.Item>
          {headingLevels.map((level) => (
            <Menu.Item
              className={editorStyles.editorMenuItem}
              data-active={editor?.isActive('heading', { level }) || undefined}
              key={level}
              leftSection={<Heading aria-hidden='true' className={editorStyles.editorMenuIcon} />}
              onClick={() => editor?.chain().focus().toggleHeading({ level }).run()}
            >
              Heading {level}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </MantineRichTextEditor.ControlsGroup>
  )
}

const AlignmentMenu = () => {
  const { editor } = useRichTextEditorContext()
  const activeAlignment = alignments.find(({ value }) => editor?.isActive({ textAlign: value }))
  const ActiveIcon = activeAlignment?.Icon ?? AlignLeft

  return (
    <MantineRichTextEditor.ControlsGroup>
      <Menu position='bottom-start' width={150} withinPortal>
        <Menu.Target>
          <MantineRichTextEditor.Control
            active={Boolean(activeAlignment)}
            aria-label='Text alignment'
            disabled={!editor}
            title='Text alignment'
          >
            <span className={editorStyles.editorMenuControlContent}>
              <ActiveIcon aria-hidden='true' className={editorStyles.editorMenuIcon} />
              <ChevronDown aria-hidden='true' className={editorStyles.editorMenuChevron} />
            </span>
          </MantineRichTextEditor.Control>
        </Menu.Target>
        <Menu.Dropdown className={editorStyles.editorMenuDropdown}>
          {alignments.map(({ value, label, Icon }) => (
            <Menu.Item
              className={editorStyles.editorMenuItem}
              data-active={editor?.isActive({ textAlign: value }) || undefined}
              key={value}
              leftSection={<Icon aria-hidden='true' className={editorStyles.editorMenuIcon} />}
              onClick={() => editor?.chain().focus().setTextAlign(value).run()}
            >
              {label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </MantineRichTextEditor.ControlsGroup>
  )
}

export default Toolbar
