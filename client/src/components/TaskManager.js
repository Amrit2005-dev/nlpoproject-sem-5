import React, { useState, useEffect } from 'react';
import { Sparkles, Plus, Search, Check, Trash2 } from 'lucide-react';
import { api } from '../services/api';

export default function TaskManager({ onTaskCountChange }) {
  const [tasks, setTasks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isPrioritizing, setIsPrioritizing] = useState(false);

  useEffect(() => {
    async function loadTasks() {
      try {
        const data = await api.getTasks();
        setTasks(data || []);
        if (onTaskCountChange) onTaskCountChange(data?.length || 0);
      } catch (err) {
        console.warn('Failed to load tasks:', err);
      }
    }
    loadTasks();
  }, [onTaskCountChange]);

  const handleAddTask = async (e) => {
    if (e) e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const created = await api.createTask(newTaskTitle.trim(), 'high');
      const updated = [created, ...tasks];
      setTasks(updated);
      setNewTaskTitle('');
      setIsAdding(false);
      if (onTaskCountChange) onTaskCountChange(updated.length);
    } catch (err) {
      console.error('Error adding task:', err);
    }
  };

  const handleToggleTask = async (id, currentStatus) => {
    try {
      const updatedTask = await api.updateTask(id, { completed: !currentStatus });
      setTasks(prev => prev.map(t => (t.id === id ? updatedTask : t)));
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      await api.deleteTask(id);
      const updated = tasks.filter(t => t.id !== id);
      setTasks(updated);
      if (onTaskCountChange) onTaskCountChange(updated.length);
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const handlePrioritize = async () => {
    setIsPrioritizing(true);
    try {
      const res = await api.prioritizeTasks();
      if (res?.tasks) {
        setTasks(res.tasks);
      }
    } catch (err) {
      console.error('Error prioritizing tasks:', err);
    } finally {
      setTimeout(() => setIsPrioritizing(false), 400);
    }
  };

  const filteredTasks = tasks.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '920px',
        margin: '24px auto 0 auto',
        padding: '0 16px'
      }}
    >
      {/* Task Manager Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Top Header Row Matching Image 2 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px'
          }}
        >
          {/* Left Title + Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              My Tasks
            </h3>
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                backgroundColor: 'var(--badge-bg)',
                color: 'var(--badge-text)',
                padding: '2px 8px',
                borderRadius: '9999px',
                minWidth: '20px',
                textAlign: 'center'
              }}
            >
              {tasks.length}
            </span>
          </div>

          {/* Search bar with '+' button inside */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-color)',
              borderRadius: '9999px',
              padding: '4px 8px 4px 12px',
              width: '100%',
              maxWidth: '320px'
            }}
          >
            <Search size={14} style={{ color: 'var(--text-subtle)' }} />
            <input
              type="text"
              placeholder="Search for name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '13px',
                flex: 1
              }}
            />
            <button
              onClick={() => setIsAdding(prev => !prev)}
              title="Add task"
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'var(--badge-bg)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Right Action: Prioritize Tasks */}
          <button
            onClick={handlePrioritize}
            disabled={isPrioritizing || tasks.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 14px',
              borderRadius: '9999px',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              backgroundColor: 'var(--accent-sparkle-bg)',
              color: 'var(--accent-sparkle)',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: tasks.length === 0 ? 'default' : 'pointer',
              opacity: tasks.length === 0 ? 0.6 : 1,
              transition: 'all 0.18s'
            }}
          >
            <Sparkles size={14} />
            <span>{isPrioritizing ? 'Prioritizing...' : 'Prioritize Tasks'}</span>
          </button>
        </div>

        {/* Inline Add Task Form */}
        {isAdding && (
          <form
            onSubmit={handleAddTask}
            className="animate-fade-in"
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '14px',
              backgroundColor: 'var(--bg-app)',
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-focus)'
            }}
          >
            <input
              type="text"
              placeholder="What task do you want to accomplish?"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              autoFocus
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '13.5px'
              }}
            />
            <button
              type="submit"
              disabled={!newTaskTitle.trim()}
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-subtle)',
                fontSize: '12.5px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </form>
        )}

        {/* Task List or Empty State */}
        {filteredTasks.length === 0 ? (
          <div
            style={{
              padding: '36px 16px',
              textAlign: 'center',
              color: 'var(--text-subtle)',
              fontSize: '13.5px'
            }}
          >
            No tasks match your search.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  transition: 'background-color 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                  <button
                    onClick={() => handleToggleTask(task.id, task.completed)}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '5px',
                      border: `1.5px solid ${task.completed ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      backgroundColor: task.completed ? 'var(--accent-primary)' : 'transparent',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    {task.completed && <Check size={13} strokeWidth={3} />}
                  </button>

                  <span
                    style={{
                      fontSize: '13.5px',
                      color: task.completed ? 'var(--text-subtle)' : 'var(--text-primary)',
                      textDecoration: task.completed ? 'line-through' : 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {task.title}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor:
                        task.priority === 'high'
                          ? 'rgba(239, 68, 68, 0.1)'
                          : task.priority === 'medium'
                          ? 'rgba(245, 158, 11, 0.1)'
                          : 'rgba(59, 130, 246, 0.1)',
                      color:
                        task.priority === 'high'
                          ? '#ef4444'
                          : task.priority === 'medium'
                          ? '#f59e0b'
                          : '#3b82f6',
                    }}
                  >
                    {task.priority || 'normal'}
                  </span>

                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    title="Delete task"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-subtle)',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
