import { createFigmaIcon } from './createFigmaIcon'

const IProps = createFigmaIcon({
  name: 'IProps',
  slot: { x: 8, y: 4, width: 32, height: 40, viewBox: '0 0 34 42' },
  content: (
    <svg
      x={8}
      y={4}
      width={32}
      height={40}
      viewBox='0 0 34 42'
      fill='none'
      preserveAspectRatio='none'
      dangerouslySetInnerHTML={{ __html: '<path id="Vector" d="M1 25H13M1 1H21M3 33H31C32.1046 33 33 33.8954 33 35V39C33 40.1046 32.1046 41 31 41H3C1.89543 41 1 40.1046 1 39V35C1 33.8954 1.89543 33 3 33ZM3 9H31C32.1046 9 33 9.89543 33 11V15C33 16.1046 32.1046 17 31 17H3C1.89543 17 1 16.1046 1 15V11C1 9.89543 1.89543 9 3 9Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' }}
    />
  )
})

export default IProps
