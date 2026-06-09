import os
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from passlib.context import CryptContext
from typing import Optional
import json

router = APIRouter(prefix="/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# Simple JSON-based database for hackathon (replaces a full SQL setup)
DB_PATH = "users.json"

class User(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None

class UserInDB(User):
    hashed_password: str

def load_users():
    if not os.path.exists(DB_PATH):
        return {}
    with open(DB_PATH, "r") as f:
        return json.load(f)

def save_users(users):
    with open(DB_PATH, "w") as f:
        json.dump(users, f)

@router.post("/signup")
async def signup(user: User):
    users = load_users()
    if user.username in users:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = pwd_context.hash(user.password)
    users[user.username] = {
        "username": user.username,
        "hashed_password": hashed_password,
        "full_name": user.full_name
    }
    save_users(users)
    return {"message": "User created successfully"}

@router.post("/signin")
async def signin(user: User):
    users = load_users()
    if user.username not in users:
        raise HTTPException(status_code=400, detail="Invalid username or password")
    
    db_user = users[user.username]
    if not pwd_context.verify(user.password, db_user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Invalid username or password")
    
    return {
        "username": user.username,
        "full_name": db_user.get("full_name"),
        "status": "authenticated"
    }
