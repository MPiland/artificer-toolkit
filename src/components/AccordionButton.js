const AccordionButton = ({ children, className, id, target }) => {
  function accordionToggle() {
    const accordion = document.getElementById(target)
    const accordionButton = document.getElementById(id)
    if (accordionButton.getAttribute('aria-expanded') === 'true') {
      accordionButton.setAttribute('aria-expanded', 'false')
    } else {
      accordionButton.setAttribute('aria-expanded', 'true')
    }
    if (accordionButton.classList.contains('collapsed')) {
      accordionButton.classList.remove('collapsed')
    } else {
      accordionButton.classList.add('collapsed')
    }
    accordion.classList.toggle('show')
  }

  const content = (
    <button
      className={`accordion-button ${className ?? ''}`}
      type='button'
      id={id}
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
