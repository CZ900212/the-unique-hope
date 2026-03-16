/**
 * The Unique Hope - Internationalization (i18n) Module
 * uniquehope（稀望俱乐部）- 国际化语言文件
 *
 * Based on: 稀望俱乐部罕见病公益授课须知及要求.pdf
 */

const i18n = {
  en: {
    // Navigation
    nav: {
      brand: "The Unique Hope",
      mission: "Mission",
      howItWorks: "How it Works",
      stories: "Stories",
      memberLogin: "Member Login",
      switchLang: "中文",
      logout: "Logout",
      backHome: "← Home",
      studentSignup: "Student Signup"
    },

    // Landing Page - Hero Section
    hero: {
      tag: "uniquehope · Est. 2025",
      title: "Ignite Every Child's",
      titleHighlight: "Unique Hope",
      description: "Free 1-on-1 online English courses for children aged 6-12 with rare diseases. We believe every child has unique potential, and we light up their future with love and patience.",
      ctaJoin: "Join Us",
      ctaLearn: "Learn More"
    },

    // Landing Page - Mission Section
    mission: {
      title: "Our Mission",
      subtitle: "Through weekly 1-on-1 English lessons, we provide learning support for children with rare diseases, helping them learn through stories and interaction.",
      feature1Title: "1-on-1 Personalized Teaching",
      feature1Desc: "Each volunteer teacher is matched with one student. Teaching content is customized based on the child's situation and progress, using Lexile English APP or designated materials.",
      feature2Title: "Flexible Interactive Courses",
      feature2Desc: "45-minute sessions once a week via Tencent Meeting. Incorporating game interactions, storytelling, phonics practice, and other innovative teaching methods.",
      feature3Title: "Official Certificate",
      feature3Desc: "Complete one term and meet assessment requirements to receive an official volunteer service certificate from Shanghai CORD Rare Disease Organization."
    },

    // Landing Page - Quote Section
    quote: {
      text: "Every child is unique. They deserve to be seen, loved, and supported. This is not just an English lesson, it's a delivery of hope.",
      author: "uniquehope",
      role: "Hangzhou · Rare Disease Charity Project"
    },

    // Landing Page - Footer
    footer: {
      description: "uniquehope — Providing free personalized online English courses for children with rare diseases, lighting up hope for every child with love and patience.",
      platformTitle: "Platform",
      studentEntry: "For Students",
      teacherEntry: "For Teachers",
      curriculum: "Curriculum",
      aboutTitle: "About",
      aboutUs: "About Us",
      joinVolunteer: "Become a Volunteer",
      contactUs: "Contact Us",
      copyright: "© 2025 The Unique Hope uniquehope",
      privacy: "Privacy Policy",
      terms: "Terms of Use"
    },

    // Login Page
    login: {
      subtitle: "Sign in to continue your journey",
      roleTeacher: "Teacher",
      roleStudent: "Student",
      roleAdmin: "Admin",
      username: "Username",
      password: "Password",
      adminId: "Admin ID",
      identifier: "Email or Username",
      signIn: "Sign In",
      dashboardAccess: "Dashboard Access",
      invalid: "Invalid credentials",
      denied: "Access Denied",
      demoTitle: "Demo Accounts (Click to fill):",
      demoAdmin: "Admin",
      demoTeacher: "Teacher",
      demoStudent: "Student"
    },

    // Student Portal
    student: {
      pageTitle: "Student Portal - The Unique Hope",
      sidebarJourney: "My Journey",
      dashTitle: "My Learning Path",
      dashSubtitle: "Track your progress and growth.",
      statusOnTrack: "On Track",
      weekLesson: "This Week's Lesson",
      waitingUpload: "Waiting for teacher upload...",
      teacherNotes: "Teacher's Notes:",
      certificateProgress: "Certificate Progress",
      lessonsCount: "Lessons",
      targetDate: "Target: Dec 2025",
      myFeedback: "My Feedback",
      feedbackPlaceholder: "How was the lesson? Share your thoughts...",
      rating: "Rating",
      submitFeedback: "Submit Feedback",
      feedbackSubmitted: "Feedback submitted!",
      feedbackEmpty: "Please enter feedback before submitting.",
      history: "History",
      weekPrefix: "Week ",
      weekSuffix: ""
    },

    // Teacher Portal
    teacher: {
      pageTitle: "Teacher Portal - The Unique Hope",
      sidebarLessons: "Weekly Lessons",
      sidebarGuidelines: "Guidelines",
      weekTitle: "Week",
      weekPrefix: "Week ",
      weekSuffix: "",
      termDate: "Sept 15 - Sept 21",
      statusPending: "Pending",
      statusTaught: "Taught",
      statusTeacherLeave: "Teacher Leave",
      statusStudentLeave: "Student Leave",
      statusSick: "Sick",
      lessonEvidence: "Lesson Evidence",
      btnTaught: "Taught",
      btnTeacherLeave: "T-Leave",
      btnStudentLeave: "S-Leave",
      btnSick: "Sick",
      uploadPrompt: "Click to upload screenshot",
      notesPlaceholder: "Lesson notes...",
      saveLesson: "Save Lesson",
      myStudent: "My Student",
      noStudent: "No student assigned",
      latestFeedback: "Latest Feedback:",
      noFeedback: "No feedback yet.",
      termProgress: "Term Progress",
      completionRate: "Completion Rate",
      lessonSaved: "Lesson saved!",

      // Week Selector
      weekSelector: "Week Selector",

      // Guidelines Modal
      guidelinesTitle: "Teaching Guidelines",
      guideline1: "One 45-minute session per week.",
      guideline2: "Use Tencent Meeting for lessons.",
      guideline3: "Upload a screenshot after every lesson.",
      guideline4: "Max 3 absences allowed per term.",
      closeBtn: "Close"
    },

    // Admin Dashboard
    admin: {
      pageTitle: "Admin Dashboard - The Unique Hope",
      menuPairings: "Pairings",
      menuProgress: "Progress",
      managePairings: "Manage Pairings",
      newPairing: "+ New Pairing",
      searchPlaceholder: "Search students or teachers...",
      thStudent: "Student",
      thStudentLogin: "Student Login",
      thTeacher: "Teacher",
      thTeacherLogin: "Teacher Login",
      thAction: "Action",
      thTotals: "Totals",
      noPairings: "No pairings found.",
      courseProgress: "Course Progress",
      exportCSV: "Export CSV",
      printRecords: "Print",
      filterAll: "All",
      filterTeacherLeave: "Teacher Leave",
      filterStudentLeave: "Student Leave",
      deleteConfirm: "Delete?",

      // Modal
      modalTitle: "New Pairing",

      // Signup Management
      menuSignups: "Signups",
      signupTitle: "Signup Applications",
      signupFilterAll: "All",
      signupFilterPending: "Pending",
      signupFilterApproved: "Approved",
      signupFilterRejected: "Rejected",
      signupThName: "Name",
      signupThAge: "Age",
      signupThPhone: "Phone",
      signupThContact: "Contact",
      signupThStatus: "Status",
      signupThTime: "Submitted",
      signupThAction: "Action",
      signupApprove: "Approve",
      signupReject: "Reject",
      signupRejectReason: "Rejection Reason",
      signupRejectPlaceholder: "Please enter the reason for rejection...",
      signupNoReason: "No reason provided",
      signupAlreadyReviewed: "This signup has already been reviewed",
      signupNoRecords: "No signup records found.",
      signupConfirmReject: "Confirm Reject",
      studentSection: "Student",
      teacherSection: "Teacher",
      fieldName: "Name",
      fieldContact: "Contact",
      fieldUsername: "Username",
      fieldPassword: "Password",
      btnCancel: "Cancel",
      btnCreate: "Create"
    },

    // Signup Page
    signup: {
      pageTitle: "Student Signup - The Unique Hope",
      childName: "Child's Name",
      age: "Age",
      phone: "Phone Number",
      contact: "Other Contact (optional)",
      submit: "Submit Signup",
      success: "Signup submitted! We will review your application soon.",
      backHome: "← Back to Home",
      backLogin: "Already have an account? Sign in"
    },

    // Common / Shared
    common: {
      loading: "Loading...",
      error: "Error",
      success: "Success",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      close: "Close",
      confirm: "Confirm",
      back: "Back",
      networkError: "Network error, please refresh and try again.",
      submitting: "Submitting...",
      saving: "Saving...",
      deleteFailed: "Delete failed",
      createFailed: "Create failed",
      shared: "Shared",
      private: "Private",
      notesVisibility: "Notes Visibility",
      shareWithStudent: "Share with student",
      prev: "Prev",
      next: "Next",
      fileTooLarge: "File must be under 5 MB",
      unsupportedFileType: "Unsupported file type",
      submitFailed: "Submit failed",
      meetingLink: "Meeting Link",
      meetingLinkTitle: "Tencent Meeting Link",
      noMeetingLink: "No meeting link available yet.",
      copyLink: "Copy Link",
      linkCopied: "Link copied!",
      openMeeting: "Open Meeting"
    }
  },

  zh: {
    // 导航
    nav: {
      brand: "稀望俱乐部",
      mission: "使命",
      howItWorks: "了解更多",
      stories: "故事",
      memberLogin: "会员登录",
      switchLang: "English",
      logout: "退出登录",
      backHome: "← 首页",
      studentSignup: "学生报名"
    },

    // 首页 - Hero区域
    hero: {
      tag: "稀望俱乐部 · Est. 2025",
      title: "点亮每个孩子的",
      titleHighlight: "独特希望",
      description: "为6-12岁罕见病儿童提供免费1对1在线英语课程。我们相信每个孩子都有独特的潜力，用爱与耐心点亮他们的未来。",
      ctaJoin: "加入我们",
      ctaLearn: "了解更多"
    },

    // 首页 - 使命区域
    mission: {
      title: "我们的使命",
      subtitle: "通过每周1对1英语课，为罕见病儿童提供学习支持，在故事和互动中学习知识",
      feature1Title: "1对1个性化教学",
      feature1Desc: "每位志愿者老师匹配一位学生，根据孩子的情况和进度定制教学内容，使用蓝思英语APP或指定教材",
      feature2Title: "灵活互动课程",
      feature2Desc: "每周一次45分钟课程，通过腾讯会议进行。融入游戏互动、故事讲解、拼读练习等创新教学模式",
      feature3Title: "权威证书认证",
      feature3Desc: "完成一期课程并满足考核要求，可获得上海蔻德罕见病机构颁发的权威志愿服务证书"
    },

    // 首页 - 引用区域
    quote: {
      text: "每一个孩子都是独特的，他们值得被看见、被关爱、被支持。这不仅是一堂英语课，更是一份希望的传递。",
      author: "稀望俱乐部",
      role: "杭州 · 罕见病公益项目"
    },

    // 首页 - 页脚
    footer: {
      description: "稀望俱乐部 — 为罕见病儿童提供免费个性化在线英语课程，用爱心和耐心点亮每个孩子的希望之光",
      platformTitle: "平台",
      studentEntry: "学生入口",
      teacherEntry: "教师入口",
      curriculum: "课程介绍",
      aboutTitle: "关于",
      aboutUs: "关于我们",
      joinVolunteer: "加入志愿者",
      contactUs: "联系我们",
      copyright: "© 2025 The Unique Hope 稀望俱乐部",
      privacy: "隐私政策",
      terms: "使用条款"
    },

    // 登录页面
    login: {
      subtitle: "登录以继续您的旅程",
      roleTeacher: "教师",
      roleStudent: "学生",
      roleAdmin: "管理员",
      username: "用户名",
      password: "密码",
      adminId: "管理员ID",
      identifier: "邮箱或账号",
      signIn: "登录",
      dashboardAccess: "进入后台",
      invalid: "凭证无效",
      denied: "拒绝访问",
      demoTitle: "演示账号 (点击填充):",
      demoAdmin: "管理员",
      demoTeacher: "教师",
      demoStudent: "学生"
    },

    // 学生门户
    student: {
      pageTitle: "学生门户 - 稀望俱乐部",
      sidebarJourney: "我的学习",
      dashTitle: "我的学习路径",
      dashSubtitle: "跟踪您的进步和成长。",
      statusOnTrack: "进度正常",
      weekLesson: "本周课程",
      waitingUpload: "等待老师上传...",
      teacherNotes: "老师备注：",
      certificateProgress: "证书进度",
      lessonsCount: "课时",
      targetDate: "目标：2025年12月",
      myFeedback: "我的反馈",
      feedbackPlaceholder: "这节课怎么样？分享您的想法...",
      rating: "评分",
      submitFeedback: "提交反馈",
      feedbackSubmitted: "反馈已提交！",
      feedbackEmpty: "请先输入反馈内容再提交。",
      history: "历史记录",
      weekPrefix: "第",
      weekSuffix: "周"
    },

    // 教师门户
    teacher: {
      pageTitle: "教师门户 - 稀望俱乐部",
      sidebarLessons: "每周课程",
      sidebarGuidelines: "教学须知",
      weekTitle: "第",
      weekPrefix: "第",
      weekSuffix: "周",
      termDate: "9月15日 - 9月21日",
      statusPending: "待完成",
      statusTaught: "已授课",
      statusTeacherLeave: "老师请假",
      statusStudentLeave: "学生请假",
      statusSick: "生病",
      lessonEvidence: "授课证据",
      btnTaught: "已授课",
      btnTeacherLeave: "老师请假",
      btnStudentLeave: "学生请假",
      btnSick: "生病",
      uploadPrompt: "点击上传截图",
      notesPlaceholder: "课程备注...",
      saveLesson: "保存课程",
      myStudent: "我的学生",
      noStudent: "暂无分配学生",
      latestFeedback: "最新反馈：",
      noFeedback: "暂无反馈。",
      termProgress: "学期进度",
      completionRate: "完成率",
      lessonSaved: "课程已保存！",

      // 周选择器
      weekSelector: "周选择",

      // 教学须知弹窗
      guidelinesTitle: "教学须知",
      guideline1: "每周为罕见病孩子上1次课，每课约40-45分钟",
      guideline2: "使用腾讯会议进行授课",
      guideline3: "每次授课后上传截图作为证据",
      guideline4: "一学期累计旷课达3次，将取消本期证书获取资格",
      closeBtn: "关闭"
    },

    // 管理员仪表板
    admin: {
      pageTitle: "管理后台 - 稀望俱乐部",
      menuPairings: "配对管理",
      menuProgress: "进度查看",
      managePairings: "管理配对",
      newPairing: "+ 新建配对",
      searchPlaceholder: "搜索学生或老师...",
      thStudent: "学生",
      thStudentLogin: "学生账号",
      thTeacher: "教师",
      thTeacherLogin: "教师账号",
      thAction: "操作",
      thTotals: "合计",
      noPairings: "暂无配对记录。",
      courseProgress: "课程进度",
      exportCSV: "导出CSV",
      printRecords: "打印",
      filterAll: "全部",
      filterTeacherLeave: "老师请假",
      filterStudentLeave: "学生请假",
      deleteConfirm: "确定删除？",

      // 弹窗
      modalTitle: "新建配对",

      // 报名管理
      menuSignups: "报名申请",
      signupTitle: "报名申请管理",
      signupFilterAll: "全部",
      signupFilterPending: "待审核",
      signupFilterApproved: "已通过",
      signupFilterRejected: "已拒绝",
      signupThName: "姓名",
      signupThAge: "年龄",
      signupThPhone: "电话",
      signupThContact: "联系方式",
      signupThStatus: "状态",
      signupThTime: "提交时间",
      signupThAction: "操作",
      signupApprove: "通过",
      signupReject: "拒绝",
      signupRejectReason: "拒绝原因",
      signupRejectPlaceholder: "请输入拒绝原因...",
      signupNoReason: "未提供原因",
      signupAlreadyReviewed: "该报名已审核",
      signupNoRecords: "暂无报名记录。",
      signupConfirmReject: "确认拒绝",
      studentSection: "学生信息",
      teacherSection: "教师信息",
      fieldName: "姓名",
      fieldContact: "联系方式",
      fieldUsername: "用户名",
      fieldPassword: "密码",
      btnCancel: "取消",
      btnCreate: "创建"
    },

    // 报名页面
    signup: {
      pageTitle: "学生报名 - 稀望俱乐部",
      childName: "孩子姓名",
      age: "年龄",
      phone: "联系电话",
      contact: "其他联系方式（选填）",
      submit: "提交报名",
      success: "报名已提交！我们会尽快审核您的申请。",
      backHome: "← 返回首页",
      backLogin: "已有账号？去登录"
    },

    // 通用 / 共享
    common: {
      loading: "加载中...",
      error: "错误",
      success: "成功",
      save: "保存",
      cancel: "取消",
      delete: "删除",
      edit: "编辑",
      close: "关闭",
      confirm: "确认",
      back: "返回",
      networkError: "网络异常，请刷新重试。",
      submitting: "提交中...",
      saving: "保存中...",
      deleteFailed: "删除失败",
      createFailed: "创建失败",
      shared: "共享",
      private: "私密",
      notesVisibility: "备注可见性",
      shareWithStudent: "与学生共享",
      prev: "上一页",
      next: "下一页",
      fileTooLarge: "文件不能超过 5 MB",
      unsupportedFileType: "不支持的文件类型",
      submitFailed: "提交失败",
      meetingLink: "上课链接",
      meetingLinkTitle: "腾讯会议链接",
      noMeetingLink: "暂无会议链接。",
      copyLink: "复制链接",
      linkCopied: "链接已复制！",
      openMeeting: "打开会议"
    }
  }
};

// Language utility functions
const I18nUtils = {
  // Get current language from localStorage or default to 'en'
  getCurrentLang() {
    try {
      const settings = JSON.parse(localStorage.getItem('settings'));
      return settings?.language || 'en';
    } catch {
      return 'en';
    }
  },

  // Set current language
  setCurrentLang(langCode) {
    try {
      const settings = JSON.parse(localStorage.getItem('settings') || '{}');
      settings.language = langCode;
      localStorage.setItem('settings', JSON.stringify(settings));
    } catch {
      // ignore storage failures; keep language in memory only
    }
  },

  // Get translation by key path (e.g., 'login.username')
  t(keyPath, langCode = null) {
    const lang = langCode || this.getCurrentLang();
    const keys = keyPath.split('.');
    let value = i18n[lang];
    
    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return keyPath; // Return key if translation not found
      }
    }
    
    return (value !== undefined && value !== null) ? value : keyPath;
  },

  // Apply translations to all elements with data-i18n attribute
  applyTranslations(langCode = null) {
    const lang = langCode || this.getCurrentLang();
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const keyPath = el.dataset.i18n;
      const translation = this.t(keyPath, lang);
      if (translation !== keyPath) {
        el.textContent = translation;
      }
    });

    // Handle placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const keyPath = el.dataset.i18nPlaceholder;
      const translation = this.t(keyPath, lang);
      if (translation !== keyPath) {
        el.placeholder = translation;
      }
    });
  },

  // Toggle between languages
  toggleLang() {
    const currentLang = this.getCurrentLang();
    const newLang = currentLang === 'en' ? 'zh' : 'en';
    this.setCurrentLang(newLang);
    this.applyTranslations(newLang);
    return newLang;
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { i18n, I18nUtils };
}
