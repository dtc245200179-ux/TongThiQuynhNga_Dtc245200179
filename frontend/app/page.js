"use client";

import { useState } from "react";
import { apiRequest, saveSession } from "./lib/api";

const destinations = [
  {
    name: "Hạ Long",
    detail: "18 hành trình · Vịnh di sản",
    image: "photo-1528127269322-539801943592",
  },
  {
    name: "Hội An",
    detail: "12 hành trình · Miền ký ức",
    image: "photo-1559592413-7cec4d0cae2b",
  },
  {
    name: "Phú Quốc",
    detail: "15 hành trình · Đảo ngọc",
    image: "photo-1510414842594-a61c69b5ae57",
  },
  {
    name: "Sa Pa",
    detail: "10 hành trình · Chạm mây",
    image: "photo-1509316785289-025f5b846b35",
  },
];

const benefits = [
  {
    icon: "✦",
    title: "Hành trình được tuyển chọn",
    text: "Lịch trình thực tế, đối tác uy tín, trải nghiệm địa phương chân thật.",
  },
  {
    icon: "₫",
    title: "Giá rõ ràng, không bất ngờ",
    text: "Hiển thị đầy đủ thuế phí. Chính sách hoàn hủy minh bạch trước khi đặt.",
  },
  {
    icon: "♡",
    title: "Có người đồng hành, mọi lúc",
    text: "Tư vấn tận tâm trước chuyến đi, hỗ trợ nhanh trong suốt hành trình.",
  },
];

const steps = [
  {
    number: "01",
    title: "Tìm hành trình yêu thích",
    text: "Chọn điểm đến, ngày khởi hành và tour phù hợp với bạn.",
  },
  {
    number: "02",
    title: "Đặt chỗ thật an tâm",
    text: "Điền thông tin, thanh toán bảo mật và nhận xác nhận ngay.",
  },
  {
    number: "03",
    title: "Xách ba lô, cùng Vi Vu đi",
    text: "Theo dõi lịch trình trong tài khoản. Chúng tôi lo phần còn lại.",
  },
];

const reviews = [
  {
    initials: "LH",
    name: "Nguyễn Linh Hà",
    place: "Phú Quốc · Tháng 08/2026",
    quote:
      "Lần đầu đưa bố mẹ đi du lịch mà nhẹ tênh! Lịch trình thoải mái, hướng dẫn viên chu đáo. Cả nhà đã hẹn chuyến tiếp theo cùng Vi Vu.",
  },
  {
    initials: "ĐT",
    name: "Phạm Đức Tuấn",
    place: "Hội An · Tháng 07/2026",
    quote:
      "Mình thích cách Vi Vu đưa mình đến những góc phố rất riêng. Không vội vàng, không chặt chém, đúng là đi để tận hưởng.",
  },
  {
    initials: "MN",
    name: "Lê Minh Ngọc",
    place: "Sa Pa · Tháng 06/2026",
    quote:
      "Biển đẹp hơn cả trong ảnh, khách sạn gần phố và tour bản địa thân thiện. Một kỳ nghỉ tuyệt vời mà không phải lo lắng gì nhiều.",
  },
];

function Brand({ onClick }) {
  return (
    <a className="brand" href="#home" aria-label="Vi Vu - Trang chủ" onClick={onClick}>
      <span className="brand-mark">v</span>
      <span>
        vi vu<span className="brand-dot">.</span>
      </span>
    </a>
  );
}

export default function Home() {
  const [authMode, setAuthMode] = useState(null);
  const [notice, setNotice] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  function openAuth(mode) {
    setNotice("");
    setLoginEmail("");
    setAuthPassword("");
    setAuthMode(mode);
  }

  async function submitAuth(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");

    try {
      if (authMode === "login") {
        const session = await apiRequest("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        saveSession(session);
        window.location.assign(session.user.role === "admin" ? "/admin" : "/customer");
        return;
      }

      const name = String(formData.get("name") || "").trim();
      await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      setLoginEmail(email);
      setAuthPassword("");
      setAuthMode("login");
      setNotice("Đăng ký thành công! Hãy đăng nhập bằng email và mật khẩu vừa tạo để vào trang khách hàng.");
    } catch (error) {
      setNotice(error.message || "Không thể kết nối đến máy chủ. Vui lòng thử lại.");
    }
  }

  return (
    <main>
      <header className="site-header">
        <Brand />
        <nav className="main-nav" aria-label="Điều hướng chính">
          <a className="active" href="#home">Trang chủ</a>
          <a href="#destinations">Khám phá tour</a>
          <a href="#destinations">Điểm đến</a>
          <a href="#about">Về Vi Vu</a>
          <a href="#reviews">Cẩm nang</a>
        </nav>
        <div className="header-actions">
          <button className="button button-quiet" onClick={() => openAuth("login")}>Đăng nhập</button>
          <button className="button button-primary button-small" onClick={() => openAuth("register")}>Đăng ký</button>
        </div>
        <button className="mobile-register" onClick={() => openAuth("register")}>Đăng ký</button>
      </header>

      <section className="hero" id="home">
        <div className="hero-shade" />
        <div className="hero-content">
          <p className="eyebrow eyebrow-light">VIỆT NAM, ĐI LÀ YÊU</p>
          <h1>Đi thật xa.<br />Chạm thật gần.</h1>
          <p className="hero-copy">
            Rời những quen thuộc, chạm vào điều mới mẻ. Cùng Vi Vu khám phá những hành trình đáng nhớ theo cách của bạn.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#destinations">↗ &nbsp; Khám phá hành trình</a>
            <a className="story-link" href="#about"><span>▶</span> Một phút cùng Vi Vu</a>
          </div>
        </div>
        <div className="hero-caption">◎ &nbsp; Vịnh Hạ Long<br /><small>Quảng Ninh · Việt Nam</small></div>
        <div className="hero-pagination" aria-hidden="true"><span /><span /><span /></div>
      </section>

      <section className="search-wrap" aria-label="Tìm tour">
        <form
          className="search-bar"
          onSubmit={(event) => {
            event.preventDefault();
            document.querySelector("#destinations")?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <label className="search-field">
            <span>ĐIỂM ĐẾN MUỐN ĐẾN</span>
            <select defaultValue="">
              <option value="">Tất cả điểm đến</option>
              {destinations.map((place) => <option key={place.name}>{place.name}</option>)}
            </select>
          </label>
          <label className="search-field">
            <span>NGÀY KHỞI HÀNH</span>
            <input type="date" aria-label="Ngày khởi hành" />
          </label>
          <label className="search-field">
            <span>SỐ DU KHÁCH</span>
            <select defaultValue="2">
              <option value="1">01 người lớn</option>
              <option value="2">02 người lớn</option>
              <option value="3">03 người lớn</option>
              <option value="4">Gia đình</option>
            </select>
          </label>
          <button className="button button-primary search-submit" type="submit">⌕ &nbsp; Tìm tour ngay</button>
        </form>
      </section>

      <section className="stats section-shell" aria-label="Vi Vu trong những con số">
        <div><strong>12.000+</strong><span>Du khách tin chọn</span></div>
        <div><strong>150+</strong><span>Hành trình chọn lọc</span></div>
        <div><strong>4,9/5</strong><span>Điểm hài lòng</span></div>
        <div><strong>24/7</strong><span>Hỗ trợ mọi hành trình</span></div>
      </section>

      <section className="section-shell destinations" id="destinations">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MỖI ĐIỂM ĐẾN, MỘT CÂU CHUYỆN</p>
            <h2>Bạn muốn thức dậy ở đâu?</h2>
            <p className="muted">Biển xanh, phố cổ hay những tầng mây. Chọn nơi trái tim muốn đến.</p>
          </div>
          <a className="text-link" href="#destinations">↗ &nbsp; Tất cả điểm đến</a>
        </div>
        <div className="destination-grid">
          {destinations.map((place) => (
            <a
              href="#destinations"
              className="destination-card"
              key={place.name}
              style={{ backgroundImage: `url(https://images.unsplash.com/${place.image}?auto=format&fit=crop&w=850&q=85)` }}
            >
              <span className="card-copy"><strong>{place.name}</strong><small>{place.detail}</small></span>
              <span className="card-arrow">↗</span>
            </a>
          ))}
        </div>
      </section>

      <section className="about-section" id="about">
        <div className="about-inner section-shell">
          <div className="about-photo">
            <div className="years-badge"><strong>8 năm</strong><span>Gửi gắm niềm vui trên từng chuyến đi</span></div>
          </div>
          <div className="about-copy">
            <p className="eyebrow">KHÔNG CHỈ LÀ MỘT CHUYẾN ĐI</p>
            <h2>Bạn cứ tận hưởng.<br />Còn lại, để Vi Vu lo.</h2>
            <p className="muted">Chúng tôi tin một hành trình đẹp bắt đầu từ sự an tâm. Mỗi chi tiết nhỏ đều được chăm chút vì bạn.</p>
            <div className="benefit-list">
              {benefits.map((benefit) => (
                <div className="benefit" key={benefit.title}>
                  <span className="benefit-icon">{benefit.icon}</span>
                  <div><strong>{benefit.title}</strong><p>{benefit.text}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="steps-section">
        <div className="section-shell">
          <p className="eyebrow">ÍT THAO TÁC, NHIỀU TRẢI NGHIỆM</p>
          <h2>Chỉ 3 bước, sẵn sàng lên đường</h2>
          <div className="steps-grid">
            {steps.map((step) => (
              <article className="step" key={step.number}>
                <span>{step.number}</span>
                <div><strong>{step.title}</strong><p>{step.text}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="reviews-section" id="reviews">
        <div className="section-shell">
          <div className="section-heading">
            <div><p className="eyebrow">KỶ NIỆM THẬT, CẢM XÚC THẬT</p><h2>Người đi rồi, kể bạn nghe</h2></div>
            <span className="rating-pill">★ &nbsp;2.400+ đánh giá</span>
          </div>
          <div className="review-grid">
            {reviews.map((review) => (
              <article className="review-card" key={review.initials}>
                <div className="stars" aria-label="5 trên 5 sao">★★★★★</div>
                <p>“{review.quote}”</p>
                <div className="review-person">
                  <span>{review.initials}</span>
                  <div><strong>{review.name}</strong><small>{review.place}</small></div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer">
        <Brand />
        <span>Đi thật xa. Chạm thật gần.</span>
        <button onClick={() => openAuth("register")}>Bắt đầu hành trình ↗</button>
      </footer>

      {authMode && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAuthMode(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setAuthMode(null);
          }}
        >
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="modal-close" aria-label="Đóng" onClick={() => setAuthMode(null)}>×</button>
            <Brand onClick={() => setAuthMode(null)} />
            <p className="eyebrow">BẮT ĐẦU HÀNH TRÌNH</p>
            <h2 id="auth-title">{authMode === "register" ? "Tạo tài khoản Vi Vu" : "Chào mừng trở lại"}</h2>
            <p className="muted">
              {authMode === "register"
                ? "Đăng ký để lưu lại những chuyến đi bạn yêu thích."
                : "Đăng nhập để tiếp tục khám phá hành trình của bạn."}
            </p>
            <form className="auth-form" onSubmit={submitAuth}>
              {authMode === "register" && (
                <label>Họ và tên<input required name="name" autoComplete="name" placeholder="Nguyễn Minh Anh" /></label>
              )}
              <label>
                Email
                <input
                  required
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="ban@example.com"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                />
              </label>
              <label>
                Mật khẩu
                <input
                  required
                  name="password"
                  type="password"
                  minLength={6}
                  autoComplete={authMode === "register" ? "new-password" : "current-password"}
                  placeholder="Ít nhất 6 ký tự"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                />
              </label>
              <button className="button button-primary auth-submit" type="submit">
                {authMode === "register" ? "Đăng ký ngay" : "Đăng nhập"}
              </button>
            </form>
            {notice && <p className="form-notice" role="status">{notice}</p>}
            <p className="auth-switch">
              {authMode === "register" ? "Đã có tài khoản?" : "Chưa có tài khoản?"}
              {" "}
              <button onClick={() => { setNotice(""); setAuthPassword(""); setAuthMode(authMode === "register" ? "login" : "register"); }}>
                {authMode === "register" ? "Đăng nhập" : "Đăng ký ngay"}
              </button>
            </p>
            {authMode === "login" && (
              <p className="auth-terms">
                Admin: admin@gmail.com · Khách mặc định: khach@gmail.com · Mật khẩu demo: 123456
              </p>
            )}
            {authMode === "register" && (
              <p className="auth-terms">Bằng cách tiếp tục, bạn đồng ý với Điều khoản và Chính sách bảo mật của Vi Vu.</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
