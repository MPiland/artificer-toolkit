import {
  heroMockup,
  mockupBuilderImage,
  mockupBuilderWindow,
  mockupSheetImage,
  mockupSheetWindow
} from '../marketing.css'

export function AppMockup() {
  return (
    <div
      className={heroMockup}
      role='img'
      aria-label='Artificer Toolkit domain builder and character sheet shown as overlapping product windows'
    >
      <div className={mockupBuilderWindow} aria-hidden='true'>
        <img
          className={mockupBuilderImage}
          src='/marketing/spell-builder.png'
          width='1280'
          height='720'
          alt=''
          decoding='async'
          draggable={false}
        />
      </div>
      <div className={mockupSheetWindow} aria-hidden='true'>
        <img
          className={mockupSheetImage}
          src='/marketing/character-sheet.png'
          width='1280'
          height='720'
          alt=''
          decoding='async'
          draggable={false}
        />
      </div>
    </div>
  )
}
