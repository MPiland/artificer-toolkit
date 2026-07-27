import { createSvgIcon } from './createSvgIcon'

const IArrowLeft = createSvgIcon({
  name: 'IArrowLeft',
  slot: { x: 10, y: 10, width: 28, height: 28, viewBox: '0 0 30 30' },
  content: (
    <>
      <path
        id='Vector'
        d='M15 29L1 15M1 15L15 1M1 15H29'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </>
  )
})

export default IArrowLeft
