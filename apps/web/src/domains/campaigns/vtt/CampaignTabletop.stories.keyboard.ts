import { expect } from 'storybook/test'

const maxKeyPresses = 40

/** Presses until the target holds focus, so reaching it proves the keyboard path rather than a script. */
export async function reachByKeyboard(
  target: HTMLElement,
  press: () => Promise<unknown>
): Promise<void> {
  for (
    let presses = 0;
    presses < maxKeyPresses && target.ownerDocument.activeElement !== target;
    presses += 1
  )
    await press()
  await expect(target).toHaveFocus()
}
