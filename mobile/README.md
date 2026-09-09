# Weatherlink Web Console — Android app

A thin native Android shell (Flutter + `webview_flutter`) around the deployed
customer console at `https://wwebconsole.com/app`. It does not reimplement
any UI — the web app is the single source of truth. This project adds:

- A native app icon, splash screen, and Play Store packaging.
- In-app handling of the Polar checkout iframe/redirects.
- External links (mailto, tel, anything off the known host list) open in the
  device's browser/mail/dialer instead of hijacking the app.
- Android back button navigates WebView history before exiting the app.

Marketing pages and the admin portal (`admin.wwebconsole.com`) are
intentionally **not** included — the app opens straight to `/app`, which
redirects to `/login` for unauthenticated users on its own.

## One-time setup

This repo does not commit the release keystore or its passwords
(`android/key.properties`, `android/keystore/*.jks` — see `.gitignore`).
Whoever builds a release needs both files in place at those paths. If you
don't already have them, generate one:

```bash
keytool -genkeypair -v \
  -keystore android/keystore/upload-keystore.jks \
  -alias wwebconsole -keyalg RSA -keysize 2048 -validity 10950
```

Then create `android/key.properties`:

```properties
storePassword=<password you set above>
keyPassword=<same password — PKCS12 keystores require store and key passwords to match>
keyAlias=wwebconsole
storeFile=keystore/upload-keystore.jks
```

**Back this keystore up somewhere safe outside this machine right now**
(password manager, encrypted drive). If it's lost, you can never publish an
update to the same Play Store listing under the same app again — Google
would treat a rebuild with a new key as a different app entirely, short of
going through Play's account-recovery process for upload key resets.

## Building

```bash
flutter pub get
flutter build appbundle --release   # -> build/app/outputs/bundle/release/app-release.aab (upload this to Play Console)
flutter build apk --release --split-per-abi   # optional: sideloadable APKs for direct testing
```

## Changing what URL the app loads

`lib/main.dart` hardcodes `_consoleUrl` and the allowed in-app hosts
(`_inAppHosts`, which also covers Polar/Stripe checkout domains). Update
those if the console's domain, or the checkout provider, ever changes.

## Regenerating the icon/splash screen

Source images live in `assets/icons/`. After replacing them:

```bash
dart run flutter_launcher_icons
dart run flutter_native_splash:create
```

## Play Store listing checklist

- **Privacy policy URL**: `https://wwebconsole.com/privacy` (already live).
- **App category**: Weather, or Productivity/Tools.
- **Content rating questionnaire**: this app requires an account/login and
  has in-app purchases (Polar subscription), so answer accordingly.
- **Data safety form**: the app collects account email, and station/weather
  data tied to the user's account (all via the existing backend — nothing
  new is collected by the app shell itself). Review `worker/` for the exact
  fields collected before filling this in.
- **Screenshots**: capture from a real device/emulator running the app,
  logged in — at least a phone screenshot set (min 2, 16:9 or 9:16).
- Google has tightened review of WebView-only "wrapped website" apps. This
  shell adds native app chrome (icon, splash, back-button handling, external
  link handoff) which helps, but expect closer scrutiny than a fully native
  app on first submission.
