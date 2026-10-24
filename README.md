# Hệ thống Booking Tour / Du lịch

**Sinh viên thực hiện:** Tống Thị Quỳnh Nga
**Mã số sinh viên:** Dtc245200179

## Hướng dẫn chạy hệ thống
1. Cài đặt Docker Desktop và Docker Compose.
2. Sao chép `.env.example` thành `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
3. Mở `.env`, thay các giá trị mẫu bằng credentials riêng trên máy/môi trường của bạn.
4. Khởi động các dịch vụ:
   ```powershell
   docker compose up -d --build
   ```

`.env` chứa cấu hình riêng, đã được `.gitignore` loại khỏi Git. Chỉ commit `.env.example`; không commit hoặc gửi `.env`. Các giá trị mẫu trong `.env.example` không phải thông tin đăng nhập production. Nếu để `AUTH_TOKEN_SECRET` trống, API tự tạo khóa ký và lưu vào PostgreSQL; nếu tự đặt khóa, cần giữ nguyên giá trị giữa các lần khởi động.

## Địa chỉ truy cập localhost
- Frontend trực tiếp: http://localhost:3000
- Frontend qua Nginx: http://localhost:3333
- Backend API: http://localhost:8000
- API health qua Nginx: http://localhost:3333/api/health

# Hệ thống Booking Tour - Triển khai với Docker & CI/CD

**Sinh viên thực hiện:** Tống Thị Quỳnh Nga
**Mã sinh viên:** Dtc245200179

## 1. Giới thiệu dự án
Dự án Hệ thống Booking Tour được triển khai theo kiến trúc Microservices, sử dụng Docker Compose để đóng gói và quản lý toàn bộ các dịch vụ. Hệ thống bao gồm Frontend, Backend, Database và cụm dịch vụ Giám sát (Monitoring/Logging).

## 2. Kiến trúc công nghệ
*   **Frontend:** Next.js (React)
*   **Backend:** Python FastAPI
*   **Database:** PostgreSQL & pgAdmin4
*   **Reverse Proxy:** Nginx (Cấu hình bảo mật Security Headers)
*   **Monitoring (Metrics):** Prometheus & Grafana
*   **Logging:** Loki & Promtail

## 3. Danh sách Cổng (Ports) truy cập
Hệ thống sử dụng mạng Docker Network khép kín. Dưới đây là các cổng được mở ra máy host để truy cập:

| Dịch vụ | Truy cập nội bộ (Container) | Truy cập bên ngoài (Host) | URL Kiểm tra |
| :--- | :--- | :--- | :--- |
| **Nginx (Web & API)** | 80 | **3333** | `http://127.0.0.1:3333` |
| **pgAdmin4** | 8080 | **5050** | `http://127.0.0.1:5050` |
| **Grafana** | 3000 | **3001** | `http://127.0.0.1:3001` |
| **Prometheus** | 9090 | **9090** | `http://127.0.0.1:9090` |
| **Loki** | 3100 | **3100** | `http://127.0.0.1:3100` |

Đăng nhập pgAdmin bằng `PGADMIN_DEFAULT_EMAIL` và `PGADMIN_DEFAULT_PASSWORD` trong `.env`. Chọn **Add New Server**, đặt tên tùy ý; ở tab **Connection** nhập Host `db`, Port `5432`, Maintenance database theo `POSTGRES_DB`, Username theo `POSTGRES_USER` và Password theo `POSTGRES_PASSWORD`.

## 4. Hướng dẫn chạy dự án
**Bước 1:** Clone mã nguồn về máy.
**Bước 2:** Mở Terminal/PowerShell tại thư mục gốc của dự án.
**Bước 3:** Sao chép `.env.example` thành `.env` bằng `Copy-Item .env.example .env`, sau đó thay các giá trị mẫu trong `.env`.
**Bước 4:** Chạy lệnh sau để khởi tạo toàn bộ hệ thống:
```bash
docker compose up -d --build
```

## 5. Tài khoản, dữ liệu và API nghiệp vụ

Khi API khởi động lần đầu, SQLAlchemy tạo các bảng `users`, `tours`, `bookings`, `favorites` và `app_settings` trong PostgreSQL, đồng thời thêm dữ liệu tour mẫu và hai tài khoản dùng để chạy thử. Khóa ký token được lưu trong `app_settings` để phiên đăng nhập không bị mất khi API khởi động lại; có thể cung cấp `AUTH_TOKEN_SECRET` qua môi trường để tự quản lý khóa:

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Quản trị viên | `admin@gmail.com` | `123456` |
| Khách hàng | `khach@gmail.com` | `123456` |

Mật khẩu được lưu dưới dạng PBKDF2 hash. Đăng nhập trả về bearer token có thời hạn 12 giờ; frontend giữ token trong session hiện tại. Tài khoản đăng ký mới luôn có vai trò khách hàng.

Các API chính (mở `http://localhost:8000/docs` để xem đầy đủ request/response):

| Phương thức | Đường dẫn | Quyền |
| --- | --- | --- |
| `POST` | `/auth/register`, `/auth/login` | Công khai |
| `GET` | `/auth/me`, `/customers/me` | Đã đăng nhập |
| `GET` | `/tours` | Công khai, chỉ tour đang mở |
| `GET`, `POST` | `/admin/tours` | Quản trị viên |
| `PUT`, `DELETE` | `/admin/tours/{tour_id}` | Quản trị viên |
| `GET`, `POST` | `/bookings` | Khách xem/tạo đơn của mình; admin xem tất cả |
| `PATCH` | `/bookings/{booking_code}` | Admin cập nhật trạng thái; khách hủy đơn đang chờ |
| `GET` | `/admin/customers` | Quản trị viên |
| `PUT` | `/customers/me` | Khách hàng |
| `GET` | `/favorites` | Khách hàng |
| `POST`, `DELETE` | `/favorites/{tour_id}` | Khách hàng |

Frontend gọi API qua Nginx tại `http://localhost:3333/api` hoặc trực tiếp tại `http://localhost:3000/api`. API cũng có thể kiểm tra qua `http://localhost:8000`.

### Theo dõi Prometheus

Prometheus scrape các dịch vụ nội bộ; mở `http://localhost:9090/targets` để kiểm tra trạng thái. Các target cần ở trạng thái **UP**: `prometheus`, `fastapi_app`, `postgres` và `container_exporter`.

- API tại `http://booking_api:8000/metrics`: tổng số request, độ trễ HTTP và trạng thái kết nối PostgreSQL.
- PostgreSQL exporter: số liệu kết nối và hoạt động database.
- Container exporter: CPU, bộ nhớ và lưu lượng mạng từng container của project Compose hiện tại. Exporter lấy số liệu qua Docker API proxy chỉ cho phép các endpoint đọc container; không cần cAdvisor/privileged trên Docker Desktop Windows.

Có thể kiểm tra nhanh trên Prometheus bằng các truy vấn `up`, `pg_up`, `booking_api_http_requests_total`, `booking_api_database_available`, `rate(booking_container_cpu_usage_seconds_total[5m])` và `booking_container_memory_usage_bytes`.

Grafana ở `http://localhost:3001` tự provision Prometheus datasource và dashboard **Booking Tour Monitoring** (thư mục *Dashboards*). Dashboard hiển thị target health, request rate/độ trễ API, kết nối PostgreSQL và mức dùng tài nguyên container.