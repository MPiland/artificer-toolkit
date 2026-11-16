import { useEffect, useRef } from 'react'

/**
 * Focuses and scrolls to the row a deep link names, once per mounted element. It checks on every
 * commit rather than on a dependency list, because a list reload can remount the row with the same
 * id and the new element has to take focus again.
 */
export function useFocusLinkedRow(elementId: string | null) {
  const focused = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!elementId) return
    const row = document.getElementById(elementId)
    if (!row || focused.current === row) return
    focused.current = row
    row.focus({ preventScroll: true })
    row.scrollIntoView({ block: 'center' })
  })
}
