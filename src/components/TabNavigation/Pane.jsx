const Pane = ({ id, tabIndex, tabItem }) => {
  const content = (
    <div
      className={`tab-pane ${id}-tab-pane category-tab-pane fade`}
      id={`${id}${tabIndex}Pane`}
      aria-labelledby={`${id}${tabIndex}Tab`}
      role='tabpanel'
      tabIndex='0'
    >
      {tabItem?.content}
    </div>
  )

  return content
}

export default Pane
