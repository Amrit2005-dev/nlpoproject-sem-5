import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

// Initial seed data
const initialData = {
  users: [
    {
      id: 'demo-user-1',
      name: 'Sarvatha',
      email: 'sarvatha@example.com',
      // bcrypt hash for 'password123'
      passwordHash: '$2a$10$wT70Ivd7dE3/h953k25Vb.k3uFwH1v0Vq.vj0G4k23.YhB/8.uDsy',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      createdAt: new Date().toISOString()
    }
  ],
  conversations: [
    {
      id: 'conv-sample-1',
      userId: 'demo-user-1',
      title: 'UX Strategy & Architecture',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
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
  ],
  tasks: [
    {
      id: 'task-1',
      userId: 'demo-user-1',
      title: 'Conduct UX Research for chat flow',
      completed: false,
      priority: 'high',
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'task-2',
      userId: 'demo-user-1',
      title: 'Review IndicRAG-QA benchmark results',
      completed: true,
      priority: 'medium',
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
    }
  ],
  files: [
    {
      id: 'file-1',
      userId: 'demo-user-1',
      name: 'UX_Strategy_Brief_2026.pdf',
      size: '2.4 MB',
      type: 'pdf',
      updatedAt: '1 Apr 2025, 14:00 pm'
    },
    {
      id: 'file-2',
      userId: 'demo-user-1',
      name: 'IndicRAG_Benchmark_Summary.json',
      size: '840 KB',
      type: 'json',
      updatedAt: '24 Oct 2026, 11:30 am'
    }
  ]
};

class Store {
  constructor() {
    this.data = initialData;
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(STORE_PATH)) {
        const fileContent = fs.readFileSync(STORE_PATH, 'utf-8');
        this.data = JSON.parse(fileContent);
      } else {
        this.save();
      }
    } catch (err) {
      console.warn('[Store] Using in-memory store due to load error:', err.message);
      this.data = initialData;
    }
  }

  save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[Store] Could not persist store to disk:', err.message);
    }
  }

  // Users
  findUserByEmail(email) {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  findUserById(id) {
    return this.data.users.find(u => u.id === id);
  }

  createUser(user) {
    this.data.users.push(user);
    this.save();
    return user;
  }

  // Conversations
  getUserConversations(userId) {
    return this.data.conversations
      .filter(c => c.userId === userId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  getConversation(id, userId) {
    return this.data.conversations.find(c => c.id === id && c.userId === userId);
  }

  createConversation(conv) {
    this.data.conversations.unshift(conv);
    this.save();
    return conv;
  }

  updateConversation(id, userId, updates) {
    const conv = this.getConversation(id, userId);
    if (!conv) return null;
    Object.assign(conv, updates, { updatedAt: new Date().toISOString() });
    this.save();
    return conv;
  }

  deleteConversation(id, userId) {
    const index = this.data.conversations.findIndex(c => c.id === id && c.userId === userId);
    if (index === -1) return false;
    this.data.conversations.splice(index, 1);
    this.save();
    return true;
  }

  addMessage(convId, userId, message) {
    const conv = this.getConversation(convId, userId);
    if (!conv) return null;
    conv.messages.push(message);
    conv.updatedAt = new Date().toISOString();
    // Update title from first message if it is default
    if (conv.messages.length === 1 || conv.title === 'New Chat') {
      const summary = message.text.slice(0, 32).trim();
      conv.title = summary.length > 0 ? (summary + (message.text.length > 32 ? '...' : '')) : 'New Chat';
    }
    this.save();
    return conv;
  }

  // Tasks
  getUserTasks(userId) {
    return this.data.tasks.filter(t => t.userId === userId);
  }

  createTask(task) {
    this.data.tasks.unshift(task);
    this.save();
    return task;
  }

  updateTask(id, userId, updates) {
    const task = this.data.tasks.find(t => t.id === id && t.userId === userId);
    if (!task) return null;
    Object.assign(task, updates);
    this.save();
    return task;
  }

  deleteTask(id, userId) {
    const index = this.data.tasks.findIndex(t => t.id === id && t.userId === userId);
    if (index === -1) return false;
    this.data.tasks.splice(index, 1);
    this.save();
    return true;
  }

  // Files
  getUserFiles(userId) {
    return this.data.files.filter(f => f.userId === userId || !f.userId);
  }
}

export const store = new Store();
