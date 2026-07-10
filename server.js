require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'student_os_jwt_secret';

// Initialize directories
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Setup Multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Setup Gemini API Client if key is available
let aiModel = null;
if (process.env.GEMINI_API_KEY) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    aiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('Gemini AI assistant initialized successfully.');
  } catch (error) {
    console.error('Error initializing Gemini API:', error);
  }
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const token = req.cookies.token || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Session expired. Please log in again.' });
  }
}

// Optional Admin validation
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin privileges required.' });
  }
}

// Admin or Faculty validation
function requireAdminOrFaculty(req, res, next) {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'faculty')) {
    next();
  } else {
    res.status(403).json({ error: 'Admin or Faculty privileges required.' });
  }
}

// Seed Calendar Holidays on startup if empty
async function seedDefaultHolidays() {
  try {
    const year = new Date().getFullYear();
    const defaultHolidays = [
      { title: "New Year's Day", date: `${year}-01-01`, type: "Holiday", description: "Global New Year Celebration" },
      { title: "Pongal", date: `${year}-01-15`, type: "Holiday", description: "Harvest Festival of South India" },
      { title: "Republic Day", date: `${year}-01-26`, type: "Holiday", description: "Indian Republic Day - National Holiday" },
      { title: "Maha Shivratri", date: `${year}-02-15`, type: "Holiday", description: "Lord Shiva Festival" },
      { title: "Holi", date: `${year}-03-04`, type: "Holiday", description: "Festival of Colors" },
      { title: "Good Friday", date: `${year}-04-03`, type: "Holiday", description: "Christian Holy Day" },
      { title: "Mahavir Jayanti", date: `${year}-04-01`, type: "Holiday", description: "Birth of Lord Mahavira" },
      { title: "Ambedkar Jayanti", date: `${year}-04-14`, type: "Holiday", description: "Dr. B.R. Ambedkar Birthday" },
      { title: "Budha Purnima", date: `${year}-05-01`, type: "Holiday", description: "Gautam Buddha Birthday" },
      { title: "Id-ul-Zuha (Bakrid)", date: `${year}-05-27`, type: "Holiday", description: "Islamic Feast of Sacrifice" },
      { title: "Muharram", date: `${year}-06-26`, type: "Holiday", description: "Islamic New Year Mourning Day" },
      { title: "Independence Day", date: `${year}-08-15`, type: "Holiday", description: "Indian Independence Day - National Holiday" },
      { title: "Janmashtami", date: `${year}-09-03`, type: "Holiday", description: "Birth of Lord Krishna" },
      { title: "Milad-un-Nabi", date: `${year}-09-15`, type: "Holiday", description: "Prophet Muhammad's Birthday" },
      { title: "Gandhi Jayanti", date: `${year}-10-02`, type: "Holiday", description: "Mahatma Gandhi Birthday - National Holiday" },
      { title: "Dussehra", date: `${year}-10-20`, type: "Holiday", description: "Vijayadashami - Victory of Good over Evil" },
      { title: "Diwali (Deepavali)", date: `${year}-11-08`, type: "Holiday", description: "Festival of Lights" },
      { title: "Guru Nanak Jayanti", date: `${year}-11-24`, type: "Holiday", description: "Guru Nanak Dev Birthday" },
      { title: "Christmas Day", date: `${year}-12-25`, type: "Holiday", description: "Christmas Celebration" }
    ];

    // Clear old system holidays so list refreshes with new Indian Government holidays
    await db.delete('calendar', { userId: 'system' });

    for (const h of defaultHolidays) {
      await db.insert('calendar', {
        userId: 'system',
        ...h
      });
    }
    console.log('Successfully seeded Indian Government Gazetted Holidays.');
  } catch (error) {
    console.error('Error seeding calendar holidays:', error);
  }
}

// --- API ROUTES ---

// Auth Endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email, role, securityQuestion, securityAnswer, fullName, collegeName, department, facultyId } = req.body;
    
    if (!username || !password || !email || !securityQuestion || !securityAnswer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingUser = await db.findOne('users', { username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role === 'admin' ? 'admin' : (role === 'faculty' ? 'faculty' : 'student');
    
    // Students must be verified by their Advisor/Admin first; Faculty/Admins are auto-verified
    const isVerified = userRole !== 'student'; 

    const user = await db.insert('users', {
      username,
      password: hashedPassword,
      email,
      role: userRole,
      securityQuestion,
      securityAnswer: securityAnswer.toLowerCase().trim(),
      fullName: fullName || username,
      collegeName: collegeName || 'College Student OS',
      department: department || '',
      facultyId: userRole === 'student' ? (facultyId || '') : '',
      isVerified
    });

    res.status(201).json({ message: 'User registered successfully', userId: user.id, isVerified });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const user = await db.findOne('users', { username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    // Check account verification
    if (user.isVerified === false) {
      return res.status(403).json({ error: 'Your account is pending verification by your Faculty Advisor or Admin.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Set to true if running on HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        collegeName: user.collegeName,
        department: user.department || ''
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { username, securityAnswer, newPassword } = req.body;
    if (!username || !securityAnswer || !newPassword) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const user = await db.findOne('users', { username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.securityAnswer !== securityAnswer.toLowerCase().trim()) {
      return res.status(400).json({ error: 'Incorrect answer to security question' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.update('users', { id: user.id }, { password: hashedPassword });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/security-question', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }
    const user = await db.findOne('users', { username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ securityQuestion: user.securityQuestion });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/user', authenticateToken, async (req, res) => {
  try {
    const user = await db.findOne('users', { id: req.user.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      collegeName: user.collegeName,
      department: user.department || ''
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// Timetable Endpoints
app.get('/api/timetable', authenticateToken, async (req, res) => {
  const items = await db.find('timetable', { userId: req.user.id });
  res.json(items);
});

app.post('/api/timetable', authenticateToken, async (req, res) => {
  const { subject, day, startTime, endTime, room, instructor } = req.body;
  if (!subject || !day || !startTime || !endTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const entry = await db.insert('timetable', {
    userId: req.user.id,
    subject,
    day,
    startTime,
    endTime,
    room: room || '',
    instructor: instructor || ''
  });
  res.status(201).json(entry);
});

app.delete('/api/timetable/:id', authenticateToken, async (req, res) => {
  const deleted = await db.delete('timetable', { id: req.params.id, userId: req.user.id });
  if (deleted) res.json({ message: 'Timetable entry deleted' });
  else res.status(404).json({ error: 'Not found' });
});

// Notes Endpoints
app.get('/api/notes', authenticateToken, async (req, res) => {
  try {
    const user = await db.findOne('users', { id: req.user.id });
    const personalNotes = await db.find('notes', { userId: req.user.id });

    if (user && user.role === 'student') {
      const sharedNotes = await db.find('notes', {
        isShared: true,
        collegeName: user.collegeName,
        department: user.department
      });

      if (sharedNotes.length > 0) {
        for (const note of sharedNotes) {
          const exists = personalNotes.some(n => n.sharedNoteId === note.id);
          if (!exists) {
            const newNote = await db.insert('notes', {
              userId: req.user.id,
              title: note.title,
              content: note.content,
              category: note.category || 'General',
              sharedNoteId: note.id,
              assignedBy: note.authorName || 'Faculty'
            });
            personalNotes.push(newNote);
          }
        }
      }
    }

    res.json(personalNotes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notes', authenticateToken, async (req, res) => {
  const { title, content, category } = req.body;
  const entry = await db.insert('notes', {
    userId: req.user.id,
    title: title || 'Untitled Note',
    content: content || '',
    category: category || 'General'
  });
  res.status(201).json(entry);
});

app.put('/api/notes/:id', authenticateToken, async (req, res) => {
  const { title, content, category } = req.body;
  const updated = await db.update('notes', { id: req.params.id, userId: req.user.id }, {
    title,
    content,
    category
  });
  if (updated) res.json({ message: 'Note updated' });
  else res.status(404).json({ error: 'Not found' });
});

app.delete('/api/notes/:id', authenticateToken, async (req, res) => {
  const deleted = await db.delete('notes', { id: req.params.id, userId: req.user.id });
  if (deleted) res.json({ message: 'Note deleted' });
  else res.status(404).json({ error: 'Not found' });
});

// Assignments Endpoints
app.get('/api/assignments', authenticateToken, async (req, res) => {
  try {
    const user = await db.findOne('users', { id: req.user.id });
    const personalAssignments = await db.find('assignments', { userId: req.user.id });

    if (user && user.role === 'student') {
      const sharedAssignments = await db.find('assignments', {
        isShared: true,
        collegeName: user.collegeName,
        department: user.department
      });

      if (sharedAssignments.length > 0) {
        for (const ass of sharedAssignments) {
          const exists = personalAssignments.some(a => a.sharedAssignmentId === ass.id);
          if (!exists) {
            const newAss = await db.insert('assignments', {
              userId: req.user.id,
              title: ass.title,
              subject: ass.subject || 'General',
              dueDate: ass.dueDate,
              status: 'Pending',
              priority: ass.priority || 'Medium',
              description: ass.description || '',
              sharedAssignmentId: ass.id,
              assignedBy: ass.authorName || 'Faculty'
            });
            personalAssignments.push(newAss);
          }
        }
      }
    }

    res.json(personalAssignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/assignments', authenticateToken, async (req, res) => {
  const { title, subject, dueDate, status, priority, description } = req.body;
  if (!title || !dueDate) {
    return res.status(400).json({ error: 'Title and Due Date required' });
  }
  const entry = await db.insert('assignments', {
    userId: req.user.id,
    title,
    subject: subject || 'General',
    dueDate,
    status: status || 'Pending', // Pending, Completed, Submitted
    priority: priority || 'Medium', // Low, Medium, High
    description: description || ''
  });
  res.status(201).json(entry);
});

app.put('/api/assignments/:id', authenticateToken, async (req, res) => {
  const { title, subject, dueDate, status, priority, description } = req.body;
  const updated = await db.update('assignments', { id: req.params.id, userId: req.user.id }, {
    title,
    subject,
    dueDate,
    status,
    priority,
    description
  });
  if (updated) res.json({ message: 'Assignment updated' });
  else res.status(404).json({ error: 'Not found' });
});

app.delete('/api/assignments/:id', authenticateToken, async (req, res) => {
  const deleted = await db.delete('assignments', { id: req.params.id, userId: req.user.id });
  if (deleted) res.json({ message: 'Assignment deleted' });
  else res.status(404).json({ error: 'Not found' });
});

// Attendance Tracker
app.get('/api/attendance', authenticateToken, async (req, res) => {
  const items = await db.find('attendance', { userId: req.user.id });
  res.json(items);
});

app.post('/api/attendance', authenticateToken, async (req, res) => {
  if (req.user.role === 'student') {
    return res.status(403).json({ error: 'Access denied. Students cannot modify attendance records.' });
  }
  const { subject, attended, total, target } = req.body;
  if (!subject) return res.status(400).json({ error: 'Subject required' });
  
  const entry = await db.insert('attendance', {
    userId: req.user.id,
    subject,
    attended: Number(attended) || 0,
    total: Number(total) || 0,
    target: Number(target) || 75,
    logs: [] // Array of { date: string, status: 'present'|'absent' }
  });
  res.status(201).json(entry);
});

app.put('/api/attendance/:id', authenticateToken, async (req, res) => {
  if (req.user.role === 'student') {
    return res.status(403).json({ error: 'Access denied. Students cannot modify attendance records.' });
  }
  const { subject, attended, total, target } = req.body;
  const updated = await db.update('attendance', { id: req.params.id, userId: req.user.id }, {
    subject,
    attended: Number(attended),
    total: Number(total),
    target: Number(target)
  });
  if (updated) res.json({ message: 'Attendance updated' });
  else res.status(404).json({ error: 'Not found' });
});

app.post('/api/attendance/:id/log', authenticateToken, async (req, res) => {
  if (req.user.role === 'student') {
    return res.status(403).json({ error: 'Access denied. Students cannot modify attendance records.' });
  }
  const { status } = req.body; // 'present' or 'absent'
  if (status !== 'present' && status !== 'absent') {
    return res.status(400).json({ error: 'Status must be present or absent' });
  }

  const subjectRecord = await db.findOne('attendance', { id: req.params.id, userId: req.user.id });
  if (!subjectRecord) return res.status(404).json({ error: 'Subject not found' });

  const logs = subjectRecord.logs || [];
  logs.push({
    date: new Date().toISOString(),
    status
  });

  const newAttended = status === 'present' ? subjectRecord.attended + 1 : subjectRecord.attended;
  const newTotal = subjectRecord.total + 1;

  await db.update('attendance', { id: req.params.id, userId: req.user.id }, {
    attended: newAttended,
    total: newTotal,
    logs
  });

  res.json({ message: 'Attendance logged', attended: newAttended, total: newTotal });
});

app.delete('/api/attendance/:id', authenticateToken, async (req, res) => {
  if (req.user.role === 'student') {
    return res.status(403).json({ error: 'Access denied. Students cannot modify attendance records.' });
  }
  const deleted = await db.delete('attendance', { id: req.params.id, userId: req.user.id });
  if (deleted) res.json({ message: 'Attendance track deleted' });
  else res.status(404).json({ error: 'Not found' });
});

// Academic Calendar
app.get('/api/calendar', authenticateToken, async (req, res) => {
  const personalItems = await db.find('calendar', { userId: req.user.id });
  const systemItems = await db.find('calendar', { userId: 'system' });
  res.json([...personalItems, ...systemItems]);
});

app.post('/api/calendar', authenticateToken, async (req, res) => {
  const { title, date, type, description } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'Title and date required' });

  const entry = await db.insert('calendar', {
    userId: req.user.id,
    title,
    date,
    type: type || 'Exam', // Exam, Holiday, Class, Event
    description: description || ''
  });
  res.status(201).json(entry);
});

app.delete('/api/calendar/:id', authenticateToken, async (req, res) => {
  const deleted = await db.delete('calendar', { id: req.params.id, userId: req.user.id });
  if (deleted) res.json({ message: 'Calendar event deleted' });
  else res.status(404).json({ error: 'Not found' });
});

// Expense Tracker
app.get('/api/expenses', authenticateToken, async (req, res) => {
  const items = await db.find('expenses', { userId: req.user.id });
  res.json(items);
});

app.post('/api/expenses', authenticateToken, async (req, res) => {
  const { title, amount, type, category, date } = req.body;
  if (!title || !amount || !type || !category) {
    return res.status(400).json({ error: 'Missing required transaction fields' });
  }

  const entry = await db.insert('expenses', {
    userId: req.user.id,
    title,
    amount: Number(amount),
    type, // income or expense
    category,
    date: date || new Date().toISOString().split('T')[0]
  });
  res.status(201).json(entry);
});

app.delete('/api/expenses/:id', authenticateToken, async (req, res) => {
  const deleted = await db.delete('expenses', { id: req.params.id, userId: req.user.id });
  if (deleted) res.json({ message: 'Transaction deleted' });
  else res.status(404).json({ error: 'Not found' });
});

// Habit Tracker
app.get('/api/habits', authenticateToken, async (req, res) => {
  const items = await db.find('habits', { userId: req.user.id });
  res.json(items);
});

app.post('/api/habits', authenticateToken, async (req, res) => {
  const { name, category } = req.body;
  if (!name) return res.status(400).json({ error: 'Habit name is required' });

  const entry = await db.insert('habits', {
    userId: req.user.id,
    name,
    category: category || 'Health',
    history: {} // Map of 'YYYY-MM-DD' -> boolean
  });
  res.status(201).json(entry);
});

app.post('/api/habits/:id/toggle', authenticateToken, async (req, res) => {
  const { date } = req.body; // YYYY-MM-DD
  if (!date) return res.status(400).json({ error: 'Date is required' });

  const habit = await db.findOne('habits', { id: req.params.id, userId: req.user.id });
  if (!habit) return res.status(404).json({ error: 'Habit not found' });

  const history = habit.history || {};
  history[date] = !history[date];

  await db.update('habits', { id: req.params.id, userId: req.user.id }, { history });
  res.json({ message: 'Habit updated', history });
});

app.delete('/api/habits/:id', authenticateToken, async (req, res) => {
  const deleted = await db.delete('habits', { id: req.params.id, userId: req.user.id });
  if (deleted) res.json({ message: 'Habit deleted' });
  else res.status(404).json({ error: 'Not found' });
});

// Personal File Storage
app.get('/api/files', authenticateToken, async (req, res) => {
  const items = await db.find('files', { userId: req.user.id });
  res.json(items);
});

app.post('/api/files', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { category } = req.body;

  const entry = await db.insert('files', {
    userId: req.user.id,
    filename: req.file.originalname,
    storedName: req.file.filename,
    path: `/uploads/${req.file.filename}`,
    size: req.file.size,
    mimetype: req.file.mimetype,
    category: category || 'Unsorted'
  });

  res.status(201).json(entry);
});

app.delete('/api/files/:id', authenticateToken, async (req, res) => {
  const file = await db.findOne('files', { id: req.params.id, userId: req.user.id });
  if (!file) return res.status(404).json({ error: 'File not found' });

  // Delete actual file
  const fullPath = path.join(UPLOADS_DIR, file.storedName);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }

  await db.delete('files', { id: req.params.id, userId: req.user.id });
  res.json({ message: 'File deleted successfully' });
});

// Previous Year Question Papers (Admins & Faculty upload, Students read)
app.get('/api/papers', authenticateToken, async (req, res) => {
  const items = await db.find('papers');
  res.json(items);
});

app.post('/api/papers', authenticateToken, requireAdminOrFaculty, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { subject, year, semester } = req.body;
  if (!subject || !year || !semester) {
    return res.status(400).json({ error: 'Subject, Year, and Semester are required' });
  }

  const entry = await db.insert('papers', {
    subject,
    year: Number(year),
    semester: Number(semester),
    filename: req.file.originalname,
    storedName: req.file.filename,
    path: `/uploads/${req.file.filename}`,
    uploadedBy: req.user.username
  });

  res.status(201).json(entry);
});

app.delete('/api/papers/:id', authenticateToken, requireAdminOrFaculty, async (req, res) => {
  const paper = await db.findOne('papers', { id: req.params.id });
  if (!paper) return res.status(404).json({ error: 'Question paper not found' });

  const fullPath = path.join(UPLOADS_DIR, paper.storedName);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }

  await db.delete('papers', { id: req.params.id });
  res.json({ message: 'Question paper deleted successfully' });
});

// Placement Prep questions (Curated static JSON)
app.get('/api/placement', authenticateToken, async (req, res) => {
  const prepPath = path.join(__dirname, 'data', 'placement.json');
  if (!fs.existsSync(prepPath)) {
    // Generate some default high-quality placement material
    const defaultPrep = {
      aptitude: [
        { id: 1, topic: 'Quantitative', question: 'Two ships are sailing in the sea on the two sides of a lighthouse. The angle of elevation of the top of the lighthouse is observed from the ships are 30° and 45° respectively. If the lighthouse is 100m high, the distance between the two ships is:', options: ['173m', '273m', '300m', '200m'], answer: '273m', explanation: 'Distance = 100*cot(30°) + 100*cot(45°) = 100*1.732 + 100*1 = 273.2m' },
        { id: 2, topic: 'Logical Reasoning', question: 'Find the next number in the series: 3, 5, 9, 17, 33, ...', options: ['45', '50', '65', '53'], answer: '65', explanation: 'The difference between numbers is: 2, 4, 8, 16, 32. So next is 33 + 32 = 65.' }
      ],
      coding: [
        { id: 1, title: 'Two Sum', difficulty: 'Easy', problem: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.', example: 'Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: nums[0] + nums[1] == 9, we return [0, 1].', solution: 'function twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (map.has(complement)) {\n      return [map.get(complement), i];\n    }\n    map.set(nums[i], i);\n  }\n  return [];\n}' }
      ],
      flashcards: [
        { id: 1, question: 'What is ACID in Database Management Systems?', answer: 'ACID stands for Atomicity, Consistency, Isolation, and Durability. These properties ensure that database transactions are processed reliably.' },
        { id: 2, question: 'Difference between TCP and UDP?', answer: 'TCP (Transmission Control Protocol) is connection-oriented, reliable, and slower. UDP (User Datagram Protocol) is connectionless, unreliable, and faster (used for streaming).' }
      ]
    };
    fs.mkdirSync(path.dirname(prepPath), { recursive: true });
    fs.writeFileSync(prepPath, JSON.stringify(defaultPrep, null, 2), 'utf8');
  }

  try {
    const data = fs.readFileSync(prepPath, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: 'Error loading placement prep materials' });
  }
});

// Resume Builder Endpoints
app.get('/api/resumes', authenticateToken, async (req, res) => {
  const items = await db.find('resumes', { userId: req.user.id });
  res.json(items);
});

app.post('/api/resumes', authenticateToken, async (req, res) => {
  const resumeData = req.body; // Full JSON structure for the resume
  const entry = await db.insert('resumes', {
    userId: req.user.id,
    ...resumeData
  });
  res.status(201).json(entry);
});

app.put('/api/resumes/:id', authenticateToken, async (req, res) => {
  const updated = await db.update('resumes', { id: req.params.id, userId: req.user.id }, req.body);
  if (updated) res.json({ message: 'Resume updated' });
  else res.status(404).json({ error: 'Not found' });
});

app.delete('/api/resumes/:id', authenticateToken, async (req, res) => {
  const deleted = await db.delete('resumes', { id: req.params.id, userId: req.user.id });
  if (deleted) res.json({ message: 'Resume deleted' });
  else res.status(404).json({ error: 'Not found' });
});

// Faculty & Verification Endpoints
app.get('/api/faculty', async (req, res) => {
  try {
    const list = await db.find('users', { role: 'faculty' });
    const publicList = list.map(f => ({ id: f.id, fullName: f.fullName, username: f.username }));
    res.json(publicList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/faculty/students', authenticateToken, requireAdminOrFaculty, async (req, res) => {
  try {
    let students = [];
    if (req.user.role === 'admin') {
      students = await db.find('users', { role: 'student' });
    } else {
      const faculty = await db.findOne('users', { id: req.user.id });
      if (faculty) {
        students = await db.find('users', { 
          role: 'student', 
          collegeName: faculty.collegeName,
          department: faculty.department
        });
      }
    }

    const safeStudents = students.map(s => ({
      id: s.id,
      username: s.username,
      email: s.email,
      fullName: s.fullName,
      collegeName: s.collegeName,
      department: s.department || '',
      isVerified: s.isVerified === undefined ? true : s.isVerified
    }));
    res.json(safeStudents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/faculty/student-attendance/:studentId', authenticateToken, requireAdminOrFaculty, async (req, res) => {
  try {
    const student = await db.findOne('users', { id: req.params.studentId });
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    
    if (req.user.role === 'faculty') {
      const faculty = await db.findOne('users', { id: req.user.id });
      const sameDept = student.collegeName === faculty.collegeName && student.department === faculty.department;
      if (student.facultyId !== req.user.id && !sameDept) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }
    
    const attendanceRecords = await db.find('attendance', { userId: req.params.studentId });
    res.json(attendanceRecords);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/faculty/verify-student', authenticateToken, requireAdminOrFaculty, async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ error: 'Student ID required.' });
    
    const student = await db.findOne('users', { id: studentId });
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    
    if (req.user.role === 'faculty') {
      const faculty = await db.findOne('users', { id: req.user.id });
      const sameDept = student.collegeName === faculty.collegeName && student.department === faculty.department;
      if (student.facultyId !== req.user.id && !sameDept) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }
    
    await db.update('users', { id: studentId }, { isVerified: true });
    res.json({ message: 'Student account verified successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Faculty Publish Note
app.post('/api/faculty/publish-note', authenticateToken, requireAdminOrFaculty, async (req, res) => {
  try {
    const { title, content, category } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required.' });
    }

    const faculty = await db.findOne('users', { id: req.user.id });
    if (!faculty) return res.status(404).json({ error: 'Faculty not found.' });

    const entry = await db.insert('notes', {
      userId: req.user.id,
      title,
      content,
      category: category || 'General',
      isShared: true,
      collegeName: faculty.collegeName,
      department: faculty.department,
      authorName: faculty.fullName || faculty.username
    });

    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Faculty Publish Assignment
app.post('/api/faculty/publish-assignment', authenticateToken, requireAdminOrFaculty, async (req, res) => {
  try {
    const { title, subject, dueDate, priority, description } = req.body;
    if (!title || !dueDate || !subject) {
      return res.status(400).json({ error: 'Title, subject and due date required.' });
    }

    const faculty = await db.findOne('users', { id: req.user.id });
    if (!faculty) return res.status(404).json({ error: 'Faculty not found.' });

    const entry = await db.insert('assignments', {
      userId: req.user.id,
      title,
      subject,
      dueDate,
      status: 'Pending',
      priority: priority || 'Medium',
      description: description || '',
      isShared: true,
      collegeName: faculty.collegeName,
      department: faculty.department,
      authorName: faculty.fullName || faculty.username
    });

    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Faculty Mark Student Attendance
app.post('/api/faculty/mark-attendance', authenticateToken, requireAdminOrFaculty, async (req, res) => {
  try {
    const { studentId, subject, status, date } = req.body;
    if (!studentId || !subject || !status || !date) {
      return res.status(400).json({ error: 'Student ID, subject, status, and date are required.' });
    }

    const student = await db.findOne('users', { id: studentId });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const faculty = await db.findOne('users', { id: req.user.id });
    if (!faculty) return res.status(404).json({ error: 'Faculty not found.' });

    // Verify advisor or department match
    const sameDept = student.collegeName === faculty.collegeName && student.department === faculty.department;
    if (req.user.role === 'faculty' && student.facultyId !== req.user.id && !sameDept) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const record = await db.findOne('attendance', { userId: studentId, subject });
    const dateString = date + 'T12:00:00.000Z'; // standard format

    if (!record) {
      const entry = await db.insert('attendance', {
        userId: studentId,
        subject,
        attended: status === 'present' ? 1 : 0,
        total: 1,
        target: 75,
        logs: [{ date: dateString, status, markedBy: faculty.fullName || faculty.username }]
      });
      return res.status(201).json(entry);
    } else {
      const logs = record.logs || [];
      const dateOnly = date.substring(0, 10);
      const alreadyLogged = logs.some(l => l.date.substring(0, 10) === dateOnly);

      if (alreadyLogged) {
        return res.status(400).json({ error: 'Attendance for this date and subject is already logged.' });
      }

      logs.push({
        date: dateString,
        status,
        markedBy: faculty.fullName || faculty.username
      });

      const newAttended = status === 'present' ? record.attended + 1 : record.attended;
      const newTotal = record.total + 1;

      await db.update('attendance', { id: record.id }, {
        attended: newAttended,
        total: newTotal,
        logs
      });

      res.json({ message: 'Attendance marked successfully', attended: newAttended, total: newTotal });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Faculty Mark Student Attendance (Bulk)
app.post('/api/faculty/mark-attendance-bulk', authenticateToken, requireAdminOrFaculty, async (req, res) => {
  try {
    const { subject, date, records } = req.body;
    if (!subject || !date || !records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Subject, date, and student records array are required.' });
    }

    const faculty = await db.findOne('users', { id: req.user.id });
    if (!faculty) return res.status(404).json({ error: 'Faculty not found.' });

    const results = [];
    const dateString = date + 'T12:00:00.000Z'; // standard format
    const dateOnly = date.substring(0, 10);

    for (const recordItem of records) {
      const { studentId, status } = recordItem;
      if (!studentId || !status) continue;

      const student = await db.findOne('users', { id: studentId });
      if (!student) continue;

      // Verify advisor or department match
      const sameDept = student.collegeName === faculty.collegeName && student.department === faculty.department;
      if (req.user.role === 'faculty' && student.facultyId !== req.user.id && !sameDept) {
        continue; // Skip unauthorized students
      }

      const record = await db.findOne('attendance', { userId: studentId, subject });

      if (!record) {
        const entry = await db.insert('attendance', {
          userId: studentId,
          subject,
          attended: status === 'present' ? 1 : 0,
          total: 1,
          target: 75,
          logs: [{ date: dateString, status, markedBy: faculty.fullName || faculty.username }]
        });
        results.push({ studentId, subject, status, action: 'inserted' });
      } else {
        const logs = record.logs || [];
        const todayLogIndex = logs.findIndex(l => l.date.substring(0, 10) === dateOnly);

        if (todayLogIndex !== -1) {
          // If already logged on this day, update the status
          const oldStatus = logs[todayLogIndex].status;
          if (oldStatus !== status) {
            logs[todayLogIndex].status = status;
            logs[todayLogIndex].markedBy = faculty.fullName || faculty.username;
            
            let newAttended = record.attended;
            if (oldStatus === 'present' && status === 'absent') {
              newAttended = Math.max(0, record.attended - 1);
            } else if (oldStatus === 'absent' && status === 'present') {
              newAttended = record.attended + 1;
            }

            await db.update('attendance', { id: record.id }, {
              attended: newAttended,
              logs
            });
            results.push({ studentId, subject, status, action: 'updated_status' });
          } else {
            results.push({ studentId, subject, status, action: 'no_change' });
          }
        } else {
          // Append a new log entry for today
          logs.push({
            date: dateString,
            status,
            markedBy: faculty.fullName || faculty.username
          });
          const newAttended = status === 'present' ? record.attended + 1 : record.attended;
          const newTotal = record.total + 1;

          await db.update('attendance', { id: record.id }, {
            attended: newAttended,
            total: newTotal,
            logs
          });
          results.push({ studentId, subject, status, action: 'appended' });
        }
      }
    }

    res.json({ message: 'Bulk attendance marked successfully', results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Assistant Chat endpoint
app.post('/api/ai/chat', authenticateToken, async (req, res) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const systemInstruction = `You are the Student OS AI Study Assistant. Help the college student user with their study schedules, homework clarifications, exam preparation, writing summaries, explaining concepts, or answering questions. Keep your tone supportive, smart, encouraging, and clear. Format responses in Markdown.`;

  const modelNames = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-pro', 'gemini-1.0-pro'];

  if (process.env.GEMINI_API_KEY) {
    for (const mName of modelNames) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const modelInstance = genAI.getGenerativeModel({ model: mName });
        
        const formattedHistory = (history || []).map(h => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }]
        }));

        const chat = modelInstance.startChat({
          history: [
            { role: 'user', parts: [{ text: `${systemInstruction} Understood?` }] },
            { role: 'model', parts: [{ text: 'Yes, I am your Student OS AI Study Assistant. I am ready to help you with college schedules, study plans, subject explanations, and exam preparation. What can I do for you today?' }] },
            ...formattedHistory
          ]
        });

        const result = await chat.sendMessage(message);
        const reply = result.response.text();
        return res.json({ reply });
      } catch (e) {
        console.error(`Gemini API call failed for model ${mName}:`, e.message);
      }
    }
  }

  // Graceful Mock fallback if Gemini is unconfigured/failed - Comprehensive Student Knowledge Base
  let reply = '';
  const cleanMsg = message.toLowerCase();

  if (cleanMsg.includes('hello') || cleanMsg.includes('hi') || cleanMsg.includes('hey') || cleanMsg.includes('sup')) {
    reply = `Hello! I am your **Student OS Study Assistant** (Offline Mode). How can I help you today?
    
You can ask me about:
- **Programming Languages**: Python, Java, C++, JavaScript, HTML/CSS, SQL
- **Data Structures (DSA)**: Stacks, Queues, Linked Lists, Trees, Graphs, Sorting
- **Core CS**: OOP, Operating Systems, Database (DBMS), Computer Networks
- **Placement & Projects**: Project ideas, Interview prep, Resume advice
- **Productivity & Health**: Budgeting tips, stress relief, time management, Pomodoro`;
  } 
  
  // Tech & Programming
  else if (cleanMsg.includes('what is ai') || cleanMsg.includes('artificial intelligence')) {
    reply = `**Artificial Intelligence (AI)** refers to the simulation of human intelligence in machines.
    
Key domains you should study:
1. **Machine Learning (ML)**: Training models to detect patterns (e.g., linear regression, random forest).
2. **Deep Learning**: Utilizing multi-layer artificial neural networks (CNNs for images, RNNs/Transformers for sequences).
3. **Natural Language Processing (NLP)**: Processing text/speech data (powering translation, sentiment analysis, LLMs).
4. **Computer Vision**: Enabling computers to see and interpret digital images (OpenCV, YOLO).`;
  } else if (cleanMsg.includes('python')) {
    reply = `**Python** is an interpreted, high-level, dynamically typed language.
    
**Why it is popular:**
- Readability and minimal syntax (excellent for prototyping).
- Extensive library ecosystems:
  - **Web**: Django, Flask, FastAPI
  - **Data Science**: Pandas, NumPy, Scikit-learn, TensorFlow, PyTorch
  - **Scripting**: Selenium, Beautiful Soup`;
  } else if (cleanMsg.includes('java') && !cleanMsg.includes('javascript')) {
    reply = `**Java** is a class-based, object-oriented programming language designed to have as few implementation dependencies as possible ("Write Once, Run Anywhere").
    
**Core Concepts to Know:**
- **JVM, JRE, JDK**: JDK compiles java to bytecode; JRE provides libraries; JVM executes the bytecode.
- **Garbage Collection**: Automatic memory management that destroys unused objects.
- **Spring Boot**: Industry standard for building REST APIs and Microservices.`;
  } else if (cleanMsg.includes('javascript') || cleanMsg.includes(' js')) {
    reply = `**JavaScript (JS)** is a lightweight, interpreted, prototype-based language with first-class functions.
    
**Core Ecosystem:**
- **Frontend**: Vanilla JS, React, Vue, Angular
- **Backend**: Node.js (V8 engine running JS on the server), Express.js
- **Key Concepts**: Event Loop, Promises, Async/Await, Closures, DOM Manipulation.`;
  } else if (cleanMsg.includes('c++') || cleanMsg.includes('cpp')) {
    reply = `**C++** is a general-purpose, middle-level programming language that extends C with object-oriented features.
    
**Why study C++ for DSA/Placements:**
- **Performance**: Extremely fast execution and low-level memory control (using pointers).
- **STL (Standard Template Library)**: Out-of-the-box vectors, maps, stacks, sets, queues. Saves time in coding rounds!`;
  } else if (cleanMsg.includes('html') || cleanMsg.includes('css')) {
    reply = `**HTML & CSS** form the basic skeleton and skin of the web:
- **HTML5**: Semantic tags (\`<header>\`, \`<footer>\`, \`<article>\`) improve SEO and accessibility.
- **CSS3**: Layout systems:
  - **Flexbox**: 1D layout (rows/columns navigation alignment).
  - **Grid**: 2D layout (entire page rows and columns).
  - **Media Queries**: Key to responsive web design.`;
  } else if (cleanMsg.includes('database') || cleanMsg.includes('dbms') || cleanMsg.includes('sql')) {
    reply = `**DBMS (Database Management Systems)** manage structures storing digital information.
    
**Relational vs. Non-Relational:**
- **SQL (MySQL, PostgreSQL)**: Structured tabular data, strict schema, ACID properties (Atomicity, Consistency, Isolation, Durability), supports complex JOIN queries.
- **NoSQL (MongoDB, Redis)**: Document/Key-Value structures, schema-less, highly scalable, horizontal distribution.`;
  } 
  
  // Data Structures & Algorithms
  else if (cleanMsg.includes('data structure') || cleanMsg.includes('dsa')) {
    reply = `**Data Structures & Algorithms (DSA)** form the backbone of clean, performant programming.
    
**Core DSA Checklist for Placements:**
1. **Linear**: Arrays, Strings, Linked Lists, Stacks, Queues.
2. **Non-Linear**: Trees (BST, AVL, Heaps), Graphs (BFS, DFS, Dijkstra).
3. **Algorithms**: Sorting, Binary Search, Recursion, Dynamic Programming (DP), Greedy.`;
  } else if (cleanMsg.includes('binary tree') || cleanMsg.includes('tree') || cleanMsg.includes('bst')) {
    reply = `A **Binary Tree** is a hierarchical structure where each node has at most two children (left and right).
    
**Key concepts:**
- **Binary Search Tree (BST)**: Left child < parent < right child. Allows $O(\\log n)$ lookup/insertion.
- **Traversals**: 
  - **In-Order** (Left, Root, Right) - returns elements of BST in sorted order!
  - **Pre-Order** (Root, Left, Right) - useful to clone/copy trees.
  - **Post-Order** (Left, Right, Root) - useful for deletion operations.`;
  } else if (cleanMsg.includes('stack') || cleanMsg.includes('queue')) {
    reply = `**Stacks** and **Queues** are linear collections with specific access rules:
- **Stack**: **LIFO** (Last In, First Out). Think of a stack of plates. Push inserts, Pop removes the top element. Used in recursion, undo systems, and bracket matching.
- **Queue**: **FIFO** (First In, First Out). Think of a queue at a movie ticket counter. Enqueue inserts at rear, Dequeue removes from front. Used in task scheduling, printer buffers, and BFS.`;
  } else if (cleanMsg.includes('linked list')) {
    reply = `A **Linked List** is a linear collection of data elements called nodes, where each node points to the next node in memory (non-contiguous).
    
**Types:**
- **Singly Linked**: Each node has data and \`next\` pointer.
- **Doubly Linked**: Node has data, \`next\` and \`prev\` pointers.
- **Circular Linked**: Last node points back to the first node.
*Tip: Standard insertions are $O(1)$ if you have a tail reference, but random access is $O(n)$ compared to arrays $O(1)$.*`;
  } else if (cleanMsg.includes('sorting') || cleanMsg.includes('sort')) {
    reply = `**Sorting Algorithms** arrange data elements in ascending/descending order.
    
**Common Algorithms:**
- **Bubble/Insertion/Selection**: Simple, $O(n^2)$ time complexity.
- **Merge Sort**: Divide and conquer, stable, always $O(n \log n)$ time. Requires auxiliary space.
- **Quick Sort**: Divide and conquer, in-place, average $O(n \log n)$, worst case $O(n^2)$ depending on pivot selection.`;
  } else if (cleanMsg.includes('graph')) {
    reply = `A **Graph** is a non-linear data structure consisting of Nodes (Vertices) connected by Edges.
    
**Key Algorithms to Prepare:**
- **BFS (Breadth-First Search)**: Uses a Queue. Finds shortest path in unweighted graphs.
- **DFS (Depth-First Search)**: Uses Recursion/Stack. Explores deeply.
- **Dijkstra's**: Finds shortest path in weighted graphs using a Priority Queue.`;
  } 
  
  // CS Core
  else if (cleanMsg.includes('operating system') || cleanMsg.includes(' os')) {
    reply = `An **Operating System (OS)** manages hardware resource allocation and provides services for software execution.
    
**Top Topics for Placements:**
- **Process vs Thread**: A process is an executing program (isolated memory); a thread is a lightweight segment of a process (shares memory).
- **Deadlock**: A state where processes are stuck waiting for resources held by each other. Conditions: Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait.
- **Virtual Memory & Paging**: Swapping parts of memory to disk to run larger programs.`;
  } else if (cleanMsg.includes('network') || cleanMsg.includes('tcp') || cleanMsg.includes('udp')) {
    reply = `**Computer Networks** allow computers to share data using packet transmissions.
    
**Key Interview Concept (TCP vs UDP):**
- **TCP (Transmission Control Protocol)**: Connection-oriented, performs handshake, guarantees packet delivery and order, error checking (slower, e.g., web pages, email).
- **UDP (User Datagram Protocol)**: Connectionless, sends packet immediately without checking delivery, fast (faster, e.g., video streaming, gaming).`;
  } else if (cleanMsg.includes('oop') || cleanMsg.includes('object oriented')) {
    reply = `**Object-Oriented Programming (OOP)** is a paradigm centered around 'objects' containing data and code.
    
**The 4 Pillars of OOP:**
1. **Encapsulation**: Bundling data and methods together and restricting direct access (using private variables + getters/setters).
2. **Abstraction**: Hiding complex implementation details and showing only essentials (using abstract classes/interfaces).
3. **Inheritance**: Allowing a new class (child) to inherit properties of an existing class (parent).
4. **Polymorphism**: Ability of a function/object to take multiple forms (Method Overloading - compile-time; Method Overriding - runtime).`;
  } 
  
  // Placement & Projects
  else if (cleanMsg.includes('placement') || cleanMsg.includes('interview') || cleanMsg.includes('aptitude')) {
    reply = `To crack **College Placements**, follow this structured preparation roadmap:
1. **Quizzes & Aptitude**: Practice quantitative, logical reasoning, and verbal analysis daily. (Use the **Placement Prep** MCQ tool!).
2. **Coding Test**: Master arrays, strings, hash maps, and recursion. Solve medium-level challenges.
3. **Core CS Subjects**: Review OS threads, DBMS SQL queries, OOP pillars, and networks.
4. **Mock Interviews**: Practice explaining your thought process out loud while writing code.`;
  } else if (cleanMsg.includes('resume') || cleanMsg.includes('cv')) {
    reply = `A strong **Student Resume** should fit on **one single page** and follow this structure:
- **Contact Details**: Name, email, phone, GitHub, LinkedIn.
- **Education**: College degree, GPA/CGPA (aim to keep it above 7.5/8.0).
- **Technical Skills**: Languages, frameworks, databases, developer tools.
- **Projects**: Describe using the **STAR method** (Situation, Task, Action, Result). Mention tech stack.
- **Experience**: Internships, college clubs, hackathons, or volunteering.
*Tip: Use the **Resume Builder** tool in the sidebar to generate a clean PDF template!*`;
  } else if (cleanMsg.includes('project') || cleanMsg.includes('project ideas')) {
    reply = `Here are 3 high-quality **Student Project Ideas** that look great on a resume:
1. **Student OS (Full Stack)**: A productivity dashboard for managing timetables, notes, calendars, and expenses. (Just like this app!).
2. **E-Commerce / Food Delivery App**: Builds experience in user authentication, databases, carts, and payment gateways.
3. **AI Search / Recommendation System**: Integrates AI APIs (like Gemini) to answer questions, analyze notes, or suggest career paths based on resume text.`;
  } 
  
  // Productivity & Budgeting
  else if (cleanMsg.includes('time management') || cleanMsg.includes('pomodoro') || cleanMsg.includes('focus')) {
    reply = `Improve your **academic productivity** with these time management techniques:
- **Pomodoro Technique**: Focus on a task for 25 minutes, then take a 5-minute break. Repeat 4 times, then take a longer 20-minute break.
- **Time Blocking**: Dedicate specific hours in your **Timetable** view for deep work (no social media notifications).
- **Eat the Frog**: Complete your hardest, most critical assignment first thing in the morning.`;
  } else if (cleanMsg.includes('stress') || cleanMsg.includes('anxiety') || cleanMsg.includes('depressed')) {
    reply = `College life can feel overwhelming. Here are some quick **stress relief tips**:
- **Take breaks**: Do not study continuously for hours. Stretch, drink water, or take a short walk.
- **Sleep well**: Aim for 7-8 hours of sleep. Pulling all-nighters before exams reduces recall and logic.
- **Talk to someone**: Share your stress with a close friend, family member, or college counselor. 
- You are doing great, take it one day at a time!`;
  } else if (cleanMsg.includes('friend') || cleanMsg.includes('social') || cleanMsg.includes('meet people')) {
    reply = `**Making Friends & Socializing in College:**
- **Join Clubs & Societies**: Join teams that match your interests (coding, sports, music, drama). It is the easiest way to find like-minded people!
- **Study Groups**: Form a study circle for tough subjects. Cooperation fosters strong relationships.
- **Participate in Events**: Attend college fests, hackathons, and seminars.
- **Be Approachable**: Start with simple greetings, ask about their department, and share details about your courses.`;
  } else if (cleanMsg.includes('hostel') || cleanMsg.includes('dorm') || cleanMsg.includes('room')) {
    reply = `**Dorm/Hostel Room Essentials Checklist:**
1. **Bedding**: Comfortable pillow, bedsheets, blanket, mattress cover.
2. **Utilities**: Water bottle, extension board (must-have!), laundry bag, hangers.
3. **Toiletries**: Towels, shower slippers, personal hygiene kit, bucket and mug.
4. **Study Setup**: Desk lamp, laptop charger, notebooks, highlighters.
5. **Basic Medical Kit**: Band-aids, pain relief spray, common cold/fever medicines, antiseptic.`;
  } else if (cleanMsg.includes('health') || cleanMsg.includes('diet') || cleanMsg.includes('exercise') || cleanMsg.includes('gym')) {
    reply = `**Staying Healthy in College:**
- **Stay Hydrated**: Keep a reusable water bottle with you and drink 2-3 liters daily.
- **Balanced Diet**: Canteen food can be greasy. Try including fresh fruits, milk, oats, and nuts in your daily routine.
- **Physical Activity**: Walking around campus is great! Aim for 30 minutes of physical activity, jogging, or gym sessions 4 times a week.
- **Mental Wellness**: Give yourself downtime. Practice deep breathing or meditation if things get overwhelming.`;
  } else if (cleanMsg.includes('job') || cleanMsg.includes('earn') || cleanMsg.includes('part-time') || cleanMsg.includes('freelance')) {
    reply = `**How to Earn Money as a Student:**
- **Freelancing**: Offer skills like web development (using HTML/CSS/JS), graphic design, content writing, or video editing on platforms like Upwork or Fiverr.
- **Teaching/Tutoring**: Tutor school juniors or help peers with subjects you excel at.
- **Open Source & Hackathons**: Look for paid programs like Google Summer of Code (GSoC) or hackathons with cash prizes.
- **On-Campus Jobs**: Check if your university libraries, labs, or administrative offices hire student assistants.`;
  } else if (cleanMsg.includes('motivation') || cleanMsg.includes('lazy') || cleanMsg.includes('procrastinat') || cleanMsg.includes('tired')) {
    reply = `**Beating Procrastination & Getting Motivated:**
- **5-Minute Rule**: Tell yourself you will work on the task for just 5 minutes. Often, starting is the hardest part, and once you start, you will want to continue.
- **Break it Down**: A huge assignment feels daunting. Break it into tiny steps (e.g., "Write the title", "Outline 3 bullet points").
- **Remove Distractions**: Put your phone in another room or use website blockers during study sessions.
- **Reward Yourself**: Treat yourself to a snack or a short game session after completing a task.`;
  } else if (cleanMsg.includes('gravity') || cleanMsg.includes('science') || cleanMsg.includes('space') || cleanMsg.includes('physics')) {
    reply = `**A Quick Science Nugget (Gravity):**
- **Gravity** is the invisible force that pulls objects toward each other. It is what keeps your feet on the ground and what makes the Earth orbit the Sun.
- According to Einstein's General Theory of Relativity, massive objects (like planets) warp the fabric of space-time around them, and this curvature is what we perceive as gravity.
- *Fun Fact: The strength of gravity depends on mass and distance. You weigh slightly less at the equator than at the poles because the Earth bulges out!*`;
  } else if (cleanMsg.includes('student os') || cleanMsg.includes('about this app') || cleanMsg.includes('features')) {
    reply = `**Student OS** is a premium, all-in-one digital workspace tailored for college students.
    
**Core Tools available:**
- **Timetable & Attendance**: Map your weekly classes and logs.
- **Notes & Assignments**: Manage academic documents and checklist goals.
- **Expense & CGPA**: Keep track of budget limits and semester academic performance.
- **Digital ID & Resume**: Generate a professional CV and view a 3D glassmorphic student card.
- **Placement & AI**: Practice Aptitude/Coding tasks and consult this helper bot!`;
  } else if (cleanMsg.includes('cgpa') || cleanMsg.includes('gpa')) {
    reply = `Use the **CGPA Calculator** tool in the sidebar to plan out your semester GPAs! Keep track of credits, select grades, and hit 'Save to Profile' to automatically display it on your Dashboard and Resume.`;
  } else if (cleanMsg.includes('timetable') || cleanMsg.includes('schedule')) {
    reply = `Open the **Timetable** tool in the sidebar to manage your classes. Consistent schedules improve productivity. Make sure to schedule review sessions right after your lectures!`;
  } else if (cleanMsg.includes('exam') || cleanMsg.includes('prepare') || cleanMsg.includes('study')) {
    reply = `Here is a quick **study plan tip** (Feynman Technique):
1. Choose a concept you want to learn.
2. Explain it to a child or in simple terms.
3. Identify gaps in your explanation and review the source material.
4. Simplify and use analogies.

Try practicing with the **Placement Prep** section in the sidebar for interview and aptitude questions!`;
  }
  
  // Generic Fallback
  else {
    reply = `I received your query: "${message}". 
    
*(Notice: The AI Study Assistant is currently in Offline/Mock mode. To unlock fully dynamic Gemini AI responses, please supply a valid \`GEMINI_API_KEY\` in your \`.env\` file).*

**Study Tip:** Try asking me about **OOP**, **Data Structures (DSA)**, **Operating Systems (OS)**, **Python/Java**, **Interview prep**, or **budgeting** to get detailed study guides!`;
  }

  res.json({ reply });
});

// Fallback HTML routing for PWA
app.get(/^\/(?!api|uploads).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, async () => {
  await seedDefaultHolidays();
  console.log(`Student OS Server running at http://localhost:${PORT}`);
});
