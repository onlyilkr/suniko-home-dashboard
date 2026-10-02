# Security

## Reporting a vulnerability

Please report security issues privately through GitHub: **Security → Report a vulnerability** on this repository. Do not open a public issue. Reports are acknowledged as soon as possible; fixes are released on `main` and noted in the [changelog](CHANGELOG.md). Only the latest version is supported.

## How the app handles secrets

- **Your build contains your SmartThings credentials.** `build.sh` writes the OAuth client ID, client secret and token pair into `app/secrets.js` and packages it into the `.wgt`. Do not share your built package, and do not commit `app/secrets.js`, `app/config.js` or `secrets/` (all ignored by git).
- **Tokens are renewed on the TV** and stored in the app's `localStorage`. To revoke access, delete the OAuth app with `npx @smartthings/cli apps:delete` or remove the connected service in your SmartThings account.
- **The desktop preview** (`dev-server.py`) listens on `127.0.0.1` only and answers only requests addressed to `127.0.0.1` or `localhost` on its port, so other websites cannot reach it through DNS rebinding. It refuses requests that other sites make from the browser (`Sec-Fetch-Site`, and `Origin` for every POST), never serves the real `app/secrets.js` (the preview gets its own answer at that path), lists no directories, proxies a fixed host (`api.smartthings.com`), and blocks device commands unless started with `ST_WRITE=1`.
- **Network access on the TV** is limited to the hosts listed with `<access>` in `app/config.xml`. The app has no server of its own and sends no analytics.
- **External text** (news titles, comments, device names, status messages) is always inserted as text, never as HTML.
