import base64
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import time
from datetime import date
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
from pydantic import BaseModel, Field
from sqlalchemy import Column, Date, ForeignKey, Integer, String, Text, UniqueConstraint, create_engine, func
from sqlalchemy.engine import URL
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from starlette.responses import Response


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("booking_api")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    database_user = os.getenv("POSTGRES_USER")
    database_password = os.getenv("POSTGRES_PASSWORD")
    database_name = os.getenv("POSTGRES_DB")
    if not database_user or not database_password or not database_name:
        raise RuntimeError(
            "Set DATABASE_URL or POSTGRES_USER, POSTGRES_PASSWORD and POSTGRES_DB."
        )
    DATABASE_URL = URL.create(
        drivername="postgresql+psycopg2",
        username=database_user,
        password=database_password,
        host=os.getenv("POSTGRES_HOST", "db"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=database_name,
    )
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()
bearer_scheme = HTTPBearer(auto_error=False)

app = FastAPI(title="Booking Tour API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3333",
        "http://127.0.0.1:3333",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

http_requests_total = Counter(
    "booking_api_http_requests_total",
    "Total HTTP requests handled by the booking API.",
    ("method", "path", "status"),
)
http_request_duration_seconds = Histogram(
    "booking_api_http_request_duration_seconds",
    "HTTP request duration in seconds.",
    ("method", "path"),
)
database_available = Gauge(
    "booking_api_database_available",
    "Whether the API can connect to PostgreSQL (1=yes, 0=no).",
)


@app.middleware("http")
async def collect_http_metrics(request, call_next):
    if request.url.path == "/metrics":
        return await call_next(request)

    started_at = time.perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        path = request.scope.get("route").path if request.scope.get("route") else "unmatched"
        http_requests_total.labels(request.method, path, str(status_code)).inc()
        http_request_duration_seconds.labels(request.method, path).observe(
            time.perf_counter() - started_at
        )


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="customer")
    phone = Column(String(30), nullable=False, default="")
    created_at = Column(Date, nullable=False, default=date.today)
    bookings = relationship("Booking", back_populates="user")


class Tour(Base):
    __tablename__ = "tours"

    id = Column(Integer, primary_key=True)
    name = Column(String(180), nullable=False)
    destination = Column(String(120), nullable=False, index=True)
    duration = Column(String(80), nullable=False)
    price = Column(Integer, nullable=False)
    status = Column(String(30), nullable=False, default="Đang mở", index=True)
    image = Column(String(255), nullable=False, default="photo-1530789253388-582c481c54b0")
    description = Column(Text, nullable=False, default="")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True)
    code = Column(String(24), nullable=False, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    tour_id = Column(Integer, ForeignKey("tours.id", ondelete="SET NULL"), nullable=True)
    customer_name = Column(String(120), nullable=False)
    customer_email = Column(String(255), nullable=False)
    tour_name = Column(String(180), nullable=False)
    destination = Column(String(120), nullable=False)
    duration = Column(String(80), nullable=False)
    unit_price = Column(Integer, nullable=False)
    departure_date = Column(Date, nullable=False)
    guests = Column(Integer, nullable=False)
    total = Column(Integer, nullable=False)
    status = Column(String(30), nullable=False, default="Chờ xác nhận", index=True)
    created_at = Column(Date, nullable=False, default=date.today)
    user = relationship("User", back_populates="bookings")


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "tour_id", name="uq_user_tour_favorite"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tour_id = Column(Integer, ForeignKey("tours.id", ondelete="CASCADE"), nullable=False, index=True)


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String(80), primary_key=True)
    value = Column(Text, nullable=False)


class RegisterInput(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=6, max_length=128)


class LoginInput(BaseModel):
    email: str
    password: str


class TourInput(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    destination: str = Field(min_length=2, max_length=120)
    duration: str = Field(min_length=2, max_length=80)
    price: int = Field(ge=0)
    status: str = "Đang mở"
    image: str = Field(default="photo-1530789253388-582c481c54b0", max_length=255)
    description: str = Field(default="", max_length=2000)


class BookingInput(BaseModel):
    tour_id: int
    departure_date: date
    guests: int = Field(ge=1, le=50)


class BookingStatusInput(BaseModel):
    status: str


class ProfileInput(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(default="", max_length=30)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return "pbkdf2_sha256$310000${}${}".format(
        base64.urlsafe_b64encode(salt).decode(),
        base64.urlsafe_b64encode(digest).decode(),
    )


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, salt_value, digest_value = encoded.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.urlsafe_b64decode(salt_value.encode())
        expected = base64.urlsafe_b64decode(digest_value.encode())
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(iterations))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def encode_token(user: User) -> str:
    payload = base64.urlsafe_b64encode(
        json.dumps(
            {"sub": user.id, "exp": int(time.time()) + 60 * 60 * 12},
            separators=(",", ":"),
        ).encode()
    ).decode().rstrip("=")
    secret = app.state.token_secret
    signature = hmac.new(secret, payload.encode(), hashlib.sha256).digest()
    return f"{payload}.{base64.urlsafe_b64encode(signature).decode().rstrip('=')}"


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db=Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Vui lòng đăng nhập.")
    try:
        payload, signature = credentials.credentials.split(".", 1)
        expected = hmac.new(app.state.token_secret, payload.encode(), hashlib.sha256).digest()
        supplied = base64.urlsafe_b64decode(signature + "=" * (-len(signature) % 4))
        if not hmac.compare_digest(expected, supplied):
            raise ValueError("invalid signature")
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if int(data["exp"]) < int(time.time()):
            raise ValueError("expired token")
        user = db.query(User).filter(User.id == int(data["sub"])).first()
        if user is None:
            raise ValueError("account no longer exists")
        return user
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Phiên đăng nhập không hợp lệ hoặc đã hết hạn.")


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền thực hiện thao tác này.")
    return user


def user_data(user: User):
    return {"id": user.id, "name": user.name, "email": user.email, "phone": user.phone, "role": user.role}


def tour_data(tour: Tour):
    return {
        "id": tour.id,
        "name": tour.name,
        "destination": tour.destination,
        "duration": tour.duration,
        "price": tour.price,
        "status": tour.status,
        "image": tour.image,
        "description": tour.description,
    }


def booking_data(booking: Booking):
    return {
        "id": booking.code,
        "tourId": booking.tour_id,
        "tourName": booking.tour_name,
        "destination": booking.destination,
        "duration": booking.duration,
        "price": booking.unit_price,
        "date": booking.departure_date.strftime("%d/%m/%Y"),
        "departureDate": booking.departure_date.isoformat(),
        "guests": booking.guests,
        "total": booking.total,
        "status": booking.status,
        "createdAt": booking.created_at.isoformat(),
        "customer": booking.customer_name,
        "email": booking.customer_email,
    }


@app.on_event("startup")
def initialize_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.query(User.id).limit(1).all()
        database_available.set(1)
        configured_token_secret = os.getenv("AUTH_TOKEN_SECRET")
        if configured_token_secret:
            app.state.token_secret = configured_token_secret.encode()
        else:
            token_setting = db.query(AppSetting).filter(AppSetting.key == "token_signing_secret").first()
            if token_setting is None:
                token_setting = AppSetting(
                    key="token_signing_secret",
                    value=secrets.token_urlsafe(48),
                )
                db.add(token_setting)
                db.commit()
            app.state.token_secret = token_setting.value.encode()
        if db.query(User).filter(User.email == "admin@gmail.com").first() is None:
            db.add(User(name="Quản trị viên", email="admin@gmail.com", password_hash=hash_password("123456"), role="admin"))
        if db.query(User).filter(User.email == "khach@gmail.com").first() is None:
            db.add(User(name="Khách hàng", email="khach@gmail.com", password_hash=hash_password("123456"), role="customer"))
        if db.query(Tour).count() == 0:
            db.add_all(
                [
                    Tour(name="Khám phá Vịnh Hạ Long", destination="Hạ Long", duration="3 ngày 2 đêm", price=3290000, status="Đang mở", image="photo-1528127269322-539801943592", description="Du thuyền giữa kỳ quan thiên nhiên, khám phá hang động và làng chài trên vịnh."),
                    Tour(name="Phố cổ Hội An bình yên", destination="Hội An", duration="2 ngày 1 đêm", price=1890000, status="Đang mở", image="photo-1559592413-7cec4d0cae2b", description="Dạo bước phố đèn lồng, thưởng thức ẩm thực địa phương và trải nghiệm thả hoa đăng."),
                    Tour(name="Nghỉ dưỡng đảo Phú Quốc", destination="Phú Quốc", duration="4 ngày 3 đêm", price=5490000, status="Đang mở", image="photo-1510414842594-a61c69b5ae57", description="Tận hưởng biển xanh, cát trắng, hoàng hôn tuyệt đẹp và những trải nghiệm đảo ngọc."),
                    Tour(name="Săn mây trên đỉnh Sa Pa", destination="Sa Pa", duration="3 ngày 2 đêm", price=2790000, status="Tạm dừng", image="photo-1509316785289-025f5b846b35", description="Chạm biển mây Tây Bắc, thăm bản làng và khám phá nét đẹp văn hóa vùng cao."),
                ]
            )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to initialize booking database")
        raise
    finally:
        db.close()


@app.get("/")
def read_root():
    return {"message": "Welcome to Booking Tour API"}


@app.get("/health")
def health_check(db=Depends(get_db)):
    try:
        db.query(User.id).limit(1).all()
        database_available.set(1)
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        database_available.set(0)
        logger.exception("Database health check failed")
        raise HTTPException(status_code=503, detail="Database is unavailable.") from exc


@app.get("/metrics", include_in_schema=False)
def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(data: RegisterInput, db=Depends(get_db)):
    email = data.email.strip().lower()
    if re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) is None:
        raise HTTPException(status_code=422, detail="Email không hợp lệ.")
    if email in {"admin@gmail.com", "khach@gmail.com"} or db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email này đã được đăng ký.")
    user = User(name=data.name.strip(), email=email, password_hash=hash_password(data.password), role="customer")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_data(user)


@app.post("/auth/login")
def login(data: LoginInput, db=Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.strip().lower()).first()
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu chưa chính xác.")
    return {"access_token": encode_token(user), "token_type": "bearer", "user": user_data(user)}


@app.get("/auth/me")
def get_me(user: User = Depends(get_current_user)):
    return user_data(user)


@app.get("/tours")
def list_public_tours(db=Depends(get_db)):
    return [tour_data(tour) for tour in db.query(Tour).filter(Tour.status == "Đang mở").order_by(Tour.id).all()]


@app.get("/admin/tours")
def list_admin_tours(db=Depends(get_db), _admin: User = Depends(require_admin)):
    return [tour_data(tour) for tour in db.query(Tour).order_by(Tour.id.desc()).all()]


@app.post("/admin/tours", status_code=status.HTTP_201_CREATED)
def create_tour(data: TourInput, db=Depends(get_db), _admin: User = Depends(require_admin)):
    if data.status not in {"Đang mở", "Tạm dừng"}:
        raise HTTPException(status_code=422, detail="Trạng thái tour không hợp lệ.")
    tour = Tour(**data.dict())
    db.add(tour)
    db.commit()
    db.refresh(tour)
    return tour_data(tour)


@app.put("/admin/tours/{tour_id}")
def update_tour(tour_id: int, data: TourInput, db=Depends(get_db), _admin: User = Depends(require_admin)):
    tour = db.query(Tour).filter(Tour.id == tour_id).first()
    if tour is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tour.")
    if data.status not in {"Đang mở", "Tạm dừng"}:
        raise HTTPException(status_code=422, detail="Trạng thái tour không hợp lệ.")
    for key, value in data.dict().items():
        setattr(tour, key, value)
    db.commit()
    db.refresh(tour)
    return tour_data(tour)


@app.delete("/admin/tours/{tour_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tour(tour_id: int, db=Depends(get_db), _admin: User = Depends(require_admin)):
    tour = db.query(Tour).filter(Tour.id == tour_id).first()
    if tour is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tour.")
    db.query(Booking).filter(Booking.tour_id == tour_id).update({Booking.tour_id: None})
    db.query(Favorite).filter(Favorite.tour_id == tour_id).delete()
    db.delete(tour)
    db.commit()


@app.get("/bookings")
def list_bookings(db=Depends(get_db), user: User = Depends(get_current_user)):
    query = db.query(Booking)
    if user.role != "admin":
        query = query.filter(Booking.user_id == user.id)
    return [booking_data(item) for item in query.order_by(Booking.id.desc()).all()]


@app.post("/bookings", status_code=status.HTTP_201_CREATED)
def create_booking(data: BookingInput, db=Depends(get_db), user: User = Depends(get_current_user)):
    tour = db.query(Tour).filter(Tour.id == data.tour_id, Tour.status == "Đang mở").first()
    if tour is None:
        raise HTTPException(status_code=404, detail="Tour không tồn tại hoặc đã tạm dừng.")
    if data.departure_date < date.today():
        raise HTTPException(status_code=422, detail="Ngày khởi hành phải từ hôm nay trở đi.")
    booking = Booking(
        code=f"VV-{secrets.token_hex(3).upper()}",
        user_id=user.id,
        tour_id=tour.id,
        customer_name=user.name,
        customer_email=user.email,
        tour_name=tour.name,
        destination=tour.destination,
        duration=tour.duration,
        unit_price=tour.price,
        departure_date=data.departure_date,
        guests=data.guests,
        total=tour.price * data.guests,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking_data(booking)


@app.patch("/bookings/{booking_code}")
def update_booking(
    booking_code: str,
    data: BookingStatusInput,
    db=Depends(get_db),
    user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.code == booking_code).first()
    if booking is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy đặt chỗ.")
    if user.role == "admin":
        if data.status not in {"Chờ xác nhận", "Đã xác nhận", "Đã hủy"}:
            raise HTTPException(status_code=422, detail="Trạng thái đặt chỗ không hợp lệ.")
    elif booking.user_id == user.id and data.status == "Đã hủy" and booking.status == "Chờ xác nhận":
        pass
    else:
        raise HTTPException(status_code=403, detail="Bạn không thể cập nhật đặt chỗ này.")
    booking.status = data.status
    db.commit()
    db.refresh(booking)
    return booking_data(booking)


@app.get("/admin/customers")
def list_customers(db=Depends(get_db), _admin: User = Depends(require_admin)):
    customers = db.query(User).filter(User.role == "customer").order_by(User.id.desc()).all()
    results = []
    for customer in customers:
        count, spent = db.query(func.count(Booking.id), func.coalesce(func.sum(Booking.total), 0)).filter(
            Booking.user_id == customer.id,
            Booking.status == "Đã xác nhận",
        ).one()
        results.append(
            {
                **user_data(customer),
                "bookings": db.query(Booking).filter(Booking.user_id == customer.id).count(),
                "spent": int(spent),
                "joined": customer.created_at.strftime("%d/%m/%Y"),
            }
        )
    return results


@app.get("/customers/me")
def get_profile(user: User = Depends(get_current_user)):
    if user.role != "customer":
        raise HTTPException(status_code=403, detail="Chỉ khách hàng mới có hồ sơ cá nhân.")
    return user_data(user)


@app.put("/customers/me")
def update_profile(data: ProfileInput, db=Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "customer":
        raise HTTPException(status_code=403, detail="Chỉ khách hàng mới có hồ sơ cá nhân.")
    user.name = data.name.strip()
    user.phone = data.phone.strip()
    db.commit()
    db.refresh(user)
    return user_data(user)


@app.get("/favorites")
def list_favorites(db=Depends(get_db), user: User = Depends(get_current_user)):
    return [row[0] for row in db.query(Favorite.tour_id).filter(Favorite.user_id == user.id).all()]


@app.post("/favorites/{tour_id}", status_code=status.HTTP_204_NO_CONTENT)
def add_favorite(tour_id: int, db=Depends(get_db), user: User = Depends(get_current_user)):
    if db.query(Tour).filter(Tour.id == tour_id, Tour.status == "Đang mở").first() is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tour đang mở.")
    favorite = db.query(Favorite).filter(Favorite.user_id == user.id, Favorite.tour_id == tour_id).first()
    if favorite is None:
        db.add(Favorite(user_id=user.id, tour_id=tour_id))
        db.commit()


@app.delete("/favorites/{tour_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(tour_id: int, db=Depends(get_db), user: User = Depends(get_current_user)):
    db.query(Favorite).filter(Favorite.user_id == user.id, Favorite.tour_id == tour_id).delete()
    db.commit()
