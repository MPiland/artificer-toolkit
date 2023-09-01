import '../css/table.css'
import { useEffect, useState, Fragment } from 'react'
import useSortableData from '../hooks/useSortableData'
import { get } from 'lodash'
import Input from './Input'

const Table = ({
  inputs,
  indentedInputs,
  indentedName,
  name,
  value,
  onChange,
  className,
  dynamic,
  headers,
  readOnly,
  clickable,
  onClick,
  empty,
  sortable,
  scrollable,
  deleteRow,
}) => {
  const [sortState, setSortState] = useState()
  const { items, requestSort, sortConfig } = useSortableData(value)

  useEffect(() => {
    setSortState({ valueItems: items, sortConfig: sortConfig })
  }, [setSortState, items, sortConfig])

  const getClassNames = (value) => {
    if (!sortState?.sortConfig) {
      return
    }
    if (Array.isArray(sortState.sortConfig.key)) {
      return sortState.sortConfig.key[0] === value
        ? sortState.sortConfig.direction
        : ''
    } else {
      return sortState.sortConfig.key === value
        ? sortState.sortConfig.direction
        : ''
    }
  }

  const getValueFromState = (inputItem, valueItem) => {
    const processItem = (item, state) => {
      if (Array.isArray(item)) {
        return item
          .map((nestedItem) => processItem(nestedItem, state))
          .join(' ')
      } else {
        const value = get(state, item)
        if (Array.isArray(value)) {
          if (value.length > 0) {
            if (value.length > 1) {
              const sortedValues = [...value]
              sortedValues.sort((a, b) =>
                a.value.toString().localeCompare(b.value.toString())
              )
              return sortedValues
                .map((nestedValue) => nestedValue.value)
                .join(' / ')
            } else {
              return value[0].value
            }
          } else {
            return empty ? empty : null
          }
        } else {
          return value
        }
      }
    }

    if (inputItem && inputItem.name) {
      const nameItems = Array.isArray(inputItem.name[0])
        ? inputItem.name
        : [inputItem.name]
      return nameItems
        .map((nameItem) => {
          const value = processItem(nameItem, valueItem)
          return value !== undefined ? value : empty ? empty : null
        })
        .join(' / ')
    }

    return empty ? empty : null
  }

  const content = (
    <div className={`${scrollable ? 'table-scrollable' : ''}`}>
      {headers && (
        <div className={`row align-items-center pb-2 g-2`}>
          {headers?.map((headerItem, headerIndex) => {
            return (
              !headerItem.breakpoint &&
              (readOnly ? (
                <div
                  className={`${headerItem.size ?? ''} ${
                    headerItem.className ?? ''
                  }  ${getClassNames(headerItem.value)} ${
                    sortable ? 'sortable-header' : ''
                  }`}
                  key={headerIndex}
                  onClick={() =>
                    sortable && requestSort(headerItem.value, headerItem.order)
                  }
                >
                  {headerItem.name}
                </div>
              ) : (
                <Input
                  size={headerItem.size ?? null}
                  className={headerItem.className}
                  key={headerIndex}
                  name={headerItem.name}
                  value={headerItem.value}
                  readOnly={readOnly === true ? true : false}
                  border={headerItem.border}
                />
              ))
            )
          })}
        </div>
      )}
      {sortState?.valueItems?.map((valueItem, valueIndex) => (
        <div
          key={valueIndex}
          className={`row pb-2 g-2 ${className ?? ''} ${
            clickable ? 'row-clickable' : ''
          } ${scrollable ? 'scrollable' : ''}`}
          onClick={() => {
            onClick && onClick(valueItem)
          }}
        >
          {inputs?.map(
            (inputItem, inputIndex) =>
              !inputItem.breakpoint &&
              (readOnly ? (
                <Fragment key={inputIndex}>
                  <div className={`${inputItem.size ?? ''}`} key={inputIndex}>
                    {getValueFromState(inputItem, valueItem) !== null
                      ? getValueFromState(inputItem, valueItem)
                      : ''}
                  </div>
                  {deleteRow && (
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
              ) : (
                <Fragment key={inputIndex}>
                  <Input
                    size={inputItem.size ?? null}
                    name={`${name}.${valueIndex}.${inputItem.name}`}
                    label={inputItem.label ?? false}
                    border={inputItem.border}
                    placeholder={inputItem.value}
                    invalidText={inputItem.invalid}
                    value={
                      getValueFromState(inputItem, valueItem) !== null
                        ? getValueFromState(inputItem, valueItem)
                        : ''
                    }
                    onChange={onChange}
                    readOnly={readOnly === true ? true : false}
                    validation={inputItem.validation}
                  />
                  {!!dynamic && inputIndex === inputs.length - 1 && (
                    <div className='col-auto d-flex'>
                      <div className='row g-0 row-cols-auto'>
                        <div className='col-auto'>
                          <button
                            className='bi bi-plus-circle mx-2'
                            type='button'
                            name={`${name}`}
                            onClick={(e) => {
                              onChange({ type: 'added', payload: e })
                            }}
                          />
                        </div>
                        {valueIndex !== 0 && (
                          <div className='col-auto'>
                            <button
                              className='bi bi-trash3 mx-2'
                              type='button'
                              name={`${name}.${valueIndex}`}
                              onClick={(e) =>
                                onChange({ type: 'removed', payload: e })
                              }
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Fragment>
              ))
          )}
          {indentedInputs?.length !== 0 &&
            valueItem[indentedName]?.map((subValueItem, subValueIndex) => {
              return (
                <div className='row gx-2 gy-1' key={subValueIndex}>
                  <div className='col-2'></div>
                  {indentedInputs.map((indentedItem, indentedIndex) => (
                    <Fragment key={indentedIndex}>
                      <Input
                        size={indentedItem.size ?? null}
                        name={`${name}.${valueIndex}.${indentedName}.${subValueIndex}.${indentedIndex.name}`}
                        label={indentedItem.label ?? false}
                        border={indentedItem.border}
                        key={indentedIndex}
                        placeholder={indentedItem.value}
                        invalidText={indentedItem.invalid}
                        value={
                          getValueFromState(indentedItem, subValueItem) !== null
                            ? getValueFromState(indentedItem, subValueItem)
                            : ''
                        }
                        onChange={onChange}
                        readOnly={readOnly === true ? true : false}
                        validation={indentedItem.validation}
                      />
                      {!!dynamic &&
                        indentedIndex === indentedInputs.length - 1 && (
                          <div className='col-auto d-flex'>
                            <div className='row g-2 row-cols-auto'>
                              <div className='col-auto'>
                                <button
                                  className='bi bi-plus-circle'
                                  type='button'
                                  name={`${name}.${valueIndex}.${indentedName}`}
                                  onClick={(e) =>
                                    onChange({ type: 'added', payload: e })
                                  }
                                />
                              </div>
                              {subValueIndex !== 0 && (
                                <div className='col-auto'>
                                  <button
                                    className='bi bi-trash3'
                                    type='button'
                                    name={`${name}.${valueIndex}.${indentedName}.${subValueIndex}`}
                                    onClick={(e) =>
                                      onChange({ type: 'removed', payload: e })
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                    </Fragment>
                  ))}
                </div>
              )
            })}
        </div>
      ))}
    </div>
  )

  return content
}
export default Table
