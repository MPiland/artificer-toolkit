import { IconArrowLeft } from '@tabler/icons-react'

type IArrowLeftProps = {
  className?: string
  size?: number
}

const IArrowLeft = ({ className, size = 24 }: IArrowLeftProps) => {
  return <IconArrowLeft className={className} size={size} />
}

export default IArrowLeft
