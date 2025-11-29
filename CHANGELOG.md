# Change Log

All notable changes to the "hoverLookup" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.5.3] - 2025-11-29

### Fixed

- Removed warning message about missing collections when MongoDB is not enabled. Message is still shown in logs.

## [0.5.2] - 2025-11-26

### Fixed

- Changed error messages to console logs when JSON database is not found or MongoDB connection fails.
- MongoDB source was not including collection name. Now the format is `MongoDB.{database}.{collection}`.

## [0.5.0] - 2025-11-23

### Added

- Hover over variables containing objects will perform a lookup using every value in order:
	- When hovering over an object like `{id: "1234", name: "John", age: 23}`, the extension searches sequentially using each value ("abc", "John", 23) until finding a match
	- Works in both debug mode and normal editing mode
	- Works with single-line and multi-line object declarations
- MongoDB cache size and TTL are now configurable via settings:
	- `hoverLookup.mongodbMaxCacheSize` - Maximum number of cached documents (default: 1000, range: 100-10000)
	- `hoverLookup.mongodbCacheTtlMinutes` - Cache time-to-live in minutes (default: 1, range: 0.1-60)

### Fixed

- MongoDB lookup now works for dynamic values in debugger hover (e.g., computed variables, random values)
	- Implemented background async search when value is not cached
	- First hover triggers MongoDB search, second hover shows cached result



## [0.4.0] - 2025-11-14

### Fixed

- Crash caused by missing MongoDB dependencies.

## [0.3.0] - 2025-11-13

### Added

- Added MongoDB support.
	- Added command to reconnect to MongoDB.
	- Added setting to configure MongoDB connection URL.
	- Added setting to configure MongoDB databases to search.
	- Added setting to configure MongoDB collections to search.
	- Added setting to configure MongoDB projection (select specific fields).
	- Added command to clear MongoDB cache.
- Added support for multiple lookup-database.json files.
- Added setting to configure maximum hover tooltip size.
- Added command to toggle MongoDB lookup.
- Added command to toggle JSON database lookup.
- Added command to open extension settings.