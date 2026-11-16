import { fireEvent } from 'storybook/test'

/** Presses the canvas centre, where focusing a token puts it, or a corner, which is empty map there. */
export async function pressStage(canvas: HTMLElement, where: 'centre' | 'corner'): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  const bounds = canvas.getBoundingClientRect()
  const point =
    where === 'centre'
      ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
      : { x: bounds.left + 4, y: bounds.top + 4 }
  const pointer = { clientX: point.x, clientY: point.y, pointerId: 1, pointerType: 'mouse' }
  fireEvent.pointerDown(canvas, { ...pointer, button: 0, buttons: 1 })
  fireEvent.pointerUp(canvas, { ...pointer, button: 0, buttons: 0 })
}
