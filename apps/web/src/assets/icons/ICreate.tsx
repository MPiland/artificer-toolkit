import { createFigmaIcon } from './createFigmaIcon'

const ICreate = createFigmaIcon({
  name: 'ICreate',
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
          dangerouslySetInnerHTML={{ __html: "<path id=\"Vector\" d=\"M11 19H27M19 11V27M5 1H33C35.2091 1 37 2.79086 37 5V33C37 35.2091 35.2091 37 33 37H5C2.79086 37 1 35.2091 1 33V5C1 2.79086 2.79086 1 5 1Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>" }}
        />
  ),
})

export default ICreate
