# Phenomenon AI Workspace & Productivity Suite

A fully functional, modern, responsive AI chat website and productivity platform built to match the project architecture reference and layout design.

---

## 🚀 Quick Start Guide

### 1. Start the Backend API Server
```powershell
# From the project root
node server/src/index.js
```
- The backend server runs on: `http://localhost:5000`
- Provides authentication (JWT), chat history persistence, smart AI responses, task management, and file storage.
- Automatically connects to MongoDB if available, with a resilient persistent store fallback if MongoDB is not running.

### 2. Start the Frontend Client
```powershell
# In a new terminal window
cd client
npm.cmd run dev
```
- The frontend client runs on: `http://localhost:5173`
- Proxies `/api` requests to the backend server at `http://localhost:5000`.

---

## 🔐 Authentication & Demo Credentials

- **Demo Email:** `sarvatha@example.com`
- **Demo Password:** `password123`
- An **"Instant Demo"** quick-fill button is available directly on the login screen for instant one-click login.
- You can also switch to the **"Sign Up"** tab to register custom user accounts with email & password validation.

---

## 📁 Project Structure

```
NLP_Project/
├── client/                     # Frontend Vite + React SPA
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── components/         # Reusable UI Components
│       │   ├── Header.jsx      # Top header with sidebar toggle, user avatar & theme switcher
│       │   ├── Button.jsx      # Reusable button with variants (primary, outline, ghost, danger)
│       │   ├── Input.jsx       # Reusable input with icons, error validation, password toggle
│       │   ├── Sidebar.jsx     # Collapsible desktop sidebar & mobile drawer with search, rename, delete
│       │   ├── ChatArea.jsx    # Hero/Welcome view & active conversation message history
│       │   ├── MessageBubble.jsx # User & AI bubbles with copy button, timestamps, markdown format
│       │   ├── SuggestedCards.jsx # 3 Action suggestion cards matching reference layout
│       │   ├── TaskManager.jsx # "My Tasks" board with search, add, checkoff, prioritize
│       │   ├── SavedFilesModal.jsx # Workspace document files modal
│       │   └── SettingsModal.jsx # Workspace appearance & cache settings
│       ├── screens/            # Application Screens
│       │   ├── HomeScreen.jsx  # Main workspace dashboard matching layout reference
│       │   ├── LoginScreen.jsx # Sign in & Sign up with form validation & password visibility
│       │   └── ProfileScreen.jsx # User profile, stats, and account settings
│       ├── navigation/
│       │   └── AppNavigator.jsx # React Router setup with ProtectedRoute
│       ├── services/
│       │   └── api.js          # API client with JWT interceptor & local fallback
│       ├── hooks/              # Custom React Hooks
│       │   ├── useAuth.jsx     # Authentication context & session manager
│       │   ├── useChat.jsx     # Multi-conversation management & AI messaging
│       │   └── useTheme.jsx    # Centralized instant dark/light theme switcher
│       ├── utils/
│       │   ├── storage.js      # Resilient localStorage wrapper
│       │   └── formatters.js   # Relative timestamps & text helpers
│       ├── App.jsx             # App entry with Providers & Router
│       ├── main.jsx            # React root mount
│       └── index.css           # Global theme variables & styling
│
├── server/                     # Backend Express API Server
│   ├── .env                    # Port & JWT configurations
│   ├── package.json
│   ├── data/
│   │   └── store.json          # Persistent JSON store
│   └── src/
│       ├── index.js            # Express server entry point & REST endpoints
│       ├── store.js            # Resilient database & store adapter
│       └── ai.js               # Context-aware AI assistant generator
│
└── README.md
```

---

## ✨ Features Implemented

1. **Authentication & Validation:**
   - Sign in and Sign up tabs with full client-side validation.
   - Show/hide password visibility toggle with Lucide eye icons.
   - Session persistence with JWT tokens stored securely.
   - One-click "Instant Demo" button.

2. **Layout Matching Reference:**
   - Centered hero heading: *"How can I help you today?"*.
   - 3 interactive suggestion cards:
     - `Previously viewed files`
     - `Summarize your last meeting` (UX Strategy Meet up, 1 Apr 2025, 14:00 pm)
     - `Suggested Task` (Conduct UX Research)
   - "My Tasks" section with counter badge, inline task creation (`+`), search filter, and `✨ Prioritize Tasks` button.
   - Floating pill prompt input bar at the bottom with sparkle icon (`✨`) and send arrow button (`→`).

3. **Collapsible Sidebar & Mobile Drawer:**
   - Sidebar toggle icon (`[||]`) in header and sidebar top bar.
   - `[+ New chat]` button that starts fresh conversations.
   - Live search input to filter past conversations.
   - Conversation options: Inline rename (pencil) and delete (trash).
   - On screens < 768px, functions as an off-canvas slide-out drawer with backdrop.

4. **Complete Chat History & Persistence:**
   - Multi-chat support: switch between chats without losing messages.
   - Full message history loaded and displayed with user & assistant bubbles.
   - Copy-to-clipboard button with visual feedback.
   - Formatted timestamps and loading typing indicators.
   - Conversations persist across browser refreshes.

5. **Instant Dark & Light Theme:**
   - Centralized CSS tokens for seamless real-time switching.
   - Accessible contrast in both themes.
   - Preference saved and restored on page reload.
