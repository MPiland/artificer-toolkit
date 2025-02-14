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
      source: 'scroll' | 'drag'
      verticalDelta?: number
      horizontalDelta?: number
      clientHeight: number
      clientWidth: number
      scrollTop?: number
      scrollHeight?: number
      scrollLeft?: number
      scrollWidth?: number
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
  source,
  currentPosition,
  delta,
  scrollPos,
  scrollSize,
  clientSize,
  thumbSize,
}: {
  source: 'scroll' | 'drag'
  currentPosition: number
  delta: number
  scrollPos?: number
  scrollSize?: number
  clientSize: number
  thumbSize: number
}) => {
  if (source === 'drag') {
    const maxThumbTravel = clientSize - thumbSize
    const newPosition = currentPosition + delta
    return Math.max(0, Math.min(newPosition, maxThumbTravel))
  }

  const scrollProgress = scrollPos / (scrollSize - clientSize)
  const maxThumbTravel = clientSize - thumbSize
  return scrollProgress * maxThumbTravel
}

export const scrollReducer = (state: ScrollState, action: ScrollAction): ScrollState => {
  switch (action.type) {
    case 'UPDATE_SCROLL': {
      const newState = { ...state }

      if (action.verticalDelta !== undefined) {
        newState.verticalThumbPosition = calculateThumbPosition({
          source: action.source,
          currentPosition: state.verticalThumbPosition,
          delta: action.verticalDelta,
          scrollPos: action.scrollTop,
          scrollSize: action.scrollHeight,
          clientSize: action.clientHeight,
          thumbSize: state.verticalThumbSize,
        })
      }

      if (action.horizontalDelta !== undefined) {
        newState.horizontalThumbPosition = calculateThumbPosition({
          source: action.source,
          currentPosition: state.horizontalThumbPosition,
          delta: action.horizontalDelta,
          scrollPos: action.scrollLeft,
          scrollSize: action.scrollWidth,
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
