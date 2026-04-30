import { RichTextEditor as MantineRichTextEditor, useRichTextEditorContext } from '@mantine/tiptap'
import { Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, Grid2x2Plus, Grid2x2X } from 'lucide-react'
import {
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconRowRemove,
  IconRowInsertTop,
  IconRowInsertBottom,
  IconColumnRemove
} from '@tabler/icons-react'

const InsertTableControl = () => {
  const { editor } = useRichTextEditorContext()
  return (
    <MantineRichTextEditor.Control
      onClick={() => editor?.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true })}
      aria-label='Insert table'
      title='Insert new table'
    >
      <Grid2x2Plus />
    </MantineRichTextEditor.Control>
  )
}

const DeleteTableControl = () => {
  const { editor } = useRichTextEditorContext()
  return (
    <MantineRichTextEditor.Control
      onClick={() => editor?.commands.deleteTable()}
      aria-label='Delete table'
      title='Delete table'
    >
      <Grid2x2X />
    </MantineRichTextEditor.Control>
  )
}

const InsertRowTopControl = () => {
  const { editor } = useRichTextEditorContext()
  return (
    <MantineRichTextEditor.Control
      onClick={() => editor?.commands.addRowBefore()}
      aria-label='Insert row above'
      title='Insert row above'
    >
      <IconRowInsertTop />
    </MantineRichTextEditor.Control>
  )
}

const InsertRowBottomControl = () => {
  const { editor } = useRichTextEditorContext()
  return (
    <MantineRichTextEditor.Control
      onClick={() => editor?.commands.addRowAfter()}
      aria-label='Insert row below'
      title='Insert row below'
    >
      <IconRowInsertBottom />
    </MantineRichTextEditor.Control>
  )
}

const DeleteRowControl = () => {
  const { editor } = useRichTextEditorContext()
  return (
    <MantineRichTextEditor.Control
      onClick={() => editor?.commands.deleteRow()}
      aria-label='Delete row'
      title='Delete row'
    >
      <IconRowRemove />
    </MantineRichTextEditor.Control>
  )
}

const InsertColumnLeftControl = () => {
  const { editor } = useRichTextEditorContext()
  return (
    <MantineRichTextEditor.Control
      onClick={() => editor?.commands.addColumnBefore()}
      aria-label='Insert column before'
      title='Insert column before'
    >
      <IconColumnInsertLeft />
    </MantineRichTextEditor.Control>
  )
}

const InsertColumnRightControl = () => {
  const { editor } = useRichTextEditorContext()
  return (
    <MantineRichTextEditor.Control
      onClick={() => editor?.commands.addColumnAfter()}
      aria-label='Insert column after'
      title='Insert column after'
    >
      <IconColumnInsertRight />
    </MantineRichTextEditor.Control>
  )
}

const DeleteColumnControl = () => {
  const { editor } = useRichTextEditorContext()
  return (
    <MantineRichTextEditor.Control
      onClick={() => editor?.commands.deleteColumn()}
      aria-label='Delete column'
      title='Delete column'
    >
      <IconColumnRemove />
    </MantineRichTextEditor.Control>
  )
}

const Toolbar = () => {
  return (
    <MantineRichTextEditor.Toolbar sticky stickyOffset='var(--docs-header-height)'>
      <MantineRichTextEditor.ControlsGroup>
        <MantineRichTextEditor.Bold />
        <MantineRichTextEditor.Italic />
        <MantineRichTextEditor.Underline />
        <MantineRichTextEditor.Strikethrough />
        <MantineRichTextEditor.ClearFormatting />
        <MantineRichTextEditor.Highlight />
        <MantineRichTextEditor.Code />
      </MantineRichTextEditor.ControlsGroup>

      <MantineRichTextEditor.ControlsGroup>
        <MantineRichTextEditor.H1 icon={() => <Heading1 />} />
        <MantineRichTextEditor.H2 icon={() => <Heading2 />} />
        <MantineRichTextEditor.H3 icon={() => <Heading3 />} />
        <MantineRichTextEditor.H4 icon={() => <Heading4 />} />
        <MantineRichTextEditor.H5 icon={() => <Heading5 />} />
        <MantineRichTextEditor.H6 icon={() => <Heading6 />} />
      </MantineRichTextEditor.ControlsGroup>

      <MantineRichTextEditor.ControlsGroup>
        <MantineRichTextEditor.Blockquote />
        <MantineRichTextEditor.Hr />
        <MantineRichTextEditor.BulletList />
        <MantineRichTextEditor.OrderedList />
        <MantineRichTextEditor.Subscript />
        <MantineRichTextEditor.Superscript />
      </MantineRichTextEditor.ControlsGroup>

      <MantineRichTextEditor.ControlsGroup>
        <MantineRichTextEditor.Link />
        <MantineRichTextEditor.Unlink />
      </MantineRichTextEditor.ControlsGroup>

      <MantineRichTextEditor.ControlsGroup>
        <MantineRichTextEditor.AlignLeft />
        <MantineRichTextEditor.AlignCenter />
        <MantineRichTextEditor.AlignJustify />
        <MantineRichTextEditor.AlignRight />
      </MantineRichTextEditor.ControlsGroup>

      <MantineRichTextEditor.ControlsGroup>
        <InsertTableControl />
        <DeleteTableControl />
        <InsertColumnLeftControl />
        <InsertColumnRightControl />
        <DeleteColumnControl />
        <InsertRowTopControl />
        <InsertRowBottomControl />
        <DeleteRowControl />
      </MantineRichTextEditor.ControlsGroup>

      <MantineRichTextEditor.ControlsGroup>
        <MantineRichTextEditor.Undo />
        <MantineRichTextEditor.Redo />
      </MantineRichTextEditor.ControlsGroup>
    </MantineRichTextEditor.Toolbar>
  )
}
export default Toolbar
