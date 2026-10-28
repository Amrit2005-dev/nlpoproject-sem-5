/**
 * SIDEBAR COMPONENT TEMPLATE
 * Matches Image 2 Layout Reference:
 * - New Chat button + Collapse icon [||]
 * - Navigation links: "My Tasks" (with badge counter), "Saved Files"
 * - Searchable Conversation history list with edit & delete actions
 * - Settings footer
 */

import React from 'react';
import { SquarePen, PanelLeftClose, CheckSquare, FileText, Search, Settings, MoreHorizontal } from 'lucide-react';

export default function SidebarTemplate({ isOpen, onClose, onNewChat, taskCount = 2, conversations = [] }) {
  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div className="mobile-backdrop active" onClick={onClose} />
      )}

      <aside className={`sidebar-container ${!isOpen ? 'collapsed' : ''}`}>
        {/* Top Action Row */}
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={onNewChat}>
            <SquarePen size={16} />
            <span>New chat</span>
          </button>
          <button className="sidebar-toggle-btn" onClick={onClose} title="Collapse sidebar">
            <PanelLeftClose size={18} />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="sidebar-nav">
          <button className="nav-item active">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckSquare size={16} />
              <span>My Tasks</span>
            </div>
            <span className="nav-badge">{taskCount}</span>
          </button>

          <button className="nav-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText size={16} />
              <span>Saved Files</span>
            </div>
          </button>
        </div>

        {/* Search */}
        <div className="sidebar-search">
          <div className="search-box">
            <Search size={14} style={{ color: 'var(--text-subtle)' }} />
            <input type="text" placeholder="Search chats..." />
          </div>
        </div>

        {/* Chat History List */}
        <div className="conversations-container">
          {conversations.length === 0 ? (
            <div className="empty-conversations">
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>No conversations yet</p>
              <p style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Start a chat or ask a question to begin.</p>
            </div>
          ) : (
            conversations.map(chat => (
              <div key={chat.id} className="chat-history-item">
                <span>{chat.title}</span>
              </div>
            ))
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <button className="settings-btn">
            <Settings size={17} />
            <span>Settings</span>
          </button>
          <MoreHorizontal size={18} style={{ color: 'var(--text-subtle)', cursor: 'pointer' }} />
        </div>
      </aside>
    </>
  );
}
