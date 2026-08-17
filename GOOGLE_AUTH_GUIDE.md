# Google OAuth Authentication Guide

TripPlanner uses Google OAuth 2.0 to authenticate users and generate JWT tokens.
Because setting up OAuth requires configured domains and redirect URIs in the Google Cloud Console,
the app supports two modes: a mocked "local" mode for immediate development, and a "production" mode.

## 1. Local Testing (Mock Auth)

For ease of local testing without configuring Google Cloud credentials, TripPlanner includes a "Mock Auth" fallback.
If `GOOGLE_CLIENT_ID` is **not set** in your `.env`, the backend will route you to a simulated callback.

**How to test locally:**
1. Leave `GOOGLE_CLIENT_ID` empty or commented out in your `backend/.env` file.
2. Start the FastAPI backend and Vite frontend.
3. Go to the frontend (`http://localhost:5173`).
4. Click "Sign in with Google".
5. The backend will bypass the Google redirect and immediately issue a JWT token for the user `test@example.com` and redirect you to `/dashboard`.

*Note: This mock backdoor is strictly disabled if `GOOGLE_CLIENT_ID` is present, making it safe for production deployments.*

## 2. Production Setup

To enable real Google Sign-In, follow these steps:

### A. Create Google Cloud Credentials
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to **APIs & Services > Credentials**.
4. Click **Create Credentials** and choose **OAuth client ID**.
5. Set the Application type to **Web application**.
6. Under **Authorized redirect URIs**, add the exact URI where your backend will receive the callback.
   - Example for production: `https://api.yourdomain.com/api/auth/google/callback`
   - Example for local testing (if you want real auth locally): `http://localhost:8000/api/auth/google/callback`

### B. Configure Backend Environment
Edit your `backend/.env` file with the credentials provided by Google:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
JWT_SECRET=generate-a-strong-random-string-here
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080
FRONTEND_URL=https://yourdomain.com
GOOGLE_REDIRECT_URI=https://api.yourdomain.com/api/auth/google/callback
```

### C. Configure Frontend Environment
Edit your `trip-planner/.env` file:

```env
VITE_API_URL=https://api.yourdomain.com
```

### D. Restart Services
Ensure the backend is restarted so it picks up the `GOOGLE_CLIENT_ID`.
When users click "Sign in with Google", they will now be redirected to the actual Google consent screen, and upon returning, a secure JWT session will be created.