import { IconArrowRight } from '@tabler/icons-react'

type IArrowRightProps = {
  className?: string
  size?: number
}

const IArrowRight = ({ className, size = 24 }: IArrowRightProps) => {
  return <IconArrowRight className={className} size={size} />
}

export default IArrowRight
