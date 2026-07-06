import { Menu } from '@mantine/core'
import { RichTextEditor as MantineRichTextEditor, useRichTextEditorContext } from '@mantine/tiptap'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  ChevronRight,
  Columns3,
  Code2,
  Heading,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Plus,
  Quote,
  RemoveFormatting,
  Rows3,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  TableCellsMerge,
  TableCellsSplit,
  Trash2,
  Underline,
  Unlink
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
      <TextMenu />
      <BlockMenu />
      <ContentMenu />
      <MantineRichTextEditor.Undo />
      <MantineRichTextEditor.Redo />
    </MantineRichTextEditor.Toolbar>
  )
}

const TextMenu = () => {
  const { editor } = useRichTextEditorContext()
  const hasActiveTextStyle = Boolean(
    editor?.isActive('bold')
      || editor?.isActive('italic')
      || editor?.isActive('underline')
      || editor?.isActive('strike')
      || editor?.isActive('code')
      || editor?.isActive('subscript')
      || editor?.isActive('superscript')
  )

  return (
    <MantineRichTextEditor.ControlsGroup>
      <Menu position='bottom-start' width={190} withinPortal>
        <Menu.Target>
          <MantineRichTextEditor.Control
            active={hasActiveTextStyle}
            aria-label='Text formatting'
            disabled={!editor}
            title='Text formatting'
          >
            <span className={editorStyles.editorMenuControlContent}>
              <Bold aria-hidden='true' className={editorStyles.editorMenuIcon} />
              <ChevronDown aria-hidden='true' className={editorStyles.editorMenuChevron} />
            </span>
          </MantineRichTextEditor.Control>
        </Menu.Target>
        <Menu.Dropdown className={editorStyles.editorMenuDropdown}>
          <Menu.Item
            className={editorStyles.editorMenuItem}
            data-active={editor?.isActive('bold') || undefined}
            leftSection={<Bold aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            Bold
          </Menu.Item>
          <Menu.Item
            className={editorStyles.editorMenuItem}
            data-active={editor?.isActive('italic') || undefined}
            leftSection={<Italic aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            Italic
          </Menu.Item>
          <Menu.Item
            className={editorStyles.editorMenuItem}
            data-active={editor?.isActive('underline') || undefined}
            leftSection={<Underline aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            Underline
          </Menu.Item>
          <Menu.Item
            className={editorStyles.editorMenuItem}
            data-active={editor?.isActive('strike') || undefined}
            leftSection={<Strikethrough aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          >
            Strikethrough
          </Menu.Item>
          <Menu.Item
            className={editorStyles.editorMenuItem}
            data-active={editor?.isActive('code') || undefined}
            leftSection={<Code2 aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().toggleCode().run()}
          >
            Inline code
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            className={editorStyles.editorMenuItem}
            data-active={editor?.isActive('subscript') || undefined}
            leftSection={<Subscript aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().toggleSubscript().run()}
          >
            Subscript
          </Menu.Item>
          <Menu.Item
            className={editorStyles.editorMenuItem}
            data-active={editor?.isActive('superscript') || undefined}
            leftSection={<Superscript aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().toggleSuperscript().run()}
          >
            Superscript
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            className={editorStyles.editorMenuItem}
            leftSection={<RemoveFormatting aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
          >
            Clear formatting
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </MantineRichTextEditor.ControlsGroup>
  )
}

const BlockMenu = () => {
  const { editor } = useRichTextEditorContext()
  const hasActiveBlockTool = Boolean(
    headingLevels.some((level) => editor?.isActive('heading', { level }))
      || editor?.isActive('bulletList')
      || editor?.isActive('orderedList')
      || editor?.isActive('blockquote')
      || alignments.some(({ value }) => editor?.isActive({ textAlign: value }))
  )

  return (
    <MantineRichTextEditor.ControlsGroup>
      <Menu position='bottom-start' width={210} withinPortal>
        <Menu.Target>
          <MantineRichTextEditor.Control
            active={hasActiveBlockTool}
            aria-label='Block tools'
            disabled={!editor}
            title='Block tools'
          >
            <span className={editorStyles.editorMenuControlContent}>
              <Pilcrow aria-hidden='true' className={editorStyles.editorMenuIcon} />
              <ChevronDown aria-hidden='true' className={editorStyles.editorMenuChevron} />
            </span>
          </MantineRichTextEditor.Control>
        </Menu.Target>
        <Menu.Dropdown className={editorStyles.editorMenuDropdown}>
          <Menu.Sub position='right-start'>
            <Menu.Sub.Target>
              <Menu.Sub.Item
                className={editorStyles.editorMenuItem}
                data-active={
                  (editor?.isActive('paragraph') || headingLevels.some((level) => editor?.isActive('heading', { level })))
                    || undefined
                }
                leftSection={<Heading aria-hidden='true' className={editorStyles.editorMenuIcon} />}
                rightSection={<ChevronRight aria-hidden='true' className={editorStyles.editorMenuChevron} />}
              >
                Headings
              </Menu.Sub.Item>
            </Menu.Sub.Target>
            <Menu.Sub.Dropdown className={editorStyles.editorMenuDropdown}>
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
            </Menu.Sub.Dropdown>
          </Menu.Sub>
          <Menu.Item
            className={editorStyles.editorMenuItem}
            data-active={editor?.isActive('bulletList') || undefined}
            leftSection={<List aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            Bulleted list
          </Menu.Item>
          <Menu.Item
            className={editorStyles.editorMenuItem}
            data-active={editor?.isActive('orderedList') || undefined}
            leftSection={<ListOrdered aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            Numbered list
          </Menu.Item>
          <Menu.Sub position='right-start'>
            <Menu.Sub.Target>
              <Menu.Sub.Item
                className={editorStyles.editorMenuItem}
                data-active={alignments.some(({ value }) => editor?.isActive({ textAlign: value })) || undefined}
                leftSection={<AlignLeft aria-hidden='true' className={editorStyles.editorMenuIcon} />}
                rightSection={<ChevronRight aria-hidden='true' className={editorStyles.editorMenuChevron} />}
              >
                Alignment
              </Menu.Sub.Item>
            </Menu.Sub.Target>
            <Menu.Sub.Dropdown className={editorStyles.editorMenuDropdown}>
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
            </Menu.Sub.Dropdown>
          </Menu.Sub>
          <Menu.Divider />
          <Menu.Item
            className={editorStyles.editorMenuItem}
            data-active={editor?.isActive('blockquote') || undefined}
            leftSection={<Quote aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            Quote block
          </Menu.Item>
          <Menu.Item
            className={editorStyles.editorMenuItem}
            leftSection={<Minus aria-hidden='true' className={editorStyles.editorMenuIcon} />}
            onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          >
            Divider
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </MantineRichTextEditor.ControlsGroup>
  )
}

const ContentMenu = () => {
  const { editor } = useRichTextEditorContext()
  const hasActiveLink = Boolean(editor?.isActive('link'))
  const inTable = editor?.isActive('table') ?? false
  const hasActiveContent = Boolean(hasActiveLink || inTable)

  const handleSetLink = () => {
    const currentHref = editor?.getAttributes('link').href
    const href = window.prompt('Link URL', typeof currentHref === 'string' ? currentHref : '')

    if (href === null) return

    if (href.trim() === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor?.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run()
  }

  return (
    <MantineRichTextEditor.ControlsGroup>
      <Menu position='bottom-start' width={190} withinPortal>
        <Menu.Target>
          <MantineRichTextEditor.Control
            active={hasActiveContent}
            aria-label='Content tools'
            disabled={!editor}
            title='Content tools'
          >
            <span className={editorStyles.editorMenuControlContent}>
              <Plus aria-hidden='true' className={editorStyles.editorMenuIcon} />
              <ChevronDown aria-hidden='true' className={editorStyles.editorMenuChevron} />
            </span>
          </MantineRichTextEditor.Control>
        </Menu.Target>
        <Menu.Dropdown className={editorStyles.editorMenuDropdown}>
          <Menu.Sub position='right-start'>
            <Menu.Sub.Target>
              <Menu.Sub.Item
                className={editorStyles.editorMenuItem}
                data-active={hasActiveLink || undefined}
                leftSection={<Link aria-hidden='true' className={editorStyles.editorMenuIcon} />}
                rightSection={<ChevronRight aria-hidden='true' className={editorStyles.editorMenuChevron} />}
              >
                Link
              </Menu.Sub.Item>
            </Menu.Sub.Target>
            <Menu.Sub.Dropdown className={editorStyles.editorMenuDropdown}>
              <Menu.Item
                className={editorStyles.editorMenuItem}
                data-active={hasActiveLink || undefined}
                leftSection={<Link aria-hidden='true' className={editorStyles.editorMenuIcon} />}
                onClick={handleSetLink}
              >
                Edit link
              </Menu.Item>
              <Menu.Item
                className={editorStyles.editorMenuItem}
                disabled={!hasActiveLink}
                leftSection={<Unlink aria-hidden='true' className={editorStyles.editorMenuIcon} />}
                onClick={() => editor?.chain().focus().extendMarkRange('link').unsetLink().run()}
              >
                Remove link
              </Menu.Item>
            </Menu.Sub.Dropdown>
          </Menu.Sub>

          <Menu.Sub position='right-start'>
            <Menu.Sub.Target>
              <Menu.Sub.Item
                className={editorStyles.editorMenuItem}
                data-active={inTable || undefined}
                leftSection={<Table aria-hidden='true' className={editorStyles.editorMenuIcon} />}
                rightSection={<ChevronRight aria-hidden='true' className={editorStyles.editorMenuChevron} />}
              >
                Table
              </Menu.Sub.Item>
            </Menu.Sub.Target>
            <Menu.Sub.Dropdown className={editorStyles.editorMenuDropdown}>
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
            </Menu.Sub.Dropdown>
          </Menu.Sub>
        </Menu.Dropdown>
      </Menu>
    </MantineRichTextEditor.ControlsGroup>
  )
}

export default Toolbar
