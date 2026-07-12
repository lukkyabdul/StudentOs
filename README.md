# 🎓 StudentOS

> **AI-Powered Academic Management Platform for Students, Faculty & Administrators**

StudentOS is a modern all-in-one academic management platform that helps students, faculty members, and administrators manage academic activities from a single dashboard.

Built with a premium Glassmorphism UI, role-based authentication, AI-powered study assistance, and productivity tools, StudentOS simplifies college management while improving the student learning experience.

---

## ✨ Features

### 👨‍🎓 Student Portal

- 📅 Smart Timetable
- 📝 Notes Management
- 📚 Assignment Tracker
- 📊 Attendance Tracker
- 💰 Expense Manager
- ✅ Habit Tracker
- 📂 Personal File Storage
- 📄 Resume Builder
- 🤖 AI Study Assistant
- 📈 Dashboard Analytics
- 🌙 Dark Theme
- 🌐 Multi-language Support
- 📱 Progressive Web App (PWA)

---

### 👨‍🏫 Faculty Portal

- Student Verification
- Publish Notes
- Publish Assignments
- Mark Attendance
- Bulk Attendance Management
- Upload Previous Year Papers
- Department Management

---

### 👨‍💼 Administrator

- User Management
- Faculty Management
- College Management
- Department Management
- Analytics Dashboard
- System Administration

---

# 🚀 Tech Stack

## Frontend

- HTML5
- CSS3
- JavaScript
- Glassmorphism UI
- Progressive Web App

## Backend

- Node.js
- Express.js

## Database

- JSON Database
- Custom DB Controller

## Authentication

- JWT Authentication
- HttpOnly Cookies
- bcrypt Password Hashing

## AI Integration

- Google Gemini API
- Intelligent Offline Fallback

---

# 🏗️ System Architecture

```
Browser
      │
      ▼
Frontend (SPA)
      │
 REST API
      │
      ▼
Express.js Backend
      │
      ├─────────────► JSON Database
      │
      ├─────────────► Google Gemini AI
      │
      └─────────────► Service Worker (PWA)
```

---

# 📂 Project Structure

```
StudentOS

├── frontend
│   ├── css
│   ├── js
│   ├── images
│   ├── index.html
│
├── backend
│   ├── routes
│   ├── middleware
│   ├── data
│   ├── db.js
│   ├── server.js
│
├── public
├── sw.js
├── package.json
└── README.md
```

---

# 🎯 Core Modules

- Authentication
- Student Dashboard
- Faculty Dashboard
- Admin Dashboard
- Timetable
- Notes
- Assignments
- Attendance
- Expense Manager
- Habit Tracker
- Resume Builder
- Previous Year Papers
- AI Assistant
- File Manager

---

# 🔐 Security

- JWT Authentication
- Secure HttpOnly Cookies
- Password Hashing (bcrypt)
- Role-Based Access Control
- Faculty Verification
- Department Isolation
- College Isolation

---

# 👥 User Roles

| Role | Access |
|------|---------|
| Student | Personal Dashboard |
| Faculty | Manage Students |
| Admin | Full System Access |

---

# 📡 REST APIs

## Authentication

- Register
- Login
- Logout
- Forgot Password

## Student

- Timetable
- Attendance
- Assignments
- Notes
- Expenses
- Habits
- Resume

## Faculty

- Verify Students
- Publish Notes
- Publish Assignments
- Mark Attendance
- Bulk Attendance

## AI

- AI Chat
- Study Assistant

---

# 🤖 AI Features

StudentOS integrates Google Gemini AI for:

- Study Assistant
- Programming Help
- Resume Suggestions
- DSA Guidance
- OOP Concepts
- Operating Systems
- Interview Preparation

If no API key is configured, StudentOS automatically uses an offline knowledge base.

---

# 📱 Progressive Web App

- Installable
- Offline Support
- Service Worker
- Fast Loading
- Mobile Friendly

---

# 📈 Dashboard

Student Dashboard provides:

- Attendance Overview
- Assignment Status
- Today's Timetable
- Upcoming Deadlines
- Expense Analytics
- Habit Progress
- Study Statistics

Faculty Dashboard provides:

- Student Verification
- Attendance Management
- Assignment Publishing
- Notes Publishing

Admin Dashboard provides:

- System Analytics
- User Management
- Department Management

---

# ⚡ Installation

## Clone Repository

```bash
git clone https://github.com/yourusername/StudentOS.git
```

---

## Install Dependencies

```bash
npm install
```

---

## Run Development Server

```bash
npm start
```

---

# 📁 Database

Current Database

- JSON Storage

Future Support

- PostgreSQL
- MySQL
- MongoDB

---

# 🔑 Environment Variables

Create a `.env` file.

```
PORT=3000

JWT_SECRET=your_secret

GEMINI_API_KEY=your_api_key
```

---

# 📷 Screenshots

Add screenshots here.

- Login
- Dashboard
- Faculty Portal
- AI Assistant
- Attendance
- Timetable

---


# 🛣️ Future Roadmap

- Google Calendar Integration
- PDF Resume Generator
- CGPA Predictor
- Live Study Rooms
- Parent Portal
- Push Notifications
- Mobile App
- Cloud Storage
- Real-time Chat
- LMS Integration


---

## Made with ❤️ using Node.js, Express.js, JavaScript, AI & Modern Web Technologies.
