# 🚀 FitTrack Full-Stack Deployment Guide

This guide walks you through deploying **FitTrack**:
- **Backend (FastAPI)** on [Render](https://render.com) (or [Railway](https://railway.app))
- **Frontend (Angular)** on [Vercel](https://vercel.com)

---

## Part 1: Deploy Backend to Render (2 Minutes)

1. Go to **[render.com](https://render.com)** and sign in with your GitHub account.
2. Click **New +** → **Web Service**.
3. Select your repository: **`aslahkp01/fittrack`**.
4. Configure the settings:
   - **Name**: `fittrack-backend` (or any preferred name)
   - **Region**: Closest to your users (e.g. Frankfurt, Singapore, Oregon)
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`
5. Click **Create Web Service**.
6. Once deployed, Render will generate a public URL (e.g., `https://fittrack-backend.onrender.com`).
   - Test it by opening `https://fittrack-backend.onrender.com/docs` in your browser.

---

## Part 2: Deploy Frontend to Vercel (2 Minutes)

1. Go to **[vercel.com](https://vercel.com)** and log in with your GitHub account.
2. Click **Add New...** → **Project**.
3. Select and import **`aslahkp01/fittrack`**.
4. In the Project Configuration:
   - **Root Directory**: Click **Edit** and select `frontend`.
   - **Framework Preset**: `Angular`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/frontend/browser`
5. (Optional) Set Environment Variable:
   - If your Render backend URL is `https://fittrack-backend.onrender.com`, add:
     - **Key**: `API_URL`
     - **Value**: `https://fittrack-backend.onrender.com/api`
6. Click **Deploy**.
7. Vercel will build and deploy your application to a live `.vercel.app` domain.

---

## Part 3: Alternative Backend on Railway (Optional)

1. Go to **[railway.app](https://railway.app)** and click **New Project** → **Deploy from GitHub repo**.
2. Select **`aslahkp01/fittrack`**.
3. In service settings, set **Root Directory** to `/backend`.
4. Railway automatically detects `requirements.txt` and `Procfile` and assigns a public domain under **Networking**.
