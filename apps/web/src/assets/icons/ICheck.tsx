import { createSvgIcon } from './createSvgIcon'

const ICheck = createSvgIcon({
  name: 'ICheck',
  slot: { x: 12, y: 12, width: 32, height: 22, viewBox: '0 0 34 24' },
  content: (
    <>
      <path id='Vector' d='M33 1L11 23L1 13' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
    </>
  )
})

export default ICheck
