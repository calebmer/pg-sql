import minify = require('pg-minify')

/**
 * A Postgres query which may be fed directly into the `pg` module for
 * execution.
 */
export interface PGQuery {
  /**
   * The SQL query text with placeholders for values. The placeholders refer to
   * a value in the `values` array.
   */
  text: string

  /**
   * The values used to fill the placeholders in `text`.
   */
  values: Array<any>
}

/**
 * A single, escaped, `SQLQuery` item. These items are assembled into a SQL
 * query through the compile method.
 */
type SQLItem =
  { type: 'RAW', text: string } |
  { type: 'VALUE', value: any } |
  { type: 'IDENTIFIER', names: Array<any> }

/**
 * The representation of a SQL query. Call `compile` to turn it into a SQL
 * string with value placeholders.
 *
 * This object is immutable. Instead of changing the object, new `SQLQuery`
 * values will be returned.
 *
 * The constructor for this class is private and may not be called.
 */
export class SQLQuery implements PGQuery {
  /**
   * A template string tag that interpolates literal SQL with placeholder SQL
   * values.
   */
  public static query (strings: TemplateStringsArray, ...values: Array<any>): SQLQuery {
    const items: Array<SQLItem> = []

    // Add all of the strings as raw items and values as placeholder values.
    for (let i = 0; i < strings.length; i++) {
      items.push({ type: 'RAW', text: strings[i] })

      if (i < values.length) {
        const value = values[i]

        // If the value is a `SQLQuery`, add all of its items.
        if (value instanceof SQLQuery) {
          for (const item of value._items)
            items.push(item)
        }
        else {
          items.push({ type: 'VALUE', value })
        }
      }
    }

    return new SQLQuery(items)
  }

  /**
   * Joins multiple queries together and puts a seperator in between if a
   * seperator was defined.
   */
  public static join (queries: Array<SQLQuery>, seperator?: string) {
    const items: Array<SQLItem> = []

    // Add the items of all our queries into the `items` array, adding text
    // seperator items as necessary.
    for (const query of queries) {
      for (const item of query._items)
        items.push(item)

      // If we have a seperator, and this is not the last query, add a
      // seperator.
      if (seperator && query !== queries[queries.length - 1])
        items.push({ type: 'RAW', text: seperator })
    }

    return new SQLQuery(items)
  }

  /**
   * Creates a new query with the raw text.
   */
  public static raw (text: string): SQLQuery {
    return new SQLQuery([{ type: 'RAW', text }])
  }

  /**
   * Creates a new query with the value. This value will be turned into a
   * placeholder when the query gets compiled.
   */
  public static value (value: any): SQLQuery {
    return new SQLQuery([{ type: 'VALUE', value }])
  }

  /**
   * Creates an identifier query. Each name will be escaped, and the
   * names will be concatenated with a period (`.`).
   */
  public static identifier (...names: Array<any>): SQLQuery {
    return new SQLQuery([{ type: 'IDENTIFIER', names }])
  }

  /**
   * The internal array of SQL items. This array is never mutated, only cloned.
   */
  private readonly _items: Array<SQLItem>

  /**
   * Storage for our memoized compiled query.
   */
  private _query: PGQuery | null

  // The constructor is private. Users should use the static `create` method to
  // make a new `SQLQuery`.
  private constructor (items: Array<SQLItem>) {
    this._items = items
    this._query = null
  }

  /**
   * The SQL query text with placeholders for values. The placeholders refer to
   * a value in the `values` array.
   */
  public get text (): string {
    return this.compile().text
  }

  /**
   * The values used to fill the placeholders in `text`.
   */
  public get values (): Array<any> {
    return this.compile().values
  }

  /**
   * Compiles this SQL query into a Postgres query. Memoized so it only does the
   * work once.
   */
  public compile (): PGQuery {
    // If we don’t yet have a compiled query, create one.
    if (this._query == null)
      this._query = compile(this._items)

    return this._query
  }
}

/**
 * Compiles a list of `SQLItem`s into a single `PGQuery`.
 */
function compile (items: Array<SQLItem>): PGQuery {
  // Create an empty query object.
  const query: PGQuery = {
    text: '',
    values: [],
  }

  const localIdentifiers = new Map<any, string>()

  for (const item of items) {
    switch (item.type) {
      // If this is just raw text, we add it directly to the query text.
      case 'RAW': {
        query.text += item.text
        break
      }

      // If we got a value SQL item, add a placeholder and add the value to our
      // placeholder values array.
      case 'VALUE': {
        query.text += `$${query.values.length + 1}`
        query.values.push(item.value)
        break
      }

      // If we got an identifier type, escape the strings and get a local
      // identifier for non-string identifiers.
      case 'IDENTIFIER': {
        query.text += item.names.map((name): string => {
          if (typeof name === 'string')
            return escapePGIdentifier(name)

          if (!localIdentifiers.has(name))
            localIdentifiers.set(name, `__local_${localIdentifiers.size}__`)

          return localIdentifiers.get(name)!
        }).join('.')
        break
      }
    }
  }

  // Minify the query text before returning it.
  query.text = minify(query.text)

  return query
}

/**
 * Escapes a Postgres identifier. Adapted from the [`pg` module][1].
 *
 * [1]: https://github.com/brianc/node-postgres/blob/a536afb1a8baa6d584bd460e7c1286d75bb36fe3/lib/client.js#L255-L272
 */
function escapePGIdentifier (str: string): string {
  let escaped = '"'

  for (const c of str) {
    if (c === '"') escaped += c + c
    else escaped += c
  }

  escaped += '"'

  return escaped
}

/**
 * The interface we actually expect people to use.
 */
export interface SQL {
  (strings: TemplateStringsArray, ...values: Array<any>): SQLQuery

  join (queries: Array<SQLQuery>, seperator?: string): SQLQuery
  raw (text: string): SQLQuery
  value (value: any): SQLQuery
  ident (...names: Array<any>): SQLQuery
}

// Create the SQL interface we export.
export const sql: SQL = Object.assign(
  (strings: TemplateStringsArray, ...values: Array<any>): SQLQuery =>
    SQLQuery.query(strings, ...values),
  {
    join: SQLQuery.join,
    raw: SQLQuery.raw,
    value: SQLQuery.value,
    ident: SQLQuery.identifier,
  },
)
