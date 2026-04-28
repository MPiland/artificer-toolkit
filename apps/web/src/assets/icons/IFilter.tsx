import { createFigmaIcon } from './createFigmaIcon'

const IFilter = createFigmaIcon({
  name: 'IFilter',
  slot: { x: 6, y: 6, width: 36, height: 36, viewBox: '0 0 38 38' },
  content: (
        <svg
          x={6}
          y={6}
          width={36}
          height={36}
          viewBox='0 0 38 38'
          fill='none'
          preserveAspectRatio='none'
          dangerouslySetInnerHTML={{ __html: "<path id=\"Vector\" d=\"M37 37L28.32 28.32M33 17C33 25.8366 25.8366 33 17 33C8.16344 33 1 25.8366 1 17C1 8.16344 8.16344 1 17 1C25.8366 1 33 8.16344 33 17Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>" }}
        />
  ),
})

export default IFilter
