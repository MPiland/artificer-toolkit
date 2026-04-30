import { ReactNode } from 'react'
import { footer, divider } from './Modal.css'

export interface FooterProps {
  children: ReactNode
}

const Footer = ({ children }: FooterProps) => {
  return (
    <>
      <hr className={divider} />
      <div className={footer}>{children}</div>
    </>
  )
}

export default Footer
