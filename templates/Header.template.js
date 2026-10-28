/**
 * HEADER COMPONENT TEMPLATE
 * Matches Image 2 Layout Reference:
 * - Left: Sidebar toggle icon [||] and [+ New chat] button
 * - Right: Sun/Moon Theme Toggle, User Profile pill with avatar & dropdown
 */

import React from 'react';
import { PanelLeft, PanelLeftClose, SquarePen, Sun, Moon, ChevronDown } from 'lucide-react';

export default function HeaderTemplate({
  isSidebarOpen,
  onToggleSidebar,
  onNewChat,
  isDark,
  onToggleTheme,
  userName = 'sarvatha',
  userAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
}) {
  return (
    <header className="header-bar">
      <div className="header-left">
        <button className="sidebar-toggle-btn" onClick={onToggleSidebar} title="Toggle sidebar">
          {isSidebarOpen ? <PanelLeftClose size={19} /> : <PanelLeft size={19} />}
        </button>

        <button className="new-chat-btn" onClick={onNewChat} style={{ flex: 'none', padding: '7px 14px' }}>
          <SquarePen size={15} />
          <span>New chat</span>
        </button>
      </div>

      <div className="header-right">
        {/* Instant Theme Toggle Button */}
        <button className="sidebar-toggle-btn" onClick={onToggleTheme} title="Toggle theme">
          {isDark ? <Sun size={18} color="#fbbf24" /> : <Moon size={18} color="var(--accent-primary)" />}
        </button>

        {/* User Profile Pill */}
        <button className="user-profile-pill">
          <img src={userAvatar} alt={userName} className="user-avatar-img" />
          <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{userName}</span>
          <ChevronDown size={14} style={{ color: 'var(--text-subtle)' }} />
        </button>
      </div>
    </header>
  );
}
