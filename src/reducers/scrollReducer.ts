type ScrollState = {
  verticalThumbSize: number
  horizontalThumbSize: number
  verticalThumbPosition: number
  horizontalThumbPosition: number
  scrollHeight: number
  scrollWidth: number
  isDragging: boolean
  dragDirection: 'vertical' | 'horizontal' | 'both' | null
  active: boolean
  mousePos: { x: number; y: number }
}

type ScrollAction =
  | {
      type: 'UPDATE_SCROLL'
      verticalDelta?: number
      horizontalDelta?: number
      clientHeight: number
      clientWidth: number
    }
  | {
      type: 'UPDATE_DIMENSIONS'
      scrollHeight: number
      scrollWidth: number
      verticalThumbSize: number
      horizontalThumbSize: number
    }
  | {
      type: 'SET_DRAG'
      isDragging: boolean
      dragDirection: 'vertical' | 'horizontal' | 'both' | null
      mousePos?: { x: number; y: number }
    }
  | { type: 'SET_ACTIVE'; value: boolean }

const calculateThumbPosition = ({
  currentPosition,
  delta,
  clientSize,
  thumbSize,
}: {
  currentPosition: number
  delta: number
  clientSize: number
  thumbSize: number
}) => {
  const maxThumbTravel = clientSize - thumbSize
  const newPosition = currentPosition + delta
  return Math.max(0, Math.min(newPosition, maxThumbTravel))
}

export const scrollReducer = (state: ScrollState, action: ScrollAction): ScrollState => {
  switch (action.type) {
    case 'UPDATE_SCROLL': {
      const newState = { ...state }

      if (action.verticalDelta !== undefined) {
        newState.verticalThumbPosition = calculateThumbPosition({
          currentPosition: state.verticalThumbPosition,
          delta: action.verticalDelta,
          clientSize: action.clientHeight,
          thumbSize: state.verticalThumbSize,
        })
      }

      if (action.horizontalDelta !== undefined) {
        newState.horizontalThumbPosition = calculateThumbPosition({
          currentPosition: state.horizontalThumbPosition,
          delta: action.horizontalDelta,
          clientSize: action.clientWidth,
          thumbSize: state.horizontalThumbSize,
        })
      }

      return newState
    }

    case 'UPDATE_DIMENSIONS': {
      return {
        ...state,
        scrollHeight: action.scrollHeight,
        scrollWidth: action.scrollWidth,
        verticalThumbSize: action.verticalThumbSize,
        horizontalThumbSize: action.horizontalThumbSize,
      }
    }

    case 'SET_DRAG': {
      return {
        ...state,
        isDragging: action.isDragging,
        dragDirection: action.dragDirection,
        mousePos: action.mousePos,
      }
    }

    case 'SET_ACTIVE': {
      return {
        ...state,
        active: action.value,
      }
    }
  }
}
