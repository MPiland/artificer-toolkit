const TabWrapper = ({
  id,
  wrapperRef,
  leftScrollerRef,
  rightScrollerRef,
  scrollLeft,
  scrollRight,
  children,
}) => {
  const content = (
    <div className='nav-tabs-wrapper' id={`${id}TabWrapper`} ref={wrapperRef}>
      <div
        className='left-scroller hide'
        id={`${id}-scroll-left`}
        onClick={scrollLeft}
        ref={leftScrollerRef}
      >
        <span>
          <i className='bi bi-chevron-left' />
        </span>
      </div>
      <div
        className='right-scroller hide'
        id={`${id}-scroll-right`}
        onClick={scrollRight}
        ref={rightScrollerRef}
      >
        <span>
          <i className='bi bi-chevron-right' />
        </span>
      </div>
      {children}
    </div>
  )

  return content
}

export default TabWrapper
