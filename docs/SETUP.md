# Setup: from zero to the app running on your TV

This is the full walkthrough: install the tooling, put the TV into Developer Mode, connect to it, sign the app, configure it, optionally wire up API keys, then build, install and launch.

[← Back to README](../README.md)

## 0. Prerequisites & overview

You'll need:

- A Mac, Windows or Linux computer and a Samsung Smart TV running Tizen, on the same local network.
- [Tizen Studio](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html) with the Samsung TV Extension and Samsung Certificate Extension (§1).
- A Samsung Developer account, used to create the signing certificate (§4).
- `app/config.js`, copied from `app/config.example.js` and edited with your own values (§5).

Flow: install the SDK (§1) → turn on Developer Mode on the TV (§2) → connect to it with `sdb` (§3) → create a certificate profile (§4) → configure the app (§5) → optionally add API keys (§6) → build, install and launch (§7).

## 1. Install Tizen Studio + TV Extension

From Samsung's [Installing TV SDK](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html) guide:

1. Download and run the Tizen Studio installer, accept the software license, and set the install location.
2. Wait for Tizen Studio to install, then let it launch the Package Manager.
3. In the Package Manager, open the **Extension SDK** tab and install **TV Extensions-\<version\>** and **Samsung Certificate Extension**, accepting their licenses.

`$TIZEN_STUDIO/tools/sdb` and `$TIZEN_STUDIO/tools/ide/bin/tizen` (default `~/tizen-studio`) are what `build.sh` calls later.

## 2. Enable Developer Mode on the TV

From Samsung's [TV Device](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html) guide:

1. On the TV, open **Smart Hub**.
2. Select the **Apps** panel.
3. Scroll down to **App Settings**.
4. In the **Apps Settings** panel, enter `12345` using the remote control or the on-screen number keypad.
5. The developer mode configuration popup appears — switch **Developer mode** to **On**.
6. Enter the IP address of the computer you want to connect to the TV, and click **OK**.
7. Reboot the TV.
8. After the reboot, opening the **Apps** panel again shows "Develop Mode" marked at the top of the screen.

If what you see on your TV differs from this, follow the official page above.

## 3. Connect with sdb

The TV and your computer must be on the same network (same guide as §2). Using the `sdb` tool from Tizen Studio:

```
sdb connect <TV_IP>
sdb devices
```

`build.sh` runs the same `sdb connect <TV_IP>` before every install (no port), then addresses the device as `<TV_IP>:26101` for the push/install/launch commands that follow (§7). Port 26101 is an internal device port; per Samsung's FAQ, it "cannot be opened separately."

If `sdb devices` lists the TV but `sdb shell`/`sdb push` just hang, reset the sdb server and reconnect with the port included:

```
sdb kill-server && sdb start-server && sdb connect <TV_IP>:26101
```

If `sdb connect` fails outright ("failed to connect"), the TV and computer are probably on different networks (a phone hotspot, guest Wi-Fi, a different VLAN/subnet) — ping the TV first. Also note that Developer Mode's "Host PC IP" (step 2.6) is a snapshot of your computer's LAN IP at the time you entered it; if your router reassigns it later (DHCP), re-enter it on the TV.

## 4. Create certificates

From Samsung's [Creating Certificates](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html) guide. You'll need the Samsung Certificate Extension (§1), a Samsung Developers account, and the TV's Device ID (DUID) — on the TV, **Menu > Support > Contact Samsung > Unique Device ID**.

1. In Tizen Studio, select **Tools > Certificate Manager**.
2. Dismiss the "Migration for Certificate Profile" dialog with **Cancel**, then click **+**.
3. Click **Samsung**, select **TV**, and click **Next**.
4. Enter a name for the certificate profile — this is the name you'll pass as `CERT_PROFILE` — and click **Next**.
5. Add an author certificate: either create a new one (sign in with your Samsung Developer account, then define a backup path for the certificate file) or import an existing `author.p12`.
6. Add a distributor certificate: choose the privilege level you need, and add the TV's DUID (enter it manually, or click **+** next to the connected device in the list).
7. Click **Finish**.

Keep the certificate file backed up: an update to an already-installed app must be signed with the same author certificate as the original, or the TV can treat the update as a different app.

To find your active profile's name later: **Tools > Certificate Manager**, "Certificate Profile" panel ([Command Line Interface](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html) guide).

## 5. Configure the app

Everything is optional; without a config the app uses its defaults. To set your own, copy the template (`app/config.js` is ignored by git):

```
cp app/config.example.js app/config.js
```

- `location`: the weather location as `{ lat, lon, name }`. Leave it `null` to resolve it automatically: IP geolocation first, then your SmartThings home location.
- `fallbackLocation`: used only when neither of those works (for example a TV without internet at start-up), as `{ lat, lon, name, region, country }`. With `null`, the weather area shows an error and retries every 15 minutes.
- `display`: the initial value of every on-screen setting (theme, clock, weather sections, smart home panel, developer hub, prayer times, language, unit). See the table in the [README](../README.md#configuration). Choices made on the TV are stored there and win over these defaults.
- `demo`: `true` replaces SmartThings and the forecast with a sample home and fixed weather.
- `smartthings.climateDeviceId`: which temperature sensor the indoor panel shows (empty = the first one found). `smartthings.hide`: device IDs or names to leave out.

## 6. SmartThings (optional)

Without SmartThings credentials the app shows clock, date and weather only.

### Recommended: OAuth (tokens renew themselves)

SmartThings Personal Access Tokens created after 30 December 2024 expire after 24 hours, so the app uses OAuth: the access token lasts 24 hours and is renewed with a refresh token (valid 30 days, replaced on every renewal).

1. Create an OAuth app with the [SmartThings CLI](https://github.com/SmartThingsCommunity/smartthings-cli). It opens a browser to sign in to your Samsung account:
   ```
   mkdir -p secrets && cp secrets.example/st-app.json secrets/   # set a unique appName
   npx @smartthings/cli apps:create -i secrets/st-app.json -j -o secrets/st-app-created.json
   ```
2. Authorize the TV: run `python3 st_auth.py url`, open the printed address, sign in, pick your location and press **Authorize**. You land on an `httpbin.org` page; copy the `code` value:
   ```
   python3 st_auth.py code tv <code>
   ```
3. Optional, only for the desktop preview (`dev-server.py`): create a **second** OAuth app and authorize it separately. Copy `secrets.example/st-app-dev.json` to `secrets/`, set a unique `appName`, then:
   ```
   npx @smartthings/cli apps:create -i secrets/st-app-dev.json -j -o secrets/st-app-dev-created.json
   python3 st_auth.py url dev        # open, sign in, Authorize, copy the code
   python3 st_auth.py code dev <code>
   ```
   Do **not** authorize the preview with the TV's app. SmartThings returns the same token pair for a second authorization by the same user, and the refresh token changes on every renewal, so whichever side renews first (the TV or the preview server) silently logs the other one out. `st_auth.py` refuses to save a pair that matches the other one.

`build.sh` bundles the client credentials and the `tv` token pair into `app/secrets.js`. Rebuilding does not undo the TV's own renewals: the TV keeps whichever pair is newer. If the TV stays off for more than 30 days, authorize the TV again and rebuild.

### Quick test: Personal Access Token

Create a token at [account.smartthings.com/tokens](https://account.smartthings.com/tokens) with **Devices** (list, see, control), **Locations** (see) and **Scenes** (see, control), and save it as `secrets/smartthings.json`: `{ "token": "..." }`. It stops working after 24 hours. OAuth credentials take precedence when both exist.

## 7. Build, install, launch

```
TV_IP=<tv-ip> CERT_PROFILE=<profile> ./build.sh
```

(or `./build.sh <tv-ip>` with `CERT_PROFILE` set in the environment). `TIZEN_STUDIO` defaults to `~/tizen-studio`. What it does:

1. Runs `gen-secrets.sh` (§6): SmartThings credentials from `secrets/` → `app/secrets.js`.
2. Packages `app/` into a `.wgt` with `tizen package -t wgt -s $CERT_PROFILE`, and renames the result to `app/SunikoHome.wgt`.
3. Connects to the TV (`sdb connect $TV_IP`; a failed/duplicate connect is tolerated) and pushes the package to the TV's temporary share.
4. Installs it (`sdb -s $TV_IP:26101 shell 0 vd_appinstall <app id>`) and launches it (`shell 0 was_execute <app id>`). The app ID is read from the `tizen:application` element of `app/config.xml` (`SUNIKOHOME.SunikoHome`).

To install a fork next to this app on the same TV, give it its own package and application ID in `config.xml`: the package is exactly 10 letters or digits, and the application ID is `<package>.<name>`. Changing the ID makes it a new app for the TV, with empty settings and storage.

**Manual alternative**, from Samsung's [Command Line Interface](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html) guide, if you'd rather not use `build.sh`:

```
tizen package -t wgt -s <profile> -- <project path>
tizen install -s <serial> --name <file>.wgt -- <project path>
```

(use `-t <target>` instead of `-s <serial>` if you prefer a target name). Get the serial number or target name from `sdb devices`. Note that `tizen install`/`tizen run` are the general Tizen Studio CLI path; `build.sh` instead uses the lower-level `sdb shell vd_appinstall`/`was_execute` commands shown above, which are not documented on Samsung's public pages.

## 8. On the TV

Smart Hub shows a tile named "Suniko Home" (the app's `<name>` in `config.xml`) with its icon. Pressing the remote's **Home** key sends the app to the background — it does not quit — and returning to it resumes from the same state. `config.xml` sets `multitasking.support=true`; see Samsung's [Multitasking](https://developer.samsung.com/smarttv/develop/guides/fundamentals/multitasking.html) guide for the underlying mechanism (the app is paused and hidden, and receives a `visibilitychange` event when it is hidden or resumed). The app itself never quits (it does not call the Tizen exit API on Back or Home); use the TV's own controls to close it.

## 9. Updating the app

Re-run the same `TV_IP=... CERT_PROFILE=... ./build.sh` command. It packages and pushes the app again and calls `vd_appinstall` for the same app ID (§7), which in practice replaces the installed app — including after a `config.xml` `version` bump. Separately, Samsung's own docs describe the general Tizen install path (outside of the specific `vd_appinstall`/`was_execute` commands `build.sh` uses) as automatically uninstalling the previous version when a newer one is installed.

Two things worth knowing:

- The Smart Hub tile's **icon is cached**: reinstalling with the same `version` in `config.xml` does not refresh it. Bump `version` and power-cycle the TV; you don't need to uninstall first.
- Because the package/app ID doesn't change, anything the app stored in `localStorage` (settings, cached data) survives the reinstall.

## 10. Troubleshooting

From Samsung's [TV Device](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html) guide:

- **`1009: App uninstall fail`** — internal device problem; uninstall from the TV's Apps panel instead.
- **`1010: App install fail`** — a problem with the signing certificates is a common cause; check your certificate profile.
- **`1013: App run fail`** — internal device problem; try running again, or reboot the device.
- **"You are not an authorized user!" or a null-pointer error** — usually an outdated firmware or SDK version; update both.
- **Tizen Studio freezes/hangs on macOS** — update your Java Development Kit installation.

Beyond the official list:

- `sdb devices` lists the TV, but `sdb shell`/`sdb push` just hang → reset sdb (§3).
- `sdb connect` fails outright → TV and computer are on different networks; ping the TV first (§3).
- The indoor panel says "SmartThings disconnected" → the refresh token expired (TV off for 30+ days) or access was revoked; authorize the TV again (§6) and rebuild.

## 11. Desktop preview details

```
python3 dev-server.py        # defaults to port 8770
```

This serves `app/` as static files (with `Cache-Control: no-store`) and forwards `/st/...` requests to `https://api.smartthings.com/v1/...`, because the SmartThings API sends no CORS headers. The target host is fixed, so the proxy can't be pointed elsewhere. On the TV the app calls the API directly. Weather (Open-Meteo) and IP geolocation (ipwho.is) allow CORS and are called directly in both places.

The preview is connected to your real home, so device commands (`POST`) are blocked by default; start it with `ST_WRITE=1 python3 dev-server.py` to allow them on purpose. To try the app without SmartThings at all, open **http://127.0.0.1:8770/?demo** (a sample home and a fixed forecast; `?demo=rain`, `snow`, `storm`, `fog`, `clear` or `overcast` picks the weather). For the preview's own SmartThings authorization, see §6, step 3.

Keyboard map (mirrors the TV remote): **↑** moves into the top menu, **Enter**, **↓** or **→** opens the home controls, **←** opens settings, arrows move focus, **Enter** toggles a device or runs a scene, **Esc**/**Backspace** goes back. With a mouse, click the indoor panel to open the controls, the dimmed area to close them, and the menu icons to switch screens.

Console helpers: `TVDebug.notify({ title, text, icon, tone })` (test notification), `TVDebug.sky(13)` / `TVDebug.scene('snow', 22)` (sky or weather scene at another hour), `TVDebug.screen('dev')` (developer hub), `TVDebug.status('Claude Code', 'major_outage')` (fake service incident), `TVDebug.hubFail(true)` (network errors on the developer hub), `TVDebug.prayer(23, 30)` (prayer card at 23:30).

---

[← Back to README](../README.md)
