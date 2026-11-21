import React, { useState } from 'react';
import {
  SquarePen,
  PanelLeftClose,
  CheckSquare,
  FileText,
  GraduationCap,
  MessageSquare,
  Settings,
  MoreHorizontal,
  Search,
  Pencil,
  Trash2,
  Check,
  X
} from 'lucide-react';
import { useChat } from '../hooks/useChat';
import { formatTimestamp } from '../utils/formatters';
import { studyApi } from '../services/studyApi';

export default function Sidebar({
  isOpen,
  onClose,
  onOpenSettings,
  onOpenSavedFiles,
  taskCount = 0
}) {
  const {
    conversations,
    currentChatId,
    selectChat,
    startNewChat,
    renameChat,
    deleteChat,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab
  } = useChat();

  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [syllabusProgress, setSyllabusProgress] = useState(37);

  React.useEffect(() => {
    studyApi.getPlannerOverview().then(data => {
      if (data && typeof data.overall_progress === 'number') {
        setSyllabusProgress(data.overall_progress);
      }
    });

    const unsubscribe = studyApi.subscribeProgress((newProg) => {
      setSyllabusProgress(newProg);
    });
    return () => unsubscribe();
  }, []);

  const handleStartRename = (e, chat) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditingTitle(chat.title);
  };

  const handleSaveRename = async (e, id) => {
    e.stopPropagation();
    if (editingTitle.trim()) {
      await renameChat(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Delete this conversation?')) {
      await deleteChat(id);
    }
  };

  const handleChatClick = (id) => {
    selectChat(id);
    setActiveTab('chat');
    // On mobile viewports, auto close sidebar
    if (window.innerWidth <= 768) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            zIndex: 40,
            display: 'none',
          }}
          className="mobile-backdrop"
        />
      )}

      <aside
        style={{
          width: 'var(--sidebar-width)',
          height: '100%',
          backgroundColor: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 45,
          flexShrink: 0,
          transition: 'transform 0.25s ease, margin-left 0.25s ease',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          marginLeft: isOpen ? 0 : 'calc(-1 * var(--sidebar-width))',
        }}
        className="sidebar-container"
      >
        {/* Top Action Row: New Chat + Collapse */}
        <div
          style={{
            padding: '16px 14px 12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <button
            onClick={() => {
              startNewChat();
              setActiveTab('chat');
              if (window.innerWidth <= 768) onClose();
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '9px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.18s',
            }}
          >
            <SquarePen size={16} style={{ color: 'var(--text-secondary)' }} />
            <span>New chat</span>
          </button>

          <button
            onClick={onClose}
            title="Collapse sidebar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.18s',
              flexShrink: 0
            }}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ padding: '4px 10px 8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button
            onClick={() => {
              setActiveTab('tasks');
              if (window.innerWidth <= 768) onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'tasks' ? 'var(--bg-active)' : 'transparent',
              color: activeTab === 'tasks' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckSquare size={16} />
              <span>My Tasks</span>
            </div>
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                backgroundColor: 'var(--badge-bg)',
                color: 'var(--badge-text)',
                padding: '2px 7px',
                borderRadius: '9999px',
                minWidth: '18px',
                textAlign: 'center'
              }}
            >
              {taskCount}
            </span>
          </button>

          <button
            onClick={() => {
              if (onOpenSavedFiles) onOpenSavedFiles();
              if (window.innerWidth <= 768) onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <FileText size={16} />
            <span>Saved Files</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('syllabus');
              if (window.innerWidth <= 768) onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'syllabus' ? 'var(--bg-active)' : 'transparent',
              color: activeTab === 'syllabus' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <GraduationCap size={16} />
              <span>Exam & Syllabus</span>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: syllabusProgress === 100 ? '#dcfce7' : 'var(--accent-light)',
                color: syllabusProgress === 100 ? '#15803d' : 'var(--accent-primary)',
                padding: '2px 7px',
                borderRadius: '9999px',
                minWidth: '28px',
                textAlign: 'center'
              }}
            >
              {syllabusProgress}%
            </span>
          </button>
        </div>

        {/* Search Input for Chats */}
        <div style={{ padding: '6px 12px 10px 12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '6px 10px',
            }}
          >
            <Search size={14} style={{ color: 'var(--text-subtle)' }} />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '13px',
                width: '100%'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Conversations History List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          {conversations.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '24px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--badge-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                  color: 'var(--text-subtle)'
                }}
              >
                <MessageSquare size={20} />
              </div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                No conversations yet
              </p>
              <p style={{ fontSize: '12.5px', color: 'var(--text-subtle)', lineHeight: 1.4 }}>
                Start a chat or ask a question to begin.
              </p>
            </div>
          ) : (
            conversations.map((chat) => {
              const isActive = currentChatId === chat.id && activeTab === 'chat';
              const isEditing = editingId === chat.id;

              return (
                <div
                  key={chat.id}
                  onClick={() => handleChatClick(chat.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: isActive ? 'var(--bg-active)' : 'transparent',
                    color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                    position: 'relative',
                    group: 'item'
                  }}
                  className="chat-history-item"
                >
                  {isEditing ? (
                    <div
                      style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '6px' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(e, chat.id);
                          if (e.key === 'Escape') handleCancelRename(e);
                        }}
                        style={{
                          flex: 1,
                          border: '1px solid var(--accent-primary)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '13px',
                          outline: 'none',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-primary)'
                        }}
                      />
                      <button
                        onClick={(e) => handleSaveRename(e, chat.id)}
                        style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }}
                      >
                        <Check size={15} />
                      </button>
                      <button
                        onClick={handleCancelRename}
                        style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', paddingRight: '8px' }}>
                        <span
                          style={{
                            fontSize: '13.5px',
                            fontWeight: isActive ? 600 : 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {chat.title}
                        </span>
                        {chat.updatedAt && (
                          <span style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                            {formatTimestamp(chat.updatedAt)}
                          </span>
                        )}
                      </div>

                      {/* Action buttons (Rename & Delete) */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          opacity: isActive ? 1 : 0.6,
                        }}
                        className="chat-item-actions"
                      >
                        <button
                          onClick={(e) => handleStartRename(e, chat)}
                          title="Rename chat"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-subtle)',
                            cursor: 'pointer',
                            padding: '3px'
                          }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, chat.id)}
                          title="Delete chat"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-subtle)',
                            cursor: 'pointer',
                            padding: '3px'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer with Settings */}
        <div
          style={{
            padding: '12px 14px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={onOpenSettings}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Settings size={17} />
            <span>Settings</span>
          </button>

          <button
            onClick={onOpenSettings}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-subtle)',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>

      {/* Style for hover and mobile queries */}
      <style>{`
        @media (max-width: 768px) {
          .sidebar-container {
            position: fixed !important;
            top: 0;
            bottom: 0;
            left: 0;
            box-shadow: var(--shadow-lg);
          }
          .mobile-backdrop {
            display: block !important;
          }
        }
        .chat-history-item:hover {
          background-color: var(--bg-hover) !important;
        }
        .chat-history-item:hover .chat-item-actions {
          opacity: 1 !important;
        }
      `}</style>
    </>
  );
}
