import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useFocusLinkedRow } from './useFocusLinkedRow'

function Row({ elementId, instance }: { elementId: string | null; instance: number }) {
  useFocusLinkedRow(elementId)
  return <div data-instance={instance} id='row' key={instance} tabIndex={-1} />
}

describe('useFocusLinkedRow', () => {
  it('focuses the named row once and leaves later focus alone', () => {
    const { rerender } = render(<Row elementId='row' instance={1} />)
    expect(document.getElementById('row')).toHaveFocus()
    document.body.focus()
    rerender(<Row elementId='row' instance={1} />)
    expect(document.getElementById('row')).not.toHaveFocus()
  })

  it('focuses the replacement element when the row remounts under the same id', () => {
    const { rerender } = render(
      <div>
        <Row elementId='row' instance={1} />
      </div>
    )
    const first = document.getElementById('row')
    rerender(
      <div>
        <Row elementId='row' instance={2} />
      </div>
    )
    const second = document.getElementById('row')
    expect(second).not.toBe(first)
    expect(second).toHaveFocus()
  })

  it('does nothing without an element id', () => {
    render(<Row elementId={null} instance={1} />)
    expect(document.getElementById('row')).not.toHaveFocus()
  })
})
