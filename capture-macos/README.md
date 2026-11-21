# Basic macOS capture client

This small Node.js script opens a visible Chromium browser. The examiner signs
in to the social platform there, navigates to a section, and presses Enter in the
terminal to capture and upload the visible page. There are no platform-specific
selectors or automatic scrolling yet. Native apps and iOS are not supported.

## Setup

Use Node.js 22 or newer on the Mac. From the repository root:

```sh
cd capture-macos
npm ci
npx playwright install chromium
npm start
```

The API defaults to `http://localhost:3000/api`. For another backend, set its
public URL before starting:

```sh
CAPTURE_API_URL=https://your-api.example/api npm start
```

Remote APIs require HTTPS. Start the backend and use the React app in real-data
mode first. The client uses existing APIs and does not need database credentials.

## Capture a session

1. In the app, register the account and create a panchnama and an open **macOS**
   capture session. Note the session ID shown in the session dropdown.
2. Run `npm start`. Enter the owning examiner's **app** email and password.
   Password input is hidden. Enter the session ID.
3. Enter the platform URL, or press Enter to use the registered profile URL.
4. Sign in to the platform directly in the opened browser. Enter platform
   passwords and OTPs only in the platform's own sign-in screen.
5. Navigate in the original browser tab to the evidence you want. In the terminal,
   choose its section ID and press Enter at the capture prompt. The current
   viewport becomes a PNG and is uploaded to that section. Capture only after
   sign-in is complete and the intended evidence is visible.
6. Scroll or navigate and repeat for more screenshots. Sequence numbers continue
   from the uploaded screenshots for that section.
7. For an inaccessible section, enter `skipped` or `failed` and provide a reason.
8. Enter `finish` to complete the session. The backend rejects completion if a
   section is pending or a captured section has no screenshot. Enter `quit` to
   leave the session open and continue later.
9. In the React app, refresh the session to review screenshots, run OCR, generate
   a PDF, and request reviewer approval.

The client checks the uploaded image's SHA-256 against the API response before
saving a captured outcome. Uploads and outcome changes use the existing audited
routes. No app token is passed to the platform browser. The script does not save
passwords, tokens, screenshots or browser sign-in state to project files. Closing
the client closes its temporary browser context. Platform sign-in may be needed
again when restarting it.

The source URL stored with the screenshot excludes its query and fragment, which
may contain sign-in tokens. A screenshot captures only what is visible, not the
whole account or unloaded content. It is not a capture of the macOS desktop.

## Errors and retries

An action error leaves the menu available. Review the screenshot list in the app
before retrying an upload: a lost network response can happen after the server
has saved it. If upload succeeds but saving the outcome fails, the client shows
the screenshot ID; save that section as captured in the app without recapturing.
Expired app tokens require restarting the client and signing in again. The API
also enforces session ownership, access, PNG size and sequence uniqueness.

## Test

```sh
npm test
```

Tests use a headless browser, a fictional local page and a temporary HTTP test
server. They check PNG uploads, section numbering, token separation, rejected
uploads, hash mismatches and partial failures. They do not access social accounts
or modify the application database. Platform sign-in and the visible browser flow
still need a manual check on the target Mac.
