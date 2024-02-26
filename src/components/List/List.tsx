import React from 'react'
import Container from '../Container/Container'
import Group from '../Group/Group'
import Button from '../Button/Button'
import Table from '../Table/Table'
import { Sprinkles } from '../../css/sprinkles.css'

const List = ({ filter, tableColumns, filtersState }) => {
  return (
    <Container className={sprinkles({ pt: 'size-3' })}>
      <Group className={sprinkles({ mb: 'size-3' })}>
        <h1>Spells</h1>
        <Group>
          <Button type='button' variant='default' onClick={onFilterReset}>
            Clear Filters
          </Button>
          <Button type='button' variant='default' onClick={handleCreate}>
            Create a Spell
          </Button>
        </Group>
      </Group>
      {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
      {filter}
      <Table
        id={'list-table'}
        addRow={false}
        readOnly={true}
        sortable={true}
        defaultSort={tableColumns.headers.find(
          (headerItem: any) => headerItem.defaultSort === true
        )}
        rows={{
          inputs: tableColumns.inputs,
          headers: tableColumns.headers,
        }}
        value={filteredItems as any[]}
        clickable={true}
        onClick={(spell) => handleShowDetail(spell)}
        deleteRow={(spell) => handleDelete(spell)}
      />
    </Container>
  )
}

export default List
