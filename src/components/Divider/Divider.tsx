import { divider, divider_label, divider_line } from './Divider.css'

interface DividerProps {
  label?: string
  labelLocation?: 'left' | 'center' | 'right'
}

const Divider = ({ label, labelLocation = 'center' }: DividerProps) => {
  return (
    <div className={divider}>
      <hr className={divider_line} />
      {label && (
        <>
          <span className={divider_label} data-location={labelLocation}>
            {label}
          </span>
          <hr className={divider_line} />
        </>
      )}
    </div>
  )
}

export default Divider
