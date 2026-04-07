# HopeNet


Demo video: [Watch Demo](https://drive.google.com/file/d/1celVfqDhS_-DW5Z2yLQlKcTsq4bOLnZM/view?usp=drive_link)

HopeNet is a disaster response coordination system for matching volunteers to urgent tasks in real time. It combines assignment scoring, live event updates, explainable AI reasoning, simulation mode, and a map-based operations dashboard designed to feel like a working command center rather than a static prototype.

## What It Does

- Recomputes volunteer-to-task assignments with weighted scoring.
- Streams live system events for recomputes, priority changes, volunteer movement, and simulations.
- Shows explainable assignment reasoning with alternatives and trade-offs.
- Visualizes operations on a map with task demand zones, assignment routes, and hover tooltips.
- Supports Cloud Run deployment with Firestore-backed state.

## Tech Stack

- Frontend: React, TypeScript, Vite, Leaflet, Framer Motion
- Backend: FastAPI, Pydantic
- State: Firestore with in-memory fallback for local development
- AI: Gemini for explainability, Vertex AI-compatible priority scoring
- Deployment: Google Cloud Run, Cloud Build

## Key Features

- Real-time dashboard updates via backend event streaming.
- Recompute and update-priority actions with visible feedback.
- Dynamic scoring with realistic variation instead of flat scores.
- Explainable recommendations with alternative candidates.
- Simulation mode for volunteer dropout and demand spikes.
- Event-driven volunteer movement and automatic reassignment.

## Local Development

### One-command start on Windows

From the project root:

```powershell
.\start-hopenet.ps1 -Install
```

After dependencies are installed, start the app with:

```powershell
.\start-hopenet.ps1
```

This opens FastAPI and Vite in separate PowerShell windows.

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Environment Variables

Backend:

- `GOOGLE_CLOUD_PROJECT`
- `FIRESTORE_COLLECTION_PREFIX` optional
- `GEMINI_API_KEY`
- `GEMINI_MODEL` optional, defaults to `gemini-1.5-flash`
- `GEMINI_USE_VERTEXAI` set to `true` for Gemini on Vertex AI
- `VERTEX_PROJECT_ID`
- `VERTEX_LOCATION` optional, defaults to `us-central1`
- `VERTEX_ENDPOINT_ID` optional for deployed prediction endpoint
- `VERTEX_USE_LOCAL_MODEL` set to `true` to use the local demo model

Frontend:

- `VITE_API_BASE` defaults to `/api` in production and `http://127.0.0.1:8000/api` in local development

## Deployment

### Enable Google Cloud APIs

```powershell
.\scripts\enable-gcp-services.ps1 -ProjectId YOUR_PROJECT_ID
```

### Deploy Backend

```powershell
.\scripts\deploy-backend.ps1 -ProjectId YOUR_PROJECT_ID
```

### Deploy Frontend

```powershell
.\scripts\deploy-frontend.ps1 -ProjectId YOUR_PROJECT_ID -ApiBase https://YOUR_BACKEND_URL/api
```

## How the Scoring Works

The matching system blends distance, priority, availability, workload, and skill fit into a weighted score, then normalizes results so assignments show realistic variation. The app also exposes detailed reasoning and alternatives so the result reads like an operational recommendation rather than a black box.

## Explainability

Clicking a reasoning action in the dashboard calls the explainability endpoint and returns:

- Why the volunteer was chosen.
- Which factors helped or hurt the score.
- Other candidates that were considered and why they lost.

## Cloud Run Notes

Cloud Run is stateless, so HopeNet uses Firestore-backed collections for tasks, volunteers, assignments, events, and priority configuration. If Firestore is unavailable, the backend falls back to in-memory storage for local runs.

## Demo Flow

1. Open the live demo link.
2. Click Recompute and watch the assignment feed update.
3. Update priorities and observe changed scores.
4. Open simulation mode and compare baseline vs scenario response.
5. Inspect the reasoning panel for alternatives and trade-offs.

## Repository Layout

- `backend/` FastAPI service, Firestore integration, matching logic, and AI hooks.
- `frontend/` React dashboard, live event feed, map, and simulation UI.
- `scripts/` PowerShell deployment scripts for backend, frontend, and Google Cloud setup.
