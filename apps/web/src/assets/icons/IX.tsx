import { createSvgIcon } from './createSvgIcon'

const IX = createSvgIcon({
  name: 'IX',
  slot: { x: 12, y: 12, width: 24, height: 24, viewBox: '0 0 26 26' },
  content: (
    <>
      <path
        id='Vector'
        d='M25 1L1 25M1 1L25 25'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </>
  )
})

export default IX
