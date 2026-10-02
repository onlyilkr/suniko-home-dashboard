# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Security

- Desktop preview server: `app/secrets.js` could be read through other spellings of its path (`/Secrets.js`, `/./secrets.js`), including from other websites through a script tag in browsers without local network protection; any `Host` header was accepted (DNS rebinding). The server now checks the `Host`, `Sec-Fetch-Site` and `Origin` headers, never serves the real file and lists no directories.
- `gen-secrets.sh` writes `app/secrets.js` readable by the owner only.

## [1.0.0] - 2026-10-02

First public release.

### Added

- Home screen with a large clock (digital or two round faces), date, current weather, a six-hour strip and a seven-day strip with daily icons.
- Background themes: an illustrated weather scene (default), live sky, colors of the day, dark, and eight Wikimedia Commons photo themes with author and license credits.
- SmartThings integration: indoor climate, status chips, home controls grouped by room, scenes, and notifications for doors, leaks, presence and batteries; OAuth with token renewal on the TV.
- Developer hub: Hacker News front page, GitHub's most-starred new repositories, Claude and GitHub service status, details with top comments and a QR code, incident notifications.
- Prayer times: Diyanet in Turkey, Aladhan elsewhere, with automatic or manual location and reminders.
- Top menu, settings drawer, English and Turkish with locale-aware formats and °C/°F.
- Demo mode (`?demo`, with selectable weather) for trying the app without an account.
- Desktop preview server, setup guide, architecture notes, unit tests, translation check and a lint for ES5 and comment-free code; CI on GitHub Actions.

[Unreleased]: https://github.com/onlyilkr/suniko-home-dashboard/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/onlyilkr/suniko-home-dashboard/releases/tag/v1.0.0
