/**
 * HOME SCREEN TEMPLATE
 * Reusable full dashboard template matching Image 2 Layout Reference
 * Consists of:
 * - Collapsible Sidebar with mobile drawer support
 * - Top Header with theme toggle & user profile pill
 * - Hero Title: "How can I help you today?"
 * - 3 Action Suggestion Cards
 * - "My Tasks" board with search & prioritization
 * - Floating bottom prompt bar with sparkles and send arrow
 */

import React, { useState } from 'react';
import Sidebar from './Sidebar.template';
import Header from './Header.template';
import ChatArea from './ChatArea.template';

export default function HomeScreenTemplate() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="app-container">
      {/* Sidebar Template */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Viewport */}
      <div className="main-wrapper">
        <Header
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        />

        <ChatArea />
      </div>
    </div>
  );
}
