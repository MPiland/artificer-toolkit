import type { NativePauseHandler } from './nativePauseTypes.js'

export const castReactionPause: NativePauseHandler<'CAST_REACTION'> = {
  read: ({ pause, decision }) => {
    if (!decision) throw new Error('The action requires a reaction decision.')
    return { kind: 'CAST_REACTION', answer: { offer: pause.payload, selection: decision } }
  }
}
