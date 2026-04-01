# DD Tracker — Frontend

The backend is a drop-in replacement for the ICP canister.
You have two options for connecting a frontend.

---

## Option A — Use the ICP frontend locally (recommended)

The ICP-deployed React frontend communicates with the canister through
`@dfinity/agent`. To repoint it at the local FastAPI backend you need to
replace the canister calls with HTTP fetch calls.

Steps:

1. Download the project source from the ICP platform
   (Project settings → More → Download files).
2. In the frontend source, locate the canister call layer
   (usually `src/frontend/src/declarations/` or a `backend.ts` actor file).
3. Replace every canister method call with a `fetch` call to
   `http://localhost:8000/<endpoint>` using the same JSON shapes documented
   in the main README and at http://localhost:8000/docs.
4. Run the frontend dev server:

```bash
npm install
npm run dev
```

The React app will now talk to your local FastAPI backend.

---

## Option B — Use the API Explorer directly

FastAPI ships a fully interactive API explorer at:

```
http://localhost:8000/docs
```

You can create, update, and query all entries, reflections, settings, and
analytics directly from the browser without any separate frontend.

This is the fastest way to import data and verify the backend is working
correctly before wiring up a UI.

---

## Option C — Simple standalone HTML/JS UI

A lightweight single-file UI can be built by creating `frontend/index.html`
with standard fetch calls to the API. Serve it with:

```bash
python -m http.server 3000 --directory frontend
```

Then visit http://localhost:3000.

> Make sure the backend is running before opening the page.
> CORS is enabled for all origins so the browser fetch calls will work.
