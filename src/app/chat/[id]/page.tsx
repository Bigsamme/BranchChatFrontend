"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

interface Message {
  id: string;
  content: string;
  role: string; // "user" or "assistant"
  created_at: string;
}

interface Chat {
  id: string;
  ancestorId: string | null; // Assuming each chat has an ancestor ID
  branch_of?: string | null; // Added to represent the branching relationship
  name?: string | null; // <-- Add this line
}

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const chatId = params.id as string;

  const { isLoaded, userId, getToken } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [branchTags, setBranchTags] = useState("");
  const [branchMsgId, setBranchMsgId] = useState<string | null>(null);
  const [allChats, setAllChats] = useState<Chat[]>([]);
  const [currentRootChatId, setCurrentRootChatId] = useState<string | null>(null);
  const [compareChatId, setCompareChatId] = useState<string | null>(null);
  const [compareMessages, setCompareMessages] = useState<Message[]>([]);
  const [compareUserInput, setCompareUserInput] = useState("");
  const [showSplit, setShowSplit] = useState(false);
  const [bothUserInput, setBothUserInput] = useState("");

  // Fetch all chats
  const fetchAllChats = useCallback(async () => {
    if (!isLoaded || !userId) return;
    const token = await getToken();
    try {
      const res = await fetch(`http://localhost:8000/chats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAllChats(Array.isArray(data) ? data : []);
      const currentChat = data.find((chat: Chat) => chat.id === chatId);
      setCurrentRootChatId(currentChat ? currentChat.ancestorId : null);
    } catch (error) {
      console.error("Error fetching all chats:", error);
    }
  }, [isLoaded, userId, getToken, chatId]);

  useEffect(() => {
    fetchAllChats();
  }, [fetchAllChats]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!isLoaded || !userId || !chatId) return;
    const token = await getToken();
    try {
      const res = await fetch(`http://localhost:8000/chats/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }, [chatId, isLoaded, userId, getToken]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Fetch messages for the compare chat
  const fetchCompareMessages = useCallback(async () => {
    if (!compareChatId || !isLoaded || !userId) return;
    const token = await getToken();
    try {
      const res = await fetch(`http://localhost:8000/chats/${compareChatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCompareMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching compare messages:", error);
    }
  }, [compareChatId, isLoaded, userId, getToken]);

  useEffect(() => {
    fetchCompareMessages();
  }, [fetchCompareMessages]);

  // Send a new user message
  const sendMessage = useCallback(async () => {
    if (!isLoaded || !userId || !userInput.trim()) return;
    const token = await getToken();
    try {
      const res = await fetch(`http://localhost:8000/chats/${chatId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: userInput }),
      });
      const data = await res.json();
      // If the backend returns something like { user_message, assistant_message }
      if (data.user_message && data.assistant_message) {
        setMessages((prev) => [...prev, data.user_message, data.assistant_message]);
      }
      setUserInput("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }, [chatId, userInput, isLoaded, userId, getToken]);

  // Send a message in the compare chat
  const sendCompareMessage = useCallback(async () => {
    if (!isLoaded || !userId || !compareChatId || !compareUserInput.trim()) return;
    const token = await getToken();
    try {
      const res = await fetch(`http://localhost:8000/chats/${compareChatId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: compareUserInput }),
      });
      const data = await res.json();
      if (data.user_message && data.assistant_message) {
        setCompareMessages((prev) => [...prev, data.user_message, data.assistant_message]);
      }
      setCompareUserInput("");
    } catch (error) {
      console.error("Error sending compare message:", error);
    }
  }, [compareChatId, compareUserInput, isLoaded, userId, getToken]);

  const sendBothMessage = useCallback(async () => {
    if (!isLoaded || !userId || !bothUserInput.trim()) return;
    if (!compareChatId) {
      console.error("Compare chat is not selected.");
      return;
    }
    const token = await getToken();
    // Create a temporary message to indicate the message is being sent
    const tempMessageId = `temp-${Date.now()}`;
    const tempMessage = {
      id: tempMessageId,
      content: bothUserInput,
      role: "user",
      created_at: new Date().toISOString(),
    };

    // Optimistically update the UI for both chats
    setMessages((prev) => [...prev, tempMessage]);
    setCompareMessages((prev) => [...prev, tempMessage]);

    try {
      // Send both requests concurrently
      const [resMain, resCompare] = await Promise.all([
        fetch(`http://localhost:8000/chats/${chatId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: bothUserInput }),
        }),
        fetch(`http://localhost:8000/chats/${compareChatId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: bothUserInput }),
        }),
      ]);

      const dataMain = await resMain.json();
      const dataCompare = await resCompare.json();

      // For main chat: replace temporary message with the actual messages
      if (dataMain.user_message && dataMain.assistant_message) {
        setMessages((prev) =>
          prev
            .map((msg) => (msg.id === tempMessageId ? dataMain.user_message : msg))
            .concat(dataMain.assistant_message)
        );
      } else {
        setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
      }

      // For compare chat: replace temporary message with the actual messages
      if (dataCompare.user_message && dataCompare.assistant_message) {
        setCompareMessages((prev) =>
          prev
            .map((msg) => (msg.id === tempMessageId ? dataCompare.user_message : msg))
            .concat(dataCompare.assistant_message)
        );
      } else {
        setCompareMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
      }
    } catch (error) {
      console.error("Error sending message to both chats:", error);
      // Remove the temporary messages on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
      setCompareMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
    }
    setBothUserInput("");
  }, [bothUserInput, chatId, compareChatId, isLoaded, userId, getToken]);

  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };

  const handleCompareEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendCompareMessage();
  };

  // Open the branch form for a specific message
  const openBranchForm = (messageId: string) => {
    setBranchMsgId(messageId);
    setBranchName("");
    setBranchTags("");
    setShowBranchForm(true);
  };

  // Cancel branching
  const closeBranchForm = () => {
    setShowBranchForm(false);
    setBranchMsgId(null);
  };

  // Create a new branched chat from the chosen message + user-provided name/tags
  const createBranch = async () => {
    if (!branchMsgId) return; // no message selected
    const token = await getToken();
    try {
      const bodyData = {
        name: branchName,
        tags: branchTags,
      };
      const res = await fetch(
        `http://localhost:8000/chats/${chatId}/branch-from/${branchMsgId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(bodyData),
        }
      );
      const data = await res.json();
      if (data.new_chat_id) {
        // Navigate to the new chat
        router.push(`/chat/${data.new_chat_id}`);
      }
    } catch (error) {
      console.error("Error branching:", error);
    } finally {
      closeBranchForm();
    }
  };

  const renderBranchTree = (parentId: string | null) => {
    return allChats
      .filter(chat => chat.branch_of === parentId && chat.ancestorId === currentRootChatId)
      .map(chat => (
        <div key={chat.id} style={{ marginLeft: "20px" }}>
          <button onClick={() => router.push(`/chat/${chat.id}`)} style={{ color: chat.id === chatId ? 'red' : 'black' }}>
            {chat.name || chat.id}
          </button>
          <button onClick={() => setCompareChatId(chat.id)} style={{ marginLeft: "5px", color: "green", textDecoration: "underline" }}>
            Compare
          </button>
          {renderBranchTree(chat.id)}
        </div>
      ));
  };

  return (
    <div style={{ display: "flex" }}>
      <div style={{ width: "200px", padding: "1rem", borderRight: "1px solid #ccc" }}>
        <h2>Branches</h2>
        {renderBranchTree(null)}
      </div>
      <div style={{ display: "flex", flex: 1 }}>
        {showSplit ? (
          <div style={{ display: "flex", flex: 1 }}>
            {/* Main Chat Panel */}
            <div style={{ flex: 1, padding: "1rem", borderRight: "1px solid #ccc" }}>
              <h1>
                Main Chat: {chatId}{" "}
                <button onClick={() => setShowSplit(!showSplit)} style={{ marginLeft: "1rem" }}>
                  {showSplit ? "Disable Split View" : "Enable Split View"}
                </button>
              </h1>
              <div style={{ marginBottom: "1rem", height: 400, overflowY: "auto", border: "1px solid #ccc" }}>
                {messages.map((msg) => (
                  <div key={msg.id} style={{ margin: "0.5rem 0" }}>
                    <strong>{msg.role}:</strong> {msg.content}
                    <button
                      style={{ marginLeft: "1rem", color: "blue", textDecoration: "underline" }}
                      onClick={() => openBranchForm(msg.id)}
                    >
                      Branch
                    </button>
                  </div>
                ))}
              </div>
              <div>
                <input
                  style={{ width: 300, marginRight: 8 }}
                  placeholder="Type a message..."
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                />
                <button onClick={sendMessage}>Send</button>
              </div>
            </div>
            {/* Compare Chat Panel */}
            <div style={{ flex: 1, padding: "1rem" }}>
              {compareChatId ? (
                <>
                  <h1>Compare Chat: {compareChatId}</h1>
                  <div style={{ marginBottom: "1rem", height: 400, overflowY: "auto", border: "1px solid #ccc" }}>
                    {compareMessages.map((msg) => (
                      <div key={msg.id} style={{ margin: "0.5rem 0" }}>
                        <strong>{msg.role}:</strong> {msg.content}
                        <button
                          style={{ marginLeft: "1rem", color: "blue", textDecoration: "underline" }}
                          onClick={() => openBranchForm(msg.id)}
                        >
                          Branch
                        </button>
                      </div>
                    ))}
                  </div>
                  <div>
                    <input
                      style={{ width: 300, marginRight: 8 }}
                      placeholder="Type a message..."
                      value={compareUserInput}
                      onChange={(e) => setCompareUserInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") sendCompareMessage(); }}
                    />
                    <button onClick={sendCompareMessage}>Send</button>
                  </div>
                </>
              ) : (
                <p>Select a branch to compare</p>
              )}
            </div>
          </div>
        ) : (
          // Only Main Chat Panel when split view is disabled
          <div style={{ padding: "1rem", flex: 1 }}>
            <h1>
              Main Chat: {chatId}
              <button onClick={() => setShowSplit(!showSplit)} style={{ marginLeft: "1rem" }}>
                {showSplit ? "Disable Split View" : "Enable Split View"}
              </button>
            </h1>
            <div style={{ marginBottom: "1rem", height: 400, overflowY: "auto", border: "1px solid #ccc" }}>
              {messages.map((msg) => (
                <div key={msg.id} style={{ margin: "0.5rem 0" }}>
                  <strong>{msg.role}:</strong> {msg.content}
                  <button
                    style={{ marginLeft: "1rem", color: "blue", textDecoration: "underline" }}
                    onClick={() => openBranchForm(msg.id)}
                  >
                    Branch
                  </button>
                </div>
              ))}
            </div>
            <div>
              <input
                style={{ width: 300, marginRight: 8 }}
                placeholder="Type a message..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </div>
        )}
        
        {/* If split view is enabled, add an input to send a message to both chats */}
        {showSplit && (
          <div style={{ padding: "1rem", borderTop: "1px solid #ccc" }}>
            <input
              style={{ width: 300, marginRight: 8 }}
              placeholder="Type a message for both chats..."
              value={bothUserInput}
              onChange={(e) => setBothUserInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendBothMessage(); }}
            />
            <button onClick={sendBothMessage}>Send to Both</button>
          </div>
        )}
      </div>
      {/* Branch form remains as-is */}
      {showBranchForm && (
        <div style={{ marginTop: "1rem", padding: "1rem", border: "1px solid #999" }}>
          <h2>Create a Branch</h2>
          <p>Branch from message ID: {branchMsgId}</p>
          <input
            style={{ display: "block", marginBottom: 8 }}
            placeholder="Branch Name"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
          />
          <input
            style={{ display: "block", marginBottom: 8 }}
            placeholder="Tags (comma separated)"
            value={branchTags}
            onChange={(e) => setBranchTags(e.target.value)}
          />
          <button onClick={createBranch} style={{ marginRight: 8 }}>
            Create
          </button>
          <button onClick={closeBranchForm}>Cancel</button>
        </div>
      )}
    </div>
  );
}