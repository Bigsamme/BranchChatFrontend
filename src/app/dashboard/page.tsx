"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Chat {
  id: string;
  name: string;
  created_at: string;
  branch_of?: string; // Added optional branch_of property
}

export default function DashboardPage() {
  const router = useRouter();
  const { isLoaded, userId, getToken } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);

  // Fetch existing chats
  const fetchChats = useCallback(async () => {
    if (!isLoaded || !userId) return;
    const token = await getToken();
    try {
      const res = await fetch("http://localhost:8000/chats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setChats(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching chats:", error);
    }
  }, [isLoaded, userId, getToken]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Create a new empty chat
  const createChat = async () => {
    if (!isLoaded || !userId) return;
    setLoading(true);
    const token = await getToken();
    try {
    const res = await fetch("http://localhost:8000/chats", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.chat_id) {
        // Navigate to the new chat
        router.push(`/chat/${data.chat_id}`);
      }
    } catch (error) {
      console.error("Error creating chat:", error);
    } finally {
      setLoading(false);
    }
  };

  // Delete a chat
  const deleteChat = async (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent navigation when clicking delete
    if (!isLoaded || !userId) return;
    setDeletingChatId(chatId);
    const token = await getToken();
    try {
      const res = await fetch(`http://localhost:8000/chats/${chatId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setChats(prev => prev.filter(chat => chat.id !== chatId));
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    } finally {
      setDeletingChatId(null);
    }
  };

  const renderChatTree = (chat: Chat, chats: Chat[], level: number = 0) => {
    const children = chats.filter(c => c.branch_of === chat.id);
    return (
      <div key={chat.id} style={{ paddingLeft: `${level * 20}px`, margin: "0.5rem 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => router.push(`/chat/${chat.id}`)}
            style={{ textDecoration: "underline", cursor: "pointer" }}
          >
            {chat.name || "Untitled Chat"}
          </button>
          <button
            onClick={(e) => deleteChat(chat.id, e)}
            disabled={deletingChatId === chat.id}
            style={{ 
              color: "red", 
              cursor: "pointer",
              opacity: deletingChatId === chat.id ? 0.5 : 1
            }}
          >
            {deletingChatId === chat.id ? "Deleting..." : "Delete"}
          </button>
        </div>
        {children.map(child => renderChatTree(child, chats, level + 1))}
      </div>
    );
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Dashboard</h1>
      <button onClick={createChat} disabled={loading}>
        {loading ? "Creating..." : "Create New Chat"}
      </button>

      <h2>Your Chats</h2>
      <div>
        {chats.filter(chat => !chat.branch_of).map(rootChat => renderChatTree(rootChat, chats))}
      </div>
    </div>
  );
}