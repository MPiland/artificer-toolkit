const PaneContainer = ({ id, children, paneContainerRef }) => {
  const content = (
    <div
      className='tab-content'
      id={`${id}PaneContainer`}
      ref={paneContainerRef}
    >
      {children}
    </div>
  )

  return content
}

export default PaneContainer
