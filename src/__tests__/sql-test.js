jest.mock('pg-minify')

const minify = require('pg-minify')
const { sql } = require('../sql')

minify.mockImplementation(query => query)

test('will compile to an empty query', () => {
  expect(sql``.compile()).toEqual({ text: '', values: [] })
})

test('will compile basic text', () => {
  expect(sql`foobar`.compile()).toEqual({ text: 'foobar', values: [] })
})

test('will concatenate nested queries', () => {
  expect(sql`${sql`Hello`}, ${sql`world`}!`.compile()).toEqual({ text: 'Hello, world!', values: [] })
})

test('will escape identifiers', () => {
  expect(sql`${sql.ident('hello', 'world')} ${sql.ident('escape"me')}`.compile()).toEqual({ text: '"hello"."world" "escape""me"', values: [] })
})

test('will make values placeholders', () => {
  const value1 = Symbol()
  const value2 = Symbol()
  expect(sql`${value1} ${value2}`.compile()).toEqual({ text: '$1 $2', values: [value1, value2] })
})

test('join will join together queries with', () => {
  const queries = [sql`foo`, sql`bar`, sql`${sql.ident('baz')}`, sql`${sql.value(5)}`, sql`${sql.value(15)}`]
  expect(sql`${sql.join(queries)}`.compile()).toEqual({ text: 'foobar"baz"$1$2', values: [5, 15] })
})

test('join will join together queries with a seperator', () => {
  const queries = [sql`foo`, sql`bar`, sql`${sql.ident('baz')}`, sql`${sql.value(5)}`, sql`${sql.value(15)}`]
  expect(sql`${sql.join(queries, ', ')}`.compile()).toEqual({ text: 'foo, bar, "baz", $1, $2', values: [5, 15] })
})

test('raw will emit raw sql', () => {
  expect(sql`${sql.raw('foobar')}`.compile()).toEqual({ text: 'foobar', values: [] })
})

test('will minify a query', () => {
  minify.mockClear()
  expect(sql`foobar`.compile()).toEqual({ text: 'foobar', values: [] })
  expect(minify.mock.calls).toEqual([['foobar']])
})

test('will minify a query with values', () => {
  minify.mockClear()
  const value1 = Symbol()
  const value2 = Symbol()
  expect(sql`${value1} ${value2}`.compile()).toEqual({ text: '$1 $2', values: [value1, value2] })
  expect(minify.mock.calls).toEqual([['$1 $2']])
})
