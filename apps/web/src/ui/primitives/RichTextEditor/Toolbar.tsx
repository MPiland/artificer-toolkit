import { Menu } from '@mantine/core'
import { RichTextEditor as MantineRichTextEditor, useRichTextEditorContext } from '@mantine/tiptap'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Heading,
  Pilcrow
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
