# Basic macOS capture client

This small Node.js script opens a visible Chromium browser. The examiner signs
in to the social platform there, navigates to a section, and presses Enter in the
terminal to capture and upload the visible page. An `auto` command can also visit
planned section URLs, scroll and upload several screens. A `menus` command finds
recognizable English section links/tabs and clicks them. This browser client does not capture native apps;
use the separate [iPhone client](../capture-ios/README.md) for connected iOS capture.

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

## Automatic navigation and scrolling

After signing in to the platform in the opened browser, enter `auto` in the
terminal menu. Build a small plan by supplying:

1. A section ID from the displayed list.
2. That section's exact URL for the intended account.
3. A maximum screen count from 1 to 10.
4. An optional CSS selector for a scrollable feed container. Leave blank for
   whole-page scrolling. For example, `#feed` works only if that element exists
   and scrolls on the target page.

Repeat for more sections, then enter a blank section ID to finish planning.
Choose a wait after navigation/scroll (default 1500 ms, up to 10000 ms), then type
`start` when signed in and ready. The client visits the supplied URLs in order,
starts each page/container at its top, captures the viewport, scrolls down by 80%
of the container height and repeats. There is 20% overlap to help review adjacent
screens. It stops a section when scrolling no longer advances, or when the screen
limit is reached. A maximum of 20 unique session sections can be planned.

For example, plan the displayed posts section with its account posts URL and
three screens, then the profile section with its profile URL and one screen.
Section IDs and URLs are specific to your case/account; the client does not guess
them from platform names. Plans are entered in the terminal, not saved to files.

Each PNG uses the existing upload API, sequence numbering and hash check. The
section's captured outcome is saved only after the batch succeeds. The client
does not automatically complete the session: review captures and use `finish`.
If a batch fails, earlier uploads remain as evidence. An existing section outcome
is not automatically cleared, so review it after a failed rerun. There are no
automatic upload retries or rollback/deletion of earlier screenshots.

Unexpected redirects to a different origin/path/hash, visible password forms,
HTTP page errors or upload errors stop the plan and return to the manual menu.
These checks do not establish that a page contains the right account or section;
review the screenshots. A sign-in page without a visible password field may need
manual detection. Loading delays, infinite feeds and virtualized lists can leave
content unloaded; choose a suitable wait and screen limit. Reaching the bottom
means no scroll movement was detected, not that the account was fully captured.
Automatic phone navigation, menu clicks and content expansion are not included.

The client checks the uploaded image's SHA-256 against the API response before
saving a captured outcome. Uploads and outcome changes use the existing audited
routes. No app token is passed to the platform browser. The script does not save
passwords, tokens, screenshots or browser sign-in state to project files. Closing
the client closes its temporary browser context. Platform sign-in may be needed
again when restarting it.

The source URL stored with the screenshot excludes its query and fragment, which
may contain sign-in tokens. A screenshot captures only what is visible, not the
whole account or unloaded content. It is not a capture of the macOS desktop.

## Discover section menus

After manual sign-in, leave the browser on a page containing the platform's
section navigation and enter `menus` in the terminal. Enter 0 to omit a section,
or 1-10 screens to include it. Optionally specify its feed scroll container.
Type `start` to run. Each section begins at the current page saved as the menu
home, discovers a matching visible link/tab, clicks it, then uses the existing
scroll/capture/upload loop. You do not need to supply each section URL.

Simple English aliases include Posts/Tweets, Messages/Chats/Direct,
Profile/About, Friends, Followers, Following and Timeline. The client only clicks
a unique visible link or tab. It does not click buttons (for example, a Following
button could change follow state), open hidden menus or guess between duplicate
matches. Missing/ambiguous menus and links to another origin stop the plan.
For unsupported layouts or languages, use URL-based `auto` or manual capture.
Labels alone do not confirm the account/section, so review all screenshots.
This mode has been checked with fictional navigation pages; real-platform menus
still need testing with the intended accounts.

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
