# `pg-sql`

Create SQL for Postgres in a safe and composable fashion with the power of template strings.

```js
import { sql } from 'pg-sql'

const tableName = 'user'
const id = 10
const query = sql`select * from ${sql.ident(tableName)} where id = ${id}`

console.log(query)

// -> { text: 'select * from "user" where id = $1', values: [10] }
```

This approach makes it impossible for developers to accidently introduce SQL injection vulnerabilities. The only way to inject raw SQL is if your developer writes it in the template string, or a developer wraps arbitrary input with the `sql.raw` function.

You can also easily compose queries:

```js
import { sql } from 'pg-sql'

const var1 = 'foo'
const var2 = 'bar'
const var3 = 'baz'

const expression = sql`(${var1} || ${var2})`
const query = sql`select ${expression} || ${var3}`

console.log(query)

// -> { text: 'select ($1 || $2) || $3', values: ['foo', 'bar', 'baz'] }
```

Queries created with the `sql` template string tag are ready to be used with the `pg` package as they are compatible with the prepared query object format. Just pass the query directly in like so:

```js
pg.query(sql`select * from user where id = ${id}`).then(({ rows }) => console.log(rows))
```

## API

The API of this module is fairly simple, but this is where some of its power comes from.

### ``sql`...` ``

A template string tag which interpolates all values as placeholders unless they are escaped with a function from this package such as `sql.ident` or `sql.raw`.

Example:

```js
sql`select * from user where id = ${id}`
```

### `sql.ident(...names)`

Creates a Postgres identifier. A qualified identifier will be created if more than one name is passed. If a non-string value is used for a name, such as a symbol, a local identifier will be generated.

Examples:

```js
sql`select * from ${sql.ident('user')}`
// -> 'select * from "user"'

sql`select * from ${sql.ident('schema', 'user')}`
// -> 'select * from "schema"."user"'

const fromIdent = Symbol()

sql`select * from user as ${sql.ident(fromIdent)}`
// -> 'select * from user as __local_0__'
```

### `sql.raw(text)`

Use a string of text directly in the SQL. Helpful if you need to escape the constraints of this library.

> **Warning:** If you use arbitrary user generated input anywhere inside the text you pass to `sql.raw`, you will have a SQL injection vulnerability. Try not to use `sql.raw` unless absolutely necessary.

Example:

```js
sql`select * from user where id ${sql.raw('=')} 5`
// -> 'select * from user where id = 5'
```

### `sql.join(queries, seperator?)`

Joins an array of SQL queries together with an optional seperator. Works similarly to `Array#join`.

Example:

```js
sql`select ${sql.join([sql.query`id`, sql.query`name`], ', ')} from user`
// -> 'select id, name from user'
```

## Thanks

Enjoy the library? Want to see what the author is up to next? Follow me on Twitter [`@calebmer`](https://twitter.com/calebmer).
