# Change Log

All notable changes to the "hoverLookup" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.4.0] - 2024-11-14

### Fixed

- Crash caused by missing MongoDB dependencies

## [0.3.0] - 2024-11-13

### Added

- Added MongoDB support
	- Added command to reconnect to MongoDB
	- Added setting to configure MongoDB connection URL
	- Added setting to configure MongoDB databases to search
	- Added setting to configure MongoDB collections to search
	- Added setting to configure MongoDB projection (select specific fields)
	- Added command to clear MongoDB cache
- Added support for multiple lookup-database.json files
- Added setting to configure maximum hover tooltip size
- Added command to toggle MongoDB lookup
- Added command to toggle JSON database lookup
- Added command to open extension settings