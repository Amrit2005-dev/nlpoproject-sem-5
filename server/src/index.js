import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { store } from './store.js';
import { generateAiResponse } from './ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_phenomenon_studio_2026_xyz';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Non-blocking MongoDB connection attempt
let isMongoConnected = false;
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 2000,
  }).then(() => {
    isMongoConnected = true;
    console.log('[Database] Connected to MongoDB successfully.');
  }).catch((err) => {
    console.log('[Database] MongoDB not reachable, using resilient persistent JSON store.', err.message);
  });
}

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
};

// Health Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: isMongoConnected ? 'mongodb' : 'json-store',
    timestamp: new Date().toISOString()
  });
});

// ================= AUTH ROUTES =================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = store.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = {
      id: 'user-' + Date.now(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      createdAt: new Date().toISOString()
    };

    store.createUser(newUser);

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, name: newUser.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        avatar: newUser.avatar
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = store.findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Signed in successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error during login' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = store.findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar
    }
  });
});

// ================= CHAT ROUTES =================
app.get('/api/chats', authenticateToken, (req, res) => {
  const chats = store.getUserConversations(req.user.id);
  const formatted = chats.map(c => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: c.messages ? c.messages.length : 0,
    lastMessage: c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1].text : ''
  }));
  res.json(formatted);
});

app.post('/api/chats', authenticateToken, (req, res) => {
  const { title } = req.body;
  const newChat = {
    id: 'conv-' + Date.now(),
    userId: req.user.id,
    title: title || 'New Chat',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  };

  store.createConversation(newChat);
  res.status(201).json(newChat);
});

app.get('/api/chats/:id', authenticateToken, (req, res) => {
  const chat = store.getConversation(req.params.id, req.user.id);
  if (!chat) {
    return res.status(404).json({ message: 'Conversation not found' });
  }
  res.json(chat);
});

app.put('/api/chats/:id', authenticateToken, (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Title is required' });
  }

  const updated = store.updateConversation(req.params.id, req.user.id, { title: title.trim() });
  if (!updated) {
    return res.status(404).json({ message: 'Conversation not found' });
  }
  res.json(updated);
});

app.delete('/api/chats/:id', authenticateToken, (req, res) => {
  const success = store.deleteConversation(req.params.id, req.user.id);
  if (!success) {
    return res.status(404).json({ message: 'Conversation not found' });
  }
  res.json({ message: 'Conversation deleted successfully' });
});

app.post('/api/chats/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    let chat = store.getConversation(req.params.id, req.user.id);
    if (!chat) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // 1. Add user message
    const userMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toISOString()
    };
    store.addMessage(chat.id, req.user.id, userMessage);

    // 2. Generate AI response
    const aiText = await generateAiResponse(text, chat.messages);
    const aiMessage = {
      id: 'msg-' + (Date.now() + 1),
      sender: 'assistant',
      text: aiText,
      timestamp: new Date().toISOString()
    };
    store.addMessage(chat.id, req.user.id, aiMessage);

    // If query was UX research, also create the task if not already present
    if (text.toLowerCase().includes('ux research') || text.toLowerCase().includes('conduct ux')) {
      const existing = store.getUserTasks(req.user.id).find(t => t.title.toLowerCase().includes('conduct ux research'));
      if (!existing) {
        store.createTask({
          id: 'task-' + Date.now(),
          userId: req.user.id,
          title: 'Conduct UX Research for chat flow',
          completed: false,
          priority: 'high',
          createdAt: new Date().toISOString()
        });
      }
    }

    const updatedChat = store.getConversation(chat.id, req.user.id);
    res.json({
      userMessage,
      aiMessage,
      chat: updatedChat
    });
  } catch (err) {
    console.error('Error posting message:', err);
    res.status(500).json({ message: 'Error processing message' });
  }
});

// ================= TASK ROUTES =================
app.get('/api/tasks', authenticateToken, (req, res) => {
  const tasks = store.getUserTasks(req.user.id);
  res.json(tasks);
});

app.post('/api/tasks', authenticateToken, (req, res) => {
  const { title, priority } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Task title is required' });
  }

  const newTask = {
    id: 'task-' + Date.now(),
    userId: req.user.id,
    title: title.trim(),
    completed: false,
    priority: priority || 'medium',
    createdAt: new Date().toISOString()
  };

  store.createTask(newTask);
  res.status(201).json(newTask);
});

app.put('/api/tasks/:id', authenticateToken, (req, res) => {
  const { title, completed, priority } = req.body;
  const updates = {};
  if (typeof title === 'string') updates.title = title.trim();
  if (typeof completed === 'boolean') updates.completed = completed;
  if (priority) updates.priority = priority;

  const updated = store.updateTask(req.params.id, req.user.id, updates);
  if (!updated) {
    return res.status(404).json({ message: 'Task not found' });
  }
  res.json(updated);
});

app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  const success = store.deleteTask(req.params.id, req.user.id);
  if (!success) {
    return res.status(404).json({ message: 'Task not found' });
  }
  res.json({ message: 'Task deleted successfully' });
});

app.post('/api/tasks/prioritize', authenticateToken, (req, res) => {
  const tasks = store.getUserTasks(req.user.id);
  // Sort incomplete tasks by high priority first, then medium, then low
  const priorityWeight = { high: 1, medium: 2, low: 3 };
  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (priorityWeight[a.priority] || 2) - (priorityWeight[b.priority] || 2);
  });
  res.json({ message: 'Tasks prioritized successfully', tasks: sorted });
});

// ================= FILES ROUTE =================
app.get('/api/files', authenticateToken, (req, res) => {
  const files = store.getUserFiles(req.user.id);
  res.json(files);
});

// Start Server
app.listen(PORT, () => {
  console.log(`[Server] AI Workspace Server running on http://localhost:${PORT}`);
});
