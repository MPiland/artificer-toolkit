import { createSvgIcon } from './createSvgIcon'

const IAlertCircle = createSvgIcon({
  name: 'IAlertCircle',
  slot: { x: 4, y: 4, width: 40, height: 40, viewBox: '0 0 42 42' },
  content: (
    <>
      <path id='Vector' d='M21 13V21M21 29H21.02M41 21C41 32.0457 32.0457 41 21 41C9.9543 41 1 32.0457 1 21C1 9.9543 9.9543 1 21 1C32.0457 1 41 9.9543 41 21Z' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
    </>
  )
})

export default IAlertCircle
