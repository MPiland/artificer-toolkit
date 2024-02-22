import { FC, ReactNode } from 'react'
import { card, card_close_button } from './Card.css'
import Button from '../Button/Button'
import { TbX } from 'react-icons/tb'

interface CardProps {
  children: ReactNode
  handleRemove: () => void
}

const Card: FC<CardProps> = ({ children, handleRemove }) => {
  return (
    <div className={card}>
      <Button
        variant='unstyled'
        type='button'
        className={card_close_button}
        onClick={(e) => {
          e.stopPropagation()
          handleRemove()
        }}
      >
        <TbX />
      </Button>
      {children}
    </div>
  )
}

export default Card
