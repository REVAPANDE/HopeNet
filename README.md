# HopeNet

HopeNet is a full-stack disaster response coordination platform designed for hackathons and production-minded demos. It combines real-time volunteer allocation, what-if simulation, explainable assignment reasoning, fairness-aware workload balancing, and Google Cloud integration points for Firestore, Gemini, and Vertex AI.

## Stack

- Frontend: React + TypeScript + Vite + Leaflet
- Backend: FastAPI + Pydantic
- Data: Firestore with in-memory fallback for local development
- AI: Gemini for explanations, Vertex AI for priority scoring
- Deployment: Cloud Run ready

## Local Run

### One Command on Windows

From the project root:

```powershell
.\start-hopenet.ps1 -Install
```

Use that the first time to create the Python virtual environment and install frontend/backend dependencies.

After that, start both apps with:

```powershell
.\start-hopenet.ps1
```

This opens two PowerShell windows, one for FastAPI and one for Vite.

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment

- `GOOGLE_CLOUD_PROJECT`
- `FIRESTORE_COLLECTION_PREFIX` optional
- `GEMINI_API_KEY`
- `GEMINI_MODEL` optional, defaults to `gemini-1.5-flash`
- `GEMINI_USE_VERTEXAI` set to `true` if you want Gemini through Vertex AI auth
- `VERTEX_PROJECT_ID`
- `VERTEX_LOCATION` optional, defaults to `us-central1`
- `VERTEX_ENDPOINT_ID` optional for deployed custom endpoint
- `VERTEX_USE_LOCAL_MODEL` set to `true` to use the trained local demo model before deploying an endpoint

The backend runs fully in fallback mode if these are not set.

Frontend environment:

- `VITE_API_BASE` defaults to `http://127.0.0.1:8000/api`

## Gemini Explainability

The explainability endpoint is already wired in [gemini.py](C:/Users/RAMBO/Downloads/my_folder/backend/app/services/gemini.py). You can use either:

- Gemini Developer API: set `GEMINI_API_KEY`
- Gemini on Vertex AI: set `GEMINI_USE_VERTEXAI=true`, `VERTEX_PROJECT_ID`, and `VERTEX_LOCATION`

When the user clicks "Why this assignment?" in the frontend, the app calls `/api/allocation/explain` and Gemini returns a natural-language explanation using proximity, skill match, urgency, and fairness context.

## Vertex AI Priority Scoring

The scoring service in [vertex.py](C:/Users/RAMBO/Downloads/my_folder/backend/app/services/vertex.py) now supports three modes:

- Vertex AI online prediction endpoint if `VERTEX_ENDPOINT_ID` is configured
- Local trained model if `VERTEX_USE_LOCAL_MODEL=true`
- Heuristic fallback if neither is available

### Train the demo model locally

```bash
cd backend
.venv\Scripts\activate
python ml\train_priority_model.py
```

That trains on [priority_training_data.csv](C:/Users/RAMBO/Downloads/my_folder/backend/ml/data/priority_training_data.csv) and saves a model to `backend/ml/artifacts/priority_model.joblib`.

### Use the local trained model

Set this in [backend/.env](C:/Users/RAMBO/Downloads/my_folder/backend/.env):

```env
VERTEX_USE_LOCAL_MODEL=true
```

### Move it to Vertex AI

Recommended production flow:

1. Train your regression model on disaster task history using `task_type`, `people_affected`, `severity`, and `deadline_minutes`.
2. Upload the trained model artifact to Vertex AI Model Registry.
3. Deploy it to a Vertex AI endpoint using the prebuilt scikit-learn prediction container.
4. Put the endpoint ID into `VERTEX_ENDPOINT_ID`.

You can do that with:

```powershell
.\scripts\deploy-vertex-priority.ps1 -ProjectId YOUR_PROJECT_ID
```

After deployment, set these in [backend/.env](C:/Users/RAMBO/Downloads/my_folder/backend/.env):

```env
VERTEX_PROJECT_ID=YOUR_PROJECT_ID
VERTEX_LOCATION=us-central1
VERTEX_ENDPOINT_ID=YOUR_VERTEX_ENDPOINT_ID
GEMINI_USE_VERTEXAI=true
```

Official references:

- [Vertex AI training methods](https://cloud.google.com/vertex-ai/docs/start/training-methods)
- [Vertex AI Gemini SDK overview](https://cloud.google.com/vertex-ai/docs/generative-ai/multimodal/sdk-for-gemini/gemini-sdk-overview-reference)

## Cloud Run Deployment

### Enable APIs

```powershell
.\scripts\enable-gcp-services.ps1 -ProjectId YOUR_PROJECT_ID
```

### Backend

```bash
.\scripts\deploy-backend.ps1 -ProjectId YOUR_PROJECT_ID
```

### Frontend

```bash
.\scripts\deploy-frontend.ps1 -ProjectId YOUR_PROJECT_ID -ApiBase https://YOUR_BACKEND_URL/api
```

## Core Features

- Adaptive volunteer allocation using urgency queues and dynamic re-matching
- Fairness-aware workload balancing to avoid overloading repeat responders
- What-if simulator for volunteer dropout and demand spikes
- Explainable assignments using assignment factors and Gemini enhancement
- Vertex AI priority hook with deterministic fallback scoring
- Map-driven operational dashboard
