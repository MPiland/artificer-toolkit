import { createFigmaIcon } from './createFigmaIcon'

const IChevron = createFigmaIcon({
  name: 'IChevron',
  slot: { x: 12, y: 18, width: 24, height: 12, viewBox: '0 0 26 14' },
  content: (
        <svg
          x={12}
          y={18}
          width={24}
          height={12}
          viewBox='0 0 26 14'
          fill='none'
          preserveAspectRatio='none'
          dangerouslySetInnerHTML={{ __html: "<path id=\"Vector\" d=\"M25 13L13 1L1 13\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>" }}
        />
  ),
})

export default IChevron
