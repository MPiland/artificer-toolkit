import { createFigmaIcon } from './createFigmaIcon'

const IX = createFigmaIcon({
  name: 'IX',
  slot: { x: 12, y: 12, width: 24, height: 24, viewBox: '0 0 26 26' },
  content: (
    <svg
      x={12}
      y={12}
      width={24}
      height={24}
      viewBox='0 0 26 26'
      fill='none'
      preserveAspectRatio='none'
      dangerouslySetInnerHTML={{ __html: '<path id="Vector" d="M25 1L1 25M1 1L25 25" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' }}
    />
  )
})

export default IX
