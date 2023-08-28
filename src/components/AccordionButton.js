import { useEffect, useRef } from 'react'

const AccordionButton = ({ children, className, id, target, expanded }) => {
  const buttonRef = useRef(null)

  const accordionToggle = (e) => {
    const accordion = document.getElementById(target)
    const accordionButton = buttonRef.current
    if (e?.target === accordionButton) {
      accordionButton.toggleAttribute('aria-expanded')
      accordionButton.classList.toggle('collapsed')
      accordion.classList.toggle('show')
    }
  }

  useEffect(() => {
    const accordion = document.getElementById(target)
    const accordionButton = buttonRef.current
    if (
      expanded === 'false' &&
      accordionButton.getAttribute('aria-expanded') !== false
    ) {
      console.log('true')
      accordionButton.toggleAttribute('aria-expanded')
      accordionButton.classList.toggle('collapsed')
      accordion.classList.toggle('show')
    }
  }, [expanded, target])

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
