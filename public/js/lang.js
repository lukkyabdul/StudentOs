const translations = {
  en: {
    dashboard: "Dashboard",
    timetable: "Timetable",
    notes: "Notes",
    assignments: "Assignments",
    attendance: "Attendance",
    ai_assistant: "AI Assistant",
    calendar: "Calendar",
    cgpa: "CGPA Calculator",
    expenses: "Expenses",
    digital_id: "Digital ID",
    habits: "Habit Tracker",
    file_storage: "File Storage",
    question_papers: "Question Papers",
    placement_prep: "Placement Prep",
    resume_builder: "Resume Builder",
    dark_mode: "Dark Mode",
    light_mode: "Light Mode",
    welcome: "Welcome back",
    logout: "Log Out",
    language: "Language",
    today_schedule: "Today's Schedule",
    pending_tasks: "Pending Assignments",
    habit_status: "Today's Habits",
    budget_status: "Monthly Budget Tracker",
    admin_panel: "Admin Panel"
  },
  hi: {
    dashboard: "डैशबोर्ड",
    timetable: "समय-सारणी",
    notes: "नोट्स",
    assignments: "असाइनमेंट",
    attendance: "उपस्थिति",
    ai_assistant: "एआई सहायक",
    calendar: "कैलेंडर",
    cgpa: "सीजीपीए कैलकुलेटर",
    expenses: "खर्च ट्रैकर",
    digital_id: "डिजिटल आईडी",
    habits: "आदत ट्रैकर",
    file_storage: "फाइल स्टोरेज",
    question_papers: "पिछले वर्ष के प्रश्न पत्र",
    placement_prep: "प्लेसमेंट तैयारी",
    resume_builder: "रेज़्यूमे बिल्डर",
    dark_mode: "डार्क मोड",
    light_mode: "लाइट मोड",
    welcome: "स्वागत है",
    logout: "लॉग आउट",
    language: "भाषा",
    today_schedule: "आज की समय-सारणी",
    pending_tasks: "लंबित असाइनमेंट",
    habit_status: "आज की आदतें",
    budget_status: "मासिक बजट ट्रैकर",
    admin_panel: "प्रशासनिक पैनल"
  },
  es: {
    dashboard: "Tablero",
    timetable: "Horario",
    notes: "Notas",
    assignments: "Tareas",
    attendance: "Asistencia",
    ai_assistant: "Asistente IA",
    calendar: "Calendario",
    cgpa: "Calculadora CGPA",
    expenses: "Gastos",
    digital_id: "ID Digital",
    habits: "Hábitos",
    file_storage: "Archivos",
    question_papers: "Exámenes Anteriores",
    placement_prep: "Preparación",
    resume_builder: "Currículum",
    dark_mode: "Modo Oscuro",
    light_mode: "Modo Claro",
    welcome: "Bienvenido",
    logout: "Cerrar Sesión",
    language: "Idioma",
    today_schedule: "Horario de Hoy",
    pending_tasks: "Tareas Pendientes",
    habit_status: "Hábitos de Hoy",
    budget_status: "Presupuesto Mensual",
    admin_panel: "Panel de Admin"
  }
};

window.StudentOSLang = {
  current: localStorage.getItem('student_os_lang') || 'en',
  
  get(key) {
    const dict = translations[this.current] || translations['en'];
    return dict[key] || key;
  },
  
  set(lang) {
    if (translations[lang]) {
      this.current = lang;
      localStorage.setItem('student_os_lang', lang);
      document.dispatchEvent(new Event('languagechanged'));
    }
  }
};
