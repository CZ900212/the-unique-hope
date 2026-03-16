/**
 * Demo Mock API — replaces ApiClient for offline demos.
 * Load this AFTER api.js to override all endpoints with fake data.
 */
(function setupDemoApi() {
  const shouldUseDemoApi = (() => {
    if (window.__USE_DEMO_API === true || window.__USE_DEMO_API === "true") {
      return true;
    }

    const queryDemo = new URLSearchParams(window.location.search).get("demo") === "1";
    if (queryDemo) {
      return true;
    }

    let storageDemo = null;
    try {
      storageDemo = localStorage.getItem("uh_use_demo_api");
    } catch {
      storageDemo = null;
    }
    if (storageDemo === "1" || storageDemo === "true") {
      return true;
    }

    return false;
  })();

  if (!shouldUseDemoApi) {
    return;
  }

  const DEMO_KEY = 'demo_user';

  // ---------- fake data ----------
  const users = {
    admin:   { role: 'admin',   name: 'Admin',         username: 'admin' },
    teacher: { role: 'teacher', name: 'Sarah Chen',    username: 'sarah' },
    student: { role: 'student', name: 'Xiao Ming',     username: 'xiaoming' }
  };

  const fakePairings = [
    {
      id: '1',
      student: { name: 'Xiao Ming',  username: 'xiaoming',  contact: 'Parent: 138****1234' },
      teacher: { name: 'Sarah Chen',  username: 'sarah',     contact: '' },
      progress: { taughtCount: 8, totalWeeks: 20, lessons: buildLessons(8) }
    },
    {
      id: '2',
      student: { name: 'Xiao Hong',  username: 'xiaohong',  contact: 'Parent: 139****5678' },
      teacher: { name: 'James Li',   username: 'james',     contact: '' },
      progress: { taughtCount: 5, totalWeeks: 20, lessons: buildLessons(5) }
    },
    {
      id: '3',
      student: { name: 'Tian Tian',  username: 'tiantian',  contact: 'Parent: 137****9012' },
      teacher: { name: 'Emily Wang', username: 'emily',     contact: '' },
      progress: { taughtCount: 12, totalWeeks: 20, lessons: buildLessons(12) }
    }
  ];

  function buildLessons(taughtCount) {
    var lessons = [];
    var statuses = ['taught', 'teacher_leave', 'student_leave', 'sick'];
    for (var i = 1; i <= 20; i++) {
      var status = 'pending';
      if (i <= taughtCount) status = 'taught';
      else if (i === taughtCount + 1 && taughtCount < 20) status = statuses[Math.floor(Math.random() * 3) + 1];
      lessons.push({ week_number: i, status: status });
    }
    return lessons;
  }

  // In-memory lesson store for teacher save
  var teacherLessons = new Map();
  buildLessons(8).forEach(function (l) { teacherLessons.set(l.week_number, l); });

  var studentFeedbacks = {};

  var demoSignups = [
    { id: 'sig-1', childName: '小明', age: 8, phone: '138****1234', contact: '妈妈微信: mama123', status: 'pending', rejectReason: '', createdAt: Date.now() - 86400000, reviewedAt: null },
    { id: 'sig-2', childName: 'Lily', age: 10, phone: '139****5678', contact: '', status: 'approved', rejectReason: '', createdAt: Date.now() - 172800000, reviewedAt: Date.now() - 86400000 },
    { id: 'sig-3', childName: '天天', age: 6, phone: '137****9012', contact: 'QQ: 12345', status: 'rejected', rejectReason: '年龄不符合要求', createdAt: Date.now() - 259200000, reviewedAt: Date.now() - 172800000 }
  ];

  // ---------- delay helper ----------
  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms || 300); });
  }

  // ---------- mock ApiClient ----------
  window.ApiClient = {
    async login(payload) {
      await delay(400);
      var role = payload.role || 'student';
      if (!users[role]) throw Object.assign(new Error('Invalid role'), { status: 401 });
      sessionStorage.setItem(DEMO_KEY, JSON.stringify(users[role]));
      return { ok: true };
    },

    async logout() {
      await delay(200);
      sessionStorage.removeItem(DEMO_KEY);
      return { ok: true };
    },

    async me() {
      await delay(200);
      var raw = sessionStorage.getItem(DEMO_KEY);
      if (!raw) throw Object.assign(new Error('Not logged in'), { status: 401 });
      return JSON.parse(raw);
    },

    // ---- Admin ----
    async listPairings(page, pageSize) {
      await delay(300);
      return {
        pairings: fakePairings,
        pagination: { page: 1, totalPages: 1, total: fakePairings.length }
      };
    },
    async createPairing(payload) {
      await delay(400);
      var id = String(fakePairings.length + 1);
      var p = {
        id: id,
        student: payload.student,
        teacher: payload.teacher,
        progress: { taughtCount: 0, totalWeeks: 20, lessons: buildLessons(0) }
      };
      fakePairings.push(p);
      return p;
    },
    async deletePairing(id) {
      await delay(300);
      var idx = fakePairings.findIndex(function (p) { return p.id === id; });
      if (idx !== -1) fakePairings.splice(idx, 1);
      return { ok: true };
    },

    // ---- Teacher ----
    async teacherDashboard() {
      await delay(300);
      var lessons = [];
      teacherLessons.forEach(function (v) { lessons.push(v); });
      return {
        student: { name: 'Xiao Ming', contact: 'Parent: 138****1234' },
        latestSharedFeedback: { text: 'Teacher is very patient, I learned a lot today!' },
        progress: { lessons: lessons }
      };
    },
    async updateLesson(week, payload) {
      await delay(400);
      var lesson = teacherLessons.get(week) || { week_number: week };
      lesson.status = payload.status || lesson.status;
      lesson.notes = { text: payload.notesText || '', visibility: payload.notesVisibility || 'shared' };
      teacherLessons.set(week, lesson);
      return { lesson: lesson };
    },
    async uploadLessonEvidence(week, formData) {
      await delay(500);
      var file = formData.get('file');
      var url = file ? URL.createObjectURL(file) : null;
      var lesson = teacherLessons.get(week) || { week_number: week };
      lesson.evidenceUrl = url;
      teacherLessons.set(week, lesson);
      return { evidence: { signedUrl: url } };
    },

    // ---- Student ----
    async studentDashboard() {
      await delay(300);
      var weeks = [];
      for (var i = 1; i <= 20; i++) {
        var l = teacherLessons.get(i);
        weeks.push({ weekNumber: i, status: l ? l.status : 'pending' });
      }
      return { progress: { weeks: weeks } };
    },
    async studentLesson(week) {
      await delay(300);
      var lesson = teacherLessons.get(week) || null;
      var feedback = studentFeedbacks[week] || null;
      return { lesson: lesson, feedback: feedback };
    },
    async saveFeedback(week, payload) {
      await delay(400);
      studentFeedbacks[week] = payload;
      return { feedback: payload };
    },

    // ---- Signups ----
    async createStudentSignup(payload) {
      await delay(400);
      var signup = {
        id: 'sig-' + String(demoSignups.length + 1),
        childName: payload.childName,
        age: payload.age,
        phone: payload.phone,
        contact: payload.contact || '',
        status: 'pending',
        rejectReason: '',
        createdAt: Date.now(),
        reviewedAt: null
      };
      demoSignups.unshift(signup);
      return { signup: { id: signup.id, status: 'pending', createdAt: signup.createdAt } };
    },
    async listStudentSignups(page, pageSize, status) {
      await delay(300);
      var filtered = status && status !== 'all'
        ? demoSignups.filter(function (s) { return s.status === status; })
        : demoSignups;
      var total = filtered.length;
      var from = ((page || 1) - 1) * (pageSize || 20);
      var sliced = filtered.slice(from, from + (pageSize || 20));
      return {
        signups: sliced,
        pagination: { page: page || 1, pageSize: pageSize || 20, total: total, totalPages: Math.ceil(total / (pageSize || 20)) }
      };
    },
    async reviewStudentSignup(id, payload) {
      await delay(400);
      var signup = demoSignups.find(function (s) { return s.id === id; });
      if (!signup) throw Object.assign(new Error('Signup not found'), { status: 404 });
      if (signup.status !== 'pending') throw Object.assign(new Error('Already reviewed'), { status: 409 });
      signup.status = payload.action === 'approve' ? 'approved' : 'rejected';
      signup.rejectReason = payload.action === 'reject' ? (payload.reason || '') : '';
      signup.reviewedAt = Date.now();
      return { signup: signup };
    }
  };

  console.log('%c[DEMO MODE] Mock API active — no backend needed', 'color: #10B981; font-weight: bold;');
})();
