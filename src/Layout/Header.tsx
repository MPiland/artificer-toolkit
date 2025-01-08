import { use } from 'react'
import ILogo from '../assets/Icons/ILogo'
import { LayoutContext } from './LayoutContext'
import { useMediaQuery } from 'usehooks-ts'
import { Hamburger } from './Hamburger'
import { header, header_item_group, header_title } from './Header.css'

const Header = ({ signedIn }: { signedIn: boolean }) => {
  const { collapsed, setCollapsed } = use(LayoutContext)
  const lg = useMediaQuery('screen and (min-width: 1025px)')
  return (
    <header className={header}>
      {!signedIn ? (
        !lg ? (
          <div className={header_item_group}>
            <Hamburger
              onClick={(e) => {
                e.stopPropagation()
                setCollapsed((prev) => !prev)
              }}
              collapsed={collapsed}
            />
            <div className={header_title}>
              <ILogo />
              Artificer Toolkit
            </div>
          </div>
        ) : (
          <div className={header_item_group}>
            <Hamburger
              onClick={(e) => {
                e.stopPropagation()
                setCollapsed((prev) => !prev)
              }}
              collapsed={collapsed}
            />
            <div className={header_title}>
              <ILogo />
              Artificer Toolkit
            </div>
          </div>
        )
      ) : !lg ? (
        <div className={header_item_group}>
          <Hamburger
            onClick={(e) => {
              e.stopPropagation()
              setCollapsed((prev) => !prev)
            }}
            collapsed={collapsed}
          />
          <div className={header_title}>
            Artificer Toolkit
            <ILogo />
          </div>
        </div>
      ) : (
        <div className={header_item_group}>
          <div className={header_title}>
            Artificer Toolkit
            <ILogo />
          </div>
        </div>
      )}
    </header>
  )
}

export default Header
