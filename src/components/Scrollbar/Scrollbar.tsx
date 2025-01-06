import clsx from 'clsx'
import {
  scroll_bar_horizontal,
  scroll_bar_vertical,
  scroll_thumb_horizontal,
  scroll_thumb_vertical,
} from './Scrollbar.css'
import { RefObject, MouseEvent as ReactMouseEvent } from 'react'
const Scrollbar = ({
  active,
  scrollDirection,
  onMouseDown,
  size,
  position,
  ref,
}: {
  active: boolean
  scrollDirection: 'horizontal' | 'vertical'
  onMouseDown: (e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => void
  size: number
  position: number
  thumbRef?: RefObject<HTMLDivElement>
  ref?: RefObject<HTMLDivElement>
}) => {
  return (
    <div
      className={clsx(
        { [scroll_bar_horizontal]: scrollDirection === 'horizontal' },
        { [scroll_bar_vertical]: scrollDirection === 'vertical' },
        {
          ['active']: active,
        }
      )}
    >
      <div
        ref={ref}
        className={clsx(
          { [scroll_thumb_horizontal]: scrollDirection === 'horizontal' },
          { [scroll_thumb_vertical]: scrollDirection === 'vertical' }
        )}
        style={{
          ...(scrollDirection === 'horizontal'
            ? {
                width: `${size}px`,
                left: `${position}px`,
              }
            : undefined),
          ...(scrollDirection === 'vertical'
            ? {
                height: `${size}px`,
                top: `${position}px`,
              }
            : undefined),
        }}
        onMouseDown={onMouseDown}
      />
    </div>
  )
}

export default Scrollbar
