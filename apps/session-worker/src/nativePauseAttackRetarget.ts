import type { NativePauseHandler } from './nativePauseTypes.js'

export const attackRetargetPause: NativePauseHandler<'ATTACK_RETARGET'> = {
  read: ({ pause, decision }) => {
    if (!decision) throw new Error('The action requires a retarget decision.')
    return { kind: 'ATTACK_RETARGET', answer: { offer: pause.payload, selection: decision } }
  }
}
