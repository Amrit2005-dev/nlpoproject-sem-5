import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { storage } from '../utils/storage';
import { useAuth } from './useAuth';

const ChatContext = createContext();

export function ChatProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(() => storage.get('active_chat_id', null));
  const [currentChat, setCurrentChat] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'tasks' | 'files'

  // Load conversations list
  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingChats(true);
    try {
      const list = await api.getChats();
      setConversations(list || []);
    } catch (err) {
      console.warn('Failed to load conversations:', err);
    } finally {
      setIsLoadingChats(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    } else {
      setConversations([]);
      setCurrentChat(null);
      setCurrentChatId(null);
    }
  }, [isAuthenticated, loadConversations]);

  // Load single conversation details when currentChatId changes
  useEffect(() => {
    let isCancelled = false;
    async function fetchChatDetails() {
      if (!currentChatId) {
        setCurrentChat(null);
        return;
      }
      try {
        const fullChat = await api.getChat(currentChatId);
        if (!isCancelled) {
          setCurrentChat(fullChat);
          storage.set('active_chat_id', currentChatId);
        }
      } catch (err) {
        console.warn('Error fetching chat details:', err);
        if (!isCancelled) {
          setCurrentChat(null);
          setCurrentChatId(null);
          storage.remove('active_chat_id');
        }
      }
    }

    if (isAuthenticated && currentChatId) {
      fetchChatDetails();
    }
    return () => {
      isCancelled = true;
    };
  }, [currentChatId, isAuthenticated]);

  const selectChat = (id) => {
    setActiveTab('chat');
    setCurrentChatId(id);
  };

  const startNewChat = () => {
    setActiveTab('chat');
    setCurrentChatId(null);
    setCurrentChat(null);
    storage.remove('active_chat_id');
  };

  const createChat = async (title = 'New Chat') => {
    try {
      const newConv = await api.createChat(title);
      setConversations(prev => [newConv, ...prev]);
      setCurrentChatId(newConv.id);
      setCurrentChat(newConv);
      return newConv;
    } catch (err) {
      console.error('Failed to create chat:', err);
    }
  };

  const renameChat = async (id, newTitle) => {
    try {
      const updated = await api.renameChat(id, newTitle);
      setConversations(prev =>
        prev.map(c => (c.id === id ? { ...c, title: newTitle } : c))
      );
      if (currentChat && currentChat.id === id) {
        setCurrentChat(prev => ({ ...prev, title: newTitle }));
      }
      return updated;
    } catch (err) {
      console.error('Failed to rename chat:', err);
      throw err;
    }
  };

  const deleteChat = async (id) => {
    try {
      await api.deleteChat(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentChatId === id) {
        startNewChat();
      }
    } catch (err) {
      console.error('Failed to delete chat:', err);
      throw err;
    }
  };

  const sendMessage = async (text, documentId = null) => {
    if (!text || !text.trim() || isSending) return;
    setIsSending(true);

    try {
      let chatId = currentChatId;
      // If no active chat, create one automatically
      if (!chatId) {
        const title = text.slice(0, 32).trim() + (text.length > 32 ? '...' : '');
        const newConv = await api.createChat(title);
        chatId = newConv.id;
        setCurrentChatId(chatId);
      }

      // Optimistic user message
      const optimisticMsg = {
        id: 'temp-' + Date.now(),
        sender: 'user',
        text: text.trim(),
        timestamp: new Date().toISOString()
      };

      setCurrentChat(prev => ({
        id: chatId,
        title: prev?.title || text.slice(0, 30),
        messages: prev?.messages ? [...prev.messages, optimisticMsg] : [optimisticMsg]
      }));

      // Call API
      const result = await api.sendMessage(
        chatId,
        text,
        documentId,
        currentChat?.messages?.slice(-12) || []
      );
      if (documentId && result?.userMessage && result?.aiMessage) {
        setCurrentChat(prev => ({
          ...(result.chat || prev || {}),
          id: chatId,
          title: result.chat?.title || prev?.title || text.slice(0, 30),
          messages: [
            ...(prev?.messages || []).filter(message => !String(message.id).startsWith('temp-')),
            result.userMessage,
            result.aiMessage
          ]
        }));
      } else if (result?.chat) {
        setCurrentChat(result.chat);
      }
      await loadConversations();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The request could not be completed.';
      console.error('Failed to send message:', err);
      setCurrentChat(prev => prev ? {
        ...prev,
        messages: [
          ...(prev.messages || []).filter(item => !String(item.id).startsWith('temp-')),
          {
            id: 'user-error-' + Date.now(),
            sender: 'user',
            text: text.trim(),
            timestamp: new Date().toISOString()
          },
          {
            id: 'error-' + (Date.now() + 1),
            sender: 'assistant',
            text: `I could not answer that question. ${message}`,
            timestamp: new Date().toISOString()
          }
        ]
      } : prev);
    } finally {
      setIsSending(false);
    }
  };

  // Filtered conversations based on search
  const filteredConversations = conversations.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = c.title?.toLowerCase().includes(q);
    const lastMsgMatch = c.lastMessage?.toLowerCase().includes(q);
    return titleMatch || lastMsgMatch;
  });

  return (
    <ChatContext.Provider
      value={{
        conversations: filteredConversations,
        allConversations: conversations,
        currentChat,
        currentChatId,
        isSending,
        isLoadingChats,
        searchQuery,
        setSearchQuery,
        activeTab,
        setActiveTab,
        selectChat,
        startNewChat,
        createChat,
        renameChat,
        deleteChat,
        sendMessage,
        refreshConversations: loadConversations
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
