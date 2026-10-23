from fastapi import FastAPI
from sqlalchemy import create_engine
import os

app = FastAPI(title="Booking Tour API")

# Lấy thông tin kết nối DB từ biến môi trường (trong docker-compose)
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://admin:StrongAdminPassword2026!@db:5432/booking_tour"
)

engine = create_engine(DATABASE_URL)

@app.get("/")
def read_root():
    return {"message": "Welcome to Booking Tour API"}

@app.get("/health")
def health_check():
    try:
        # Test kết nối database
        with engine.connect() as connection:
            return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}