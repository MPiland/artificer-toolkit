import { createFigmaIcon } from './createFigmaIcon'

const IArrowRight = createFigmaIcon({
  name: 'IArrowRight',
  slot: { x: 10, y: 10, width: 28, height: 28, viewBox: '0 0 30 30' },
  content: (
      <g transform='translate(48 0) scale(-1 1)'>
        <svg
          x={10}
          y={10}
          width={28}
          height={28}
          viewBox='0 0 30 30'
          fill='none'
          preserveAspectRatio='none'
          dangerouslySetInnerHTML={{ __html: "<path id=\"Vector\" d=\"M15 29L1 15M1 15L15 1M1 15H29\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>" }}
        />
      </g>
  ),
})

export default IArrowRight
