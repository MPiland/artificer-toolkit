const AccordionButton = ({ children, className, id, target }) => {
  const content = (
    <button
      className={`accordion-button ${className ?? ''}`}
      type='button'
      data-bs-toggle='collapse'
      data-bs-target={`#${target}`}
      id={id}
      aria-expanded='true'
      aria-controls={target}
    >
      {children}
    </button>
  )
  return content
}
export default AccordionButton
