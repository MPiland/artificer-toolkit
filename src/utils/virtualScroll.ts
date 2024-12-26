type ScrollState = {
  scrollTop: number
  startIndex: number
  thumbPosition: number
  scrollHeight: number
  renderedNodesCount: number
}

type ScrollAction =
  | { type: 'SCROLL'; deltaY: number; clientHeight: number; itemHeight: number; thumbSize: number }
  | { type: 'DRAG'; newScrollTop: number; clientHeight: number; itemHeight: number; thumbSize: number }
  | { type: 'UPDATE_LAYOUT'; itemHeight: number; totalItems: number; clientHeight: number }

const calculateThumbPosition = (scrollTop: number, clientHeight: number, scrollHeight: number, thumbSize: number) => {
  return scrollHeight > clientHeight ? (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - thumbSize) : 0
}

const OVERSCAN = 2
const BUFFER = 2

export const scrollReducer = (state: ScrollState, action: ScrollAction): ScrollState => {
  switch (action.type) {
    case 'SCROLL': {
      const newScrollTop = Math.max(
        0,
        Math.min(state.scrollTop + action.deltaY, state.scrollHeight - action.clientHeight)
      )

      const calculatedIndex = Math.floor(newScrollTop / action.itemHeight)
      const startIndex = Math.max(0, calculatedIndex <= BUFFER ? 0 : calculatedIndex - BUFFER)

      return {
        ...state,
        scrollTop: newScrollTop,
        startIndex,
        thumbPosition:
          (newScrollTop / (state.scrollHeight - action.clientHeight)) * (action.clientHeight - action.thumbSize),
      }
    }

    case 'DRAG': {
      return {
        ...state,
        scrollTop: action.newScrollTop,
        startIndex: Math.max(0, Math.floor(action.newScrollTop / action.itemHeight)),
        thumbPosition: calculateThumbPosition(
          action.newScrollTop,
          action.clientHeight,
          state.scrollHeight,
          action.thumbSize
        ),
      }
    }
    case 'UPDATE_LAYOUT': {
      const scrollHeight = action.totalItems * action.itemHeight
      const countHeight = Math.ceil(action.clientHeight / action.itemHeight) + BUFFER * OVERSCAN

      const nodeCount = Math.min(action.totalItems - state.startIndex, countHeight)

      return {
        ...state,
        scrollHeight,
        renderedNodesCount: nodeCount,
      }
    }
  }
}
