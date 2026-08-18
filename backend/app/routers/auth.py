import os
from datetime import datetime, timedelta
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth

from ..database import get_db
from .. import models
from ..dependencies import get_current_user

router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-change-in-prod")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "10080")) # 7 days
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")

oauth = OAuth()
oauth.register(
    name='google',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

@router.get("/google/url")
async def google_login(request: Request):
    if not GOOGLE_CLIENT_ID:
        # Mock login for testing without credentials
        return {"url": f"{FRONTEND_URL}/api/auth/google/callback?mock=true"}
    redirect_uri = GOOGLE_REDIRECT_URI
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_auth_callback(request: Request, db: Session = Depends(get_db)):
    if request.query_params.get("mock"):
         # Mock flow
         user_info = {
             "sub": "test-mock-sub",
             "email": "test@example.com",
             "name": "Test User",
             "picture": ""
         }
    else:
        try:
            token = await oauth.google.authorize_access_token(request)
            user_info = token.get('userinfo')
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    if not user_info:
        raise HTTPException(status_code=400, detail="Failed to fetch user info")

    google_sub = user_info.get("sub")
    email = user_info.get("email")
    name = user_info.get("name")
    picture_url = user_info.get("picture")

    user = db.query(models.User).filter(models.User.google_sub == google_sub).first()
    if not user:
        # Try falling back to email lookup
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            user.google_sub = google_sub
            user.name = name
            user.picture_url = picture_url
        else:
            user = models.User(
                email=email,
                google_sub=google_sub,
                name=name,
                picture_url=picture_url
            )
            db.add(user)
    else:
         # Update existing
         user.name = name
         user.picture_url = picture_url

    db.commit()
    db.refresh(user)

    # Generate JWT token
    access_token_expires = timedelta(minutes=JWT_EXPIRE_MINUTES)
    expire = datetime.utcnow() + access_token_expires
    to_encode = {"sub": user.id, "exp": expire}
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

    # Redirect to frontend with token
    redirect_url = f"{FRONTEND_URL}/dashboard?token={encoded_jwt}"
    return RedirectResponse(url=redirect_url)


@router.get("/me")
async def get_current_user_profile(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "picture_url": current_user.picture_url
    }
