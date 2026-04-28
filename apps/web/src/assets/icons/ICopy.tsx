import { createFigmaIcon } from './createFigmaIcon'

const ICopy = createFigmaIcon({
  name: 'ICopy',
  slot: { x: 4, y: 4, width: 40, height: 40, viewBox: '0 0 42 42' },
  content: (
        <svg
          x={4}
          y={4}
          width={40}
          height={40}
          viewBox='0 0 42 42'
          fill='none'
          preserveAspectRatio='none'
          dangerouslySetInnerHTML={{ __html: "<path id=\"Vector\" d=\"M5 29C2.8 29 1 27.2 1 25V5C1 2.8 2.8 1 5 1H25C27.2 1 29 2.8 29 5M17 13H37C39.2091 13 41 14.7909 41 17V37C41 39.2091 39.2091 41 37 41H17C14.7909 41 13 39.2091 13 37V17C13 14.7909 14.7909 13 17 13Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>" }}
        />
  ),
})

export default ICopy
