# Basic React frontend

Screens: sign in, case list, case details, and admin tools. The app uses JavaScript,
React function components, `useState`, `useEffect`, and plain CSS. Vite runs and
builds it. There is no routing library, state library, or UI framework.

## Run the demo

```sh
cd frontend
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Demo mode is on by default and needs no backend.
Click **Fill demo details**, then **Sign in**. The fictional credentials are
`examiner@example.test` / `demo1234`.

You can search the three fictional cases, open a case, return to the list, and
sign out. Refreshing the page signs you out because the session is kept only
in React state. Demo login is a UI exercise, not real authentication.

## Connect to the existing backend

Copy `.env.example` to `.env` inside `frontend/` and set:

```env
VITE_USE_DEMO_DATA=false
VITE_API_BASE_URL=/api
```

Start the backend on port 3000 with its databases running, then restart Vite.
Sign in with a real backend account. The initial local admin credentials are in
`backend/.env`; do not copy them into frontend source or a `VITE_` variable.
The local database may have no cases yet; the app will show an empty state.

`vite.config.js` forwards development requests from `/api` to Express on
`http://127.0.0.1:3000`. It does not change backend routes or require a CORS
change for local development.

The frontend uses these existing contracts:

| Request | Response |
| --- | --- |
| `POST /api/auth/login` with `{ email, password }` | `{ accessToken }` |
| `GET /api/auth/me` | `{ user: { id, email, fullName, role } }` |
| `GET /api/cases` | `{ cases: [...] }` |
| `GET /api/cases/:caseId` | `{ case: { id, caseNumber, title, description, createdBy, status, createdAt } }` |
| `POST /api/cases` with `{ caseNumber, title, description }` | `{ case: {...} }` |
| `GET /api/users` | `{ users: [...] }` (no passwords or password hashes) |
| `POST /api/users` with `{ fullName, email, password, role }` | `{ user: {...} }` |
| `GET /api/cases/:caseId/assignments` | `{ assignments: [...] }` |
| `POST /api/cases/:caseId/assignments` with `{ userId, userNotes }` | `{ assignment: {...} }` |
| `GET /api/suspects` | `{ suspects: [...] }` |
| `POST /api/suspects` with `{ fullName, alias }` | `{ suspect: {...} }` |
| `GET /api/cases/:caseId/suspects` | `{ suspects: [{ id, suspectId, involvement, involvementDetails, suspect: { id, fullName, alias } }] }` |
| `POST /api/cases/:caseId/suspects` with `{ suspectId, involvement, involvementDetails }` | `{ caseSuspect: {...} }` |
| `GET /api/platforms` | `{ platforms: [...] }` |
| `GET /api/suspects/:suspectId/accounts` | `{ accounts: [...] }` |
| `POST /api/suspects/:suspectId/accounts` with `{ platformId, handle, profileUrl }` | `{ account: {...} }` |

After login, requests include `Authorization: Bearer <token>`. Express continues
to enforce roles and case assignments. The token stays in memory; no password
or token is stored in localStorage. Login and data requests display errors,
and case screens display loading and empty states.

## Use the admin tools

Sign in with a real administrator account and click **Admin tools**.

1. Create a case using its number, title and optional description.
2. Create a user with a name, email, password and examiner/reviewer role.
3. Choose a case and a user in the assignment form, then click **Assign user**.

New cases and users appear in the assignment dropdowns immediately. Existing
assignments are listed below the form, and already-assigned users are excluded
from the user dropdown. Only active examiners and reviewers can be assigned.
Click **Cases** to see newly created cases in the regular list.

An examiner/reviewer who signs in sees their assigned cases. Admin navigation is
hidden for those roles, and Express also rejects unauthorized admin mutations.
The fictional demo account remains an examiner and uses the original demo screens.
User creation passwords are sent only to the backend and cleared from the form
after success; they are not copied into the user list or browser storage.

## Suspects and social accounts

Open a case with **View case**. An administrator can:

1. Register a suspect using their full name and optional alias. This creates a
   registry record; it does not automatically link the person to a case.
2. Select the registered suspect, choose suspect/accused involvement, and click
   **Link suspect to case**. Optional involvement details belong to this case.
3. Choose a linked suspect and register an account using a platform, handle,
   and optional HTTP/HTTPS profile URL.

An existing suspect can be linked to another case without creating a second
registry record. Already-linked suspects are excluded from the linking dropdown.
If linking fails after registration, retry with the existing record in the
dropdown. Social accounts belong to the suspect, so authorized cases sharing
that suspect see the same account registry.

Assigned examiners/reviewers can view the linked suspects and accounts. Only
admins see the registration/linking forms; the backend also enforces these
permissions. The platform dropdown uses the backend's active platforms. Passwords
for social platforms are not collected. Profile links open in a new tab.

The demo case `DEMO-001` includes a fictional suspect/account, `DEMO-002` has a
fictional suspect without an account, and `DEMO-003` has no suspects. These demo
records are read-only and do not change the database.

## Panchnamas and witnesses

Open **View case** and scroll to **Panchnamas and witnesses**.

- An assigned examiner can create a panchnama with its number, authority
  reference, location, and date/time. Enter the time in your computer's local
  timezone; the form converts it to UTC for storage and displays it locally.
- Choose a panchnama to view its details and witness names.
- Only the examiner who created that panchnama can add witnesses. A name is
  required; a contact number is optional. Contact numbers are submitted to the
  backend but are not returned by the witness-list endpoint or displayed.
- Admins, assigned reviewers, and other assigned examiners can view records.
  A case assignment does not let another examiner add witnesses to someone
  else's panchnama. The backend enforces these permissions as well.
- The demo includes a read-only panchnama and witness under `DEMO-001`.

These existing API contracts are used:

| Request | Response |
| --- | --- |
| `GET /api/cases/:caseId/panchnamas` | `{ panchnamas: [...] }` |
| `POST /api/cases/:caseId/panchnamas` with `{ panchnamaNo, authorityRef, location, heldAt }` | `{ panchnama: {...} }` |
| `GET /api/panchnamas/:panchnamaId/witnesses` | `{ witnesses: [{ id, fullName }] }` |
| `POST /api/panchnamas/:panchnamaId/witnesses` with `{ fullName, contactNo }` | `{ witness: { id, fullName } }` |

## Capture sessions

In case details, choose a panchnama and scroll to **Capture sessions**.
Its creating examiner can choose a registered social account from the case,
select macOS/iOS, enter the capture tool version and an optional device label,
and click **Start session**. Register the suspect/account first if the account
list is empty; **Refresh case accounts** reloads the dropdown.

Select a session to see its status, device, timestamps, and platform sections.
For each section choose captured, failed, or skipped, provide a reason for
failed/skipped outcomes, and save. All authorized users can view these results;
only the panchnama's examiner can edit its open sessions. Ended sessions are
read-only. **Refresh session** loads the latest state after a conflict/error.

**Complete session** is disabled in this UI until all sections have a saved
outcome and at least one section exists. **End as failed** can end an unfinished
session. These are manual progress controls; they do not automate capture or
upload files. A captured outcome does not verify that a screenshot exists.
The existing backend still needs its own completeness/evidence checks; the
frontend guard is not a substitute for those checks. Demo sessions are read-only.

| Request | Response |
| --- | --- |
| `GET /api/panchnamas/:panchnamaId/sessions` | `{ sessions: [...] }` |
| `POST /api/panchnamas/:panchnamaId/sessions` with `{ accountId, deviceType, deviceLabel, toolVersion }` | `{ session: {...} }` |
| `GET /api/sessions/:sessionId` | `{ session: {...} }` |
| `GET /api/sessions/:sessionId/sections` | `{ sections: [{ id, sectionName, status, reason, ... }] }` |
| `PATCH /api/sessions/:sessionId/sections/:sectionId` with `{ status, reason }` | `{ outcome: {...} }` |
| `PATCH /api/sessions/:sessionId` with `{ status: "completed" }` or `{ status: "failed" }` | `{ session: {...} }` |

## Screenshots

Choose a capture session in case details and use its **Screenshots** section.
The panchnama's examiner can upload a PNG to an open session: choose a capture
section, enter a positive sequence number, choose a PNG up to 10 MB, and optionally
enter its source URL. Uploads use raw PNG bytes, not FormData. A sequence number
must be unique within that session/section; a new upload never overwrites it.
Uploading does not automatically change the section's captured/failed/skipped result.

Authorized viewers can list screenshots, see the stored SHA-256 and recorded
timestamp, and open a preview. The timestamp is when the backend registered the
upload, not a verified original camera/platform capture time. File requests use
the Bearer token and bypass browser caching. The backend verifies integrity and
the browser also compares downloaded bytes against the listed hash before showing
the image or enabling download. Failed integrity checks, missing files and access
errors are displayed. Previews release their object URLs when closed. Hashes are
checked on loading, not continuously; close/reopen or refresh to check again.

The demo contains an explicitly labelled 1 × 1 PNG placeholder with a matching
hash. It is not evidence. Demo uploads are disabled.

| Request | Response |
| --- | --- |
| `GET /api/sessions/:sessionId/screenshots` | `{ screenshots: [...] }` without private file paths |
| `POST /api/sessions/:sessionId/screenshots?sectionId=…&sequenceNo=…&sourceUrl=…` | `{ screenshot: {...} }`; body is PNG bytes with `Content-Type: image/png` |
| `GET /api/screenshots/:screenshotId/file` | Verified PNG bytes; integrity errors return HTTP 409 |

## Read the code

1. `src/main.jsx` mounts React and loads CSS.
2. `src/App.jsx` stores the session and switches between screens.
3. `src/components/Login.jsx` handles form fields and submission.
4. `src/components/CaseList.jsx` loads and searches cases.
5. `src/components/CaseDetails.jsx` loads one case.
6. `src/api.js` switches between fictional data and real HTTP requests.
7. `src/data/demo.js` contains only fictional fixtures.
8. `src/styles.css` styles the app and includes a small mobile layout rule.
9. `src/components/AdminPanel.jsx` loads the case/user dropdown data.
10. `CreateCase.jsx`, `CreateUser.jsx`, and `AssignUser.jsx` each handle one form.
11. `CaseSuspects.jsx` loads suspects linked to the selected case.
12. `AddSuspect.jsx` has separate registration and linking forms.
13. `SuspectAccounts.jsx` lists accounts and has the account registration form.
14. `Panchnamas.jsx` loads/selects panchnamas and applies role/ownership rules.
15. `CreatePanchnama.jsx` handles one creation form.
16. `Witnesses.jsx` loads witness names and has the witness form.
17. `CaptureSessions.jsx` lists/selects sessions for a panchnama.
18. `StartSession.jsx` loads case accounts and starts a session.
19. `SessionDetails.jsx` loads sections and handles saving/ending.
20. `SectionOutcome.jsx` is the simple result/reason form for one section.
21. `Screenshots.jsx` loads the list and selects the preview.
22. `UploadScreenshot.jsx` contains the PNG upload form; `useRef` clears the file input after success.
23. `ScreenshotViewer.jsx` loads/verifies a file and displays/downloads it.

## Production build

```sh
npm run build
npm run preview
```

The build is written to `dist/`. Set environment values before building. Vite
exposes `VITE_` values to the browser, so only put public settings there. For a
real deployment, set demo mode to false and provide a public API base URL ending
in `/api`, or configure the host to proxy `/api` to the backend. Vite's development
proxy is not included in the production build. If frontend and API origins
differ, configure the API's allowed frontend origin before deploying.

Case editing, OCR/parsed-evidence review and report screens remain to be built.
