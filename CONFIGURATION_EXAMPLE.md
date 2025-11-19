# Configuration examples

## Simple

```json
{
  "hoverLookup.databasePaths": ["lookup-database.json"]
}
```

## Multiple

```json
{
  "hoverLookup.databasePaths": [
    "lookup-database.json",
    "lookup-database-users.json",
    "lookup-database-orders.json"
  ]
}
```

## Absolute routes

```json
{
  "hoverLookup.databasePaths": [
    "/Users/you/projects/main-db.json",
    "/Users/you/projects/secondary-db.json"
  ]
}
```

## Relative routes

Las rutas relativas se resuelven desde la raíz del workspace:

```json
{
  "hoverLookup.databasePaths": [
    "lookup-database.json",
    "databases/users.json",
  ]
}
```

## How it works

- ⚠️ **Order matters**: The files are searched in order
- ⚠️ **First match wins**: If a key is found in the first file, subsequent files are not searched.
- ✅ **All files are optional**: If a file is not found, it is skipped and the next file is searched.
- ✅ **Automatic reload**: If any file or config changes, the database is automatically reloaded. You can manually reload using the `Reload Database` command.

### Example 
With this configuration:
```json
{
  "hoverLookup.databasePaths": [
    "lookup-database.json",
    "lookup-database-shared.json"
  ]
}
```

- First it searches in `lookup-database.json`
- If not found, it continues searching in `lookup-database-shared.json`
- And so on with possible additional files

## MongoDB with single database

```json
{
  "hoverLookup.mongodbUrl": "mongodb://localhost:27017",
  "hoverLookup.mongodbCollections": [
    {"collection": "users", "searchFields": ["id", "email"]},
    {"collection": "products", "searchFields": ["sku", "code"]}
  ]
}
```

## MongoDB with projection (select specific fields)

```json
{
  "hoverLookup.mongodbUrl": "mongodb://localhost:27017",
  "hoverLookup.mongodbCollections": [
    {
      "collection": "users",
      "searchFields": ["id", "email"],
      "project": {"id": 1, "name": 1, "email": 1}
    },
    {
      "collection": "products",
      "searchFields": ["sku", "code"],
      "project": {"sku": 1, "code": 1, "name": 1, "price": 1}
    }
  ]
}
```

## MongoDB with multiple databases

```json
{
  "hoverLookup.mongodbUrl": "mongodb://localhost:27017",
  "hoverLookup.mongodbDatabases": ["db1", "db2", "db3"],
  "hoverLookup.mongodbCollections": [
    {"collection": "users", "searchFields": ["id", "email"]},
    {"collection": "products", "searchFields": ["sku", "code"]}
  ]
}
```

### How MongoDB search works

- ⚠️ **Database order matters**: Databases are searched in order
- ⚠️ **First match wins**: If a key is found in the first database, subsequent databases are not searched.
- ⚠️ **Collection order matters**: Collections within each database are searched in order

### Example with multiple databases

With this configuration:
```json
{
  "hoverLookup.mongodbUrl": "mongodb://localhost:27017",
  "hoverLookup.mongodbDatabases": ["production", "staging"],
  "hoverLookup.mongodbCollections": [
    {"collection": "users", "searchFields": ["id"]},
    {"collection": "products", "searchFields": ["sku"]}
  ]
}
```

The search order is:
1. Search for the ID in `production.users` collection
2. If not found, search in `production.products` collection
3. If not found, search in `staging.users` collection
4. If not found, search in `staging.products` collection