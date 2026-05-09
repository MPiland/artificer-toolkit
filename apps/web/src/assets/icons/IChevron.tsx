import { createSvgIcon } from './createSvgIcon'

const IChevron = createSvgIcon({
  name: 'IChevron',
  slot: { x: 12, y: 18, width: 24, height: 12, viewBox: '0 0 26 14' },
  content: (
    <>
      <path id='Vector' d='M25 13L13 1L1 13' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
    </>
  )
})

export default IChevron
