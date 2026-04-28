import { createFigmaIcon } from './createFigmaIcon'

const ICheck = createFigmaIcon({
  name: 'ICheck',
  slot: { x: 12, y: 12, width: 32, height: 22, viewBox: '0 0 34 24' },
  content: (
        <svg
          x={12}
          y={12}
          width={32}
          height={22}
          viewBox='0 0 34 24'
          fill='none'
          preserveAspectRatio='none'
          dangerouslySetInnerHTML={{ __html: "<path id=\"Vector\" d=\"M33 1L11 23L1 13\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>" }}
        />
  ),
})

export default ICheck
