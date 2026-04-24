import { IconMapOff } from '@tabler/icons-react'

type IMapOffProps = {
  className?: string
  size?: number
}

const IMapOff = ({ className, size = 24 }: IMapOffProps) => {
  return <IconMapOff className={className} size={size} />
}

export default IMapOff
