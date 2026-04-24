import { IconAlertCircle } from '@tabler/icons-react'

type IAlertCircleProps = {
  className?: string
  size?: number
}

const IAlertCircle = ({ className, size = 24 }: IAlertCircleProps) => {
  return <IconAlertCircle className={className} size={size} />
}

export default IAlertCircle
