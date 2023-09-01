import { useEffect, useRef } from 'react'

const AccordionButton = ({ children, className, id, target, expanded }) => {
  const buttonRef = useRef(null)

  useEffect(() => {
    const accordion = document.getElementById(target)
    const accordionButton = buttonRef.current
    if (expanded && expanded === 'false') {
      accordionButton.setAttribute('aria-expanded', 'false')
      accordionButton.classList.add('collapsed')
      accordion.classList.remove('show')
    }
  }, [expanded, target])

  const accordionToggle = (e) => {
    const accordion = document.getElementById(target)
    const accordionButton = buttonRef.current
    if (e?.target === accordionButton) {
      accordionButton.toggleAttribute('aria-expanded')
      accordionButton.classList.toggle('collapsed')
      accordion.classList.toggle('show')
    }
  }

  const content = (
    <button
      ref={buttonRef}
      className={`accordion-button ${className ?? ''}`}
      type='button'
      id={id}
      // data-bs-toggle='collapse'
      data-bs-target={`#${target}`}
      aria-expanded={expanded ?? 'true'}
      aria-controls={target}
      onClick={(e) => accordionToggle(e)}
      key={id}
    >
      {children}
    </button>
  )
  return content
}
export default AccordionButton
