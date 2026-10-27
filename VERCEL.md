# Vercel multi-service deployment

Import the repository into one Vercel project with the repository root as the project root. `vercel.json` defines two independently built services:

- `backend` runs FastAPI from `backend/` and serves the public `/api/*` paths.
- `frontend` builds the Vite app from `frontend/` and serves every other public path.

The frontend uses same-origin `/api/...` requests, which the top-level rewrite sends to FastAPI. It does not need a service binding because browser requests use the shared public domain; bindings are for server-side service-to-service calls.

Locally, Vite's `/api` proxy targets `http://localhost:8000`. Vercel sets `VERCEL=1`, so the SQLite demo database uses `/tmp` and is seeded when the backend instance starts. Vercel's temporary storage is not durable or shared across instances. Refreshed Elexon data therefore will not persist across restarts; use a managed database for durable refreshes.
