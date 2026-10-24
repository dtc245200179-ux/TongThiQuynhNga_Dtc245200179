"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, clearSession } from "../lib/api";

const navigation = [
  { id: "overview", label: "Tổng quan", icon: "▦" },
  { id: "tours", label: "Quản lý tour", icon: "✈" },
  { id: "bookings", label: "Đặt chỗ", icon: "▤" },
  { id: "customers", label: "Khách hàng", icon: "♙" },
];

const emptyTour = { name: "", destination: "", duration: "", price: "", status: "Đang mở", image: "photo-1530789253388-582c481c54b0", description: "" };

function formatPrice(price) {
  return `${Number(price).toLocaleString("vi-VN")} đ`;
}

function PageTitle({ eyebrow, title, description, action }) {
  return (
    <div className="admin-page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="admin-page-description">{description}</p>
      </div>
      {action}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [activeView, setActiveView] = useState("overview");
  const [tours, setTours] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tất cả trạng thái");
  const [form, setForm] = useState(emptyTour);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function loadAdminData() {
      try {
        const user = await apiRequest("/auth/me");
        if (user.role !== "admin") {
          router.replace("/");
          return;
        }
        if (active) {
          setAdminEmail(user.email);
          setAuthorized(true);
        }
        const [tourData, bookingData, customerData] = await Promise.all([
          apiRequest("/admin/tours"),
          apiRequest("/bookings"),
          apiRequest("/admin/customers"),
        ]);
        if (!active) return;
        setTours(tourData);
        setBookings(bookingData.map((booking) => ({ ...booking, tour: booking.tourName, date: booking.date || booking.departureDate })));
        setCustomers(customerData);
      } catch (error) {
        if (active) {
          setMessage(`Không thể tải dữ liệu quản trị: ${error.message}`);
          if (window.sessionStorage.getItem("vi-vu-token") === null) router.replace("/");
        }
      } finally {
        if (active) setReady(true);
      }
    }
    loadAdminData();
    return () => { active = false; };
  }, [router]);

  const filteredTours = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return tours.filter((tour) => {
      const matchesQuery = `${tour.name} ${tour.destination}`.toLocaleLowerCase("vi").includes(query);
      const matchesStatus = statusFilter === "Tất cả trạng thái" || tour.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [tours, search, statusFilter]);

  const filteredBookings = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return bookings.filter((booking) => {
      const matchesQuery = `${booking.id} ${booking.customer} ${booking.tour}`.toLocaleLowerCase("vi").includes(query);
      const matchesStatus = statusFilter === "Tất cả trạng thái" || booking.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [bookings, search, statusFilter]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return customers.filter((customer) => (
      `${customer.name} ${customer.email} ${customer.phone}`.toLocaleLowerCase("vi").includes(query)
    ));
  }, [customers, search]);

  function changeView(view) {
    setActiveView(view);
    setSearch("");
    setStatusFilter("Tất cả trạng thái");
    setMessage("");
  }

  function startNewTour() {
    setForm(emptyTour);
    setEditingId(null);
    setMessage("");
    setShowForm(true);
  }

  function startEditing(tour) {
    setForm({ ...tour, price: String(tour.price) });
    setEditingId(tour.id);
    setMessage("");
    setShowForm(true);
  }

  async function saveTour(event) {
    event.preventDefault();
    const payload = { ...form, price: Number(form.price) };
    try {
      const savedTour = editingId !== null
        ? await apiRequest(`/admin/tours/${editingId}`, { method: "PUT", body: JSON.stringify(payload) })
        : await apiRequest("/admin/tours", { method: "POST", body: JSON.stringify(payload) });
      setTours((current) => editingId !== null
        ? current.map((item) => item.id === editingId ? savedTour : item)
        : [savedTour, ...current]);
      setMessage(editingId !== null ? "Đã cập nhật thông tin tour." : "Đã thêm tour mới.");
      setShowForm(false);
      setEditingId(null);
      setForm(emptyTour);
    } catch (error) {
      setMessage(`Không thể lưu tour: ${error.message}`);
    }
  }

  async function deleteTour(id) {
    if (!window.confirm("Bạn có chắc muốn xóa tour này?")) return;
    try {
      await apiRequest(`/admin/tours/${id}`, { method: "DELETE" });
      setTours((current) => current.filter((tour) => tour.id !== id));
      setMessage("Đã xóa tour.");
    } catch (error) {
      setMessage(`Không thể xóa tour: ${error.message}`);
    }
  }

  async function toggleTourStatus(tour) {
    const nextStatus = tour.status === "Đang mở" ? "Tạm dừng" : "Đang mở";
    try {
      const updated = await apiRequest(`/admin/tours/${tour.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...tour, status: nextStatus }),
      });
      setTours((current) => current.map((item) => item.id === tour.id ? updated : item));
      setMessage(`Đã ${nextStatus === "Đang mở" ? "mở bán" : "tạm dừng"} tour.`);
    } catch (error) {
      setMessage(`Không thể cập nhật tour: ${error.message}`);
    }
  }

  async function updateBookingStatus(id, status) {
    try {
      const updated = await apiRequest(`/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setBookings((current) => current.map((booking) => booking.id === id
        ? { ...updated, tour: updated.tourName, date: updated.date || updated.departureDate }
        : booking));
      setMessage(`Đã cập nhật trạng thái đặt chỗ ${id}.`);
    } catch (error) {
      setMessage(`Không thể cập nhật đặt chỗ: ${error.message}`);
    }
  }

  function logout() {
    clearSession();
    window.location.assign("/");
  }

  function renderOverview() {
    const openTours = tours.filter((tour) => tour.status === "Đang mở").length;
    const pendingBookings = bookings.filter((booking) => booking.status === "Chờ xác nhận").length;
    const revenue = bookings
      .filter((booking) => booking.status === "Đã xác nhận")
      .reduce((total, booking) => total + booking.total, 0);
    const bars = [
      { month: "T5", value: 42 },
      { month: "T6", value: 58 },
      { month: "T7", value: 51 },
      { month: "T8", value: 76 },
      { month: "T9", value: 64 },
      { month: "T10", value: 91 },
    ];

    return (
      <>
        <PageTitle
          eyebrow="BẢNG ĐIỀU KHIỂN"
          title="Tổng quan"
          description="Theo dõi tình hình kinh doanh và hoạt động du lịch của bạn."
        />
        <div className="overview-welcome">
          <div><span className="overview-sun">✦</span><div><strong>Chào buổi sáng, Admin!</strong><span>Chúc bạn một ngày quản lý hiệu quả.</span></div></div>
          <span className="overview-date">Thứ Bảy, 24 tháng 10, 2026</span>
        </div>
        <div className="overview-stat-grid">
          <article className="overview-stat-card"><span className="overview-stat-icon purple">▤</span><div><span>Tổng đặt chỗ</span><strong>{bookings.length}</strong><small className="trend-positive">↑ 12% <i>so với tháng trước</i></small></div></article>
          <article className="overview-stat-card"><span className="overview-stat-icon green">✈</span><div><span>Tour đang mở</span><strong>{openTours}</strong><small><i>trên {tours.length} hành trình</i></small></div></article>
          <article className="overview-stat-card"><span className="overview-stat-icon orange">◷</span><div><span>Chờ xác nhận</span><strong>{pendingBookings}</strong><small><i>cần xử lý sớm</i></small></div></article>
          <article className="overview-stat-card"><span className="overview-stat-icon blue">₫</span><div><span>Doanh thu xác nhận</span><strong className="revenue-value">{formatPrice(revenue)}</strong><small className="trend-positive">↑ 8,4% <i>so với tháng trước</i></small></div></article>
        </div>
        <div className="overview-grid">
          <section className="admin-card revenue-card">
            <div className="admin-card-heading"><div><h3>Doanh thu đặt chỗ</h3><p>Thống kê doanh thu 6 tháng gần đây</p></div><span className="chart-legend"><i /> Doanh thu</span></div>
            <div className="chart-total">{formatPrice(revenue)}<span> · Năm 2026</span></div>
            <div className="revenue-chart" aria-label="Biểu đồ doanh thu 6 tháng">
              <div className="chart-axis"><span>15 tr</span><span>10 tr</span><span>5 tr</span><span>0</span></div>
              <div className="chart-bars">{bars.map((bar) => <div className="chart-bar-column" key={bar.month}><div className="chart-bar-track"><span style={{ height: `${bar.value}%` }} /></div><small>{bar.month}</small></div>)}</div>
            </div>
          </section>
          <section className="admin-card quick-card">
            <div className="admin-card-heading"><div><h3>Thao tác nhanh</h3><p>Các công việc thường dùng</p></div></div>
            <button className="quick-action" onClick={() => { changeView("tours"); startNewTour(); }}><span className="quick-icon green">＋</span><span><strong>Tạo tour mới</strong><small>Thêm hành trình vào danh sách</small></span><b>›</b></button>
            <button className="quick-action" onClick={() => changeView("bookings")}><span className="quick-icon orange">◷</span><span><strong>Xử lý đặt chỗ</strong><small>{pendingBookings} yêu cầu đang chờ</small></span><b>›</b></button>
            <button className="quick-action" onClick={() => changeView("customers")}><span className="quick-icon purple">♙</span><span><strong>Xem khách hàng</strong><small>Quản lý thông tin khách</small></span><b>›</b></button>
          </section>
        </div>
        <section className="admin-card recent-bookings">
          <div className="admin-card-heading"><div><h3>Đặt chỗ gần đây</h3><p>Các yêu cầu mới nhất từ khách hàng</p></div><button className="admin-text-button" onClick={() => changeView("bookings")}>Xem tất cả <span>→</span></button></div>
          <div className="recent-booking-list">
            {bookings.slice(0, 3).map((booking) => (
              <div className="recent-booking-row" key={booking.id}>
                <span className="booking-avatar">{booking.customer.split(" ").slice(-1)[0].charAt(0)}</span>
                <span className="recent-booking-person"><strong>{booking.customer}</strong><small>{booking.id} · {booking.tour}</small></span>
                <span className="recent-booking-date">{booking.date}</span>
                <span className={`status-badge ${booking.status === "Đã xác nhận" ? "status-open" : booking.status === "Đã hủy" ? "status-cancelled" : "status-pending"}`}>{booking.status}</span>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderTours() {
    return (
      <>
        <PageTitle
          eyebrow="SẢN PHẨM DU LỊCH"
          title="Quản lý tour"
          description="Tạo và quản lý các hành trình đang được cung cấp."
          action={<button className="button button-primary" onClick={startNewTour}>＋ &nbsp; Thêm tour mới</button>}
        />
        <div className="tour-summary-strip">
          <span><i className="summary-dot green-dot" />{tours.filter((tour) => tour.status === "Đang mở").length} tour đang mở</span>
          <span><i className="summary-dot orange-dot" />{tours.filter((tour) => tour.status === "Tạm dừng").length} tour tạm dừng</span>
          <span>{tours.length} hành trình tất cả</span>
        </div>
        <section className="admin-card data-card">
          <div className="admin-card-heading"><div><h3>Danh sách hành trình</h3><p>Thông tin và trạng thái các tour du lịch</p></div><span className="admin-count">{filteredTours.length} tour</span></div>
          <div className="admin-filters">
            <label className="admin-search">⌕ <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên tour, điểm đến..." /></label>
            <select aria-label="Lọc trạng thái tour" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option>Tất cả trạng thái</option><option>Đang mở</option><option>Tạm dừng</option>
            </select>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>TÊN TOUR</th><th>ĐIỂM ĐẾN</th><th>THỜI LƯỢNG</th><th>GIÁ TỪ</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead>
              <tbody>
                {filteredTours.map((tour) => (
                  <tr key={tour.id}>
                    <td><strong>{tour.name}</strong></td><td>{tour.destination}</td><td>{tour.duration}</td><td className="admin-price">{formatPrice(tour.price)}</td>
                    <td><span className={`status-badge ${tour.status === "Đang mở" ? "status-open" : "status-paused"}`}>{tour.status}</span></td>
                    <td><div className="admin-row-actions"><button onClick={() => startEditing(tour)}>Sửa</button><button onClick={() => toggleTourStatus(tour)}>{tour.status === "Đang mở" ? "Tạm dừng" : "Mở bán"}</button><button className="delete-action" onClick={() => deleteTour(tour.id)}>Xóa</button></div></td>
                  </tr>
                ))}
                {filteredTours.length === 0 && <tr><td className="admin-empty" colSpan="6">Chưa tìm thấy tour phù hợp.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderBookings() {
    const bookingStatuses = ["Tất cả trạng thái", "Chờ xác nhận", "Đã xác nhận", "Đã hủy"];
    return (
      <>
        <PageTitle eyebrow="ĐƠN HÀNG & ĐIỀU HÀNH" title="Quản lý đặt chỗ" description="Theo dõi yêu cầu, xác nhận và cập nhật trạng thái đặt tour." />
        <div className="booking-summary-grid">
          {bookingStatuses.slice(1).map((status) => (
            <button className={`booking-summary-card ${statusFilter === status ? "selected" : ""}`} key={status} onClick={() => setStatusFilter(statusFilter === status ? "Tất cả trạng thái" : status)}>
              <span className={`summary-dot ${status === "Đã xác nhận" ? "green-dot" : status === "Đã hủy" ? "red-dot" : "orange-dot"}`} />
              <strong>{bookings.filter((booking) => booking.status === status).length}</strong><small>{status}</small>
            </button>
          ))}
        </div>
        <section className="admin-card data-card">
          <div className="admin-card-heading"><div><h3>Danh sách đặt chỗ</h3><p>Quản lý thông tin và tình trạng đặt tour</p></div><span className="admin-count">{filteredBookings.length} đơn</span></div>
          <div className="admin-filters">
            <label className="admin-search">⌕ <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã đơn, khách hàng, tour..." /></label>
            <select aria-label="Lọc trạng thái đặt chỗ" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{bookingStatuses.map((status) => <option key={status}>{status}</option>)}</select>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>MÃ ĐẶT CHỖ</th><th>KHÁCH HÀNG</th><th>TOUR</th><th>KHỞI HÀNH</th><th>KHÁCH</th><th>TỔNG TIỀN</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead>
              <tbody>
                {filteredBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td><strong className="booking-code">{booking.id}</strong></td>
                    <td><strong>{booking.customer}</strong><small className="table-subtext">{booking.email}</small></td>
                    <td>{booking.tour}</td><td>{booking.date}</td><td>{booking.guests} người</td><td className="admin-price">{formatPrice(booking.total)}</td>
                    <td><span className={`status-badge ${booking.status === "Đã xác nhận" ? "status-open" : booking.status === "Đã hủy" ? "status-cancelled" : "status-pending"}`}>{booking.status}</span></td>
                    <td>{booking.status === "Chờ xác nhận" ? <button className="confirm-booking" onClick={() => updateBookingStatus(booking.id, "Đã xác nhận")}>Xác nhận</button> : <button className="admin-inline-action" onClick={() => updateBookingStatus(booking.id, booking.status === "Đã hủy" ? "Chờ xác nhận" : "Đã hủy")}>{booking.status === "Đã hủy" ? "Mở lại" : "Hủy đơn"}</button>}</td>
                  </tr>
                ))}
                {filteredBookings.length === 0 && <tr><td className="admin-empty" colSpan="8">Chưa có đặt chỗ phù hợp.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderCustomers() {
    return (
      <>
        <PageTitle eyebrow="CỘNG ĐỒNG DU KHÁCH" title="Khách hàng" description="Thông tin khách hàng và lịch sử hoạt động trên Vi Vu." />
        <div className="customer-highlight">
          <span className="customer-highlight-icon">♙</span>
          <div><strong>{customers.length} khách hàng</strong><span>đã tin tưởng lựa chọn những chuyến đi cùng Vi Vu</span></div>
          <div className="customer-highlight-total"><strong>{customers.reduce((sum, customer) => sum + customer.bookings, 0)}</strong><span>lượt đặt tour</span></div>
        </div>
        <section className="admin-card data-card">
          <div className="admin-card-heading"><div><h3>Danh sách khách hàng</h3><p>Tra cứu thông tin liên hệ và hoạt động đặt tour</p></div><span className="admin-count">{filteredCustomers.length} khách</span></div>
          <div className="admin-filters">
            <label className="admin-search">⌕ <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, email hoặc số điện thoại..." /></label>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table customer-table">
              <thead><tr><th>KHÁCH HÀNG</th><th>LIÊN HỆ</th><th>SỐ ĐẶT CHỖ</th><th>TỔNG CHI TIÊU</th><th>THAM GIA</th><th>HẠNG THÀNH VIÊN</th></tr></thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td><div className="customer-table-person"><span className="customer-avatar">{customer.name.split(" ").slice(-1)[0].charAt(0)}</span><strong>{customer.name}</strong></div></td>
                    <td><strong>{customer.email}</strong><small className="table-subtext">{customer.phone}</small></td>
                    <td>{customer.bookings} chuyến</td><td className="admin-price">{formatPrice(customer.spent)}</td><td>{customer.joined}</td>
                    <td><span className={`member-badge ${customer.spent >= 15000000 ? "member-vip" : ""}`}>{customer.spent >= 15000000 ? "✦ VIP" : "Thân thiết"}</span></td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && <tr><td className="admin-empty" colSpan="6">Chưa tìm thấy khách hàng phù hợp.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  if (!ready || !authorized) return null;

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <a className="brand admin-brand" href="/" aria-label="Vi Vu - Trang chủ">
          <span className="brand-mark">v</span><span>vi vu<span className="brand-dot">.</span></span>
        </a>
        <p className="admin-nav-label">KHÔNG GIAN QUẢN TRỊ</p>
        <nav className="admin-navigation" aria-label="Điều hướng quản trị">
          {navigation.map((item) => (
            <button className={`admin-nav-item ${activeView === item.id ? "active" : ""}`} key={item.id} onClick={() => changeView(item.id)}>
              <span className="admin-nav-icon">{item.icon}</span>{item.label}
              {item.id === "bookings" && bookings.some((booking) => booking.status === "Chờ xác nhận") && <span className="nav-count">{bookings.filter((booking) => booking.status === "Chờ xác nhận").length}</span>}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <a href="/">← &nbsp; Về trang chủ</a>
          <button onClick={logout}>↪ &nbsp; Đăng xuất</button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div><span className="admin-breadcrumb">Vi Vu <span>/</span> {navigation.find((item) => item.id === activeView)?.label}</span><h1>{navigation.find((item) => item.id === activeView)?.label}</h1></div>
          <div className="admin-user"><span className="admin-avatar">A</span><span><strong>Quản trị viên</strong><small>{adminEmail}</small></span></div>
        </header>
        <section className="admin-content">
          {message && <p className="admin-message" role="status">{message}</p>}
          {activeView === "overview" && renderOverview()}
          {activeView === "tours" && renderTours()}
          {activeView === "bookings" && renderBookings()}
          {activeView === "customers" && renderCustomers()}
        </section>
      </main>

      {showForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
          <section className="auth-modal admin-tour-modal" role="dialog" aria-modal="true" aria-labelledby="tour-form-title">
            <button className="modal-close" aria-label="Đóng" onClick={() => setShowForm(false)}>×</button>
            <p className="eyebrow">QUẢN LÝ HÀNH TRÌNH</p>
            <h2 id="tour-form-title">{editingId === null ? "Thêm tour mới" : "Chỉnh sửa tour"}</h2>
            <form className="auth-form" onSubmit={saveTour}>
              <label>Tên tour<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ví dụ: Khám phá Vịnh Hạ Long" /></label>
              <label>Điểm đến<input required value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} placeholder="Ví dụ: Hạ Long" /></label>
              <label>Thời lượng<input required value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} placeholder="Ví dụ: 3 ngày 2 đêm" /></label>
              <label>Giá tour (VNĐ)<input required type="number" min="0" step="1000" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="3290000" /></label>
              <label>Trạng thái<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Đang mở</option><option>Tạm dừng</option></select></label>
              <button className="button button-primary auth-submit" type="submit">{editingId === null ? "Thêm tour" : "Lưu thay đổi"}</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
