import { TbSquareMinus, TbSquarePlus, TbX } from 'react-icons/tb'
import { useLayoutEffect, useState, ReactNode, memo } from 'react'
import {
  collapse_header,
  collapse_body,
  collapse_wrapper,
  collapse_header_icon,
  collapse_content,
  collapse_remove_button,
} from './Collapse.css'
import Button from '../Button/Button'
import clsx from 'clsx'
import Group from '../Group/Group'
import { sprinkles } from '../../css/sprinkles.css'

interface CollapseProps {
  startOpened?: boolean
  title?: string
  children?: ReactNode
  buttonDisabled?: boolean
  headerButton?: {
    label: string
    function: () => void
  }[]

  className?: string | number | symbol | any
  handleRemove?: () => void
}

const Collapse = memo(
  ({
    startOpened,
    title,
    children,
    buttonDisabled,
    className,
    handleRemove,
    headerButton,
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
          <div
            className={clsx(collapse_header, { ['collapsed']: isCollapsed })}
            onClick={handleButtonClick}
          >
            <Group
              justifyContentVariant='spaceBetween'
              className={sprinkles({ width: 'full' })}
            >
              <Group>
                {handleRemove && (
                  <Button
                    variant='unstyled'
                    type='button'
                    className={collapse_remove_button}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove()
                    }}
                  >
                    <TbX />
                  </Button>
                )}
                <h3>{title}</h3>
              </Group>
            </Group>
            {headerButton &&
              headerButton.length > 0 &&
              headerButton?.map((buttonItem: any, buttonIndex: number) => (
                <Button
                  variant='primary_outline'
                  type='button'
                  onClick={(e) => {
                    e.stopPropagation()
                    buttonItem.function()
                  }}
                  className={clsx({
                    [sprinkles({ me: 'size-2' })]:
                      buttonIndex !== headerButton.length - 1,
                  })}
                  key={buttonIndex}
                >
                  {buttonItem.label}
                </Button>
              ))}
            <span className={collapse_header_icon}>
              {isCollapsed ? <TbSquarePlus /> : <TbSquareMinus />}
            </span>
          </div>
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
