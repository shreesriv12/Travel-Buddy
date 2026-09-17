# TravelBuddy - MCP Multi-Agent Travel Planner

TravelBuddy turns one plain-English trip request into a shared, evidence-based travel plan. It uses an MCP (Model Context Protocol) server to coordinate specialist agents for flights, hotels, destination news, attraction reviews, routes, budgets, events, and itineraries.

The project was built for the SerpApi Travel & Local Discovery track. SerpApi provides the live search layer for flights, hotels, news, Google Maps places, and visitor reviews.

## What it does

- Create and save trips with authentication, dates, traveler count, origin, destination, and budget.
- Search live flight and hotel options using SerpApi.
- Search current destination news using SerpApi Google News.
- Find attractions, ratings, and visitor review excerpts using SerpApi Google Maps and Google Maps Reviews.
- Calculate and draw an Amazon Location driving route in the trip UI.
- Find live local events with Ticketmaster when a key is configured.
- Build a budget from returned flight and hotel data.
- Generate a day-by-day itinerary with Groq.
- Show the result of every MCP tool in the WEBSTER-style roundtable.
- Send optional email itineraries and support Google Calendar sync.
- Store notifications and emit `trip:alert` Socket.IO events when planning completes.
- Use a Bull/Redis queue for durable alert retries when `REDIS_URL` is configured.
- Learn from positive trip feedback tags to influence future itineraries.

## Architecture

```text
Next.js dashboard
        |
Express API + PostgreSQL/Prisma
        |
MCP orchestrator -> MCP stdio server
        |
weather | flights | trains | hotels | news | reviews | budget | events | itinerary | maps
        |
SerpApi | Amazon Location | Ticketmaster | Groq | SMTP | Redis (optional)
```

Important: MCP is the agent communication layer. It does not itself supply travel data; each tool calls an appropriate provider and saves its result to PostgreSQL.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, Leaflet |
| Backend | Node.js, Express, Prisma, PostgreSQL |
| Agent protocol | Model Context Protocol SDK over stdio |
| AI | Groq OpenAI-compatible API |
| Live travel data | SerpApi, Amazon Location, Ticketmaster |
| Background/realtime | Socket.IO, Bull, Redis (optional) |

## Repository layout

```text
Travel-Buddy/
  frontend/                     Next.js dashboard
  backend/
    prisma/                     Prisma schema and migrations
    src/agents/                 MCP specialist agents
    src/mcp/                    MCP server and client
    src/controllers/            Express request handlers
    src/routes/                 REST routes
    src/services/               email, queue, realtime, and alerts
```

## Prerequisites

- Node.js 20+ (Node 22 is supported)
- npm
- PostgreSQL 14+
- A SerpApi key for live flight, hotel, news, maps, and review data

Optional: Groq API key, Amazon Location API key, Ticketmaster API key, SMTP credentials, Redis, and Google OAuth credentials.

## Installation

Clone the public repository and install both applications:

```powershell
git clone https://github.com/YOUR_USERNAME/Travel-Buddy.git
cd Travel-Buddy

cd backend
npm install

cd ..\frontend
npm install
```

The frontend calendar route imports `googleapis`. If `npm run build` reports that module missing, install it in the frontend:

```powershell
npm install googleapis
```

## Environment configuration

Never commit `.env` files or real API keys. Copy the following templates and replace every placeholder locally.

### `backend/.env`

```env
PORT=5000
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/travelbuddy?schema=public"
JWT_SECRET="generate-a-long-random-secret"
JWT_EXPIRES_IN=1d

# Required for the core live-data demo
SERPAPI_KEY="your_serpapi_key"
GROQ_API_KEY="your_groq_key"
GROQ_MODEL="openai/gpt-oss-20b"
GEOAPIFY_API_KEY="your_geoapify_key"

# Amazon Location route calculation
AMAZON_LOCATION_API_KEY="your_aws_location_api_key"
AWS_REGION="us-east-1"
AMAZON_LOCATION_MAP_STYLE="Standard"

# Optional live events
TICKETMASTER_API_KEY="your_ticketmaster_key"

# Optional email; Gmail requires an app password
EMAIL_USER="you@example.com"
EMAIL_PASS="your_email_app_password"
# Or generic SMTP:
# SMTP_HOST="smtp.example.com"
# SMTP_PORT=587
# SMTP_USER="your_user"
# SMTP_PASS="your_password"
# SMTP_SECURE=false
# EMAIL_FROM="TravelBuddy <you@example.com>"

# Optional durable Bull queue. Without this, alerts are delivered immediately
# but are not persisted in a Redis retry queue.
# REDIS_URL="redis://127.0.0.1:6379"

# Optional Google Calendar integration
# GOOGLE_CLIENT_ID="..."
# GOOGLE_CLIENT_SECRET="..."
# GOOGLE_REDIRECT_URI="http://localhost:3000/auth/google/callback"
```

### `frontend/.env`

```env
NEXT_PUBLIC_AWS_LOCATION_API_KEY="your_aws_location_api_key"
NEXT_PUBLIC_AWS_REGION="us-east-1"
NEXT_PUBLIC_AMAZON_LOCATION_MAP_STYLE="Standard"

# Required only for Google Calendar / NextAuth features
# GOOGLE_CLIENT_ID="..."
# GOOGLE_CLIENT_SECRET="..."
# NEXTAUTH_SECRET="generate-a-long-random-secret"
```

Do not put `SERPAPI_KEY`, `GROQ_API_KEY`, database passwords, or SMTP passwords in frontend environment variables.

## Database setup

Create the database first:

```sql
CREATE DATABASE travelbuddy;
```

Then, from `backend/`, apply committed migrations and generate Prisma Client:

```powershell
npx prisma migrate deploy
npx prisma generate
```

For local schema experimentation only, use `npx prisma migrate dev --name your_change` to create a new migration. Do not use `prisma migrate reset` unless you deliberately want to erase all local data.

If Prisma reports `EPERM` while generating, stop the running backend first with `Ctrl + C`; Windows locks Prisma's query engine while Node is running.

## Run locally

Open two terminals.

Terminal 1 - backend:

```powershell
cd Travel-Buddy\backend
npm run dev
```

Terminal 2 - frontend:

```powershell
cd Travel-Buddy\frontend
npm run dev
```

Open the frontend URL printed by Next.js. It normally uses `http://localhost:3000`, but may choose 3001, 3002, or 3003 when another port is already occupied. The backend runs at `http://localhost:5000`.

If Next.js reports missing `.next` manifest files, stop the frontend and clear only its generated cache:

```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

## Optional Redis and real-time alerts

Socket.IO is enabled whenever the backend runs. Connect a client using its logged-in JWT as `auth.token` and listen for:

```js
socket.on('trip:alert', (notification) => console.log(notification));
```

For Bull retries and durable queued alerts, run Redis and set `REDIS_URL`:

```powershell
docker run --name travelbuddy-redis -p 6379:6379 redis:7-alpine
```

Then add `REDIS_URL=redis://127.0.0.1:6379` to `backend/.env` and restart the backend.

## MCP tools

| Tool | Provider / role |
| --- | --- |
| `weatherAgent` | Groq planning guidance; not a live forecast provider |
| `flightAgent` | SerpApi live flight search |
| `trainAgent` | Groq planning suggestions; not live rail inventory |
| `hotelsAgent` | SerpApi live hotel search |
| `newsAgent` | SerpApi Google News |
| `reviewsAgent` | SerpApi Google Maps + Google Maps Reviews |
| `budgetAgent` | Calculates from available trip results |
| `eventsAgent` | Ticketmaster event discovery |
| `itineraryAgent` | Groq itinerary generation, informed by feedback |
| `mapsTool` | Amazon Location Routes v2 |

The MCP server is `backend/src/mcp/travelMcpServer.js`. The orchestrator starts it through `backend/src/mcp/travelMcpClient.js`, calls tools sequentially, records agent tasks, and produces the roundtable summary.

## API highlights

All protected endpoints require `Authorization: Bearer YOUR_JWT`.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/register` | Create an account |
| `POST /api/auth/login` | Log in and obtain a JWT |
| `POST /api/agents/run` | Create a trip and run the MCP workflow. Body: `{ "prompt": "..." }` |
| `GET /api/trips/:id/summary` | Full trip summary |
| `GET /api/trips/:id/flights` | Flight results |
| `GET /api/trips/:id/hotels` | Hotel results |
| `GET /api/trips/:id/news` | Destination news |
| `GET /api/trips/:id/reviews` | SerpApi attraction reviews |
| `GET /api/trips/:id/routes` | Saved Amazon Location route geometry |
| `GET /api/notifications` | Persisted alerts |
| `POST /api/trips/:id/feedback` | Save feedback for future itinerary preferences |

Feedback body example:

```json
{
  "rating": 5,
  "likedTags": ["beaches", "local food", "nature"],
  "notes": "Prefer relaxed days and sunset activities."
}
```

## Demo prompt

```text
Plan a 4-day trip for 2 adults from Mumbai to Goa from 10 October 2026 to 14 October 2026 with a budget of INR 40,000. Find flight and hotel options, top attractions with visitor reviews, current Goa travel news, local events, a driving route, and create a relaxed beach-focused daily itinerary.
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Browser CORS error | Ensure the frontend port is one of 3000-3003 and restart the backend. |
| `model_not_found` from Groq | Set a model available to your Groq account in `GROQ_MODEL`. |
| SerpApi key error | Regenerate or correct `SERPAPI_KEY`; do not log or commit it. |
| Amazon Location `403` | Ensure the API key grants Places/Routes actions in the selected AWS region. |
| No review results | The destination may not return Google Maps listings with a usable `data_id`; try a larger city or another trip. |
| `EPERM` from Prisma | Stop the backend, then rerun `npx prisma generate`. |
| Next.js 500 after changes | Stop the frontend, delete `frontend/.next`, and rerun `npm run dev`. |

## Security checklist

- Keep `.env` private and out of Git.
- Regenerate any key that has ever been pasted into chat, terminal output, a commit, or a screenshot.
- Never expose backend provider keys through `NEXT_PUBLIC_*` variables.
- Before submitting to a hackathon, test the public GitHub repository and demo video in an incognito window.
