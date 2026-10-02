# Contributing

Thanks for helping. Suniko Home runs on TVs with modest GPUs and is used from the couch with a remote, so a few rules matter more here than in a typical web project.

## Development loop

```bash
npm install                            # one development dependency (acorn, for the lint)
npm start                              # desktop preview: http://127.0.0.1:8770/?demo
npm test                               # unit tests, translations, ES5 and no-comment lint
```

Open the preview at 1920×1080 (the app scales to the window, but layouts are designed for that size). Use the arrow keys, Enter and Esc as the remote. `?demo=rain`, `snow`, `storm`, `fog` or `clear` changes the demo weather; the `TVDebug` console helpers are listed in [ARCHITECTURE.md](ARCHITECTURE.md#testing-and-debugging).

If you have a TV in Developer Mode, `TV_IP=… CERT_PROFILE=… ./build.sh` installs your build ([docs/SETUP.md](docs/SETUP.md)). Please mention in the pull request whether you checked it on a TV.

## Rules every change follows

- **ES5 only** in `app/`: no `let`/`const`, arrow functions, template strings or classes. Older Tizen engines run this code. No frameworks, no build step, no runtime dependencies; a vendored file must be small and permissively licensed, with its license file next to it.
- **Both languages.** Every new visible string is a `t('key')` with the key in `app/i18n/en.js` **and** `app/i18n/tr.js`; check the layout in both (English is often longer). Temperatures stay Celsius internally. External data (titles, device names) is never translated.
- **No comments in the code.** Not in JavaScript, CSS, HTML, Python or shell scripts, including vendored files (their license goes in a separate file). Explanations belong in [ARCHITECTURE.md](ARCHITECTURE.md), the pull request, or clearer names.
- **Escape everything external** with `textContent` or the `esc()` helper; never build HTML from API data directly.
- **TV performance**: no `backdrop-filter` on moving elements, no animated `box-shadow`, no new always-on composited layers without measuring them. See [Performance rules](ARCHITECTURE.md#performance-rules).
- **Readable from three meters**: text is at least 22 px; no all-caps labels.
- **Keyless by default.** New data sources should be public endpoints that need no account. If something needs a key, it must be optional and documented.
- **No secrets in commits.** `app/config.js`, `app/secrets.js` and `secrets/` are ignored; keep it that way.

## Pull requests

- One topic per pull request, with a short description of the user-visible change and screenshots in both languages for UI changes.
- Tests and checks above pass.

## Reporting bugs

Please include the TV model and Tizen version (Settings → Support → About This TV), whether it happens in the desktop preview too, and steps to reproduce with the remote.
