import { createSvgIcon } from './createSvgIcon'

const IArrowRight = createSvgIcon({
  name: 'IArrowRight',
  slot: { x: 10, y: 10, width: 28, height: 28, viewBox: '0 0 30 30' },
  content: (
    <path
      id='Vector'
      d='M15 29L29 15M29 15L15 1M29 15H1'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  )
})

export default IArrowRight
