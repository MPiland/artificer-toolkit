import { divider, divider_line } from './Divider.css'
import { FC } from 'react'

interface DividerProps {
  label: string
}

const Divider: FC<DividerProps> = ({ label }) => {
  return (
    <div className={divider}>
      <hr className={divider_line} />
      <span>
        <strong>{label}</strong>
      </span>
      <hr className={divider_line} />
    </div>
  )
}

export default Divider
