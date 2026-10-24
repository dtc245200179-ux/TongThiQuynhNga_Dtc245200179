const API_ROOT =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" && window.location.port === "3000"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "/api");

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem("vi-vu-token")
      : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = payload?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(", ")
      : detail || `Yêu cầu thất bại (HTTP ${response.status}).`;
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function saveSession(session) {
  window.sessionStorage.setItem("vi-vu-token", session.access_token);
  window.sessionStorage.setItem("vi-vu-role", session.user.role);
  window.sessionStorage.setItem("vi-vu-user", JSON.stringify(session.user));
  window.sessionStorage.setItem("vi-vu-admin", String(session.user.role === "admin"));
  window.sessionStorage.setItem("vi-vu-customer", String(session.user.role === "customer"));
  window.sessionStorage.setItem("vi-vu-customer-email", session.user.email);
  window.sessionStorage.setItem("vi-vu-customer-name", session.user.name);
}

export function clearSession() {
  [
    "vi-vu-token",
    "vi-vu-role",
    "vi-vu-user",
    "vi-vu-admin",
    "vi-vu-customer",
    "vi-vu-customer-email",
    "vi-vu-customer-name",
  ].forEach((key) => window.sessionStorage.removeItem(key));
}
