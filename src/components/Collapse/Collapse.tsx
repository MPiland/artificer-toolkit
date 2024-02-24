import { TbCaretUpFilled } from 'react-icons/tb'
import { useLayoutEffect, useState, ReactNode, memo } from 'react'
import {
  collapse_button,
  collapse_body,
  collapse_wrapper,
  collapse_button_caret,
  collapse_content,
} from './Collapse.css'
import Button from '../Button/Button'
import clsx from 'clsx'

interface CollapseProps {
  startOpened?: boolean
  title?: string
  children?: ReactNode
  buttonDisabled?: boolean
  className?: string | number | symbol | any
}

const Collapse = memo(
  ({
    startOpened,
    title,
    children,
    buttonDisabled,
    className,
  }: CollapseProps) => {
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false)

    useLayoutEffect(() => {
      if (startOpened) {
        setIsCollapsed(false)
      } else {
        setIsCollapsed(true)
      }
    }, [startOpened])

    const handleButtonClick = () => {
      if (isCollapsed) {
        setIsCollapsed(false)
      } else {
        setIsCollapsed(true)
      }
    }

    return (
      <div className={clsx(collapse_wrapper, { [className]: className })}>
        {!buttonDisabled && (
          <Button
            variant='unstyled'
            className={clsx(collapse_button, { ['collapsed']: isCollapsed })}
            onClick={handleButtonClick}
          >
            <span>{title}</span>
            <TbCaretUpFilled
              className={clsx(collapse_button_caret, {
                ['collapsed']: isCollapsed,
              })}
            />
          </Button>
        )}
        <div
          className={clsx(collapse_body, {
            ['collapsed']: isCollapsed,
          })}
        >
          <div
            className={clsx(collapse_content, { ['collapsed']: isCollapsed })}
          >
            {children}
          </div>
        </div>
      </div>
    )
  }
)

Collapse.displayName = 'Collapse'

export default Collapse
