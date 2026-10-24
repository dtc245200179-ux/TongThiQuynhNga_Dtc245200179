"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, clearSession } from "../lib/api";

const customerNavigation = [
  { id: "explore", label: "Khám phá tour", icon: "✈" },
  { id: "bookings", label: "Chuyến đi của tôi", icon: "▤" },
  { id: "favorites", label: "Tour yêu thích", icon: "♡" },
  { id: "profile", label: "Thông tin cá nhân", icon: "♙" },
];

function formatPrice(price) {
  return `${Number(price).toLocaleString("vi-VN")} đ`;
}

export default function CustomerPage() {
  const router = useRouter();
  const [activeView, setActiveView] = useState("explore");
  const [tours, setTours] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [search, setSearch] = useState("");
  const [destination, setDestination] = useState("Tất cả điểm đến");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [bookingTour, setBookingTour] = useState(null);
  const [departureDate, setDepartureDate] = useState("");
  const [guests, setGuests] = useState("2");
  const [profile, setProfile] = useState({ name: "Minh Anh", phone: "", email: "khach@gmail.com" });

  useEffect(() => {
    let active = true;
    async function loadCustomerData() {
      try {
        const user = await apiRequest("/auth/me");
        if (user.role !== "customer") {
          router.replace("/");
          return;
        }
        const [tourData, bookingData, favoriteData, profileData] = await Promise.all([
          apiRequest("/tours"),
          apiRequest("/bookings"),
          apiRequest("/favorites"),
          apiRequest("/customers/me"),
        ]);
        if (!active) return;
        setTours(tourData);
        setBookings(bookingData);
        setFavorites(favoriteData);
        setProfile({ name: profileData.name, email: profileData.email, phone: profileData.phone || "" });
      } catch (error) {
        if (active) {
          setMessage(`Không thể tải thông tin tài khoản: ${error.message}`);
          if (window.sessionStorage.getItem("vi-vu-token") === null) router.replace("/");
        }
      } finally {
        if (active) setReady(true);
      }
    }
    loadCustomerData();
    return () => { active = false; };
  }, [router]);

  const availableTours = tours.filter((tour) => tour.status === "Đang mở");
  const filteredTours = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return availableTours.filter((tour) => {
      const matchesSearch = `${tour.name} ${tour.destination}`.toLocaleLowerCase("vi").includes(query);
      const matchesDestination = destination === "Tất cả điểm đến" || tour.destination === destination;
      return matchesSearch && matchesDestination;
    });
  }, [availableTours, search, destination]);

  const favoriteTours = tours.filter((tour) => favorites.includes(tour.id));

  function changeView(view) {
    setActiveView(view);
    setSearch("");
    setMessage("");
  }

  async function toggleFavorite(tourId) {
    const isFavorite = favorites.includes(tourId);
    try {
      await apiRequest(`/favorites/${tourId}`, { method: isFavorite ? "DELETE" : "POST" });
      setFavorites((current) => isFavorite
        ? current.filter((id) => id !== tourId)
        : [...current, tourId]);
    } catch (error) {
      setMessage(`Không thể cập nhật tour yêu thích: ${error.message}`);
    }
  }

  async function submitBooking(event) {
    event.preventDefault();
    if (!bookingTour || !departureDate) return;
    try {
      const newBooking = await apiRequest("/bookings", {
        method: "POST",
        body: JSON.stringify({
          tour_id: bookingTour.id,
          departure_date: departureDate,
          guests: Number(guests),
        }),
      });
      setBookings((current) => [newBooking, ...current]);
      setBookingTour(null);
      setDepartureDate("");
      setGuests("2");
      setActiveView("bookings");
      setMessage("Đã gửi yêu cầu đặt tour. Vi Vu sẽ liên hệ xác nhận với bạn.");
    } catch (error) {
      setMessage(`Không thể đặt tour: ${error.message}`);
    }
  }

  async function cancelBooking(bookingId) {
    if (!window.confirm("Bạn muốn hủy yêu cầu đặt tour này?")) return;
    try {
      const updated = await apiRequest(`/bookings/${bookingId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Đã hủy" }),
      });
      setBookings((current) => current.map((booking) => booking.id === bookingId ? updated : booking));
      setMessage("Đã cập nhật yêu cầu hủy tour.");
    } catch (error) {
      setMessage(`Không thể hủy đặt tour: ${error.message}`);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    try {
      const updated = await apiRequest("/customers/me", {
        method: "PUT",
        body: JSON.stringify({ name: profile.name, phone: profile.phone }),
      });
      setProfile({ name: updated.name, email: updated.email, phone: updated.phone || "" });
      window.sessionStorage.setItem("vi-vu-customer-name", updated.name);
      window.sessionStorage.setItem("vi-vu-user", JSON.stringify(updated));
      setMessage("Đã lưu thông tin cá nhân.");
    } catch (error) {
      setMessage(`Không thể lưu thông tin cá nhân: ${error.message}`);
    }
  }

  function logout() {
    clearSession();
    window.location.assign("/");
  }

  if (!ready) return null;

  const currentLabel = customerNavigation.find((item) => item.id === activeView)?.label;

  return (
    <div className="customer-layout">
      <aside className="customer-sidebar">
        <a className="brand" href="/" aria-label="Vi Vu - Trang chủ"><span className="brand-mark">v</span><span>vi vu<span className="brand-dot">.</span></span></a>
        <div className="customer-sidebar-welcome"><span className="customer-profile-avatar">M</span><span><strong>Xin chào, {profile.name.split(" ")[0]}!</strong><small>Thành viên Vi Vu</small></span></div>
        <p className="customer-nav-label">TÀI KHOẢN CỦA BẠN</p>
        <nav className="customer-navigation" aria-label="Điều hướng khách hàng">
          {customerNavigation.map((item) => (
            <button className={`customer-nav-item ${activeView === item.id ? "active" : ""}`} key={item.id} onClick={() => changeView(item.id)}>
              <span>{item.icon}</span>{item.label}
              {item.id === "bookings" && bookings.length > 0 && <small>{bookings.length}</small>}
              {item.id === "favorites" && favorites.length > 0 && <small>{favorites.length}</small>}
            </button>
          ))}
        </nav>
        <div className="customer-sidebar-bottom"><a href="/">← &nbsp; Về trang chủ</a><button onClick={logout}>↪ &nbsp; Đăng xuất</button></div>
      </aside>

      <main className="customer-main">
        <header className="customer-topbar">
          <div><span>Vi Vu <i>/</i> {currentLabel}</span><h1>{currentLabel}</h1></div>
          <button className="customer-user-chip" onClick={() => changeView("profile")}><span>M</span><strong>{profile.name}</strong><b>⌄</b></button>
        </header>

        <div className="customer-content">
          {message && <p className="customer-message" role="status">{message}</p>}

          {activeView === "explore" && (
            <>
              <section className="customer-hero">
                <div><span className="customer-hero-kicker">NHỮNG CHUYẾN ĐI ĐANG CHỜ BẠN</span><h2>Đi để thấy thế giới<br />rộng lớn đến nhường nào.</h2><p>Chọn một hành trình yêu thích, Vi Vu sẽ lo những điều còn lại.</p><button onClick={() => document.querySelector("#customer-tours")?.scrollIntoView({ behavior: "smooth" })}>Khám phá hành trình <span>↓</span></button></div>
                <span className="customer-hero-stamp">VI VU<br /><small>✦</small><br />2026</span>
              </section>
              <div className="customer-section-heading" id="customer-tours"><div><span>ĐIỂM ĐẾN ĐƯỢC YÊU THÍCH</span><h2>Tìm hành trình của bạn</h2><p>Những trải nghiệm được chọn riêng cho chuyến đi tiếp theo.</p></div><button onClick={() => changeView("bookings")}>Chuyến đi của tôi <b>→</b></button></div>
              <div className="customer-tour-filters">
                <label>⌕ <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Bạn muốn đi đâu?" /></label>
                <select aria-label="Lọc theo điểm đến" value={destination} onChange={(event) => setDestination(event.target.value)}>
                  <option>Tất cả điểm đến</option>
                  {[...new Set(availableTours.map((tour) => tour.destination))].map((place) => <option key={place}>{place}</option>)}
                </select>
                <span>{filteredTours.length} hành trình</span>
              </div>
              <div className="customer-tour-grid">
                {filteredTours.map((tour) => (
                  <article className="customer-tour-card" key={tour.id}>
                    <div className="customer-tour-image" style={{ backgroundImage: `url(https://images.unsplash.com/${tour.image || "photo-1530789253388-582c481c54b0"}?auto=format&fit=crop&w=850&q=85)` }}>
                      <span className="customer-tour-location">⌖ &nbsp; {tour.destination}</span>
                      <button className={`favorite-toggle ${favorites.includes(tour.id) ? "is-favorite" : ""}`} aria-label={favorites.includes(tour.id) ? "Bỏ yêu thích" : "Thêm vào yêu thích"} onClick={() => toggleFavorite(tour.id)}>{favorites.includes(tour.id) ? "♥" : "♡"}</button>
                    </div>
                    <div className="customer-tour-info"><span className="customer-tour-duration">◷ &nbsp; {tour.duration}</span><h3>{tour.name}</h3><p>{tour.description || `Khám phá cảnh đẹp và trải nghiệm địa phương tại ${tour.destination}.`}</p><div><span>Từ <strong>{formatPrice(tour.price)}</strong><small> / khách</small></span><button onClick={() => { setBookingTour(tour); setDepartureDate(""); }}>Đặt tour <b>→</b></button></div></div>
                  </article>
                ))}
                {filteredTours.length === 0 && <p className="customer-empty">Chưa tìm thấy hành trình phù hợp.</p>}
              </div>
            </>
          )}

          {activeView === "bookings" && (
            <>
              <div className="customer-section-heading customer-page-heading"><div><span>HỒ SƠ DU LỊCH</span><h2>Chuyến đi của tôi</h2><p>Theo dõi yêu cầu đặt chỗ và chuẩn bị cho hành trình sắp tới.</p></div><button onClick={() => changeView("explore")}>＋ Tìm tour mới</button></div>
              <div className="customer-booking-summary"><div><strong>{bookings.length}</strong><span>Tổng chuyến đi</span></div><div><strong>{bookings.filter((booking) => booking.status === "Chờ xác nhận").length}</strong><span>Đang chờ xác nhận</span></div><div><strong>{bookings.filter((booking) => booking.status === "Đã xác nhận").length}</strong><span>Đã xác nhận</span></div></div>
              <section className="customer-booking-list">
                <div className="customer-list-heading"><div><h3>Lịch sử đặt tour</h3><p>Các hành trình bạn đã đặt cùng Vi Vu</p></div><span>{bookings.length} chuyến</span></div>
                {bookings.map((booking) => (
                  <article className="customer-booking-card" key={booking.id}>
                    <div className="customer-booking-image" style={{ backgroundImage: `url(https://images.unsplash.com/${tours.find((tour) => tour.id === booking.tourId)?.image || "photo-1530789253388-582c481c54b0"}?auto=format&fit=crop&w=500&q=80)` }} />
                    <div className="customer-booking-details"><span className="customer-booking-code">{booking.id}</span><h3>{booking.tourName}</h3><p>{booking.destination} · {booking.duration}</p><span className={`status-badge ${booking.status === "Đã xác nhận" ? "status-open" : booking.status === "Đã hủy" ? "status-cancelled" : "status-pending"}`}>{booking.status}</span></div>
                    <div className="customer-booking-meta"><span>Ngày khởi hành<strong>{booking.departureDate}</strong></span><span>Số du khách<strong>{booking.guests} người</strong></span><span>Tổng thanh toán<strong>{formatPrice(booking.total)}</strong></span>{booking.status === "Chờ xác nhận" && <button onClick={() => cancelBooking(booking.id)}>Hủy yêu cầu</button>}</div>
                  </article>
                ))}
                {bookings.length === 0 && <div className="customer-empty-state"><span>✈</span><strong>Bạn chưa có chuyến đi nào</strong><p>Hành trình đáng nhớ tiếp theo đang chờ bạn khám phá.</p><button onClick={() => changeView("explore")}>Khám phá tour</button></div>}
              </section>
            </>
          )}

          {activeView === "favorites" && (
            <>
              <div className="customer-section-heading customer-page-heading"><div><span>ĐÃ LƯU LẠI CHO BẠN</span><h2>Tour yêu thích</h2><p>Những hành trình bạn muốn khám phá trong tương lai.</p></div><button onClick={() => changeView("explore")}>Khám phá thêm <b>→</b></button></div>
              <div className="customer-tour-grid">
                {favoriteTours.map((tour) => (
                  <article className="customer-tour-card" key={tour.id}>
                    <div className="customer-tour-image" style={{ backgroundImage: `url(https://images.unsplash.com/${tour.image || "photo-1530789253388-582c481c54b0"}?auto=format&fit=crop&w=850&q=85)` }}>
                      <span className="customer-tour-location">⌖ &nbsp; {tour.destination}</span>
                      <button className="favorite-toggle is-favorite" aria-label="Bỏ yêu thích" onClick={() => toggleFavorite(tour.id)}>♥</button>
                    </div>
                    <div className="customer-tour-info"><span className="customer-tour-duration">◷ &nbsp; {tour.duration}</span><h3>{tour.name}</h3><p>{tour.description || `Khám phá cảnh đẹp và trải nghiệm địa phương tại ${tour.destination}.`}</p><div><span>Từ <strong>{formatPrice(tour.price)}</strong><small> / khách</small></span><button onClick={() => { setBookingTour(tour); setDepartureDate(""); }}>Đặt tour <b>→</b></button></div></div>
                  </article>
                ))}
                {favoriteTours.length === 0 && <div className="customer-empty-state customer-empty-wide"><span>♡</span><strong>Chưa có tour yêu thích</strong><p>Chạm vào biểu tượng trái tim để lưu hành trình bạn thích.</p><button onClick={() => changeView("explore")}>Khám phá tour</button></div>}
              </div>
            </>
          )}

          {activeView === "profile" && (
            <>
              <div className="customer-section-heading customer-page-heading"><div><span>TÀI KHOẢN VI VU</span><h2>Thông tin cá nhân</h2><p>Cập nhật thông tin để chúng tôi hỗ trợ bạn tốt hơn trong mỗi chuyến đi.</p></div></div>
              <section className="customer-profile-card">
                <div className="customer-profile-card-heading"><span className="customer-profile-avatar large">M</span><div><strong>{profile.name}</strong><span>Thành viên Vi Vu · Đã tham gia năm 2026</span></div></div>
                <form className="customer-profile-form" onSubmit={saveProfile}>
                  <label>Họ và tên<input required value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="Tên của bạn" /></label>
                  <label>Email đăng nhập<input disabled value={profile.email} /></label>
                  <label>Số điện thoại<input type="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="Nhập số điện thoại" /></label>
                  <div className="customer-profile-actions"><span>Thông tin được lưu an toàn trong tài khoản của bạn.</span><button className="button button-primary" type="submit">Lưu thay đổi</button></div>
                </form>
              </section>
            </>
          )}
        </div>
      </main>

      {bookingTour && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBookingTour(null); }}>
          <section className="auth-modal customer-booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title">
            <button className="modal-close" aria-label="Đóng" onClick={() => setBookingTour(null)}>×</button>
            <p className="eyebrow">BẮT ĐẦU CHUYẾN ĐI</p><h2 id="booking-title">Đặt tour của bạn</h2>
            <div className="booking-tour-summary"><strong>{bookingTour.name}</strong><span>{bookingTour.destination} · {bookingTour.duration}</span><span>Giá từ {formatPrice(bookingTour.price)} / khách</span></div>
            <form className="auth-form" onSubmit={submitBooking}>
              <label>Ngày khởi hành<input required type="date" min={new Date().toISOString().slice(0, 10)} value={departureDate} onChange={(event) => setDepartureDate(event.target.value)} /></label>
              <label>Số lượng du khách<select value={guests} onChange={(event) => setGuests(event.target.value)}><option value="1">1 người</option><option value="2">2 người</option><option value="3">3 người</option><option value="4">4 người</option><option value="5">5 người</option><option value="6">6 người</option></select></label>
              <div className="booking-estimate"><span>Tạm tính</span><strong>{formatPrice(bookingTour.price * Number(guests))}</strong></div>
              <button className="button button-primary auth-submit" type="submit">Gửi yêu cầu đặt tour</button>
            </form>
            <p className="auth-terms">Yêu cầu của bạn sẽ được lưu vào danh sách chuyến đi để theo dõi.</p>
          </section>
        </div>
      )}
    </div>
  );
}
