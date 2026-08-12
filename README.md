# Pantry & Plan

A small meal-planning app:

- **Home (`/`)** — browse meals grouped by category, tap to select the ones you want this week, view each recipe/ingredients inline, then generate a combined shopping list ("The Ticket").
- **Admin (`/admin`)** — add, edit, and delete meals: name, category, description, ingredients (qty + unit + name), and free-text recipe instructions. Not linked from the UI anywhere — it's a "hidden" route, so only people who know the URL will find it. There's no login, so anyone with the link can edit — fine for household use, but don't share the `/admin` URL widely.

Built as a single Node/Express service that serves a React (Vite) frontend and a small JSON API, backed by SQLite. One service, one deploy.

## Run locally

Requires Node 18+.

```bash
# install server deps
npm install

# install + run the client in dev mode (in one terminal)
cd client && npm install && npm run dev

# in another terminal, run the API server
cd .. && npm start
```

The Vite dev server (usually `http://localhost:5173`) proxies `/api` requests to the Express server on port 3000, so open the Vite URL while developing.

For a production-style run locally:

```bash
npm run build   # builds client into client/dist
npm start       # serves the API + the built client from one process on port 3000
```

## Deploying to Render

This repo includes a `render.yaml` blueprint, so the easiest path is:

1. Push this project to a GitHub repo.
2. In Render, choose **New > Blueprint** and point it at the repo. Render will read `render.yaml` and set up the service automatically.
3. Deploy. Render runs `npm run build` then `npm start`.

### About the database and Render's free tier — read this

This app stores everything in a SQLite file. SQLite needs a real, persistent disk to survive — and **Render's free web services do not support persistent disks**, and their free Postgres databases auto-delete after 30 days. On the free tier, every redeploy (and possibly every restart after the service spins down from inactivity) would wipe your meals.

`render.yaml` is set up for Render's **Starter** plan (~$7/month) with a small 1&nbsp;GB persistent disk (~$0.25/month) mounted at `/data`, which is enough for thousands of meals. That combination keeps your data safe across deploys and restarts, and the service won't spin down.

If you'd rather stay on the free tier and accept that you may need to re-enter your meals occasionally, you can:
- Remove the `disk:` block and change `plan: starter` to `plan: free` in `render.yaml`, or
- Set them directly in the Render dashboard when creating the service manually instead of using the blueprint.

Either way, once it's deployed, open `https://your-service.onrender.com/admin` on your phone or laptop to add your first meals, then share the base URL with your household for everyday use.

## How the shopping list is built

When you select meals and tap "Build shopping list," the server pulls each meal's ingredient list and combines them: ingredients with the same name and unit (case-insensitive) have their quantities summed; anything with a different or missing unit is kept as its own line. Each line also shows which meals it came from.
