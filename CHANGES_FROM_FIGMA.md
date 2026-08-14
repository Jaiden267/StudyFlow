# Changes made to the original Figma Make export

The original export used hard-coded sample records and simulated authentication timers. The following functional changes were made.

## Frontend

- Added `src/api.ts`, a same-origin PocketBase REST client.
- Replaced fake registration and login with real `users` auth collection calls.
- Persisted the auth token in browser local storage and refresh it on startup.
- Added logout, account deletion and password-reset confirmation.
- Added protected URL routes for dashboard pages.
- Connected assignments and subtasks to PocketBase records.
- Connected dashboard totals and analytics to saved records.
- Added persistent study-planner sessions, focus timer records and a calendar view.
- Connected profile and settings changes to the signed-in user record.

## Database/backend

- Added a PocketBase Docker image.
- Added an automatic migration defining `users`, `assignments`, `assignment_tasks` and `study_sessions`.
- Added per-user API ownership rules and cascade deletion.

## Hosting

- Added a production frontend Dockerfile.
- Added Nginx single-page routing and `/api/` reverse proxying.
- Added Docker Compose for frontend plus PocketBase.
- Bound PocketBase Admin/API port 8090 only to server localhost.
- Added the full ZimaOS and Cloudflare Tunnel deployment guide.
