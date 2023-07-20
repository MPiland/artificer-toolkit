const AccordionButton = ({ children, className, id, target }) => {
  function accordionToggle(elementID, buttonId) {
    const accordion = document.getElementById(elementID)
    const accordionButton = document.getElementById(buttonId)
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
      onClick={() => accordionToggle(target, id)}
    >
      {children}
    </button>
  )
  return content
}
export default AccordionButton
