# Basic React frontend

Three screens: sign in, case list, and case details. The app uses JavaScript,
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

After login, requests include `Authorization: Bearer <token>`. Express continues
to enforce roles and case assignments. The token stays in memory; no password
or token is stored in localStorage. Login and data requests display errors,
and case screens display loading and empty states.

## Read the code

1. `src/main.jsx` mounts React and loads CSS.
2. `src/App.jsx` stores the session and switches between the three screens.
3. `src/components/Login.jsx` handles form fields and submission.
4. `src/components/CaseList.jsx` loads and searches cases.
5. `src/components/CaseDetails.jsx` loads one case.
6. `src/api.js` switches between fictional data and real HTTP requests.
7. `src/data/demo.js` contains only fictional fixtures.
8. `src/styles.css` styles the app and includes a small mobile layout rule.

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

Case creation, editing, panchnamas, evidence review and report screens are not
part of these first three screens.
