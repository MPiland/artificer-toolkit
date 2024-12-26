import clsx from 'clsx'
import {
  scroll_bar_horizontal,
  scroll_bar_vertical,
  scroll_thumb_horizontal,
  scroll_thumb_vertical,
} from './Scrollbar.css'
import { forwardRef, ForwardedRef } from 'react'
const Scrollbar = forwardRef(
  (
    {
      active,
      scrollDirection,
      onMouseDown,
      size,
      position,
    }: {
      active: boolean
      scrollDirection: 'horizontal' | 'vertical'
      onMouseDown: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
      size: number
      position: number
    },
    ref: ForwardedRef<HTMLDivElement>
  ) => {
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
)

Scrollbar.displayName = 'Scrollbar'
export default Scrollbar
