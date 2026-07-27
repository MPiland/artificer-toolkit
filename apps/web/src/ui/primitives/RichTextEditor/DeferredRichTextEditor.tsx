import { useId, useState } from 'react'
import { Bold, Italic, Redo2, Underline, Undo2 } from 'lucide-react'
import RichTextEditor, { type RichTextEditorProps } from './RichTextEditor'
import * as editorStyles from './RichTextEditor.css'

export function DeferredRichTextEditor({
  className,
  error,
  label,
  name,
  placeholder,
  readOnly,
  required,
  value,
  ...editorProps
}: RichTextEditorProps) {
  const [activated, setActivated] = useState(false)
  const labelId = useId()
  const errorId = useId()

  if (readOnly || activated) {
    return (
      <RichTextEditor
        {...editorProps}
        autoFocus={activated}
        className={className}
        error={error}
        label={label}
        name={name}
        placeholder={placeholder}
        readOnly={readOnly}
        required={required}
        value={value}
      />
    )
  }

  const preview = value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return (
    <>
      {label ? (
        <span id={labelId} className={editorStyles.editorLabel}>
          {label}
          {required ? <span className={editorStyles.editorRequired}> *</span> : null}
        </span>
      ) : null}
      <button
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-label={label ? `Edit ${label}` : `Edit ${name}`}
        className={editorStyles.deferredEditorShell}
        onClick={() => setActivated(true)}
        onFocus={() => setActivated(true)}
        type='button'
      >
        <span aria-hidden='true' className={editorStyles.deferredEditorToolbar}>
          <span className={editorStyles.deferredEditorControl}>
            <Bold size={14} />
          </span>
          <span className={editorStyles.deferredEditorControl}>
            <Italic size={14} />
          </span>
          <span className={editorStyles.deferredEditorControl}>
            <Underline size={14} />
          </span>
          <span className={editorStyles.deferredEditorControl}>
            <Undo2 size={14} />
          </span>
          <span className={editorStyles.deferredEditorControl}>
            <Redo2 size={14} />
          </span>
        </span>
        <span className={editorStyles.deferredEditorContent}>
          {preview || placeholder || 'Click to edit.'}
        </span>
      </button>
      {error ? (
        <span id={errorId} role='alert' className={editorStyles.editorError}>
          {error}
        </span>
      ) : null}
    </>
  )
}
