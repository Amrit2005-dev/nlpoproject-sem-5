import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import ChatArea from '../components/ChatArea';
import SavedFilesModal from '../components/SavedFilesModal';
import SettingsModal from '../components/SettingsModal';
import { useChat } from '../hooks/useChat';

export default function HomeScreen() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth > 768 : true;
  });
  const [isSavedFilesOpen, setIsSavedFilesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [taskCount, setTaskCount] = useState(0);

  const { sendMessage } = useChat();

  const handleToggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  const handleAskAboutFile = (promptText) => {
    sendMessage(promptText);
  };

  return (
    <div className="app-container">
      {/* Sidebar (Collapsible & Mobile Drawer) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSavedFiles={() => setIsSavedFilesOpen(true)}
        taskCount={taskCount}
      />

      {/* Main Workspace Area */}
      <div className="main-wrapper">
        <Header
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        <ChatArea
          onOpenSavedFiles={() => setIsSavedFilesOpen(true)}
          onTaskCountChange={setTaskCount}
        />
      </div>

      {/* Saved Files Modal */}
      <SavedFilesModal
        isOpen={isSavedFilesOpen}
        onClose={() => setIsSavedFilesOpen(false)}
        onAskAboutFile={handleAskAboutFile}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
