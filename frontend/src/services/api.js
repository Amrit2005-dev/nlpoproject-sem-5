import { storage } from '../utils/storage';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Expose a helper so components can build document-viewer URLs
export function documentFileUrl(documentId, page = 1) {
  return `${API_BASE_URL}/documents/${documentId}/file#page=${page}`;
}

// Demo seed data used when backend is offline
const DEMO_USER = {
  id: 'demo-user-1',
  name: 'Sarvatha',
  email: 'sarvatha@example.com',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
};

const DEMO_CHATS = [
  {
    id: 'conv-sample-1',
    title: 'UX Strategy & Architecture',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    messageCount: 2,
    lastMessage: 'Here are the key takeaways from the UX Strategy meetup...',
    messages: [
      {
        id: 'msg-1',
        sender: 'user',
        text: 'Can you summarize the main goals for our UX Strategy meetup?',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 'msg-2',
        sender: 'assistant',
        text: 'Here are the key takeaways from the UX Strategy meetup:\n\n1. **User-Centric Architecture:** Focus on intuitive navigation and responsive design for multi-device workflows.\n2. **Performance Optimization:** Achieve sub-100ms interaction feedback with reactive state handling.\n3. **Modern Visual Aesthetics:** Clean layouts, accessible contrast ratios, and cohesive dark/light themes.\n\nWould you like me to convert these into actionable tasks for your workspace?',
        timestamp: new Date(Date.now() - 3600000 * 2 + 1500).toISOString()
      }
    ]
  }
];

const DEMO_TASKS = [
  {
    id: 'task-1',
    title: 'Conduct UX Research for chat flow',
    completed: false,
    priority: 'high',
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'task-2',
    title: 'Review IndicRAG-QA benchmark results',
    completed: true,
    priority: 'medium',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  }
];

const DEMO_FILES = [
  {
    id: 'file-1',
    name: 'UX_Strategy_Brief_2026.pdf',
    size: '2.4 MB',
    type: 'pdf',
    updatedAt: '1 Apr 2025, 14:00 pm'
  },
  {
    id: 'file-2',
    name: 'IndicRAG_Benchmark_Summary.json',
    size: '840 KB',
    type: 'json',
    updatedAt: '24 Oct 2026, 11:30 am'
  }
];

// Helper for normal conversational queries (e.g. 'hy', 'what is date', 'who are you')
function getConversationalResponse(text) {
  if (!text || !text.trim()) {
    return "Please type a question or a message, and I'll help you.";
  }
  const t = text.trim().toLowerCase();
  const clean = t.replace(/[^\w\s]/g, '').trim();

  // Greetings
  const greetings = ['hi', 'hii', 'hiii', 'hy', 'hello', 'hey', 'hola', 'namaste', 'good morning', 'good afternoon', 'good evening', 'good night', 'sup', 'yo'];
  if (greetings.includes(clean) || ['hi ', 'hii ', 'hiii ', 'hy ', 'hello ', 'hey ', 'hola ', 'namaste ', 'good morning ', 'good afternoon ', 'good evening '].some(g => clean.startsWith(g))) {
    return 'Hello! 👋 How can I help you today? You can ask me questions about your uploaded documents, study syllabus, or assignments.';
  }

  // Date
  const datePatterns = ['what is date', 'what is today date', 'what is the date', 'whats the date', 'what date is today', 'what date is it', 'todays date', 'today date', 'current date', 'what is todays date', 'date today', 'tell me the date', 'tell me date', 'aaj ki date', 'tarikh'];
  if (datePatterns.some(p => clean.includes(p)) || clean === 'date') {
    const now = new Date();
    const formatted = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return `📅 Today's date is **${formatted}**.`;
  }

  // Time
  const timePatterns = ['what is time', 'what is current time', 'whats the time', 'what is the time', 'current time', 'what time is it', 'tell me the time', 'time now'];
  if (timePatterns.some(p => clean.includes(p)) || clean === 'time') {
    const now = new Date();
    const formatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `⏰ The current time is **${formatted}**.`;
  }

  // Identity / Help
  if (['who are you', 'what are you', 'what can you do', 'help', 'who r u'].includes(clean)) {
    return `I am your **AI Study & Document Assistant**. Here is what I can do:
• 📚 **Document Q&A**: Ask any question grounded strictly in your PDFs with page citations.
• 🎓 **Exam & Syllabus Planner**: Organize subjects and track lesson-by-lesson progress.
• 🔍 **Study-Readiness Auditor**: Check if your notes cover your syllabus topics.
• 📝 **Interactive Quizzes**: Generate and test yourself on your course material.`;
  }

  if (['how are you', 'how r u', 'how you doing', 'whats up', 'what is up'].includes(clean)) {
    return "I'm doing well, thank you! How can I help you today?";
  }

  if (['bye', 'goodbye', 'see you', 'see ya'].includes(clean)) {
    return "Goodbye! 👋 Come back anytime when you need help.";
  }

  // Courtesy
  if (['thank you', 'thankyou', 'thanks', 'thanks a lot', 'dhanyawad', 'shukriya', 'ty'].includes(clean)) {
    return "You're very welcome! 😊 Feel free to ask if you need help with anything else.";
  }

  return null;
}

// Helper to simulate smart local assistant if backend is unreachable
function generateLocalAiResponse(userMessage) {
  const conv = getConversationalResponse(userMessage);
  if (conv) return conv;

  const query = userMessage.toLowerCase().trim();

  if (query.includes('summarize') && (query.includes('meeting') || query.includes('meet up') || query.includes('ux'))) {
    return `### 📋 Meeting Summary: UX Strategy Meet Up
**Date:** 1 Apr 2025 | **Time:** 14:00 PM  
**Attendees:** Product Design, Engineering, and NLP Core Teams  

#### Key Discussion Points:
1. **Chat UI/UX Overhaul:**
   - Implement responsive drawer navigation for mobile devices.
   - Centralize dark/light theme tokens with instant toggle transitions.
   - Integrate smart suggestion cards on empty states.
2. **NLP & RAG Integration:**
   - Establish confidence scoring on retrieved passages.
   - Support selective abstention when context is ambiguous.
3. **Action Items:**
   - [ ] Finalize responsive grid layout for desktop and tablet.
   - [ ] Connect chat history persistence to user sessions.
   - [ ] Prioritize next week's UX research sprints.

*Would you like me to auto-generate task items in your workspace for these action items?*`;
  }

  if (query.includes('ux research') || query.includes('suggested task') || query.includes('conduct ux')) {
    return `### 🎯 Action Plan: Conduct UX Research
Here is a structured, 4-step UX research sprint tailored for our chat interface:

1. **User Journey & Friction Points**
   - Track session times, navigation flows, and sidebar toggle interactions.
   - Analyze how quickly users switch between historical chats.
2. **Usability Heuristics & Contrast Audit**
   - Verify WCAG AA compliance across both light and dark themes.
   - Test accessibility on mobile viewports and touch targets.
3. **Conversational Feedback Loops**
   - Collect qualitative feedback on message bubble readability and timestamp placement.
4. **Deliverables**
   - Synthesized insights report and component priority checklist.

*I have also added "Conduct UX Research" to your active tasks!*`;
  }

  if (query.includes('previously viewed files') || query.includes('files') || query.startsWith('@')) {
    return `### 📁 Referenced Workspace Files:
Here are the files currently indexed in your workspace:
- **UX_Strategy_Brief_2026.pdf** (2.4 MB) — Design specifications, design system tokens, and user flow charts.
- **IndicRAG_Benchmark_Summary.json** (840 KB) — Evaluation metrics, F1 scores, and retriever performance logs.

Would you like me to extract specific sections or run semantic search over either of these documents?`;
  }

  return `I have processed your query: **"${userMessage}"**.

Here are some helpful insights:
- **Context:** Everything is organized in your current session.
- **Next Steps:** You can tag files using \`@\`, add tasks in the **My Tasks** board below, or export this conversation at any time.

Feel free to ask follow-up questions or request code/summaries!`;
}

class ApiService {
  constructor() {
    this.token = storage.get('auth_token', null);
  }

  setToken(token) {
    this.token = token;
    if (token) {
      storage.set('auth_token', token);
    } else {
      storage.remove('auth_token');
    }
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {})
        }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const apiError = errorData.detail ?? errorData.message;
        const message = typeof apiError === 'string'
          ? apiError
          : apiError
            ? JSON.stringify(apiError)
            : `Request failed with status ${res.status}`;
        throw new Error(message);
      }

      return await res.json();
    } catch (err) {
      console.warn(`[API] Failed to fetch ${endpoint}: ${err.message}. Using fallback storage.`);
      throw err;
    }
  }

  // Auth
  async login(email, password) {
    try {
      const data = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      this.setToken(data.token);
      return data;
    } catch (err) {
      // Fallback Demo Login
      if (email.toLowerCase() === 'sarvatha@example.com' && password === 'password123') {
        const fakeToken = 'demo-jwt-token-sarvatha-2026';
        this.setToken(fakeToken);
        return {
          token: fakeToken,
          user: DEMO_USER,
          message: 'Signed in with demo credentials'
        };
      }
      // Or allow any user in offline demo mode if email & password >= 6
      if (password.length >= 6) {
        const fakeToken = 'demo-jwt-' + Date.now();
        const fakeUser = {
          id: 'user-' + Date.now(),
          name: email.split('@')[0],
          email,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(email)}`
        };
        this.setToken(fakeToken);
        return { token: fakeToken, user: fakeUser, message: 'Signed in successfully (Offline demo mode)' };
      }
      throw new Error(err.message || 'Invalid email or password');
    }
  }

  async register(name, email, password) {
    try {
      const data = await this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      this.setToken(data.token);
      return data;
    } catch (err) {
      if (password.length < 6) throw new Error('Password must be at least 6 characters');
      const fakeToken = 'demo-jwt-' + Date.now();
      const fakeUser = {
        id: 'user-' + Date.now(),
        name,
        email,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
      };
      this.setToken(fakeToken);
      return { token: fakeToken, user: fakeUser, message: 'Registered successfully (Offline demo mode)' };
    }
  }

  async getMe() {
    try {
      return await this.request('/auth/me');
    } catch (err) {
      const savedUser = storage.get('current_user', DEMO_USER);
      return { user: savedUser };
    }
  }

  // Chats
  async getChats() {
    try {
      return await this.request('/chats');
    } catch (err) {
      return storage.get('offline_chats', DEMO_CHATS);
    }
  }

  async getChat(id) {
    try {
      return await this.request(`/chats/${id}`);
    } catch (err) {
      const list = storage.get('offline_chats', DEMO_CHATS);
      const found = list.find(c => c.id === id);
      if (!found) throw new Error('Chat not found');
      return found;
    }
  }

  async createChat(title = 'New Chat') {
    try {
      return await this.request('/chats', {
        method: 'POST',
        body: JSON.stringify({ title })
      });
    } catch (err) {
      const list = storage.get('offline_chats', DEMO_CHATS);
      const newChat = {
        id: 'conv-' + Date.now(),
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: []
      };
      const updated = [newChat, ...list];
      storage.set('offline_chats', updated);
      return newChat;
    }
  }

  async renameChat(id, title) {
    try {
      return await this.request(`/chats/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title })
      });
    } catch (err) {
      const list = storage.get('offline_chats', DEMO_CHATS);
      const chat = list.find(c => c.id === id);
      if (chat) {
        chat.title = title;
        chat.updatedAt = new Date().toISOString();
        storage.set('offline_chats', [...list]);
        return chat;
      }
      throw new Error('Chat not found');
    }
  }

  async deleteChat(id) {
    try {
      return await this.request(`/chats/${id}`, { method: 'DELETE' });
    } catch (err) {
      const list = storage.get('offline_chats', DEMO_CHATS);
      const updated = list.filter(c => c.id !== id);
      storage.set('offline_chats', updated);
      return { message: 'Chat deleted' };
    }
  }

  async sendMessage(id, text, documentId = null, conversationHistory = []) {
    if (documentId) {
      const ragResult = await this.ragAsk(text, { documentId, conversationHistory });
      const userMessage = {
        id: 'msg-' + Date.now(),
        sender: 'user',
        text,
        timestamp: new Date().toISOString()
      };
      let answer = ragResult.answer || 'I could not find an answer in the selected document.';
      const aiMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'assistant',
        text: answer,
        timestamp: new Date().toISOString()
      };
      return {
        userMessage,
        aiMessage,
        chat: {
          id,
          title: text.slice(0, 30),
          messages: [userMessage, aiMessage]
        }
      };
    }

    try {
      return await this.request(`/chats/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text })
      });
    } catch (err) {
      const list = storage.get('offline_chats', DEMO_CHATS);
      let chat = list.find(c => c.id === id);
      if (!chat) {
        chat = {
          id,
          title: text.slice(0, 30),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: []
        };
        list.unshift(chat);
      }

      const userMessage = {
        id: 'msg-' + Date.now(),
        sender: 'user',
        text,
        timestamp: new Date().toISOString()
      };
      chat.messages.push(userMessage);

      const aiText = generateLocalAiResponse(text);
      const aiMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'assistant',
        text: aiText,
        timestamp: new Date().toISOString()
      };
      chat.messages.push(aiMessage);
      chat.updatedAt = new Date().toISOString();
      if (chat.title === 'New Chat') {
        chat.title = text.slice(0, 30) + (text.length > 30 ? '...' : '');
      }

      storage.set('offline_chats', list);
      return { userMessage, aiMessage, chat };
    }
  }

  // Tasks
  async getTasks() {
    try {
      return await this.request('/tasks');
    } catch (err) {
      return storage.get('offline_tasks', DEMO_TASKS);
    }
  }

  async createTask(title, priority = 'medium') {
    try {
      return await this.request('/tasks', {
        method: 'POST',
        body: JSON.stringify({ title, priority })
      });
    } catch (err) {
      const list = storage.get('offline_tasks', DEMO_TASKS);
      const newTask = {
        id: 'task-' + Date.now(),
        title,
        completed: false,
        priority,
        createdAt: new Date().toISOString()
      };
      const updated = [newTask, ...list];
      storage.set('offline_tasks', updated);
      return newTask;
    }
  }

  async updateTask(id, updates) {
    try {
      return await this.request(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
    } catch (err) {
      const list = storage.get('offline_tasks', DEMO_TASKS);
      const task = list.find(t => t.id === id);
      if (task) {
        Object.assign(task, updates);
        storage.set('offline_tasks', [...list]);
        return task;
      }
      throw new Error('Task not found');
    }
  }

  async deleteTask(id) {
    try {
      return await this.request(`/tasks/${id}`, { method: 'DELETE' });
    } catch (err) {
      const list = storage.get('offline_tasks', DEMO_TASKS);
      const updated = list.filter(t => t.id !== id);
      storage.set('offline_tasks', updated);
      return { message: 'Task deleted' };
    }
  }

  async prioritizeTasks() {
    try {
      return await this.request('/tasks/prioritize', { method: 'POST' });
    } catch (err) {
      const list = storage.get('offline_tasks', DEMO_TASKS);
      const priorityWeight = { high: 1, medium: 2, low: 3 };
      const sorted = [...list].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (priorityWeight[a.priority] || 2) - (priorityWeight[b.priority] || 2);
      });
      storage.set('offline_tasks', sorted);
      return { tasks: sorted };
    }
  }

  // Files - returns live RAG-indexed documents
  async getFiles() {
    try {
      return await this.request('/files');
    } catch (err) {
      return DEMO_FILES;
    }
  }

  // ─── RAG: Documents ────────────────────────────────────────────────────────

  /** Upload a PDF / PPTX / DOCX file and index it for RAG. */
  async uploadDocument(file) {
    const url = `${API_BASE_URL}/documents`;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(url, {
      method: 'POST',
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Upload failed (${res.status})`);
    }
    return res.json();
  }

  /** List all indexed documents. */
  async listDocuments() {
    try {
      return await this.request('/documents');
    } catch (err) {
      return [];
    }
  }

  /** Delete an indexed document by ID. */
  async deleteDocument(documentId) {
    return this.request(`/documents/${documentId}`, { method: 'DELETE' });
  }

  /** Perform semantic search across indexed documents. */
  async ragSearch(query, { documentId = null, topK = 5, minSimilarity = 0.0 } = {}) {
    return this.request('/rag/search', {
      method: 'POST',
      body: JSON.stringify({ query, document_id: documentId, top_k: topK, min_similarity: minSimilarity }),
    });
  }

  /** Ask a question using RAG (retrieval + LLM grounding + citations). */
  async ragAsk(query, { documentId = null, conversationHistory = [], topK = 4, model = null, apiKey = null, temperature = 0.1, languageOverride = null } = {}) {
    return this.request('/rag/ask', {
      method: 'POST',
      body: JSON.stringify({
        query,
        document_id: documentId,
        conversation_history: conversationHistory,
        top_k: topK,
        model,
        api_key: apiKey,
        temperature,
        language_override: languageOverride,
      }),
    });
  }

  /** List configured Google Gemini models. */
  async listModels() {
    try {
      return await this.request('/rag/models');
    } catch (err) {
      return { provider: 'Google Gemini', default: 'gemini-2.5-flash', models: [] };
    }
  }

  /** Index all documents found in the workspace root. */
  async indexWorkspace() {
    return this.request('/documents/index-workspace', { method: 'POST' });
  }
}

export const api = new ApiService();
