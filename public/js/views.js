// --- HELPER FUNCTION: Fetch wrapper for error handling ---
async function fetchAPI(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('student_os_user');
      window.location.href = '/login.html';
      return null;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API Error');
    return data;
  } catch (err) {
    console.error('Fetch Error:', err);
    alert('Operation failed: ' + err.message);
    return null;
  }
}

window.StudentOSViews = {
  // ----------------------------------------------------
  // VIEW 1: DASHBOARD OVERVIEW
  // ----------------------------------------------------
  async dashboard(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-wrap">
          <h2 class="view-title" data-localize="welcome">Welcome back, User!</h2>
          <p class="view-subtitle" id="dashSubtitle"></p>
        </div>
      </div>
      
      <div class="overview-stats">
        <div class="card stat-card">
          <div class="stat-icon"><i class="fa-solid fa-graduation-cap"></i></div>
          <div class="stat-info">
            <span class="stat-value" id="statCGPA">0.00</span>
            <span class="stat-label">Current CGPA</span>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon"><i class="fa-solid fa-user-check"></i></div>
          <div class="stat-info">
            <span class="stat-value" id="statAttendance">0%</span>
            <span class="stat-label">Avg Attendance</span>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon"><i class="fa-solid fa-wallet"></i></div>
          <div class="stat-info">
            <span class="stat-value" id="statExpenses">$0</span>
            <span class="stat-label">This Month Expenses</span>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon"><i class="fa-solid fa-tasks"></i></div>
          <div class="stat-info">
            <span class="stat-value" id="statTasks">0</span>
            <span class="stat-label">Pending Tasks</span>
          </div>
        </div>
      </div>
      
      <div class="grid-2">
        <div class="card">
          <h3 class="card-title" data-localize="today_schedule"><i class="fa-solid fa-calendar-day"></i> Today's Schedule</h3>
          <div id="dashTimetable" style="display:flex; flex-direction:column; gap:10px; max-height: 250px; overflow-y:auto;">
            <p style="color:var(--text-muted); font-size:0.9rem;">Loading schedule...</p>
          </div>
        </div>
        
        <div class="card">
          <h3 class="card-title" data-localize="pending_tasks"><i class="fa-solid fa-tasks"></i> Pending Assignments</h3>
          <div id="dashAssignments" style="display:flex; flex-direction:column; gap:10px; max-height: 250px; overflow-y:auto;">
            <p style="color:var(--text-muted); font-size:0.9rem;">Loading assignments...</p>
          </div>
        </div>
      </div>
      
      <div class="grid-2" style="margin-top: 24px;">
        <div class="card">
          <h3 class="card-title" data-localize="budget_status"><i class="fa-solid fa-wallet"></i> Monthly Budget Status</h3>
          <div id="dashBudget">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.95rem;">
              <span>Expense / Income</span>
              <span id="dashBudgetText">$0 / $0</span>
            </div>
            <div class="budget-progress-bar">
              <div class="budget-progress-fill" id="dashBudgetFill" style="width: 0%;"></div>
            </div>
          </div>
        </div>
        
        <div class="card">
          <h3 class="card-title" data-localize="habit_status"><i class="fa-solid fa-heart-pulse"></i> Today's Habit Checklist</h3>
          <div id="dashHabits" style="display:flex; flex-direction:column; gap:10px;">
            <p style="color:var(--text-muted); font-size:0.9rem;">Loading habits...</p>
          </div>
        </div>
      </div>
    `;

    // Populate data
    const user = JSON.parse(localStorage.getItem('student_os_user')) || { fullName: 'Student', collegeName: '' };
    container.querySelector('.view-title').innerText = `${window.StudentOSLang.get('welcome')}, ${user.fullName}!`;
    document.getElementById('dashSubtitle').innerText = user.collegeName || 'Student OS Workspace';

    // Fetch and populate stats
    const timetable = await fetchAPI('/api/timetable') || [];
    const assignments = await fetchAPI('/api/assignments') || [];
    const attendance = await fetchAPI('/api/attendance') || [];
    const expenses = await fetchAPI('/api/expenses') || [];
    const habits = await fetchAPI('/api/habits') || [];
    const resumes = await fetchAPI('/api/resumes') || [];

    // CGPA Stat
    if (resumes.length > 0 && resumes[0].education && resumes[0].education[0]) {
      const cgpaVal = resumes[0].education[0].cgpa || '0.00';
      document.getElementById('statCGPA').innerText = cgpaVal;
    } else {
      document.getElementById('statCGPA').innerText = 'N/A';
    }

    // Attendance Avg Stat
    if (attendance.length > 0) {
      const totalAttended = attendance.reduce((sum, item) => sum + item.attended, 0);
      const totalClasses = attendance.reduce((sum, item) => sum + item.total, 0);
      const percentage = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 100;
      document.getElementById('statAttendance').innerText = `${percentage}%`;
    } else {
      document.getElementById('statAttendance').innerText = 'N/A';
    }

    // Expenses Stat
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    const currentMonthExpenses = expenses.filter(e => e.type === 'expense' && e.date.startsWith(currentMonth));
    const totalExp = currentMonthExpenses.reduce((sum, item) => sum + item.amount, 0);
    document.getElementById('statExpenses').innerText = `$${totalExp}`;

    // Pending Tasks Stat
    const pendingTasks = assignments.filter(a => a.status !== 'Completed');
    document.getElementById('statTasks').innerText = pendingTasks.length;

    // Today's Timetable List
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    const todayClasses = timetable.filter(t => t.day === today).sort((a,b) => a.startTime.localeCompare(b.startTime));
    
    const ttBox = document.getElementById('dashTimetable');
    if (todayClasses.length === 0) {
      ttBox.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">No classes scheduled for today.</p>`;
    } else {
      ttBox.innerHTML = todayClasses.map(c => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-input); border-radius:var(--border-radius-sm); border:1px solid var(--border-color);">
          <div>
            <div style="font-weight:600; font-size:0.95rem;">${c.subject}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);"><i class="fa-solid fa-location-dot"></i> Room: ${c.room || 'N/A'} | Instructor: ${c.instructor || 'N/A'}</div>
          </div>
          <span style="font-size:0.85rem; font-weight:600; color:var(--secondary);">${c.startTime} - ${c.endTime}</span>
        </div>
      `).join('');
    }

    // Pending Assignments List
    const assBox = document.getElementById('dashAssignments');
    const sortedPending = pendingTasks.sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 3);
    if (sortedPending.length === 0) {
      assBox.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">All clear! No pending assignments.</p>`;
    } else {
      assBox.innerHTML = sortedPending.map(a => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-input); border-radius:var(--border-radius-sm); border:1px solid var(--border-color);">
          <div>
            <div style="font-weight:600; font-size:0.95rem;">${a.title}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">Due: ${new Date(a.dueDate).toLocaleDateString()}</div>
          </div>
          <span class="badge badge-${a.priority.toLowerCase()}">${a.priority}</span>
        </div>
      `).join('');
    }

    // Monthly Budget status
    const currentMonthTransactions = expenses.filter(e => e.date.startsWith(currentMonth));
    const income = currentMonthTransactions.filter(e => e.type === 'income').reduce((sum, item) => sum + item.amount, 0);
    const expense = currentMonthTransactions.filter(e => e.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
    document.getElementById('dashBudgetText').innerText = `$${expense} / $${income || 0}`;
    const budgetPct = income > 0 ? Math.min(100, Math.round((expense / income) * 100)) : (expense > 0 ? 100 : 0);
    document.getElementById('dashBudgetFill').style.width = `${budgetPct}%`;

    // Today's Habit List
    const dateStr = new Date().toISOString().split('T')[0];
    const habitBox = document.getElementById('dashHabits');
    if (habits.length === 0) {
      habitBox.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">No habits added. Open the Habit Tracker to add habits!</p>`;
    } else {
      habitBox.innerHTML = habits.slice(0, 4).map(h => {
        const isDone = h.history && h.history[dateStr];
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg-input); border-radius:var(--border-radius-sm); border:1px solid var(--border-color);">
            <span style="font-weight:500; font-size:0.9rem;">${h.name}</span>
            <button class="habit-checkbox ${isDone ? 'completed' : ''}" onclick="toggleHabitDash('${h.id}', '${dateStr}', this)">
              ${isDone ? '<i class="fa-solid fa-check"></i>' : ''}
            </button>
          </div>
        `;
      }).join('');
    }
  },

  // ----------------------------------------------------
  // VIEW 2: TIMETABLE
  // ----------------------------------------------------
  async timetable(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-wrap">
          <h2 class="view-title" data-localize="timetable">Timetable Manager</h2>
          <p class="view-subtitle">Organize and view your weekly class schedules.</p>
        </div>
        <button class="btn btn-primary" onclick="openAddClassModal()"><i class="fa-solid fa-plus"></i> Add Class</button>
      </div>
      
      <div class="card timetable-grid" id="timetableMainGrid">
        <!-- Monday to Friday columns injected here -->
      </div>
      
      <!-- ADD CLASS MODAL -->
      <div id="addClassModal" class="card" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:1000; width:450px; max-width:90%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h3 class="card-title" style="margin:0;"><i class="fa-solid fa-plus"></i> Add Class</h3>
          <button class="btn btn-secondary" onclick="closeAddClassModal()" style="padding:4px 8px;">X</button>
        </div>
        <form onsubmit="handleAddClass(event)">
          <div class="input-group">
            <label class="input-label">Subject Name</label>
            <input type="text" id="ttSubject" class="input-field" placeholder="e.g. Algorithms" required>
          </div>
          <div class="input-group">
            <label class="input-label">Day of Week</label>
            <select id="ttDay" class="input-field">
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
            </select>
          </div>
          <div class="grid-2">
            <div class="input-group">
              <label class="input-label">Start Time</label>
              <input type="time" id="ttStart" class="input-field" required>
            </div>
            <div class="input-group">
              <label class="input-label">End Time</label>
              <input type="time" id="ttEnd" class="input-field" required>
            </div>
          </div>
          <div class="grid-2">
            <div class="input-group">
              <label class="input-label">Room Number</label>
              <input type="text" id="ttRoom" class="input-field" placeholder="e.g. Lab 3A">
            </div>
            <div class="input-group">
              <label class="input-label">Instructor</label>
              <input type="text" id="ttInstructor" class="input-field" placeholder="e.g. Prof. Smith">
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">Save Class</button>
        </form>
      </div>
      <div id="modalOverlay" onclick="closeAddClassModal()" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999;"></div>
    `;

    // Render classes
    const classes = await fetchAPI('/api/timetable') || [];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const grid = document.getElementById('timetableMainGrid');
    
    grid.innerHTML = days.map(day => {
      const dayClasses = classes.filter(c => c.day === day).sort((a,b) => a.startTime.localeCompare(b.startTime));
      return `
        <div class="timetable-day-col">
          <div class="timetable-day-header">${day}</div>
          <div style="display:flex; flex-direction:column; gap:10px; min-height:100px;">
            ${dayClasses.map(c => `
              <div class="class-card">
                <button class="class-delete-btn" onclick="deleteClass('${c.id}')"><i class="fa-solid fa-trash"></i></button>
                <div style="font-weight:600; font-size:0.95rem; margin-bottom:4px;">${c.subject}</div>
                <div class="class-time"><i class="fa-regular fa-clock"></i> ${c.startTime} - ${c.endTime}</div>
                <div class="class-room"><i class="fa-solid fa-location-dot"></i> Room ${c.room || 'N/A'}</div>
                <div style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">${c.instructor || ''}</div>
              </div>
            `).join('')}
            ${dayClasses.length === 0 ? '<div style="text-align:center; padding:20px; font-size:0.75rem; color:var(--text-muted);">No Classes</div>' : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  // ----------------------------------------------------
  // VIEW 3: NOTES
  // ----------------------------------------------------
  async notes(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-wrap">
          <h2 class="view-title" data-localize="notes">Academic Notes</h2>
          <p class="view-subtitle">Create, organize, and search your subject notes.</p>
        </div>
        <button class="btn btn-primary" onclick="newNote()"><i class="fa-solid fa-plus"></i> New Note</button>
      </div>
      
      <div class="notes-container">
        <!-- Sidebar: List of notes -->
        <div class="notes-sidebar">
          <div class="input-group">
            <input type="text" id="noteSearch" class="input-field" placeholder="Search notes..." oninput="filterNotes()">
          </div>
          <div class="notes-list" id="notesListContainer">
            <p style="color:var(--text-muted); font-size:0.9rem;">Loading notes...</p>
          </div>
        </div>
        
        <!-- Main: Note Editor -->
        <div class="card note-editor" id="noteEditorContainer">
          <p style="color:var(--text-muted); text-align:center; padding:100px 0;">Select a note to view or create a new note.</p>
        </div>
      </div>
    `;

    // Load Note List
    window.allNotes = await fetchAPI('/api/notes') || [];
    renderNoteList(window.allNotes);
  },

  // ----------------------------------------------------
  // VIEW 4: ASSIGNMENTS
  // ----------------------------------------------------
  async assignments(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-wrap">
          <h2 class="view-title" data-localize="assignments">Assignments & Tasks</h2>
          <p class="view-subtitle">Track course assignments, priorities, and deadlines.</p>
        </div>
        <button class="btn btn-primary" onclick="openAddAssignmentModal()"><i class="fa-solid fa-plus"></i> New Task</button>
      </div>
      
      <div class="grid-3" style="margin-bottom:24px;">
        <div class="card" style="padding:15px; display:flex; align-items:center; justify-content:space-between;">
          <span style="font-weight:600;">Status Filter</span>
          <select id="assFilterStatus" class="input-field" style="padding:6px 12px; font-size:0.85rem;" onchange="filterAssignments()">
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
        
        <div class="card" style="padding:15px; display:flex; align-items:center; justify-content:space-between;">
          <span style="font-weight:600;">Priority Filter</span>
          <select id="assFilterPriority" class="input-field" style="padding:6px 12px; font-size:0.85rem;" onchange="filterAssignments()">
            <option value="All">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>

        <div class="card" style="padding:15px; display:flex; align-items:center; justify-content:space-between;">
          <span style="font-weight:600;">Subject Search</span>
          <input type="text" id="assFilterSubject" class="input-field" style="padding:6px 12px; font-size:0.85rem; width:150px;" placeholder="Search Subject..." oninput="filterAssignments()">
        </div>
      </div>
      
      <div class="card assignment-list" id="assignmentList">
        <p style="color:var(--text-muted); font-size:0.9rem; text-align:center;">Loading assignments...</p>
      </div>

      <!-- ADD ASSIGNMENT MODAL -->
      <div id="addAssignmentModal" class="card" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:1000; width:450px; max-width:90%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h3 class="card-title" style="margin:0;"><i class="fa-solid fa-plus"></i> New Assignment</h3>
          <button class="btn btn-secondary" onclick="closeAddAssignmentModal()" style="padding:4px 8px;">X</button>
        </div>
        <form onsubmit="handleAddAssignment(event)">
          <div class="input-group">
            <label class="input-label">Assignment Title</label>
            <input type="text" id="assTitle" class="input-field" placeholder="e.g. Lab Report 2" required>
          </div>
          <div class="grid-2">
            <div class="input-group">
              <label class="input-label">Subject/Course</label>
              <input type="text" id="assSubject" class="input-field" placeholder="e.g. Physics" required>
            </div>
            <div class="input-group">
              <label class="input-label">Due Date</label>
              <input type="date" id="assDueDate" class="input-field" required>
            </div>
          </div>
          <div class="grid-2">
            <div class="input-group">
              <label class="input-label">Priority</label>
              <select id="assPriority" class="input-field">
                <option value="Low">Low</option>
                <option value="Medium" selected>Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Status</label>
              <select id="assStatus" class="input-field">
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>
          <div class="input-group">
            <label class="input-label">Description / Instructions</label>
            <textarea id="assDesc" class="input-field" rows="3" placeholder="Add assignment details..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">Save Assignment</button>
        </form>
      </div>
      <div id="assOverlay" onclick="closeAddAssignmentModal()" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999;"></div>
    `;

    // Load List
    window.allAssignments = await fetchAPI('/api/assignments') || [];
    renderAssignmentsList(window.allAssignments);
  },

  // ----------------------------------------------------
  // VIEW 5: ATTENDANCE TRACKING
  // ----------------------------------------------------
  async attendance(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-wrap">
          <h2 class="view-title" data-localize="attendance">Attendance Tracker</h2>
          <p class="view-subtitle">Track your class attendance and keep target percentage above 75%.</p>
        </div>
        <button class="btn btn-primary" onclick="openAddAttendanceModal()"><i class="fa-solid fa-plus"></i> Add Subject</button>
      </div>
      
      <div class="attendance-cards" id="attendanceGrid">
        <p style="color:var(--text-muted); font-size:0.9rem; text-align:center;">Loading subjects...</p>
      </div>

      <!-- ADD ATTENDANCE TRACKER MODAL -->
      <div id="addAttendanceModal" class="card" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:1000; width:400px; max-width:90%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h3 class="card-title" style="margin:0;"><i class="fa-solid fa-plus"></i> Track New Subject</h3>
          <button class="btn btn-secondary" onclick="closeAddAttendanceModal()" style="padding:4px 8px;">X</button>
        </div>
        <form onsubmit="handleAddAttendance(event)">
          <div class="input-group">
            <label class="input-label">Subject Title</label>
            <input type="text" id="attSubject" class="input-field" placeholder="e.g. Mathematics II" required>
          </div>
          <div class="grid-3">
            <div class="input-group">
              <label class="input-label">Attended</label>
              <input type="number" id="attAttended" class="input-field" value="0" min="0" required>
            </div>
            <div class="input-group">
              <label class="input-label">Total</label>
              <input type="number" id="attTotal" class="input-field" value="0" min="0" required>
            </div>
            <div class="input-group">
              <label class="input-label">Target %</label>
              <input type="number" id="attTarget" class="input-field" value="75" min="0" max="100" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">Save Subject</button>
        </form>
      </div>
      <div id="attOverlay" onclick="closeAddAttendanceModal()" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999;"></div>
    `;

    // Load Attendance Cards
    const subjects = await fetchAPI('/api/attendance') || [];
    renderAttendanceGrid(subjects);
  },

  // ----------------------------------------------------
  // VIEW 6: AI STUDY ASSISTANT
  // ----------------------------------------------------
  async ai(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-wrap">
          <h2 class="view-title" data-localize="ai_assistant">AI Study Assistant</h2>
          <p class="view-subtitle">Ask questions, explain complex subjects, or create quick study plans.</p>
        </div>
      </div>
      
      <div style="display:grid; grid-template-columns: 1fr 300px; gap:24px;">
        <div class="chat-container">
          <div class="chat-messages" id="chatFeed">
            <div class="chat-message bot">
              Hi! I am your AI Study Assistant. Ask me anything about your university classes, exam prep, or coding tasks.
            </div>
          </div>
          <div class="chat-input-bar">
            <input type="text" id="chatInput" class="chat-input-field" placeholder="Ask a study question..." onkeydown="handleChatKey(event)">
            <button class="btn btn-primary" onclick="sendChatMessage()" style="border-radius: 24px;"><i class="fa-solid fa-paper-plane"></i></button>
          </div>
        </div>
        
        <div class="card" style="display:flex; flex-direction:column; gap:16px;">
          <h3 class="card-title"><i class="fa-solid fa-lightbulb"></i> Prompt Helpers</h3>
          <p style="font-size:0.85rem; color:var(--text-muted);">Quickly template your query:</p>
          <button class="btn btn-secondary" style="justify-content:flex-start; text-align:left;" onclick="applyPromptHelper('Explain this concept in simple terms: [concept]')">
            💡 Explain Concept Simple
          </button>
          <button class="btn btn-secondary" style="justify-content:flex-start; text-align:left;" onclick="applyPromptHelper('Create a 5-step study guide for [subject]')">
            📅 Study Plan Builder
          </button>
          <button class="btn btn-secondary" style="justify-content:flex-start; text-align:left;" onclick="applyPromptHelper('Give me 3 practice coding questions for [language]')">
            💻 Practice Coding Qs
          </button>
          <button class="btn btn-secondary" style="justify-content:flex-start; text-align:left;" onclick="applyPromptHelper('Suggest an exam preparation routine for [course]')">
            📝 Exam Routine Prep
          </button>
        </div>
      </div>
    `;
    window.chatHistory = [];
  },

  // ----------------------------------------------------
  // VIEW 7: ACADEMIC CALENDAR
  // ----------------------------------------------------
  async calendar(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-wrap">
          <h2 class="view-title" data-localize="calendar">Academic Calendar</h2>
          <p class="view-subtitle">Monthly planner for exams, college events, and holidays.</p>
        </div>
        <button class="btn btn-primary" onclick="openAddEventModal()"><i class="fa-solid fa-plus"></i> Add Event</button>
      </div>
      
      <div class="grid-3" style="grid-template-columns: 1fr 1fr 1fr; margin-bottom:20px;">
        <button class="btn btn-secondary" onclick="prevMonth()"><i class="fa-solid fa-chevron-left"></i> Previous</button>
        <h3 id="calendarMonthTitle" style="text-align:center; font-weight:700;">July 2026</h3>
        <button class="btn btn-secondary" onclick="nextMonth()">Next <i class="fa-solid fa-chevron-right"></i></button>
      </div>

      <div class="card" style="padding: 20px;">
        <div class="calendar-grid" id="calendarGridContainer">
          <!-- Calendar grid injected here -->
        </div>
      </div>

      <!-- ADD CALENDAR EVENT MODAL -->
      <div id="addEventModal" class="card" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:1000; width:400px; max-width:90%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h3 class="card-title" style="margin:0;"><i class="fa-solid fa-plus"></i> Add Calendar Event</h3>
          <button class="btn btn-secondary" onclick="closeAddEventModal()" style="padding:4px 8px;">X</button>
        </div>
        <form onsubmit="handleAddEvent(event)">
          <div class="input-group">
            <label class="input-label">Event Name</label>
            <input type="text" id="evTitle" class="input-field" placeholder="e.g. Midterm Exam" required>
          </div>
          <div class="grid-2">
            <div class="input-group">
              <label class="input-label">Date</label>
              <input type="date" id="evDate" class="input-field" required>
            </div>
            <div class="input-group">
              <label class="input-label">Event Type</label>
              <select id="evType" class="input-field">
                <option value="Exam">Exam</option>
                <option value="Holiday">Holiday</option>
                <option value="Event">Event</option>
                <option value="Class">Class</option>
              </select>
            </div>
          </div>
          <div class="input-group">
            <label class="input-label">Description</label>
            <textarea id="evDesc" class="input-field" rows="2" placeholder="e.g. Syllabus: Chapters 1-4"></textarea>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">Save Event</button>
        </form>
      </div>
      <div id="evOverlay" onclick="closeAddEventModal()" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999;"></div>
    `;

    // Calendar state
    const today = new Date();
    window.currentCalYear = today.getFullYear();
    window.currentCalMonth = today.getMonth(); // 0-11
    
    window.allCalEvents = await fetchAPI('/api/calendar') || [];
    renderCalendarGrid();
  },

  // ----------------------------------------------------
  // VIEW 8: CGPA CALCULATOR
  // ----------------------------------------------------
  async cgpa(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-wrap">
          <h2 class="view-title" data-localize="cgpa">CGPA Calculator</h2>
          <p class="view-subtitle">Calculate semester-wise SGPA and Cumulative CGPA.</p>
        </div>
        <button class="btn btn-primary" onclick="addNewCgpaSemester()"><i class="fa-solid fa-plus"></i> Add Semester Block</button>
      </div>
      
      <div style="display:grid; grid-template-columns: 1fr 350px; gap:24px; align-items: flex-start;">
        <div id="semestersContainer" style="display:flex; flex-direction:column; gap:24px;">
          <!-- Semesters and subject rows render here -->
        </div>
        
        <div class="card" style="position:sticky; top:90px; text-align:center;">
          <h3 class="card-title" style="justify-content:center;"><i class="fa-solid fa-square-poll-vertical"></i> Total Summary</h3>
          <div style="margin: 20px 0;">
            <div style="font-size: 3rem; font-weight:800; color:var(--primary); line-height:1;" id="summaryCgpa">0.00</div>
            <div style="color:var(--text-muted); font-size:0.85rem; margin-top:8px;">Cumulative CGPA</div>
          </div>
          <div style="display:flex; justify-content:space-between; padding:10px 0; border-top:1px solid var(--border-color); font-size:0.95rem;">
            <span>Total Credits Completed</span>
            <span id="summaryCredits" style="font-weight:600;">0</span>
          </div>
          <button class="btn btn-primary" style="width:100%; margin-top:15px;" onclick="saveCgpaToProfile()">Save CGPA to Profile</button>
        </div>
      </div>
    `;

    // Local state for calculator
    window.cgpaSemesters = [
      {
        id: 1,
        title: 'Semester 1',
        courses: [
          { name: 'Mathematics I', credits: 4, grade: 'A' },
          { name: 'Physics Lab', credits: 2, grade: 'O' },
          { name: 'Computer Programming', credits: 3, grade: 'B' }
        ]
      }
    ];

    // Try fetching from Resume to prepopulate if possible
    const resumes = await fetchAPI('/api/resumes') || [];
    if (resumes.length > 0 && resumes[0].education && resumes[0].education[0] && resumes[0].education[0].semesterData) {
      try {
        window.cgpaSemesters = JSON.parse(resumes[0].education[0].semesterData);
      } catch (err) {}
    }

    renderSemesters();
  },

  // ----------------------------------------------------
  // VIEW 9: EXPENSE TRACKER
  // ----------------------------------------------------
  async expenses(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-wrap">
          <h2 class="view-title" data-localize="expenses">Student Expense Tracker</h2>
          <p class="view-subtitle">Track your personal budget, pocket money, food and hostel fees.</p>
        </div>
        <button class="btn btn-primary" onclick="openAddExpenseModal()"><i class="fa-solid fa-plus"></i> Add Transaction</button>
      </div>
      
      <div class="expense-summary-grid">
        <div class="card" style="display:flex; align-items:center; gap:20px;">
          <div class="stat-icon" style="color:var(--success);"><i class="fa-solid fa-wallet"></i></div>
          <div class="stat-info">
            <span class="stat-value" id="expIncome">$0</span>
            <span class="stat-label">Total Pocket Money / Income</span>
          </div>
        </div>
        <div class="card" style="display:flex; align-items:center; gap:20px;">
          <div class="stat-icon" style="color:var(--danger);"><i class="fa-solid fa-arrow-down-up-across-line"></i></div>
          <div class="stat-info">
            <span class="stat-value" id="expSpend">$0</span>
            <span class="stat-label">Total Spent Expenses</span>
          </div>
        </div>
        <div class="card" style="display:flex; align-items:center; gap:20px;">
          <div class="stat-icon" style="color:var(--secondary);"><i class="fa-solid fa-piggy-bank"></i></div>
          <div class="stat-info">
            <span class="stat-value" id="expBalance">$0</span>
            <span class="stat-label">Remaining Balance</span>
          </div>
        </div>
      </div>
      
      <div class="grid-2">
        <div class="card">
          <h3 class="card-title"><i class="fa-solid fa-list"></i> Transaction History</h3>
          <div id="expenseList" style="display:flex; flex-direction:column; gap:10px; max-height:400px; overflow-y:auto;">
            <p style="color:var(--text-muted); font-size:0.9rem;">Loading history...</p>
          </div>
        </div>
        
        <div class="card">
          <h3 class="card-title"><i class="fa-solid fa-chart-pie"></i> Categorical Breakdown</h3>
          <div id="expenseChart" style="display:flex; flex-direction:column; gap:16px;">
            <p style="color:var(--text-muted); font-size:0.9rem;">No data available.</p>
          </div>
        </div>
      </div>

      <!-- ADD TRANSACTION MODAL -->
      <div id="addExpenseModal" class="card" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:1000; width:400px; max-width:90%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h3 class="card-title" style="margin:0;"><i class="fa-solid fa-plus"></i> Add Transaction</h3>
          <button class="btn btn-secondary" onclick="closeAddExpenseModal()" style="padding:4px 8px;">X</button>
        </div>
        <form onsubmit="handleAddExpense(event)">
          <div class="input-group">
            <label class="input-label">Description</label>
            <input type="text" id="exTitle" class="input-field" placeholder="e.g. Lunch at Canteen" required>
          </div>
          <div class="grid-2">
            <div class="input-group">
              <label class="input-label">Amount</label>
              <input type="number" id="exAmount" class="input-field" min="1" step="any" placeholder="e.g. 50" required>
            </div>
            <div class="input-group">
              <label class="input-label">Type</label>
              <select id="exType" class="input-field">
                <option value="expense">Expense (-)</option>
                <option value="income">Income (+)</option>
              </select>
            </div>
          </div>
          <div class="grid-2">
            <div class="input-group">
              <label class="input-label">Category</label>
              <select id="exCategory" class="input-field">
                <option value="Food">Food / Canteen</option>
                <option value="Books">Books / Printout</option>
                <option value="Travel">Travel / Hostel</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Pocket Money">Pocket Money</option>
                <option value="Others">Others</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Date</label>
              <input type="date" id="exDate" class="input-field" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">Save Transaction</button>
        </form>
      </div>
      <div id="exOverlay" onclick="closeAddExpenseModal()" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999;"></div>
    `;

    // Load Transactions
    const tx = await fetchAPI('/api/expenses') || [];
    renderExpenses(tx);
  },

  // ----------------------------------------------------
  // VIEW 10: DIGITAL ID CARD
  // ----------------------------------------------------
  async digital_id(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-wrap">
          <h2 class="view-title" data-localize="digital_id">Digital Student ID Card</h2>
          <p class="view-subtitle">Manage your student ID card. Hover or click to flip the card.</p>
        </div>
      </div>
      
      <div class="grid-2" style="align-items:center;">
        <div>
          <!-- ID Card wrapper with 3D flip -->
          <div class="id-card-wrapper">
            <div class="id-card" id="idCardBox" onclick="this.classList.toggle('flipped')">
              
              <!-- Front Side -->
              <div class="id-card-front">
                <div class="id-card-header">
                  <span style="font-weight:700; font-size:1.1rem; color:var(--primary); letter-spacing:0.5px;" id="idCollName">UNIVERSITY NAME</span>
                  <span class="badge badge-medium" style="font-size:0.65rem;">STUDENT</span>
                </div>
                <div class="id-card-body">
                  <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" class="id-photo" id="idCardPhoto" alt="Profile Photo">
                  <div class="id-details">
                    <div style="font-weight:700; font-size:1.1rem; line-height:1.2;" id="idCardName">Student Name</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);" id="idCardBranch">Computer Science</div>
                    <div style="font-size:0.8rem; margin-top:4px;">Roll No: <span style="font-weight:600;" id="idCardRoll">STU-12345</span></div>
                  </div>
                </div>
                <div class="id-card-footer">
                  <div>VALID UPTO: <span style="font-weight:600;" id="idCardValid">06/2028</span></div>
                  <div style="color:var(--success); font-weight:600;"><i class="fa-solid fa-circle-check"></i> VERIFIED</div>
                </div>
              </div>
              
              <!-- Back Side -->
              <div class="id-card-back">
                <div class="id-barcode">*STU-12345*</div>
                <div style="font-size:0.8rem; color:var(--text-muted); text-align:center;">
                  If found, please return to the library or contact administration.
                </div>
                <div style="font-size:0.75rem; text-align:center; border-top:1px dashed var(--border-color); width:100%; padding-top:8px;">
                  Emergency Call: <strong>+1 (555) 0199</strong>
                </div>
              </div>
              
            </div>
          </div>
          <p style="text-align:center; color:var(--text-muted); font-size:0.85rem;"><i class="fa-solid fa-circle-info"></i> Click the card to flip between front and back.</p>
        </div>
        
        <div class="card">
          <h3 class="card-title"><i class="fa-solid fa-pen"></i> Update ID Card Details</h3>
          <form onsubmit="handleUpdateID(event)">
            <div class="input-group">
              <label class="input-label">Upload Profile Photo</label>
              <input type="file" id="idPhotoInput" class="input-field" accept="image/*" onchange="previewIDPhoto(this)">
            </div>
            <div class="grid-2">
              <div class="input-group">
                <label class="input-label">Full Name</label>
                <input type="text" id="idInputName" class="input-field" required>
              </div>
              <div class="input-group">
                <label class="input-label">College/University</label>
                <input type="text" id="idInputCollege" class="input-field" required>
              </div>
            </div>
            <div class="grid-3">
              <div class="input-group">
                <label class="input-label">Branch/Course</label>
                <input type="text" id="idInputBranch" class="input-field" placeholder="e.g. IT" required>
              </div>
              <div class="input-group">
                <label class="input-label">Roll/ID Number</label>
                <input type="text" id="idInputRoll" class="input-field" required>
              </div>
              <div class="input-group">
                <label class="input-label">Validity (MM/YYYY)</label>
                <input type="text" id="idInputValid" class="input-field" placeholder="06/2028" required>
              </div>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">Update ID Details</button>
          </form>
        </div>
      </div>
    `;

    // Populate existing values
    const user = JSON.parse(localStorage.getItem('student_os_user')) || {};
    
    document.getElementById('idInputName').value = user.fullName || '';
    document.getElementById('idInputCollege').value = user.collegeName || '';
    
    // Load from local storage custom ID details
    const savedID = JSON.parse(localStorage.getItem('student_os_digital_id')) || {};
    document.getElementById('idInputBranch').value = savedID.branch || 'Computer Science';
    document.getElementById('idInputRoll').value = savedID.roll || 'STU-12345';
    document.getElementById('idInputValid').value = savedID.valid || '06/2028';
    
    if (savedID.photo) {
      document.getElementById('idCardPhoto').src = savedID.photo;
    }
    
    updateIDCardText();
  },

  // ----------------------------------------------------
  // VIEW 11: HABIT TRACKER
  // ----------------------------------------------------
  async habits(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-wrap">
          <h2 class="view-title" data-localize="habits">Habit Streaks</h2>
          <p class="view-subtitle">Form healthy habits and build streaks week-over-week.</p>
        </div>
        <button class="btn btn-primary" onclick="openAddHabitModal()"><i class="fa-solid fa-plus"></i> Add Habit</button>
      </div>
      
      <div class="card" style="padding: 24px; overflow-x: auto;">
        <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-weight:600; font-size:0.9rem;">
          <span style="width: 250px;">Habits</span>
          <div style="display:flex; gap:6px;" id="habitDateHeaders">
            <!-- 7 date headers go here -->
          </div>
          <span style="width: 100px; text-align:center;">Streak 🔥</span>
        </div>
        
        <div id="habitListContainer" style="display:flex; flex-direction:column; gap:12px;">
          <p style="color:var(--text-muted); font-size:0.9rem; text-align:center;">Loading habits...</p>
        </div>
      </div>

      <!-- ADD HABIT MODAL -->
      <div id="addHabitModal" class="card" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:1000; width:400px; max-width:90%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h3 class="card-title" style="margin:0;"><i class="fa-solid fa-plus"></i> New Habit</h3>
          <button class="btn btn-secondary" onclick="closeAddHabitModal()" style="padding:4px 8px;">X</button>
        </div>
        <form onsubmit="handleAddHabit(event)">
          <div class="input-group">
            <label class="input-label">Habit Name</label>
            <input type="text" id="habName" class="input-field" placeholder="e.g. Study Coding for 1 Hour" required>
          </div>
          <div class="input-group">
            <label class="input-label">Category</label>
            <select id="habCategory" class="input-field">
              <option value="Study">Academic / Study</option>
              <option value="Health">Health & Exercise</option>
              <option value="Mind">Mind & Meditation</option>
              <option value="Coding">Coding</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">Save Habit</button>
        </form>
      </div>
      <div id="habOverlay" onclick="closeAddHabitModal()" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999;"></div>
    `;

    // Load Habits
    const habits = await fetchAPI('/api/habits') || [];
    renderHabitsList(habits);
  },

  // ----------------------------------------------------
  // VIEW 12: FILE STORAGE
  // ----------------------------------------------------
  async files(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-wrap">
          <h2 class="view-title" data-localize="file_storage">Personal File Storage</h2>
          <p class="view-subtitle">Upload and keep lecture slides, reports, and course files.</p>
        </div>
        <button class="btn btn-primary" onclick="openUploadFileModal()"><i class="fa-solid fa-cloud-arrow-up"></i> Upload File</button>
      </div>
      
      <div class="card file-grid" id="filesGrid">
        <p style="color:var(--text-muted); font-size:0.9rem; text-align:center;">Loading files...</p>
      </div>

      <!-- UPLOAD FILE MODAL -->
      <div id="uploadFileModal" class="card" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:1000; width:400px; max-width:90%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h3 class="card-title" style="margin:0;"><i class="fa-solid fa-cloud-arrow-up"></i> Upload File</h3>
          <button class="btn btn-secondary" onclick="closeUploadFileModal()" style="padding:4px 8px;">X</button>
        </div>
        <form onsubmit="handleUploadFile(event)">
          <div class="input-group">
            <label class="input-label">Select File</label>
            <input type="file" id="fileUploadInput" class="input-field" required>
          </div>
          <div class="input-group">
            <label class="input-label">Subject Category</label>
            <input type="text" id="fileCategory" class="input-field" placeholder="e.g. Physics" required>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">Upload File Now</button>
        </form>
      </div>
      <div id="fileOverlay" onclick="closeUploadFileModal()" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999;"></div>
    `;

    // Load Files Grid
    const files = await fetchAPI('/api/files') || [];
    renderFilesGrid(files);
  },

  // ----------------------------------------------------
  // VIEW 13: PREVIOUS YEAR QUESTION PAPERS
  // ----------------------------------------------------
  async papers(container) {
    const user = JSON.parse(localStorage.getItem('student_os_user')) || {};
    const isAuthorized = user.role === 'admin' || user.role === 'faculty';

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-wrap">
          <h2 class="view-title" data-localize="question_papers">Previous Year Question Papers</h2>
          <p class="view-subtitle">Review papers organized by semester and core engineering/science subjects.</p>
        </div>
        ${isAuthorized ? `<button class="btn btn-primary" onclick="openUploadPaperModal()"><i class="fa-solid fa-upload"></i> Upload Paper</button>` : ''}
      </div>
      
      <div class="grid-2" style="margin-bottom: 24px;">
        <div class="card" style="padding:15px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:600;">Semester Filter</span>
          <select id="paperSemesterSelect" class="input-field" style="padding:6px 12px; font-size:0.85rem;" onchange="filterPapers()">
            <option value="All">All Semesters</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
            <option value="3">Semester 3</option>
            <option value="4">Semester 4</option>
            <option value="5">Semester 5</option>
            <option value="6">Semester 6</option>
            <option value="7">Semester 7</option>
            <option value="8">Semester 8</option>
          </select>
        </div>
        
        <div class="card" style="padding:15px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:600;">Search Subject</span>
          <input type="text" id="paperSearchInput" class="input-field" style="padding:6px 12px; font-size:0.85rem; width:200px;" placeholder="e.g. Maths" oninput="filterPapers()">
        </div>
      </div>
      
      <div class="card" style="padding: 24px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.95rem;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted); font-weight:600;">
              <th style="padding: 12px 8px;">Subject</th>
              <th style="padding: 12px 8px;">Semester</th>
              <th style="padding: 12px 8px;">Exam Year</th>
              <th style="padding: 12px 8px;">Actions</th>
            </tr>
          </thead>
          <tbody id="papersTableBody">
            <tr>
              <td colspan="4" style="text-align:center; padding:30px; color:var(--text-muted);">Loading exam papers...</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- UPLOAD PAPER MODAL (Admin Only) -->
      <div id="uploadPaperModal" class="card" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:1000; width:450px; max-width:90%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h3 class="card-title" style="margin:0;"><i class="fa-solid fa-upload"></i> Upload Question Paper</h3>
          <button class="btn btn-secondary" onclick="closeUploadPaperModal()" style="padding:4px 8px;">X</button>
        </div>
        <form onsubmit="handleUploadPaper(event)">
          <div class="input-group">
            <label class="input-label">Subject</label>
            <input type="text" id="paperSubject" class="input-field" placeholder="e.g. Advanced Data Structures" required>
          </div>
          <div class="grid-2">
            <div class="input-group">
              <label class="input-label">Semester</label>
              <select id="paperSem" class="input-field">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Exam Year</label>
              <input type="number" id="paperYear" class="input-field" value="2025" min="2010" required>
            </div>
          </div>
          <div class="input-group">
            <label class="input-label">Select PDF File</label>
            <input type="file" id="paperFileInput" class="input-field" accept="application/pdf" required>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">Upload Paper</button>
        </form>
      </div>
      <div id="paperOverlay" onclick="closeUploadPaperModal()" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999;"></div>
    `;

    // Load Papers
    window.allPapers = await fetchAPI('/api/papers') || [];
    renderPapersList(window.allPapers);
  },

  // ----------------------------------------------------
  // VIEW 14: PLACEMENT PREPARATION
  // ----------------------------------------------------
  async placement(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-wrap">
          <h2 class="view-title" data-localize="placement_prep">Placement Preparation</h2>
          <p class="view-subtitle">Practice coding, solve aptitude quizzes, and review core CS flashcards.</p>
        </div>
      </div>
      
      <!-- Sub-tabs -->
      <div class="tab-buttons" style="margin-bottom:24px;">
        <button class="tab-btn active" id="btnPlacementApt" onclick="switchPlacementTab('apt')">Aptitude Quizzes</button>
        <button class="tab-btn" id="btnPlacementCode" onclick="switchPlacementTab('code')">Coding Practice</button>
        <button class="tab-btn" id="btnPlacementCards" onclick="switchPlacementTab('cards')">Interview Flashcards</button>
      </div>
      
      <div id="placementContentPanel">
        <!-- Sub-tab content injected here -->
      </div>
    `;

    // Fetch placement material
    window.placementMaterial = await fetchAPI('/api/placement') || { aptitude: [], coding: [], flashcards: [] };
    
    // Default show aptitude
    switchPlacementTab('apt');
  },

  // ----------------------------------------------------
  // VIEW 15: RESUME BUILDER
  // ----------------------------------------------------
  async resume(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-wrap">
          <h2 class="view-title" data-localize="resume_builder">Resume Builder</h2>
          <p class="view-subtitle">Generate a professional printable resume directly from your web profile.</p>
        </div>
        <button class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> Export to PDF / Print</button>
      </div>
      
      <div class="resume-split">
        <!-- Step Form Wizard -->
        <div class="card" style="display:flex; flex-direction:column; gap:20px;">
          <h3 class="card-title"><i class="fa-solid fa-pen-to-square"></i> Input Details</h3>
          
          <div style="display:flex; flex-direction:column; gap:16px;">
            <!-- Personal -->
            <div style="border-bottom:1px solid var(--border-color); padding-bottom:16px;">
              <h4 style="margin-bottom:12px; color:var(--primary);">1. Contact Details</h4>
              <div class="grid-2">
                <div class="input-group">
                  <label class="input-label">Full Name</label>
                  <input type="text" id="resName" class="input-field" oninput="updateResumePreview()">
                </div>
                <div class="input-group">
                  <label class="input-label">Email</label>
                  <input type="email" id="resEmail" class="input-field" oninput="updateResumePreview()">
                </div>
              </div>
              <div class="grid-2">
                <div class="input-group">
                  <label class="input-label">Phone</label>
                  <input type="text" id="resPhone" class="input-field" oninput="updateResumePreview()">
                </div>
                <div class="input-group">
                  <label class="input-label">GitHub/LinkedIn</label>
                  <input type="text" id="resSocial" class="input-field" placeholder="github.com/username" oninput="updateResumePreview()">
                </div>
              </div>
              <div class="input-group">
                <label class="input-label">Professional Summary</label>
                <textarea id="resSummary" class="input-field" rows="2" oninput="updateResumePreview()"></textarea>
              </div>
            </div>
            
            <!-- Education -->
            <div style="border-bottom:1px solid var(--border-color); padding-bottom:16px;">
              <h4 style="margin-bottom:12px; color:var(--primary);">2. Education</h4>
              <div class="grid-2">
                <div class="input-group">
                  <label class="input-label">University/College</label>
                  <input type="text" id="resEduColl" class="input-field" oninput="updateResumePreview()">
                </div>
                <div class="input-group">
                  <label class="input-label">Degree & Major</label>
                  <input type="text" id="resEduDegree" class="input-field" oninput="updateResumePreview()">
                </div>
              </div>
              <div class="grid-2">
                <div class="input-group">
                  <label class="input-label">Graduation Year</label>
                  <input type="text" id="resEduYear" class="input-field" oninput="updateResumePreview()">
                </div>
                <div class="input-group">
                  <label class="input-label">CGPA</label>
                  <input type="text" id="resEduCGPA" class="input-field" oninput="updateResumePreview()">
                </div>
              </div>
            </div>

            <!-- Skills -->
            <div style="border-bottom:1px solid var(--border-color); padding-bottom:16px;">
              <h4 style="margin-bottom:12px; color:var(--primary);">3. Technical Skills</h4>
              <div class="input-group">
                <label class="input-label">Skills (Comma separated)</label>
                <input type="text" id="resSkills" class="input-field" placeholder="e.g. React, Node.js, Python, SQL" oninput="updateResumePreview()">
              </div>
            </div>

            <!-- Experience -->
            <div>
              <h4 style="margin-bottom:12px; color:var(--primary);">4. Projects & Experience</h4>
              <div class="grid-2">
                <div class="input-group">
                  <label class="input-label">Project/Job Title</label>
                  <input type="text" id="resExpTitle" class="input-field" oninput="updateResumePreview()">
                </div>
                <div class="input-group">
                  <label class="input-label">Company/Organization</label>
                  <input type="text" id="resExpOrg" class="input-field" oninput="updateResumePreview()">
                </div>
              </div>
              <div class="input-group">
                <label class="input-label">Description</label>
                <textarea id="resExpDesc" class="input-field" rows="3" placeholder="Describe achievements..." oninput="updateResumePreview()"></textarea>
              </div>
            </div>
            
            <button class="btn btn-primary" onclick="saveResumeDetails()">Save Resume State</button>
          </div>
        </div>
        
        <!-- Live Preview -->
        <div>
          <h3 style="margin-bottom:10px;"><i class="fa-regular fa-eye"></i> Live A4 Preview</h3>
          <div class="resume-preview" id="resPreview">
            <!-- Rendered resume preview goes here -->
          </div>
        </div>
      </div>
    `;

    // Fetch details to prepopulate
    const user = JSON.parse(localStorage.getItem('student_os_user')) || {};
    const resumes = await fetchAPI('/api/resumes') || [];
    
    let resumeDetails = {
      name: user.fullName || '',
      email: user.email || '',
      phone: '',
      social: '',
      summary: 'Motivated student seeking opportunities to apply engineering and development skills.',
      education: [{ college: user.collegeName || '', degree: 'B.Tech Computer Science', year: '2028', cgpa: '8.5' }],
      skills: 'JavaScript, HTML/CSS, SQL, Python',
      experience: [{ title: 'Full Stack Project', org: 'Student OS', desc: 'Developed a rich single page portal to simplify college workflows.' }]
    };

    if (resumes.length > 0) {
      resumeDetails = resumes[0];
    }

    // Set fields
    document.getElementById('resName').value = resumeDetails.name || '';
    document.getElementById('resEmail').value = resumeDetails.email || '';
    document.getElementById('resPhone').value = resumeDetails.phone || '';
    document.getElementById('resSocial').value = resumeDetails.social || '';
    document.getElementById('resSummary').value = resumeDetails.summary || '';
    
    if (resumeDetails.education && resumeDetails.education[0]) {
      document.getElementById('resEduColl').value = resumeDetails.education[0].college || '';
      document.getElementById('resEduDegree').value = resumeDetails.education[0].degree || '';
      document.getElementById('resEduYear').value = resumeDetails.education[0].year || '';
      document.getElementById('resEduCGPA').value = resumeDetails.education[0].cgpa || '';
    }
    
    document.getElementById('resSkills').value = resumeDetails.skills || '';
    
    if (resumeDetails.experience && resumeDetails.experience[0]) {
      document.getElementById('resExpTitle').value = resumeDetails.experience[0].title || '';
      document.getElementById('resExpOrg').value = resumeDetails.experience[0].org || '';
      document.getElementById('resExpDesc').value = resumeDetails.experience[0].desc || '';
    }

    window.activeResumeId = resumes.length > 0 ? resumes[0].id : null;

    updateResumePreview();
  },

  // ----------------------------------------------------
  // VIEW 16: FACULTY PORTAL
  // ----------------------------------------------------
  async faculty_portal(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-wrap">
          <h2 class="view-title">Faculty Advisor Portal</h2>
          <p class="view-subtitle">Review, verify and track the attendance logs of your assigned students.</p>
        </div>
      </div>
      
      <div class="card" style="padding: 24px;">
        <h3 class="card-title"><i class="fa-solid fa-users"></i> Assigned Students List</h3>
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.95rem; margin-top:16px;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted); font-weight:600;">
              <th style="padding: 12px 8px;">Name</th>
              <th style="padding: 12px 8px;">Username</th>
              <th style="padding: 12px 8px;">Email</th>
              <th style="padding: 12px 8px;">Verification Status</th>
              <th style="padding: 12px 8px;">Actions</th>
            </tr>
          </thead>
          <tbody id="facultyStudentsTable">
            <tr>
              <td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">Loading students list...</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Student Details Modal (for attendance view) -->
      <div id="studentDetailModal" class="card" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:1000; width:550px; max-width:90%; max-height:80%; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h3 class="card-title" id="studentDetailTitle" style="margin:0;"><i class="fa-solid fa-graduation-cap"></i> Student Attendance Logs</h3>
          <button class="btn btn-secondary" onclick="closeStudentDetailModal()" style="padding:4px 8px;">X</button>
        </div>
        <div id="studentDetailContent" style="display:flex; flex-direction:column; gap:16px;">
          <p style="color:var(--text-muted);">Loading details...</p>
        </div>
      </div>
      <div id="studentDetailOverlay" onclick="closeStudentDetailModal()" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999;"></div>
    `;

    // Fetch and render assigned students
    await refreshFacultyStudents();
  }
};

// ==========================================================================
// SUB-FUNCTIONS FOR TIMETABLE
// ==========================================================================
function openAddClassModal() {
  document.getElementById('addClassModal').style.display = 'block';
  document.getElementById('modalOverlay').style.display = 'block';
}
function closeAddClassModal() {
  document.getElementById('addClassModal').style.display = 'none';
  document.getElementById('modalOverlay').style.display = 'none';
}
async function handleAddClass(e) {
  e.preventDefault();
  const subject = document.getElementById('ttSubject').value;
  const day = document.getElementById('ttDay').value;
  const startTime = document.getElementById('ttStart').value;
  const endTime = document.getElementById('ttEnd').value;
  const room = document.getElementById('ttRoom').value;
  const instructor = document.getElementById('ttInstructor').value;

  const result = await fetchAPI('/api/timetable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, day, startTime, endTime, room, instructor })
  });

  if (result) {
    closeAddClassModal();
    window.StudentOSViews.timetable(document.getElementById('appView'));
  }
}
async function deleteClass(id) {
  if (confirm('Are you sure you want to delete this class?')) {
    const res = await fetchAPI(`/api/timetable/${id}`, { method: 'DELETE' });
    if (res) {
      window.StudentOSViews.timetable(document.getElementById('appView'));
    }
  }
}

// ==========================================================================
// SUB-FUNCTIONS FOR NOTES
// ==========================================================================
function renderNoteList(notes) {
  const container = document.getElementById('notesListContainer');
  if (notes.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:20px 0;">No notes found.</p>`;
    return;
  }
  container.innerHTML = notes.map(n => `
    <div class="note-item" onclick="selectNote('${n.id}')">
      <div style="font-weight:600; font-size:0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${n.title}</div>
      <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px; display:flex; justify-content:space-between;">
        <span>${n.category}</span>
        <span>${new Date(n.updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  `).join('');
}
function filterNotes() {
  const q = document.getElementById('noteSearch').value.toLowerCase();
  const filtered = window.allNotes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.category.toLowerCase().includes(q));
  renderNoteList(filtered);
}
function selectNote(id) {
  const note = window.allNotes.find(n => n.id === id);
  if (!note) return;
  
  const editor = document.getElementById('noteEditorContainer');
  editor.innerHTML = `
    <div class="input-group">
      <label class="input-label">Title</label>
      <input type="text" id="editNoteTitle" class="input-field" value="${note.title}">
    </div>
    <div class="grid-2">
      <div class="input-group">
        <label class="input-label">Category</label>
        <input type="text" id="editNoteCategory" class="input-field" value="${note.category}">
      </div>
      <div style="display:flex; align-items:flex-end; justify-content:flex-end; gap:10px; margin-bottom:18px;">
        <button class="btn btn-danger" onclick="deleteNote('${note.id}')"><i class="fa-solid fa-trash"></i> Delete</button>
        <button class="btn btn-primary" onclick="saveNote('${note.id}')"><i class="fa-solid fa-save"></i> Save Note</button>
      </div>
    </div>
    <div class="input-group" style="flex:1;">
      <label class="input-label">Content</label>
      <textarea id="editNoteContent" class="input-field" style="flex:1; resize:none; min-height:300px;">${note.content}</textarea>
    </div>
  `;
}
async function newNote() {
  const note = await fetchAPI('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'New Note', content: '', category: 'General' })
  });
  if (note) {
    window.allNotes.unshift(note);
    renderNoteList(window.allNotes);
    selectNote(note.id);
  }
}
async function saveNote(id) {
  const title = document.getElementById('editNoteTitle').value;
  const category = document.getElementById('editNoteCategory').value;
  const content = document.getElementById('editNoteContent').value;
  
  const res = await fetchAPI(`/api/notes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, category, content })
  });
  
  if (res) {
    window.allNotes = await fetchAPI('/api/notes') || [];
    renderNoteList(window.allNotes);
    alert('Note saved successfully!');
  }
}
async function deleteNote(id) {
  if (confirm('Delete this note?')) {
    const res = await fetchAPI(`/api/notes/${id}`, { method: 'DELETE' });
    if (res) {
      window.allNotes = await fetchAPI('/api/notes') || [];
      renderNoteList(window.allNotes);
      document.getElementById('noteEditorContainer').innerHTML = `
        <p style="color:var(--text-muted); text-align:center; padding:100px 0;">Select a note to view or create a new note.</p>
      `;
    }
  }
}

// ==========================================================================
// SUB-FUNCTIONS FOR ASSIGNMENTS
// ==========================================================================
function openAddAssignmentModal() {
  document.getElementById('addAssignmentModal').style.display = 'block';
  document.getElementById('assOverlay').style.display = 'block';
}
function closeAddAssignmentModal() {
  document.getElementById('addAssignmentModal').style.display = 'none';
  document.getElementById('assOverlay').style.display = 'none';
}
function renderAssignmentsList(list) {
  const container = document.getElementById('assignmentList');
  if (list.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted); padding:30px; text-align:center;">No assignments found matching current filters.</p>`;
    return;
  }
  container.innerHTML = list.map(a => {
    const isCompleted = a.status === 'Completed';
    return `
      <div class="assignment-item" style="border-left: 4px solid ${isCompleted ? 'var(--success)' : 'var(--warning)'};">
        <div class="assignment-info">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-weight:600; font-size:1.05rem; ${isCompleted ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">${a.title}</span>
            <span class="badge badge-${a.priority.toLowerCase()}">${a.priority}</span>
          </div>
          <div style="font-size:0.8rem; color:var(--text-muted);">
            Course: <strong>${a.subject}</strong> | Due Date: <strong>${new Date(a.dueDate).toLocaleDateString()}</strong>
          </div>
          ${a.description ? `<div style="font-size:0.85rem; margin-top:6px; color:var(--text-main);">${a.description}</div>` : ''}
        </div>
        <div class="assignment-actions">
          <button class="btn ${isCompleted ? 'btn-secondary' : 'btn-primary'}" onclick="toggleAssignmentStatus('${a.id}', '${a.status}')" style="padding:6px 12px; font-size:0.8rem;">
            <i class="fa-solid ${isCompleted ? 'fa-rotate-left' : 'fa-check'}"></i> ${isCompleted ? 'Mark Pending' : 'Mark Done'}
          </button>
          <button class="btn btn-secondary" onclick="deleteAssignment('${a.id}')" style="padding:6px; border-radius:50%;"><i class="fa-solid fa-trash" style="color:var(--danger)"></i></button>
        </div>
      </div>
    `;
  }).join('');
}
function filterAssignments() {
  const status = document.getElementById('assFilterStatus').value;
  const priority = document.getElementById('assFilterPriority').value;
  const subject = document.getElementById('assFilterSubject').value.toLowerCase();

  const filtered = window.allAssignments.filter(a => {
    if (status !== 'All' && a.status !== status) return false;
    if (priority !== 'All' && a.priority !== priority) return false;
    if (subject && !a.subject.toLowerCase().includes(subject)) return false;
    return true;
  });
  renderAssignmentsList(filtered);
}
async function handleAddAssignment(e) {
  e.preventDefault();
  const title = document.getElementById('assTitle').value;
  const subject = document.getElementById('assSubject').value;
  const dueDate = document.getElementById('assDueDate').value;
  const priority = document.getElementById('assPriority').value;
  const status = document.getElementById('assStatus').value;
  const description = document.getElementById('assDesc').value;

  const res = await fetchAPI('/api/assignments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, subject, dueDate, priority, status, description })
  });

  if (res) {
    closeAddAssignmentModal();
    window.allAssignments = await fetchAPI('/api/assignments') || [];
    filterAssignments();
  }
}
async function toggleAssignmentStatus(id, currentStatus) {
  const nextStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
  const assignment = window.allAssignments.find(a => a.id === id);
  if (!assignment) return;
  
  const res = await fetchAPI(`/api/assignments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...assignment, status: nextStatus })
  });

  if (res) {
    window.allAssignments = await fetchAPI('/api/assignments') || [];
    filterAssignments();
  }
}
async function deleteAssignment(id) {
  if (confirm('Delete this assignment?')) {
    const res = await fetchAPI(`/api/assignments/${id}`, { method: 'DELETE' });
    if (res) {
      window.allAssignments = await fetchAPI('/api/assignments') || [];
      filterAssignments();
    }
  }
}

// ==========================================================================
// SUB-FUNCTIONS FOR ATTENDANCE
// ==========================================================================
function openAddAttendanceModal() {
  document.getElementById('addAttendanceModal').style.display = 'block';
  document.getElementById('attOverlay').style.display = 'block';
}
function closeAddAttendanceModal() {
  document.getElementById('addAttendanceModal').style.display = 'none';
  document.getElementById('attOverlay').style.display = 'none';
}
function renderAttendanceGrid(subjects) {
  const grid = document.getElementById('attendanceGrid');
  if (subjects.length === 0) {
    grid.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding:30px; width:100%;">No subjects tracked yet.</p>`;
    return;
  }
  grid.innerHTML = subjects.map(s => {
    const pct = s.total > 0 ? Math.round((s.attended / s.total) * 100) : 100;
    const isUnder = pct < s.target;
    
    // Circular SVG Dasharray calculation
    const radius = 45;
    const circ = 2 * Math.PI * radius;
    const strokeDash = circ - (pct / 100) * circ;

    return `
      <div class="card attendance-card" style="border-top: 4px solid ${isUnder ? 'var(--danger)' : 'var(--success)'}">
        <h4 style="font-weight:600; font-size:1.1rem; text-align:center;">${s.subject}</h4>
        
        <div class="attendance-progress-wrap">
          <svg width="120" height="120" class="circular-progress">
            <circle cx="60" cy="60" r="${radius}" fill="none" stroke="var(--border-color)" stroke-width="10" />
            <circle cx="60" cy="60" r="${radius}" fill="none" stroke="${isUnder ? 'var(--danger)' : 'var(--success)'}" stroke-width="10" 
                    stroke-dasharray="${circ}" stroke-dashoffset="${strokeDash}" stroke-linecap="round" />
          </svg>
          <span class="attendance-percentage" style="color:${isUnder ? 'var(--danger)' : 'var(--success)'}">${pct}%</span>
        </div>
        
        <div style="display:flex; justify-content:space-around; font-size:0.85rem; border-top:1px solid var(--border-color); padding-top:12px;">
          <div>Classes: <strong>${s.attended}/${s.total}</strong></div>
          <div>Target: <strong>${s.target}%</strong></div>
        </div>

        <div class="attendance-actions-row">
          <button class="btn btn-primary" style="flex:1; padding:8px;" onclick="logAttendance('${s.id}', 'present')"><i class="fa-solid fa-check"></i> Present</button>
          <button class="btn btn-secondary" style="flex:1; padding:8px; border-color:var(--danger); color:var(--danger);" onclick="logAttendance('${s.id}', 'absent')"><i class="fa-solid fa-xmark"></i> Absent</button>
        </div>
        
        <button class="btn btn-secondary" onclick="deleteAttendance('${s.id}')" style="font-size:0.75rem; padding:4px;"><i class="fa-solid fa-trash"></i> Delete Tracker</button>
      </div>
    `;
  }).join('');
}
async function handleAddAttendance(e) {
  e.preventDefault();
  const subject = document.getElementById('attSubject').value;
  const attended = document.getElementById('attAttended').value;
  const total = document.getElementById('attTotal').value;
  const target = document.getElementById('attTarget').value;

  const res = await fetchAPI('/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, attended, total, target })
  });

  if (res) {
    closeAddAttendanceModal();
    const subjects = await fetchAPI('/api/attendance') || [];
    renderAttendanceGrid(subjects);
  }
}
async function logAttendance(id, status) {
  const res = await fetchAPI(`/api/attendance/${id}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (res) {
    const subjects = await fetchAPI('/api/attendance') || [];
    renderAttendanceGrid(subjects);
  }
}
async function deleteAttendance(id) {
  if (confirm('Delete attendance tracker for this subject?')) {
    const res = await fetchAPI(`/api/attendance/${id}`, { method: 'DELETE' });
    if (res) {
      const subjects = await fetchAPI('/api/attendance') || [];
      renderAttendanceGrid(subjects);
    }
  }
}

// ==========================================================================
// SUB-FUNCTIONS FOR AI ASSISTANT
// ==========================================================================
function handleChatKey(e) {
  if (e.key === 'Enter') sendChatMessage();
}
function applyPromptHelper(txt) {
  document.getElementById('chatInput').value = txt;
  document.getElementById('chatInput').focus();
}
async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;

  const feed = document.getElementById('chatFeed');
  
  // User bubble
  const userDiv = document.createElement('div');
  userDiv.className = 'chat-message user';
  userDiv.innerText = msg;
  feed.appendChild(userDiv);
  
  input.value = '';
  feed.scrollTop = feed.scrollHeight;

  // Bot Typing bubble
  const typingDiv = document.createElement('div');
  typingDiv.className = 'chat-message bot';
  typingDiv.innerText = 'typing...';
  feed.appendChild(typingDiv);
  feed.scrollTop = feed.scrollHeight;

  // API Call
  const response = await fetchAPI('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg, history: window.chatHistory })
  });

  feed.removeChild(typingDiv);

  if (response) {
    const botDiv = document.createElement('div');
    botDiv.className = 'chat-message bot';
    // Format simple bold/bullets from markdown if fallback/gemini returns markdown
    botDiv.innerHTML = formatMarkdown(response.reply);
    feed.appendChild(botDiv);

    window.chatHistory.push({ role: 'user', text: msg });
    window.chatHistory.push({ role: 'model', text: response.reply });
  } else {
    const botDiv = document.createElement('div');
    botDiv.className = 'chat-message bot';
    botDiv.innerText = 'Could not get response from assistant.';
    feed.appendChild(botDiv);
  }
  feed.scrollTop = feed.scrollHeight;
}
function formatMarkdown(text) {
  if (!text) return '';
  // Basic markdown tags parsing for mock/Gemini responses
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*?)$/gm, '• $1')
    .replace(/\n/g, '<br>');
  return formatted;
}

// ==========================================================================
// SUB-FUNCTIONS FOR ACADEMIC CALENDAR
// ==========================================================================
function openAddEventModal() {
  document.getElementById('addEventModal').style.display = 'block';
  document.getElementById('evOverlay').style.display = 'block';
}
function closeAddEventModal() {
  document.getElementById('addEventModal').style.display = 'none';
  document.getElementById('evOverlay').style.display = 'none';
}
function renderCalendarGrid() {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  document.getElementById('calendarMonthTitle').innerText = `${monthNames[window.currentCalMonth]} ${window.currentCalYear}`;
  const container = document.getElementById('calendarGridContainer');
  
  // Calculate grid dates
  const firstDayIndex = new Date(window.currentCalYear, window.currentCalMonth, 1).getDay();
  const lastDate = new Date(window.currentCalYear, window.currentCalMonth + 1, 0).getDate();
  const prevLastDate = new Date(window.currentCalYear, window.currentCalMonth, 0).getDate();

  let html = dayNames.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

  // Prev month filler days
  for (let i = firstDayIndex; i > 0; i--) {
    html += `<div class="calendar-cell" style="opacity:0.3;"><span class="calendar-cell-num">${prevLastDate - i + 1}</span></div>`;
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // Active month days
  for (let date = 1; date <= lastDate; date++) {
    const dStr = `${window.currentCalYear}-${String(window.currentCalMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    const isToday = dStr === todayStr;

    // Find events on this date
    const dayEvents = window.allCalEvents.filter(e => e.date.substring(0, 10) === dStr);

    html += `
      <div class="calendar-cell ${isToday ? 'today' : ''}">
        <span class="calendar-cell-num">${date}</span>
        <div class="calendar-events-list">
          ${dayEvents.map(e => {
            let cls = 'event-general';
            if (e.type === 'Exam') cls = 'event-exam';
            if (e.type === 'Holiday') cls = 'event-holiday';
            return `<span class="calendar-event-dot ${cls}" title="${e.title}: ${e.description}">${e.title}</span>`;
          }).join('')}
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
}
function prevMonth() {
  window.currentCalMonth--;
  if (window.currentCalMonth < 0) {
    window.currentCalMonth = 11;
    window.currentCalYear--;
  }
  renderCalendarGrid();
}
function nextMonth() {
  window.currentCalMonth++;
  if (window.currentCalMonth > 11) {
    window.currentCalMonth = 0;
    window.currentCalYear++;
  }
  renderCalendarGrid();
}
async function handleAddEvent(e) {
  e.preventDefault();
  const title = document.getElementById('evTitle').value;
  const date = document.getElementById('evDate').value;
  const type = document.getElementById('evType').value;
  const description = document.getElementById('evDesc').value;

  const res = await fetchAPI('/api/calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, date, type, description })
  });

  if (res) {
    closeAddEventModal();
    window.allCalEvents = await fetchAPI('/api/calendar') || [];
    renderCalendarGrid();
  }
}

// ==========================================================================
// SUB-FUNCTIONS FOR CGPA CALCULATOR
// ==========================================================================
function renderSemesters() {
  const container = document.getElementById('semestersContainer');
  if (window.cgpaSemesters.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem; text-align:center;">No semesters added.</p>`;
    return;
  }

  container.innerHTML = window.cgpaSemesters.map(sem => {
    return `
      <div class="card" id="semCard-${sem.id}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 class="card-title" style="margin:0;"><i class="fa-solid fa-book"></i> ${sem.title}</h3>
          <button class="btn btn-secondary" onclick="deleteCgpaSemester(${sem.id})" style="padding:4px 8px; color:var(--danger); border-color:var(--danger);"><i class="fa-solid fa-trash"></i> Delete Sem</button>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <thead>
            <tr style="color:var(--text-muted); font-size:0.85rem; border-bottom:1px solid var(--border-color); text-align:left;">
              <th style="padding: 6px;">Subject Name</th>
              <th style="padding: 6px; width: 100px;">Credits</th>
              <th style="padding: 6px; width: 100px;">Grade (O-F)</th>
              <th style="padding: 6px; width: 60px;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${sem.courses.map((c, idx) => `
              <tr style="border-bottom:1px solid var(--border-color);">
                <td style="padding: 6px;">
                  <input type="text" class="input-field" style="padding:4px 8px; font-size:0.9rem; width:90%;" value="${c.name}" onchange="updateCgpaCourse(${sem.id}, ${idx}, 'name', this.value)">
                </td>
                <td style="padding: 6px;">
                  <input type="number" class="input-field" style="padding:4px 8px; font-size:0.9rem; width:70px;" value="${c.credits}" min="1" onchange="updateCgpaCourse(${sem.id}, ${idx}, 'credits', this.value)">
                </td>
                <td style="padding: 6px;">
                  <select class="input-field" style="padding:4px 8px; font-size:0.9rem; width:75px;" onchange="updateCgpaCourse(${sem.id}, ${idx}, 'grade', this.value)">
                    <option value="O" ${c.grade === 'O' ? 'selected' : ''}>O (10)</option>
                    <option value="A" ${c.grade === 'A' ? 'selected' : ''}>A (9)</option>
                    <option value="B" ${c.grade === 'B' ? 'selected' : ''}>B (8)</option>
                    <option value="C" ${c.grade === 'C' ? 'selected' : ''}>C (7)</option>
                    <option value="D" ${c.grade === 'D' ? 'selected' : ''}>D (6)</option>
                    <option value="E" ${c.grade === 'E' ? 'selected' : ''}>E (5)</option>
                    <option value="F" ${c.grade === 'F' ? 'selected' : ''}>F (0)</option>
                  </select>
                </td>
                <td style="padding: 6px;">
                  <button class="btn btn-secondary" onclick="deleteCgpaCourse(${sem.id}, ${idx})" style="padding:4px 8px;"><i class="fa-solid fa-xmark" style="color:var(--danger);"></i></button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <button class="btn btn-secondary" onclick="addCourseToCgpaSemester(${sem.id})"><i class="fa-solid fa-plus"></i> Add Course Row</button>
      </div>
    `;
  }).join('');

  calculateCgpaOverall();
}
function addNewCgpaSemester() {
  const newId = window.cgpaSemesters.length > 0 ? Math.max(...window.cgpaSemesters.map(s => s.id)) + 1 : 1;
  window.cgpaSemesters.push({
    id: newId,
    title: `Semester ${newId}`,
    courses: [{ name: '', credits: 3, grade: 'A' }]
  });
  renderSemesters();
}
function deleteCgpaSemester(semId) {
  window.cgpaSemesters = window.cgpaSemesters.filter(s => s.id !== semId);
  renderSemesters();
}
function addCourseToCgpaSemester(semId) {
  const sem = window.cgpaSemesters.find(s => s.id === semId);
  if (sem) {
    sem.courses.push({ name: '', credits: 3, grade: 'A' });
    renderSemesters();
  }
}
function deleteCgpaCourse(semId, courseIdx) {
  const sem = window.cgpaSemesters.find(s => s.id === semId);
  if (sem) {
    sem.courses.splice(courseIdx, 1);
    renderSemesters();
  }
}
function updateCgpaCourse(semId, courseIdx, field, val) {
  const sem = window.cgpaSemesters.find(s => s.id === semId);
  if (sem && sem.courses[courseIdx]) {
    if (field === 'credits') {
      sem.courses[courseIdx].credits = Number(val) || 0;
    } else {
      sem.courses[courseIdx][field] = val;
    }
    calculateCgpaOverall();
  }
}
const GRADE_POINTS = { O: 10, A: 9, B: 8, C: 7, D: 6, E: 5, F: 0 };
function calculateCgpaOverall() {
  let totalGradeCredits = 0;
  let totalCredits = 0;

  window.cgpaSemesters.forEach(sem => {
    sem.courses.forEach(c => {
      const points = GRADE_POINTS[c.grade] || 0;
      totalGradeCredits += (c.credits * points);
      totalCredits += c.credits;
    });
  });

  const cgpa = totalCredits > 0 ? (totalGradeCredits / totalCredits).toFixed(2) : '0.00';
  
  const cgpaEl = document.getElementById('summaryCgpa');
  const creditsEl = document.getElementById('summaryCredits');
  
  if (cgpaEl && creditsEl) {
    cgpaEl.innerText = cgpa;
    creditsEl.innerText = totalCredits;
  }
}
async function saveCgpaToProfile() {
  calculateCgpaOverall();
  const cgpaVal = document.getElementById('summaryCgpa').innerText;
  
  const user = JSON.parse(localStorage.getItem('student_os_user')) || {};
  const resumes = await fetchAPI('/api/resumes') || [];

  const resumeData = resumes.length > 0 ? resumes[0] : {
    name: user.fullName || '',
    email: user.email || '',
    phone: '',
    social: '',
    summary: 'Motivated student profile.',
    skills: '',
    experience: [],
    education: []
  };

  resumeData.education = [{
    college: user.collegeName || '',
    degree: 'B.Tech / Science Major',
    year: new Date().getFullYear().toString(),
    cgpa: cgpaVal,
    semesterData: JSON.stringify(window.cgpaSemesters) // Serialize semester data
  }];

  let res;
  if (resumes.length > 0) {
    res = await fetchAPI(`/api/resumes/${resumes[0].id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resumeData)
    });
  } else {
    res = await fetchAPI('/api/resumes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resumeData)
    });
  }

  if (res) {
    alert('CGPA and Semester records synced to Profile successfully!');
  }
}

// ==========================================================================
// SUB-FUNCTIONS FOR EXPENSES
// ==========================================================================
function openAddExpenseModal() {
  document.getElementById('addExpenseModal').style.display = 'block';
  document.getElementById('exOverlay').style.display = 'block';
  document.getElementById('exDate').value = new Date().toISOString().split('T')[0];
}
function closeAddExpenseModal() {
  document.getElementById('addExpenseModal').style.display = 'none';
  document.getElementById('exOverlay').style.display = 'none';
}
function renderExpenses(list) {
  const income = list.filter(e => e.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const spent = list.filter(e => e.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const balance = income - spent;

  document.getElementById('expIncome').innerText = `$${income}`;
  document.getElementById('expSpend').innerText = `$${spent}`;
  document.getElementById('expBalance').innerText = `$${balance}`;

  const histContainer = document.getElementById('expenseList');
  if (list.length === 0) {
    histContainer.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:20px;">No transactions recorded yet.</p>`;
  } else {
    histContainer.innerHTML = list.map(t => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-input); border-radius:var(--border-radius-sm); border:1px solid var(--border-color);">
        <div>
          <div style="font-weight:600; font-size:0.95rem;">${t.title}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${t.category} | ${new Date(t.date).toLocaleDateString()}</div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-weight:700; color: ${t.type === 'income' ? 'var(--success)' : 'var(--danger)'};">
            ${t.type === 'income' ? '+' : '-'}$${t.amount}
          </span>
          <button class="btn btn-secondary" onclick="deleteExpense('${t.id}')" style="padding:4px 8px; font-size:0.75rem;"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  // Calculate Category breakdown
  const categorySpent = {};
  list.filter(e => e.type === 'expense').forEach(e => {
    categorySpent[e.category] = (categorySpent[e.category] || 0) + e.amount;
  });

  const chartContainer = document.getElementById('expenseChart');
  const catEntries = Object.entries(categorySpent);
  if (catEntries.length === 0) {
    chartContainer.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:20px;">No expense breakdown.</p>`;
  } else {
    chartContainer.innerHTML = catEntries.map(([cat, amt]) => {
      const pct = spent > 0 ? Math.round((amt / spent) * 100) : 0;
      return `
        <div>
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
            <span><strong>${cat}</strong></span>
            <span>$${amt} (${pct}%)</span>
          </div>
          <div class="budget-progress-bar">
            <div class="budget-progress-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}
async function handleAddExpense(e) {
  e.preventDefault();
  const title = document.getElementById('exTitle').value;
  const amount = document.getElementById('exAmount').value;
  const type = document.getElementById('exType').value;
  const category = document.getElementById('exCategory').value;
  const date = document.getElementById('exDate').value;

  const res = await fetchAPI('/api/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, amount, type, category, date })
  });

  if (res) {
    closeAddExpenseModal();
    const tx = await fetchAPI('/api/expenses') || [];
    renderExpenses(tx);
  }
}
async function deleteExpense(id) {
  if (confirm('Delete this transaction?')) {
    const res = await fetchAPI(`/api/expenses/${id}`, { method: 'DELETE' });
    if (res) {
      const tx = await fetchAPI('/api/expenses') || [];
      renderExpenses(tx);
    }
  }
}

// ==========================================================================
// SUB-FUNCTIONS FOR DIGITAL ID CARD
// ==========================================================================
function previewIDPhoto(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('idCardPhoto').src = e.target.result;
      // Save photo locally in window state
      window.tempIDPhotoBase64 = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }
}
function updateIDCardText() {
  const name = document.getElementById('idInputName').value || 'Student Name';
  const college = document.getElementById('idInputCollege').value || 'UNIVERSITY NAME';
  const branch = document.getElementById('idInputBranch').value || 'Computer Science';
  const roll = document.getElementById('idInputRoll').value || 'STU-12345';
  const valid = document.getElementById('idInputValid').value || '06/2028';

  document.getElementById('idCardName').innerText = name;
  document.getElementById('idCollName').innerText = college.toUpperCase();
  document.getElementById('idCardBranch').innerText = branch;
  document.getElementById('idCardRoll').innerText = roll;
  document.getElementById('idCardValid').innerText = valid;

  const barcodeEl = document.querySelector('.id-barcode');
  if (barcodeEl) {
    barcodeEl.innerText = `*${roll.replace(/\s+/g, '')}*`;
  }
}
function handleUpdateID(e) {
  e.preventDefault();
  const name = document.getElementById('idInputName').value;
  const college = document.getElementById('idInputCollege').value;
  const branch = document.getElementById('idInputBranch').value;
  const roll = document.getElementById('idInputRoll').value;
  const valid = document.getElementById('idInputValid').value;

  const idDetails = {
    branch,
    roll,
    valid,
    photo: window.tempIDPhotoBase64 || document.getElementById('idCardPhoto').src
  };

  localStorage.setItem('student_os_digital_id', JSON.stringify(idDetails));
  updateIDCardText();
  alert('ID Card updated successfully!');
}

// ==========================================================================
// SUB-FUNCTIONS FOR HABIT TRACKER
// ==========================================================================
function openAddHabitModal() {
  document.getElementById('addHabitModal').style.display = 'block';
  document.getElementById('habOverlay').style.display = 'block';
}
function closeAddHabitModal() {
  document.getElementById('addHabitModal').style.display = 'none';
  document.getElementById('habOverlay').style.display = 'none';
}
function renderHabitsList(habitsList) {
  const headers = document.getElementById('habitDateHeaders');
  const container = document.getElementById('habitListContainer');

  // Generate date labels (last 7 days)
  const days = [];
  const dayLabels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
    dayLabels.push(d.toLocaleDateString(undefined, { weekday: 'narrow' }));
  }

  headers.innerHTML = dayLabels.map(label => `<span style="width: 32px; text-align:center;">${label}</span>`).join('');

  if (habitsList.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:20px 0;">No habits tracked. Add a new habit to start!</p>`;
    return;
  }

  container.innerHTML = habitsList.map(h => {
    // Calculate streak
    let streak = 0;
    const sortedDates = Object.keys(h.history || {}).sort((a,b) => new Date(b) - new Date(a));
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Check if habit has been clicked today or yesterday to continue streak
    if (h.history[todayStr] || h.history[yesterdayStr]) {
      let checkDate = h.history[todayStr] ? new Date() : new Date(Date.now() - 86400000);
      while (true) {
        const dStr = checkDate.toISOString().split('T')[0];
        if (h.history[dStr]) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    return `
      <div class="habit-row">
        <div style="width: 250px;">
          <div style="font-weight:600; font-size:0.95rem;">${h.name}</div>
          <span class="badge badge-medium" style="font-size:0.7rem; padding: 2px 6px; margin-top:4px;">${h.category}</span>
        </div>
        
        <div style="display:flex; gap:6px;">
          ${days.map(dStr => {
            const isCompleted = h.history && h.history[dStr];
            return `
              <button class="habit-checkbox ${isCompleted ? 'completed' : ''}" onclick="toggleHabitCell('${h.id}', '${dStr}', this)" style="width:32px; height:32px;">
                ${isCompleted ? '<i class="fa-solid fa-check"></i>' : ''}
              </button>
            `;
          }).join('')}
        </div>
        
        <div style="width: 100px; text-align:center; font-weight:700; font-size:1.1rem; color:var(--accent);">
          ${streak} 🔥
        </div>
        <button class="btn btn-secondary" onclick="deleteHabit('${h.id}')" style="padding:4px 8px;"><i class="fa-solid fa-trash" style="color:var(--danger)"></i></button>
      </div>
    `;
  }).join('');
}
async function toggleHabitDash(id, date, btn) {
  const isDone = btn.classList.toggle('completed');
  btn.innerHTML = isDone ? '<i class="fa-solid fa-check"></i>' : '';
  await fetchAPI(`/api/habits/${id}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date })
  });
}
async function toggleHabitCell(id, date, btn) {
  const isDone = btn.classList.toggle('completed');
  btn.innerHTML = isDone ? '<i class="fa-solid fa-check"></i>' : '';
  
  const res = await fetchAPI(`/api/habits/${id}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date })
  });
  if (res) {
    const list = await fetchAPI('/api/habits') || [];
    renderHabitsList(list);
  }
}
async function handleAddHabit(e) {
  e.preventDefault();
  const name = document.getElementById('habName').value;
  const category = document.getElementById('habCategory').value;

  const res = await fetchAPI('/api/habits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, category })
  });

  if (res) {
    closeAddHabitModal();
    const list = await fetchAPI('/api/habits') || [];
    renderHabitsList(list);
  }
}
async function deleteHabit(id) {
  if (confirm('Delete this habit tracker?')) {
    const res = await fetchAPI(`/api/habits/${id}`, { method: 'DELETE' });
    if (res) {
      const list = await fetchAPI('/api/habits') || [];
      renderHabitsList(list);
    }
  }
}

// ==========================================================================
// SUB-FUNCTIONS FOR FILE STORAGE
// ==========================================================================
function openUploadFileModal() {
  document.getElementById('uploadFileModal').style.display = 'block';
  document.getElementById('fileOverlay').style.display = 'block';
}
function closeUploadFileModal() {
  document.getElementById('uploadFileModal').style.display = 'none';
  document.getElementById('fileOverlay').style.display = 'none';
}
function renderFilesGrid(list) {
  const grid = document.getElementById('filesGrid');
  if (list.length === 0) {
    grid.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding:30px; width:100%;">No files uploaded yet.</p>`;
    return;
  }
  grid.innerHTML = list.map(f => {
    return `
      <div class="card file-card">
        <div class="file-icon"><i class="fa-solid fa-file-invoice"></i></div>
        <div class="file-name" title="${f.filename}">${f.filename}</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">${f.category}</div>
        <div style="display:flex; gap:8px; width:100%; margin-top:8px;">
          <a href="${f.path}" download class="btn btn-primary" style="flex:1; padding:6px; font-size:0.8rem;"><i class="fa-solid fa-download"></i></a>
          <button class="btn btn-secondary" onclick="deleteFile('${f.id}')" style="padding:6px; font-size:0.8rem;"><i class="fa-solid fa-trash" style="color:var(--danger)"></i></button>
        </div>
      </div>
    `;
  }).join('');
}
async function handleUploadFile(e) {
  e.preventDefault();
  const fileInput = document.getElementById('fileUploadInput');
  const category = document.getElementById('fileCategory').value;

  if (fileInput.files.length === 0) return;

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('category', category);

  const res = await fetch('/api/files', {
    method: 'POST',
    body: formData
  });

  if (res.ok) {
    closeUploadFileModal();
    const files = await fetchAPI('/api/files') || [];
    renderFilesGrid(files);
  } else {
    alert('File upload failed.');
  }
}
async function deleteFile(id) {
  if (confirm('Delete this file?')) {
    const res = await fetchAPI(`/api/files/${id}`, { method: 'DELETE' });
    if (res) {
      const files = await fetchAPI('/api/files') || [];
      renderFilesGrid(files);
    }
  }
}

// ==========================================================================
// SUB-FUNCTIONS FOR QUESTION PAPERS
// ==========================================================================
function openUploadPaperModal() {
  document.getElementById('uploadPaperModal').style.display = 'block';
  document.getElementById('paperOverlay').style.display = 'block';
}
function closeUploadPaperModal() {
  document.getElementById('uploadPaperModal').style.display = 'none';
  document.getElementById('paperOverlay').style.display = 'none';
}
function renderPapersList(list) {
  const user = JSON.parse(localStorage.getItem('student_os_user')) || {};
  const isAuthorized = user.role === 'admin' || user.role === 'faculty';
  const tbody = document.getElementById('papersTableBody');

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--text-muted);">No question papers matching search criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => `
    <tr style="border-bottom:1px solid var(--border-color); font-size:0.9rem;">
      <td style="padding:12px 8px;"><strong>${p.subject}</strong></td>
      <td style="padding:12px 8px;">Semester ${p.semester}</td>
      <td style="padding:12px 8px;">${p.year}</td>
      <td style="padding:12px 8px;">
        <div style="display:flex; gap:8px;">
          <a href="${p.path}" download class="btn btn-primary" style="padding:4px 8px; font-size:0.8rem;"><i class="fa-solid fa-download"></i> Download</a>
          ${isAuthorized ? `<button class="btn btn-secondary" onclick="deletePaper('${p.id}')" style="padding:4px 8px; font-size:0.8rem; color:var(--danger); border-color:var(--danger);"><i class="fa-solid fa-trash"></i> Delete</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}
function filterPapers() {
  const sem = document.getElementById('paperSemesterSelect').value;
  const q = document.getElementById('paperSearchInput').value.toLowerCase();

  const filtered = window.allPapers.filter(p => {
    if (sem !== 'All' && String(p.semester) !== sem) return false;
    if (q && !p.subject.toLowerCase().includes(q)) return false;
    return true;
  });
  renderPapersList(filtered);
}
async function handleUploadPaper(e) {
  e.preventDefault();
  const fileInput = document.getElementById('paperFileInput');
  const subject = document.getElementById('paperSubject').value;
  const semester = document.getElementById('paperSem').value;
  const year = document.getElementById('paperYear').value;

  if (fileInput.files.length === 0) return;

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('subject', subject);
  formData.append('semester', semester);
  formData.append('year', year);

  const res = await fetch('/api/papers', {
    method: 'POST',
    body: formData
  });

  if (res.ok) {
    closeUploadPaperModal();
    window.allPapers = await fetchAPI('/api/papers') || [];
    renderPapersList(window.allPapers);
  } else {
    alert('Paper upload failed.');
  }
}
async function deletePaper(id) {
  if (confirm('Delete this question paper?')) {
    const res = await fetchAPI(`/api/papers/${id}`, { method: 'DELETE' });
    if (res) {
      window.allPapers = await fetchAPI('/api/papers') || [];
      renderPapersList(window.allPapers);
    }
  }
}

// ==========================================================================
// SUB-FUNCTIONS FOR PLACEMENT PREP
// ==========================================================================
function switchPlacementTab(tab) {
  const panel = document.getElementById('placementContentPanel');
  const btnApt = document.getElementById('btnPlacementApt');
  const btnCode = document.getElementById('btnPlacementCode');
  const btnCards = document.getElementById('btnPlacementCards');

  btnApt.classList.remove('active');
  btnCode.classList.remove('active');
  btnCards.classList.remove('active');

  if (tab === 'apt') {
    btnApt.classList.add('active');
    renderAptitude(panel);
  } else if (tab === 'code') {
    btnCode.classList.add('active');
    renderCoding(panel);
  } else {
    btnCards.classList.add('active');
    renderFlashcards(panel);
  }
}
function renderAptitude(panel) {
  const list = window.placementMaterial.aptitude || [];
  panel.innerHTML = `
    <h3 class="placement-section-title">Aptitude & Logical Quizzes</h3>
    ${list.map((q, idx) => `
      <div class="card quiz-card">
        <span class="badge badge-low" style="margin-bottom:10px;">${q.topic}</span>
        <div style="font-weight:600; font-size:1rem; margin-bottom:12px;">Q${idx+1}: ${q.question}</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${q.options.map(opt => `
            <div class="quiz-option" onclick="checkAptitudeAnswer(this, '${opt}', '${q.answer}', '${q.explanation.replace(/'/g, "\\'")}')">${opt}</div>
          `).join('')}
        </div>
        <div class="quiz-explanation" style="display:none; margin-top:12px; padding:10px; background:var(--bg-input); border-radius:var(--border-radius-sm); border-left:4px solid var(--primary); font-size:0.9rem;"></div>
      </div>
    `).join('')}
  `;
}
function checkAptitudeAnswer(optEl, selected, answer, explanation) {
  const parent = optEl.parentNode;
  const options = parent.querySelectorAll('.quiz-option');
  
  options.forEach(opt => {
    opt.style.pointerEvents = 'none';
    if (opt.innerText === answer) {
      opt.classList.add('correct');
    } else if (opt === optEl && selected !== answer) {
      opt.classList.add('wrong');
    }
  });

  const expBox = parent.parentNode.querySelector('.quiz-explanation');
  if (expBox) {
    expBox.innerHTML = `<strong>Explanation:</strong> ${explanation}`;
    expBox.style.display = 'block';
  }
}
function renderCoding(panel) {
  const list = window.placementMaterial.coding || [];
  panel.innerHTML = `
    <h3 class="placement-section-title">Coding Practice Problems</h3>
    ${list.map((c, idx) => `
      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h4 style="font-weight:600; font-size:1.1rem;">${idx+1}. ${c.title}</h4>
          <span class="badge badge-low">${c.difficulty}</span>
        </div>
        <pre style="background:var(--bg-input); padding:12px; border-radius:var(--border-radius-sm); font-size:0.85rem; overflow-x:auto; margin-bottom:12px; border:1px solid var(--border-color); white-space:pre-wrap;">${c.problem}\n\n${c.example}</pre>
        
        <button class="btn btn-secondary" onclick="toggleCodingSolution(this)">Show JS Solution</button>
        <pre class="coding-solution" style="display:none; background:#1e1e2e; color:#abe9b3; padding:12px; border-radius:var(--border-radius-sm); font-size:0.85rem; overflow-x:auto; margin-top:12px; font-family:monospace; border:1px solid var(--border-color);">${c.solution}</pre>
      </div>
    `).join('')}
  `;
}
function toggleCodingSolution(btn) {
  const solutionPre = btn.parentNode.querySelector('.coding-solution');
  if (solutionPre.style.display === 'none') {
    solutionPre.style.display = 'block';
    btn.innerText = 'Hide Solution';
  } else {
    solutionPre.style.display = 'none';
    btn.innerText = 'Show JS Solution';
  }
}
function renderFlashcards(panel) {
  const list = window.placementMaterial.flashcards || [];
  panel.innerHTML = `
    <h3 class="placement-section-title">Interview Flashcards</h3>
    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:20px;">
      ${list.map(c => `
        <div class="card" onclick="toggleFlashcard(this)" style="cursor:pointer; height:180px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:20px; transition:var(--transition);">
          <div class="card-question" style="font-weight:600; font-size:1rem; color:var(--primary);">${c.question}</div>
          <div class="card-answer" style="display:none; font-size:0.9rem; color:var(--text-main); font-style:italic;">${c.answer}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:12px; position:absolute; bottom:10px;">Click card to flip</div>
        </div>
      `).join('')}
    </div>
  `;
}
function toggleFlashcard(cardEl) {
  const q = cardEl.querySelector('.card-question');
  const a = cardEl.querySelector('.card-answer');
  if (q.style.display === 'none') {
    q.style.display = 'block';
    a.style.display = 'none';
    cardEl.style.borderColor = 'var(--border-color)';
  } else {
    q.style.display = 'none';
    a.style.display = 'block';
    cardEl.style.borderColor = 'var(--accent)';
  }
}

// ==========================================================================
// SUB-FUNCTIONS FOR RESUME BUILDER
// ==========================================================================
function updateResumePreview() {
  const name = document.getElementById('resName').value || 'Full Name';
  const email = document.getElementById('resEmail').value || 'email@example.com';
  const phone = document.getElementById('resPhone').value || 'Phone Number';
  const social = document.getElementById('resSocial').value || 'github.com/profile';
  const summary = document.getElementById('resSummary').value || 'A brief summary...';
  
  const eduColl = document.getElementById('resEduColl').value || 'University Name';
  const eduDegree = document.getElementById('resEduDegree').value || 'Degree Title';
  const eduYear = document.getElementById('resEduYear').value || 'Year';
  const eduCGPA = document.getElementById('resEduCGPA').value || 'CGPA';
  
  const skills = document.getElementById('resSkills').value || 'Skill 1, Skill 2, Skill 3';
  
  const expTitle = document.getElementById('resExpTitle').value || 'Project Title';
  const expOrg = document.getElementById('resExpOrg').value || 'Organization';
  const expDesc = document.getElementById('resExpDesc').value || 'Describe details...';

  const preview = document.getElementById('resPreview');
  if (!preview) return;

  preview.innerHTML = `
    <div class="resume-preview-header">
      <h2 style="font-size:1.8rem; font-weight:bold; margin-bottom:4px; color:#222;">${name}</h2>
      <div style="font-size:0.85rem; color:#555;">
        ${email} | ${phone} | ${social}
      </div>
    </div>
    
    <div class="resume-preview-section">
      <div class="resume-preview-section-title">Summary</div>
      <p style="font-size:0.9rem; line-height:1.4; color:#333; text-align:justify;">${summary}</p>
    </div>

    <div class="resume-preview-section">
      <div class="resume-preview-section-title">Education</div>
      <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:0.9rem;">
        <span>${eduColl}</span>
        <span>${eduYear}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:0.9rem; color:#444;">
        <span>${eduDegree}</span>
        <span>CGPA: ${eduCGPA}</span>
      </div>
    </div>

    <div class="resume-preview-section">
      <div class="resume-preview-section-title">Skills</div>
      <p style="font-size:0.9rem; color:#333;"><strong>Technical Skills:</strong> ${skills}</p>
    </div>

    <div class="resume-preview-section">
      <div class="resume-preview-section-title">Projects & Experience</div>
      <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:0.9rem;">
        <span>${expTitle}</span>
        <span>${expOrg}</span>
      </div>
      <p style="font-size:0.85rem; color:#555; margin-top:4px; text-align:justify; white-space:pre-wrap;">${expDesc}</p>
    </div>
  `;
}
async function saveResumeDetails() {
  const name = document.getElementById('resName').value;
  const email = document.getElementById('resEmail').value;
  const phone = document.getElementById('resPhone').value;
  const social = document.getElementById('resSocial').value;
  const summary = document.getElementById('resSummary').value;
  
  const eduColl = document.getElementById('resEduColl').value;
  const eduDegree = document.getElementById('resEduDegree').value;
  const eduYear = document.getElementById('resEduYear').value;
  const eduCGPA = document.getElementById('resEduCGPA').value;
  
  const skills = document.getElementById('resSkills').value;
  
  const expTitle = document.getElementById('resExpTitle').value;
  const expOrg = document.getElementById('resExpOrg').value;
  const expDesc = document.getElementById('resExpDesc').value;

  const resumeData = {
    name,
    email,
    phone,
    social,
    summary,
    education: [{ college: eduColl, degree: eduDegree, year: eduYear, cgpa: eduCGPA }],
    skills,
    experience: [{ title: expTitle, org: expOrg, desc: expDesc }]
  };

  let res;
  if (window.activeResumeId) {
    res = await fetchAPI(`/api/resumes/${window.activeResumeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resumeData)
    });
  } else {
    res = await fetchAPI('/api/resumes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resumeData)
    });
  }

  if (res) {
    if (res.id) window.activeResumeId = res.id;
    alert('Resume details saved successfully!');
  }
}

// ==========================================================================
// SUB-FUNCTIONS FOR FACULTY PORTAL
// ==========================================================================
async function refreshFacultyStudents() {
  const tbody = document.getElementById('facultyStudentsTable');
  if (!tbody) return;

  const students = await fetchAPI('/api/faculty/students') || [];
  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">No students assigned to you yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => {
    return `
      <tr style="border-bottom:1px solid var(--border-color); font-size:0.9rem;">
        <td style="padding:12px 8px;"><strong>${s.fullName}</strong></td>
        <td style="padding:12px 8px;">${s.username}</td>
        <td style="padding:12px 8px;">${s.email}</td>
        <td style="padding:12px 8px;">
          <span class="badge badge-${s.isVerified ? 'low' : 'high'}">
            ${s.isVerified ? 'Verified' : 'Pending Verification'}
          </span>
        </td>
        <td style="padding:12px 8px;">
          <div style="display:flex; gap:8px;">
            ${!s.isVerified ? `<button class="btn btn-primary" style="padding:4px 8px; font-size:0.8rem;" onclick="verifyStudentAccount('${s.id}')"><i class="fa-solid fa-user-check"></i> Verify</button>` : ''}
            <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.8rem;" onclick="viewStudentAttendance('${s.id}', '${s.fullName.replace(/'/g, "\\'")}')"><i class="fa-solid fa-chart-simple"></i> View Attendance</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function verifyStudentAccount(studentId) {
  const res = await fetchAPI('/api/faculty/verify-student', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId })
  });

  if (res) {
    alert('Student verified successfully!');
    await refreshFacultyStudents();
  }
}

async function viewStudentAttendance(studentId, fullName) {
  document.getElementById('studentDetailTitle').innerText = `${fullName}'s Subject Attendance`;
  document.getElementById('studentDetailModal').style.display = 'block';
  document.getElementById('studentDetailOverlay').style.display = 'block';

  const content = document.getElementById('studentDetailContent');
  content.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Fetching records...</p>';

  const records = await fetchAPI(`/api/faculty/student-attendance/${studentId}`) || [];
  if (records.length === 0) {
    content.innerHTML = `<p style="color:var(--text-muted); text-align:center;">This student has not set up any attendance trackers.</p>`;
    return;
  }

  content.innerHTML = records.map(r => {
    const pct = r.total > 0 ? Math.round((r.attended / r.total) * 100) : 100;
    const isUnder = pct < r.target;
    return `
      <div style="padding:14px; background:var(--bg-input); border-radius:var(--border-radius-sm); border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
        <div>
          <h4 style="font-weight:600;">${r.subject}</h4>
          <span style="font-size:0.8rem; color:var(--text-muted);">Classes: ${r.attended} / ${r.total} (Target: ${r.target}%)</span>
        </div>
        <span style="font-size:1.2rem; font-weight:700; color: ${isUnder ? 'var(--danger)' : 'var(--success)'};">${pct}%</span>
      </div>
    `;
  }).join('');
}

function closeStudentDetailModal() {
  document.getElementById('studentDetailModal').style.display = 'none';
  document.getElementById('studentDetailOverlay').style.display = 'none';
}
