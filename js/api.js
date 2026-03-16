(function bootstrapApiClient() {
  function safeStorageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  const isLocalHost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const isHttpProtocol = window.location.protocol === "http:" || window.location.protocol === "https:";
  const localPort = window.location.port;
  const shouldUseProxyBase =
    isLocalHost &&
    isHttpProtocol &&
    (localPort === "5173" || localPort === "4173" || localPort === "3000");
  const configuredApiBase = safeStorageGet("UNIQUE_HOPE_API_BASE");
  const API_BASE =
    window.UNIQUE_HOPE_API_BASE ||
    configuredApiBase ||
    (shouldUseProxyBase ? "/api" : isLocalHost ? "http://localhost:8080/api" : "/api");

  function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)uh_csrf_token=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function csrfHeaders(method) {
    if (["GET", "HEAD", "OPTIONS"].includes(method)) return {};
    const token = getCsrfToken();
    return token ? { "X-CSRF-Token": token } : {};
  }

  async function request(path, options) {
    const method = (options?.method || "GET").toUpperCase();
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        ...csrfHeaders(method),
        ...(options?.headers || {})
      }
    });

    let payload = null;
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (_error) {
        payload = { raw: text };
      }
    }

    if (!response.ok) {
      const message =
        payload?.error?.message || payload?.message || `Request failed: ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload || {};
  }

  const ApiClient = {
    get(path) {
      return request(path, { method: "GET" });
    },
    post(path, body) {
      return request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      });
    },
    put(path, body) {
      return request(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      });
    },
    del(path) {
      return request(path, { method: "DELETE" });
    },
    patch(path, body) {
      return request(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      });
    },
    postForm(path, formData) {
      return request(path, {
        method: "POST",
        body: formData
      });
    },

    login(payload) {
      return this.post("/auth/login", payload);
    },
    logout() {
      return this.post("/auth/logout", {});
    },
    me() {
      return this.get("/auth/me");
    },
    listPairings(page = 1, pageSize = 20) {
      return this.get(`/admin/pairings?page=${page}&pageSize=${pageSize}`);
    },
    createPairing(payload) {
      return this.post("/admin/pairings", payload);
    },
    deletePairing(id) {
      return this.del(`/admin/pairings/${id}`);
    },
    teacherDashboard() {
      return this.get("/teacher/me/dashboard");
    },
    updateLesson(week, payload) {
      return this.put(`/teacher/me/lessons/${week}`, payload);
    },
    uploadLessonEvidence(week, formData) {
      return this.postForm(`/teacher/me/lessons/${week}/evidence`, formData);
    },
    studentDashboard() {
      return this.get("/student/me/dashboard");
    },
    studentLesson(week) {
      return this.get(`/student/me/lessons/${week}`);
    },
    saveFeedback(week, payload) {
      return this.put(`/student/me/feedback/${week}`, payload);
    },
    createStudentSignup(payload) {
      return this.post("/public/student-signups", payload);
    },
    listStudentSignups(page = 1, pageSize = 20, status = "all") {
      return this.get(`/admin/student-signups?page=${page}&pageSize=${pageSize}&status=${status}`);
    },
    reviewStudentSignup(id, payload) {
      return this.patch(`/admin/student-signups/${id}/review`, payload);
    }
  };

  window.ApiClient = ApiClient;
})();
