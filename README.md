# SaveZone

SaveZone is a static HTML, CSS, and JavaScript app packaged for Android with Capacitor. Expense data is stored locally on the device and is not synced to an account or server.

## Get a beta APK

1. Push the project to the `main` branch on GitHub.
2. Open the repository's **Actions** tab and select the latest **Build Android APK** run.
3. When the run succeeds, download the `savezone-debug-apk` artifact and unzip it.
4. Transfer `app-debug.apk` to an Android phone and install it. Android may ask you to allow installs from the app you used to open the file.

This debug APK is for testing and direct installation, not a signed Play Store release.

## Update the Android web app

Edit `index.html`, `styles.css`, and `app.js` in the project root. The `npm run build:web` command copies them into the generated `www/` directory; `npm run android:sync` also syncs those files into the Android project.

For a local Android build, install Android Studio with its Android SDK and use JDK 21, then run:

```powershell
npm ci
npm run android:sync
cd android
./gradlew assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.