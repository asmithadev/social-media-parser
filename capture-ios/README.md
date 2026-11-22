# Connected iPhone capture

This basic Mac-side client captures the connected iPhone's current screen using
`pymobiledevice3`, then uploads the original PNG to an existing iOS capture
session. Sign in and navigate manually in the official platform app on the phone.
It does not automate taps, scrolling or platform sign-in.

## Setup on the Mac

Use Node.js 22 or newer and install pymobiledevice3 following its
[installation guide](https://doronz88.github.io/pymobiledevice3/latest/installation/).
For example, with Python and pipx installed:

```sh
pipx install pymobiledevice3
pymobiledevice3 --help
```

Connect the test iPhone over USB, unlock it, and approve **Trust This Computer**.
Enable Developer Mode if required by the device. Use Finder's device details
(click the serial number) to find and copy the UDID. Always specify the intended
phone's UDID; do not rely on which device the tool chooses by default.

Developer services may require a mounted developer disk image and, on modern
iOS versions, a tunnel. Follow the installed version's
[developer service documentation](https://doronz88.github.io/pymobiledevice3/latest/cli/developer/)
and [tunnel guide](https://doronz88.github.io/pymobiledevice3/latest/guides/ios17-tunnels/).
The client invokes this documented command without a shell or automatic sudo:

```sh
pymobiledevice3 developer dvt screenshot --udid YOUR_DEVICE_UDID /tmp/iphone-check.png
```

First try that command on a fictional training screen. Confirm the PNG shows the
intended phone. Remove that manual test file when done. Device services and tunnel
setup vary with iOS and tool versions; this command must work before the client
can capture. Follow the tool's setup instructions when it reports a pairing,
developer image or tunnel error. The client does not change those device settings.

## Capture and upload

1. Start the backend and use the React app in real-data mode.
2. Create an **iOS** session for the intended account and panchnama. Use the
   device label to record the target phone. Note the session ID.
3. From the repository root run:

   ```sh
   node capture-ios/capture.js
   ```

4. Enter the owning examiner's **app** email and password, session ID and phone
   UDID. Password input is hidden. The API URL defaults to
   `http://localhost:3000/api`; set `CAPTURE_API_URL` for another HTTPS backend.
   Set `IOS_DEVICE_TOOL` to the executable path if pymobiledevice3 is not on PATH.
5. Sign in to the social platform directly on the iPhone. Keep passwords and OTPs
   in its own sign-in screen. Navigate to the intended evidence before capture.
6. Choose the section ID in the terminal, then press Enter to capture and upload.
   The entire current screen is captured; check it for unrelated visible content.
   Scroll on the phone and repeat for more screenshots.
7. Enter `skipped` or `failed` with a reason for inaccessible sections.
8. Enter `finish` when done. Backend completeness checks still apply. Enter
   `quit` to leave the session open for later.
9. Refresh screenshots in the app, verify them, run OCR and generate a report.

Uploads use the existing examiner-only, audited routes. The client checks the
server's SHA-256 against the original PNG before marking the section captured.
Sequence numbers continue per section. Native captures leave `sourceUrl` empty
rather than inventing a web URL. App credentials are never sent to the phone tool.
Capture files are created in a private temporary directory and removed after
reading, including on ordinary errors. Forced termination may leave a temporary
directory in the Mac's temporary storage. The backend keeps uploaded evidence.

If the device disconnects, no outcome is marked captured. Reconnect and retry.
If upload or its response fails, check the app's screenshot list before retrying:
the server may already have saved the image. If saving the outcome fails after
upload, the client identifies the screenshot; save the outcome in the app.
Restart and sign in again if the application token expires.

## Tests and current limits

```sh
node --test capture-ios/device.test.js
```

Tests use a fake device executable and fictional PNG to verify argument handling,
temporary cleanup, image preservation, numbering and errors. Backend integration
tests verify iOS uploads and file retrieval through the real API. No phone or
platform sign-in has been tested here: pymobiledevice3 is not installed on this
workspace. Physical capture must be checked on your connected test iPhone before
using this workflow. Simulator capture and automatic device control are not part
of this version.
