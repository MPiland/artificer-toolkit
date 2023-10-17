import { useEffect, useState, Fragment } from 'react'
import useSortableData from '../hooks/useSortableData'
import { getValueFromState } from '../helpers/formatting'
import { get } from 'lodash'
import Input from './Input'
import Select from './Select'

const TableHeader = ({ headers, sortable, requestSort, getClassNames }) => {
  return (
    <div className={`row pb-2 ms-0 me-0 g-2 align-items-end`}>
      {headers?.map((headerItem, headerIndex) => (
        <Fragment key={headerIndex}>
          {!headerItem.breakpoint &&
            (headerItem.readOnly ? (
              <div
                className={`${headerItem.size ?? ''} ${
                  headerItem.className ?? ''
                } ${getClassNames(headerItem.name.sortOn)} ${
                  sortable ? 'sortable-header' : ''
                }`}
                onClick={() => sortable && requestSort(headerItem.name)}
              >
                {headerItem.value}
              </div>
            ) : (
              <Input
                size={headerItem.size ?? null}
                className={headerItem.className}
                name={headerItem.name}
                value={headerItem.value}
                border={headerItem.border}
              />
            ))}
          {!!headerItem.dynamic && headerIndex === headers.length - 1 && (
            <>
              <div className='col-1'></div>
              <div className='col-1'></div>
            </>
          )}
        </Fragment>
      ))}
      {headers && <div className='col-1'></div>}
    </div>
  )
}

const TableRow = ({
  valueItem,
  inputs,
  readOnly,
  deleteRow,
  onClick,
  onChange,
  name,
  dynamic,
  className,
  deleteRowVisible,
  scrollable,
}) => {
  return (
    <div
      className={`row pb-2 ms-0 me-0 g-2 ${
        className ? ` ${className}` : ''
      } row-clickable ${scrollable ? ' scrollable' : ''}`}
      onClick={() => {
        onClick && onClick(valueItem)
      }}
    >
      {inputs?.map((inputItem, inputIndex) => {
        const itemValue =
          getValueFromState(inputItem, valueItem) !== null
            ? getValueFromState(inputItem, valueItem)
            : ''
        return (
          !inputItem.breakpoint &&
          (readOnly || inputItem.readOnly ? (
            <Fragment key={inputIndex}>
              <div className={`${inputItem.size ?? ''}`} key={inputIndex}>
                {itemValue}
              </div>
              {deleteRowVisible && inputIndex === inputs.length - 1 && (
                <div className='col-1'>
                  <button
                    className='bi bi-trash3'
                    type='button'
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteRow(valueItem)
                    }}
                  />
                </div>
              )}
            </Fragment>
          ) : inputItem.type === 'select' ? (
            <Select
              name={`${name}.${inputIndex}.${inputItem.name}`}
              placeholder={inputItem.value}
              value={valueItem[inputItem.name]}
              required={true}
              options={inputItem.options}
              onChange={onChange}
            />
          ) : (
            <Fragment key={inputIndex}>
              <Input
                size={inputItem.size ?? null}
                name={`${name}.${inputIndex}.${inputItem.name}`}
                label={inputItem.label ?? false}
                border={inputItem.border}
                placeholder={inputItem.value}
                invalidText={inputItem.invalid}
                value={valueItem[inputItem.name]}
                required={inputItem.required ?? false}
                onChange={onChange}
                validation={inputItem.validation}
              />
              {dynamic && inputIndex === inputs.length - 1 && (
                <>
                  <div className='col-1'>
                    <button
                      className='bi bi-plus-circle mx-2'
                      type='button'
                      name={`${name}`}
                      onClick={(e) => {
                        onChange({ type: 'added', payload: e })
                      }}
                    />
                  </div>
                  <div className='col-1'>
                    <button
                      className='bi bi-trash3 mx-2'
                      type='button'
                      name={`${name}.${inputIndex}`}
                      onClick={(e) => onChange({ type: 'removed', payload: e })}
                    />
                  </div>
                </>
              )}
            </Fragment>
          ))
        )
      })}
    </div>
  )
}

function Table({
  inputs,
  name,
  value,
  indentedValue,
  onChange,
  className,
  headers,
  readOnly,
  dynamic,
  onClick,
  sortable,
  defaultSort,
  scrollable,
  deleteRow,
}) {
  const [sortState, setSortState] = useState()
  const [defaultSortRan, setDefaultSortRan] = useState(false)
  const { items, requestSort, sortConfig } = useSortableData(value)

  useEffect(() => {
    if (defaultSort && defaultSortRan === false) {
      setDefaultSortRan(true)
      requestSort(defaultSort.name)
    }
  }, [defaultSort, defaultSortRan, requestSort])

  useEffect(() => {
    setSortState({ valueItems: items, sortConfig })
  }, [setSortState, items, sortConfig])

  const getClassNames = (value) => {
    if (!sortState?.sortConfig) {
      return ''
    }
    return sortState.sortConfig.key.sortOn === value
      ? sortState.sortConfig.direction
      : ''
  }
  const { valueItems } = sortState || { valueItems: [] }

  const [filteredItems, remainingItems] = valueItems.reduce(
    (result, valueItem) => {
      const hasFilter = inputs.some((inputItem) => inputItem.filter != null)

      if (!hasFilter) {
        // If there's no filter criteria, include the item in the remainingItems
        result[1].push(valueItem)
      } else if (
        inputs.some((inputItem) => {
          const itemValue = getValueFromState(inputItem, valueItem)
          if (itemValue === null) {
            return true
          }
          if (Array.isArray(inputItem.filter)) {
            return inputItem.filter.includes(itemValue)
          }
          return true
        })
      ) {
        result[0].push(valueItem)
      } else {
        result[1].push(valueItem)
      }

      return result
    },
    [[], []]
  )

  return (
    <div className={`${scrollable ? 'table-scrollable' : ''}`}>
      {headers && (
        <TableHeader
          headers={headers}
          sortable={sortable}
          requestSort={requestSort}
          getClassNames={getClassNames}
        />
      )}
      {filteredItems?.map((valueItem, valueIndex) => (
        <Fragment key={valueIndex}>
          <TableRow
            valueItem={valueItem}
            inputs={inputs}
            readOnly={readOnly}
            deleteRow={deleteRow}
            onClick={onClick}
            onChange={onChange}
            name={name}
            dynamic={dynamic}
            className={className}
            deleteRowVisible={deleteRow}
            scrollable={scrollable}
          />
          {/* Check if valueItem has parentClass.id and indentedMatch */}
          {valueItem.parentClass?.id &&
            inputs.some(
              (inputItem) =>
                inputItem.indentedMatch === '_id' &&
                inputItem.indentedName === 'parentClass.id'
            ) &&
            remainingItems
              .filter(
                (remainingItem) =>
                  get(remainingItem, 'indentedName') ===
                    valueItem.parentClass.id &&
                  inputs.some((inputItem) => inputItem.indentedMatch === '_id')
              )
              .map((remainingItem, remainingIndex) => (
                <TableRow
                  valueItem={remainingItem}
                  inputs={inputs}
                  readOnly={readOnly}
                  deleteRow={deleteRow}
                  onClick={onClick}
                  onChange={onChange}
                  name={name}
                  dynamic={dynamic}
                  className={className}
                  deleteRowVisible={deleteRow}
                  scrollable={scrollable}
                  key={remainingIndex}
                />
              ))}
        </Fragment>
      ))}
    </div>
  )
}

export default Table
