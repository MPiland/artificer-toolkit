import type { ContextCardProps } from './ContextCard.types'
import * as styles from './ContextCard.css'
import { clsx } from 'clsx'

export function ContextCard({
  children,
  title,
  titleId,
  header = true,
  props,
  className,
  classNames,
  ...rootProps
}: ContextCardProps) {
  const {
    className: headerClassName,
    children: headerChildren,
    ...restHeaderProps
  } = props?.header ?? {}

  const { className: titleClassName, ...restTitleProps } = props?.title ?? {}

  const { className: bodyClassName, ...restBodyProps } = props?.body ?? {}
  return (
    <section
      {...rootProps}
      className={clsx(styles.root, className, classNames?.root)}
      aria-labelledby={titleId}
    >
      {header && (
        <header
          {...restHeaderProps}
          className={clsx(styles.header, classNames?.header, headerClassName)}
        >
          <h2
            {...restTitleProps}
            className={clsx(styles.title, classNames?.title, titleClassName)}
            id={titleId}
          >
            {title}
          </h2>
          {headerChildren}
        </header>
      )}
      <div {...restBodyProps} className={clsx(styles.body, classNames?.body, bodyClassName)}>
        {children}
      </div>
    </section>
  )
}
