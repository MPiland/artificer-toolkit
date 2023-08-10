const AccordionButton = ({ children, className, id, target }) => {
  const accordionToggle = () => {
    const accordion = document.getElementById(target)
    const accordionButton = document.getElementById(id)
    accordionButton.toggleAttribute('aria-expanded')
    accordionButton.classList.toggle('collapsed')
    accordion.classList.toggle('show')
  }

  const content = (
    <button
      className={`accordion-button ${className ?? ''}`}
      type='button'
      id={id}
      // data-bs-toggle='collapse'
      data-bs-target={`#${target}`}
      aria-expanded='true'
      aria-controls={target}
      onClick={accordionToggle}
      key={id}
    >
      {children}
    </button>
  )
  return content
}
export default AccordionButton
