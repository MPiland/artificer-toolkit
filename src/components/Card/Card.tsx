import { FC, ReactNode } from 'react'
import { card } from './Card.css'

interface CardProps {
  children: ReactNode
}

const Card: FC<CardProps> = ({ children }) => {
  return <div className={card}>{children}</div>
}

export default Card
