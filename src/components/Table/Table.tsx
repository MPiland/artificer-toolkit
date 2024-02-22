import { useEffect, useState, Fragment, memo, FC } from 'react'
import useSortableData from '../../hooks/useSortableData'
import { getValueFromState } from '../../utils/formatting'
import { PropertyPath, get } from 'lodash'
import Input from '../Input/Input'
import Dropdown from '../Dropdown/Dropdown'
import Spinner from '../Spinner/Spinner'
import Grid from '../Grid/Grid'
import Button from '../Button/Button'
import {
  SortConfig,
  RowInput,
  RowHeader,
  DropdownOption,
  ReducerActionType,
} from '../../utils/types'
import {
  table,
  table_row,
  table_collapse_button,
  table_header,
  table_header_row,
  table_subrow,
  table_dynamic_button,
  table_cell,
  table_button_cell,
  table_body,
} from './Table.css'
import { TbCaretUpFilled, TbTrash, TbCirclePlus } from 'react-icons/tb'
import clsx from 'clsx'
import ScrollArea from '../ScrollArea/ScrollArea'

type RowData = {
  inputs: RowInput[]
  headers: RowHeader[]
  filters?: {
    filterOn: string
    filterValue: string
  }
  subrow?: {
    data: any[]
    matchKey: string
  }
}

interface SortState {
  valueItems: any[]
  sortConfig: SortConfig
}

interface TableHeaderProps {
  headers: RowHeader[]
  collapse?: boolean
  sortable?: boolean
  requestSort: (key: SortConfig['key']) => void
  getClassNames: (arg: string) => void
  deleteRow?: (arg: any) => void
  addRow?: boolean
  border?: boolean
}

interface TableRowProps {
  valueItem: any
  valueIndex: number
  rows: RowData
  readOnly?: boolean
  deleteRow?: (arg: any) => void
  addRow?: boolean
  onClick?: (arg: any) => void
  name: string | undefined
  onChange?: (arg: ReducerActionType) => void
  collapse?: boolean
  border?: boolean
}

interface TableProps {
  rows: RowData
  name?: string | undefined
  addRow?: boolean
  value: any[]
  readOnly?: boolean
  onClick?: (arg: any) => void
  sortable?: boolean
  defaultSort?: any
  clickable?: boolean
  deleteRow?: (arg: any) => void
  onChange?: (arg: ReducerActionType) => void
  collapse?: boolean
  empty?: string
  id?: string | undefined
  scrollable?: boolean
  border?: boolean
}

const TableHeader: FC<TableHeaderProps> = ({
  headers,
  collapse,
  sortable,
  requestSort,
  getClassNames,
  addRow,
  deleteRow,
  border,
}) => {
  return (
    <Grid
      cols={{
        start: collapse ? 1 : 0,
        end: addRow ? 2 : deleteRow ? 1 : 0,
      }}
      className={clsx(table_header_row, { ['borderless']: border === false })}
    >
      {collapse && <div className={table_header} />}
      {headers?.map((headerItem: RowHeader, headerIndex: number) => {
        return (
          !headerItem.breakpoint && (
            <Fragment key={headerIndex}>
              {
                <div
                  className={clsx(
                    {
                      [`${
                        headerItem.name &&
                        getClassNames(
                          typeof headerItem.name === 'object'
                            ? headerItem.name?.sortOn
                            : headerItem.name
                        )
                      }`]: headerItem.name,
                    },
                    { ['required']: headerItem.required },
                    table_header
                  )}
                  onClick={() =>
                    sortable &&
                    requestSort(headerItem.name as SortConfig['key'])
                  }
                >
                  {headerItem.value}
                </div>
              }
            </Fragment>
          )
        )
      })}
      {addRow && <div className={table_header} />}
      {deleteRow && <div className={table_header} />}
    </Grid>
  )
}

const TableRow: FC<TableRowProps> = ({
  valueItem,
  valueIndex,
  rows,
  readOnly,
  deleteRow,
  onClick,
  onChange,
  name,
  addRow,
  collapse,
  border,
}) => {
  const [collapsed, setCollapsed] = useState(true)
  const subrows = rows.subrow?.data?.filter((subrowItem: any) => {
    if (rows.subrow) {
      return get(subrowItem, rows?.subrow.matchKey) === valueItem._id
    }
  })

  return (
    <>
      <Grid
        cols={{
          start: collapse ? 1 : 0,
          end: addRow ? 2 : deleteRow ? 1 : 0,
        }}
        className={clsx(
          table_row,
          { ['clickable']: onClick },
          { ['collapsed']: collapsed },
          { ['borderless']: border === false }
        )}
        onClick={() => {
          onClick && onClick(valueItem)
        }}
      >
        {collapse && (
          <div
            className={table_button_cell}
            onClick={(e) => {
              e.stopPropagation()
              setCollapsed((prev) => !prev)
            }}
          >
            {collapse && subrows && subrows?.length > 0 && (
              <Button
                variant='unstyled'
                className={clsx(table_collapse_button, {
                  ['collapsed']: collapsed,
                })}
              >
                <TbCaretUpFilled />
              </Button>
            )}
          </div>
        )}
        {rows.inputs?.map((inputItem: RowInput, inputIndex: number) => {
          const itemValue =
            getValueFromState(inputItem, valueItem) !== null
              ? getValueFromState(inputItem, valueItem)
              : ''
          return (
            !inputItem.breakpoint && (
              <Fragment key={inputIndex}>
                {readOnly || inputItem.readOnly ? (
                  <div className={table_cell}>{itemValue}</div>
                ) : (
                  <div className={table_cell}>
                    {inputItem.type === 'select' ? (
                      <Dropdown
                        name={`${name}.${valueIndex}.${inputItem.name}`}
                        label={inputItem.label}
                        multiSelect={inputItem.multiple}
                        placeholder={inputItem.value}
                        value={get(valueItem, inputItem?.name as PropertyPath)}
                        required={inputItem.required}
                        options={inputItem.options as DropdownOption[]}
                        optionalKey={inputItem.optionalKey}
                        onChange={(e) => onChange && onChange(e)}
                      />
                    ) : (
                      <Input
                        name={`${name}.${valueIndex}.${inputItem.name}`}
                        label={inputItem.label ?? false}
                        placeholder={inputItem.value}
                        errorMsg={inputItem.errorMsg}
                        value={get(valueItem, inputItem.name as PropertyPath)}
                        required={inputItem.required}
                        onChange={(e) => onChange && onChange(e)}
                        validation={inputItem.validation}
                      />
                    )}
                  </div>
                )}
              </Fragment>
            )
          )
        })}
        {addRow && (
          <div
            className={table_button_cell}
            onClick={() => {
              onChange &&
                onChange({
                  type: 'added',
                  target: { name: name },
                })
            }}
          >
            <Button
              className={table_dynamic_button}
              variant='unstyled'
              type='button'
              name={`${name}`}
            >
              <TbCirclePlus />
            </Button>
            {valueIndex !== 0 && (
              <div
                className={table_button_cell}
                onClick={() =>
                  onChange &&
                  onChange({
                    type: 'removed',
                    target: { name: `${name}.${valueIndex}` },
                  })
                }
              >
                <Button
                  className={table_dynamic_button}
                  variant='unstyled'
                  type='button'
                  name={`${name}.${valueIndex}`}
                >
                  <TbTrash />
                </Button>
              </div>
            )}
          </div>
        )}
        {deleteRow && (
          <div
            className={table_button_cell}
            onClick={(e) => {
              e.stopPropagation()
              deleteRow && deleteRow(valueItem)
            }}
          >
            <Button
              className={table_dynamic_button}
              variant='unstyled'
              type='button'
            >
              <TbTrash />
            </Button>
          </div>
        )}
      </Grid>
      {rows?.subrow &&
        subrows &&
        subrows?.length > 0 &&
        subrows.map((subrowItem: any, subrowIndex: number) => (
          <Grid
            cols={{
              start: collapse ? 1 : 0,
              end: addRow ? 2 : deleteRow ? 1 : 0,
            }}
            className={clsx(
              table_subrow,
              { ['clickable']: onClick },
              { ['collapsed']: collapsed }
            )}
            onClick={() => {
              onClick && onClick(subrowItem)
            }}
            key={subrowIndex}
          >
            <div className={table_button_cell} />
            {rows.inputs?.map((inputItem: any, inputIndex: number) => {
              const itemValue =
                getValueFromState(inputItem, subrowItem) !== null
                  ? getValueFromState(inputItem, subrowItem)
                  : ''
              return (
                !inputItem.breakpoint && (
                  <Fragment key={inputIndex}>
                    <div className={table_cell}>{itemValue}</div>
                  </Fragment>
                )
              )
            })}
            {deleteRow && (
              <div
                className={table_button_cell}
                onClick={(e) => {
                  e.stopPropagation()
                  deleteRow(valueItem)
                }}
              >
                <Button
                  className={table_dynamic_button}
                  variant='unstyled'
                  type='button'
                >
                  <TbTrash />
                </Button>
              </div>
            )}
          </Grid>
        ))}
    </>
  )
}

const Table: FC<TableProps> = memo(
  ({
    rows,
    name,
    value,
    onChange,
    readOnly,
    onClick,
    sortable,
    defaultSort,
    deleteRow,
    addRow,
    collapse,
    scrollable,
    id,
    border,
  }) => {
    const [sortState, setSortState] = useState<SortState>()
    const [defaultSortRan, setDefaultSortRan] = useState(false)
    const [isLoadingState, setIsLoadingState] = useState(true)
    const { items, requestSort, sortConfig } = useSortableData(value)

    useEffect(() => {
      if (defaultSort && defaultSortRan === false) {
        setDefaultSortRan(true)
        requestSort(defaultSort.name)
      }
    }, [defaultSort, defaultSortRan, requestSort])

    useEffect(() => {
      setSortState({ valueItems: items, sortConfig } as any)
    }, [setSortState, items, sortConfig])

    useEffect(() => {
      const handleLoading = () => {
        setIsLoadingState(false)
      }

      window.addEventListener('load', handleLoading)

      return () => window.removeEventListener('load', handleLoading)
    })

    const getClassNames = (value: string) => {
      if (!sortState?.sortConfig) {
        return ''
      }
      return sortState.sortConfig.key.sortOn === value
        ? sortState.sortConfig.direction
        : ''
    }

    const filteredItems = rows?.filters
      ? items?.filter((item: any) => {
          return (
            get(item, rows.filters?.filterOn as PropertyPath) !==
            rows.filters?.filterValue
          )
        })
      : items

    let content

    if (isLoadingState) {
      content = <Spinner />
    }

    content = (
      <div className={clsx(table, { ['scrollable']: scrollable })} id={id}>
        {rows?.headers && (
          <TableHeader
            headers={rows.headers}
            sortable={sortable}
            requestSort={requestSort}
            getClassNames={getClassNames}
            collapse={collapse}
            deleteRow={deleteRow}
            addRow={addRow}
            border={border}
          />
        )}
        <ScrollArea scrollDirection='vertical' className={clsx(table_body)}>
          {filteredItems?.map((valueItem: any, valueIndex: number) => (
            <Fragment key={valueIndex}>
              <TableRow
                valueItem={valueItem}
                valueIndex={valueIndex}
                rows={rows}
                readOnly={readOnly}
                deleteRow={deleteRow}
                onClick={onClick}
                onChange={onChange}
                name={name}
                addRow={addRow}
                collapse={collapse}
                border={border}
              />
            </Fragment>
          ))}
        </ScrollArea>
      </div>
    )

    return content
  }
)

Table.displayName = 'Table'

export default Table
