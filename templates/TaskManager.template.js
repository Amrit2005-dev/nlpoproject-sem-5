/**
 * TASK MANAGER TEMPLATE
 * Matches "My Tasks" section in Image 2 Layout Reference:
 * - Left: "My Tasks" title with count badge
 * - Middle: Search input "Search for name..." with "+" button
 * - Right: "✨ Prioritize Tasks" button
 * - Task items list with checkboxes
 */

import React, { useState } from 'react';
import { Search, Plus, Sparkles, Check } from 'lucide-react';

export default function TaskManagerTemplate({ tasks = [], onToggleTask, onAddTask, onPrioritize }) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="tasks-section">
      <div className="tasks-card">
        <div className="tasks-header">
          <div className="tasks-title-wrap">
            <h3 className="tasks-title">My Tasks</h3>
            <span class="nav-badge">{tasks.length}</span>
          </div>

          <div className="tasks-search-wrap">
            <Search size={14} style={{ color: 'var(--text-subtle)' }} />
            <input
              type="text"
              placeholder="Search for name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="add-task-icon-btn" onClick={onAddTask} title="Add task">
              <Plus size={14} />
            </button>
          </div>

          <button className="prioritize-btn" onClick={onPrioritize}>
            <Sparkles size={14} />
            <span>Prioritize Tasks</span>
          </button>
        </div>

        <div className="tasks-list">
          {tasks.length === 0 ? (
            <div className="empty-tasks-state">No tasks match your search.</div>
          ) : (
            tasks.map(task => (
              <div key={task.id} className="task-item">
                <div className="task-item-left">
                  <button
                    className={`task-checkbox ${task.completed ? 'checked' : ''}`}
                    onClick={() => onToggleTask && onToggleTask(task.id)}
                  >
                    {task.completed && <Check size={13} strokeWidth={3} />}
                  </button>
                  <span className={`task-title ${task.completed ? 'completed' : ''}`}>
                    {task.title}
                  </span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                  {task.priority || 'NORMAL'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
