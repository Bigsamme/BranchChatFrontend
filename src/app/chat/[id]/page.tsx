"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

interface Message {
  id: string;
  content: string;
  role: string; // "user" or "assistant"
  created_at: string;
  model?: string;
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
  const [branchFromUserMessage, setBranchFromUserMessage] = useState(false);
  const [branchProvider, setBranchProvider] = useState("gemini");
  const [branchModel, setBranchModel] = useState("gemini-2.0-flash");
  const [allChats, setAllChats] = useState<Chat[]>([]);
  const [currentRootChatId, setCurrentRootChatId] = useState<string | null>(null);
  const [compareChatId, setCompareChatId] = useState<string | null>(null);
  const [compareMessages, setCompareMessages] = useState<Message[]>([]);
  const [compareUserInput, setCompareUserInput] = useState("");
  const [showSplit, setShowSplit] = useState(false);
  const [bothUserInput, setBothUserInput] = useState("");

  // New state for provider and model selection
  const [selectedProvider, setSelectedProvider] = useState("gemini");
  const [selectedCompareProvider, setSelectedCompareProvider] = useState("gemini");
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash");
  const [selectedCompareModel, setSelectedCompareModel] = useState("gemini-2.0-flash");
  const bottomRef = useRef<HTMLDivElement>(null);

  const getModelsForProvider = (provider: string) => {
    if (provider === "gemini") return ["gemini-2.0-flash", "gemini-2.5-pro-exp-03-25", "gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"];
    if (provider === "openai") return ["gpt-4o-mini", "gpt-4o"];
    if (provider === "claude") return ["claude-3-5-haiku-latest", "claude-3-7-sonnet-latest"];
    return [];
  };

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

  useEffect(() => {
    const models = getModelsForProvider(selectedProvider);
    if (!models.includes(selectedModel)) {
      setSelectedModel(models[0]);
    }
  }, [selectedProvider]);
  
  useEffect(() => {
    const models = getModelsForProvider(selectedCompareProvider);
    if (!models.includes(selectedCompareModel)) {
      setSelectedCompareModel(models[0]);
    }
  }, [selectedCompareProvider]);
  
  useEffect(() => {
    const models = getModelsForProvider(branchProvider);
    if (!models.includes(branchModel)) {
      setBranchModel(models[0]);
    }
  }, [branchProvider]);

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
    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userInput,
      created_at: new Date().toISOString(),
    };
    const assistantMsg = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      model: selectedModel,
    };
  
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  
    try {
      const res = await fetch(
        `http://localhost:8000/chats/${chatId}/messages?provider=${selectedProvider}&model=${selectedModel}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: userInput }),
        }
      );
  
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
  
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        fullText += text;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: fullText } : m))
          );
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
  
      // After streaming is complete, fetch the latest messages to get the real IDs
      const messagesRes = await fetch(`http://localhost:8000/chats/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const messagesData = await messagesRes.json();
      const lastMessages = messagesData.slice(-2); // Get the last two messages
      
      // Update the messages with real IDs from the backend
      setMessages(prev => prev.map(msg => {
        if (msg.id.startsWith('user-')) {
          return { ...msg, id: lastMessages[0].id };
        }
        if (msg.id.startsWith('assistant-') || msg.id.startsWith('temp-')) {
          return { ...msg, id: lastMessages[1].id };
        }
        return msg;
      }));
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  
      setUserInput("");
    } catch (err) {
      console.error("Stream failed", err);
    }
  }, [chatId, userInput, isLoaded, userId, getToken, messages, selectedProvider, selectedModel]);

  // Send a message in the compare chat
  const sendCompareMessage = useCallback(async () => {
    if (!isLoaded || !userId || !compareChatId || !compareUserInput.trim()) return;
    const token = await getToken();
    // Create a user message and a temporary assistant message
    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      content: compareUserInput,
      created_at: new Date().toISOString(),
    };
    const assistantMsg = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      model: selectedCompareModel,
    };
    setCompareMessages((prev) => [...prev, userMsg, assistantMsg]);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    // newMsgIndex is the index of the assistant message in the array
  
    try {
    const res = await fetch(
        `http://localhost:8000/chats/${compareChatId}/messages?provider=${selectedCompareProvider}&model=${selectedCompareModel}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: compareUserInput }),
        }
      );
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        fullText += text;
          setCompareMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: fullText } : m))
          );
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
      setCompareUserInput("");
    } catch (err) {
      console.error("Stream failed", err);
    }
  }, [compareChatId, compareUserInput, isLoaded, userId, getToken, compareMessages, selectedProvider, selectedModel]);

  const sendBothMessage = useCallback(async () => {
    if (!isLoaded || !userId || !bothUserInput.trim()) return;
    if (!compareChatId) {
      console.error("Compare chat is not selected.");
      return;
    }
    const token = await getToken();
    // Create separate temporary assistant messages for main and compare chats,
    // and a shared user message.
    const tempMessageMain = {
      id: `temp-main-${Date.now()}`,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      model: selectedModel,
    };
    const tempMessageCompare = {
      id: `temp-compare-${Date.now()}`,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      model: selectedCompareModel,
    };
    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      content: bothUserInput,
      created_at: new Date().toISOString(),
    };
  
    // Optimistically update the UI for both chats
    setMessages((prev) => [...prev, userMsg, tempMessageMain]);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setCompareMessages((prev) => [...prev, userMsg, tempMessageCompare]);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  
    // Helper function to stream response for a given chat
    const streamResponse = async (
      chatIdParam: string,
      updateFunc: React.Dispatch<React.SetStateAction<Message[]>>,
      tempId: string,
      model: string,
      provider: string
    ) => {
      const res = await fetch(`http://localhost:8000/chats/${chatIdParam}/messages?provider=${provider}&model=${model}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: bothUserInput }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        updateFunc((prev) =>
          prev.map((msg) => (msg.id === tempId ? { ...msg, content: msg.content + text } : msg))
        );
      }
    };
  
    try {
      await Promise.all([
        streamResponse(chatId, setMessages, tempMessageMain.id, selectedModel, selectedProvider),
        streamResponse(compareChatId, setCompareMessages, tempMessageCompare.id, selectedCompareModel, selectedCompareProvider)
      ]);
    } catch (error) {
      console.error("Error sending message to both chats:", error);
      // Remove temporary messages on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageMain.id));
      setCompareMessages((prev) => prev.filter((msg) => msg.id !== tempMessageCompare.id));
    }
    setBothUserInput("");
  }, [bothUserInput, chatId, compareChatId, isLoaded, userId, getToken, selectedProvider, selectedModel]);
  
  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };
  
  const handleCompareEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendCompareMessage();
  };
  
  // Open the branch form for a specific message
  const openBranchForm = (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId) || compareMessages.find((m) => m.id === messageId);
    setBranchFromUserMessage(msg?.role === "user");
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
      const originalMsg =
          messages.find((m) => m.id === branchMsgId) ||
          compareMessages.find((m) => m.id === branchMsgId);
      if (data.new_chat_id) {
        const userMsg = {
          id: `user-${Date.now()}`,
          role: "user",
          content: originalMsg?.content || "",
          created_at: new Date().toISOString(),
        };
        const assistantMsg = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "",
          created_at: new Date().toISOString(),
        };
        // Preload previous messages into new chat before streaming
        const prevMessagesRes = await fetch(`http://localhost:8000/chats/${data.new_chat_id}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const prevMessagesData = await prevMessagesRes.json();
        const preserved = Array.isArray(prevMessagesData) ? prevMessagesData : [];
        const updatedMessages = [
          ...preserved,
          userMsg,
          assistantMsg
        ];
        setMessages(updatedMessages);
      }
 
      if (originalMsg && originalMsg.role === "user") {
        try {
          const token = await getToken();
 
          const userMsg = {
            id: `user-${Date.now()}`,
            role: "user",
            content: originalMsg.content,
            created_at: new Date().toISOString(),
          };
          const assistantMsg = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: "",
            created_at: new Date().toISOString(),
            model: branchModel,
          };
 
          const res = await fetch(
            `http://localhost:8000/chats/${data.new_chat_id}/messages?provider=${branchProvider}&model=${branchModel}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ content: originalMsg.content }),
            }
          );
 
          const reader = res.body?.getReader();
          if (!reader) throw new Error("No stream");
 
          const decoder = new TextDecoder();
          let fullText = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value);
            fullText += text;
            setMessages((prev) => {
              const updated = [...prev];
              updated[prev.length - 1].content = fullText;
              return updated;
            });
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }
 
          const messagesRes = await fetch(`http://localhost:8000/chats/${data.new_chat_id}/messages`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const messagesData = await messagesRes.json();
          const lastMessages = messagesData.slice(-2);
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id.startsWith("user-")) return { ...msg, id: lastMessages[0].id };
              if (msg.id.startsWith("assistant-")) return { ...msg, id: lastMessages[1].id };
              return msg;
            })
          );
          router.push(`/chat/${data.new_chat_id}`);
        } catch (error) {
          console.error("Error adding immediate AI reply to new branch:", error);
        }
      } else {
        // Just navigate to the new branch if branching from assistant message
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
              {/* Provider and Model Selection */}              
              <div style={{ marginBottom: "1rem" }}>
              <label>
                Provider:{" "}
                <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)}>
                  <option value="gemini">Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude</option>
                </select>
              </label>
              <label style={{ marginLeft: "1rem" }}>
                Model:{" "}
                <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                  {getModelsForProvider(selectedProvider).map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </label>
              </div>
              <div style={{ marginBottom: "1rem", height: 400, overflowY: "auto", border: "1px solid #ccc" }}>
                {messages.map((msg) => (
                  <div key={msg.id} style={{ margin: "0.5rem 0" }}>
                    <strong>{msg.role}:</strong> {msg.content}
                    {msg.role === "assistant" && msg.model && (
                      <div style={{ fontSize: "0.8rem", color: "gray" }}>Model: {msg.model}</div>
                    )}
                    {!msg.id.startsWith("user-") && !msg.id.startsWith("assistant-") && !msg.id.startsWith("temp-") && (
                      <button
                        style={{ marginLeft: "1rem", color: "blue", textDecoration: "underline" }}
                        onClick={() => openBranchForm(msg.id)}
                      >
                        Branch
                      </button>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
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
              {/* Provider and Model Selection for Compare Chat (optional, can be shared with Main Chat) */}
              <div style={{ marginBottom: "1rem" }}>
                <label>
                  Provider:{" "}
                  <select value={selectedCompareProvider} onChange={(e) => setSelectedCompareProvider(e.target.value)}>
                    <option value="gemini">Gemini</option>
                    <option value="openai">OpenAI</option>
                    <option value="claude">Claude</option>
                  </select>
                </label>
                <label style={{ marginLeft: "1rem" }}>
                  Model:{" "}
                  <select value={selectedCompareModel} onChange={(e) => setSelectedCompareModel(e.target.value)}>
                    {getModelsForProvider(selectedCompareProvider).map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </label>
              </div>
              {compareChatId ? (
                <>
                  <h1>Compare Chat: {compareChatId}</h1>
                  <div style={{ marginBottom: "1rem", height: 400, overflowY: "auto", border: "1px solid #ccc" }}>
                    {compareMessages.map((msg, index) => (
                      <div key={`${msg.id}-${msg.content.length}-${index}`} style={{ margin: "0.5rem 0" }}>
                        <strong>{msg.role}:</strong> {msg.content}
                        {msg.role === "assistant" && msg.model && (
                          <div style={{ fontSize: "0.8rem", color: "gray" }}>Model: {msg.model}</div>
                        )}
                        {!msg.id.startsWith("user-") && !msg.id.startsWith("assistant-") && !msg.id.startsWith("temp-") && (
                          <button
                            style={{ marginLeft: "1rem", color: "blue", textDecoration: "underline" }}
                            onClick={() => openBranchForm(msg.id)}
                          >
                            Branch
                          </button>
                        )}
                      </div>
                    ))}
                    <div ref={bottomRef} />
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
            {/* Provider and Model Selection */}  
            <div style={{ marginBottom: "1rem" }}>
              <label>
                Provider:{" "}
                <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)}>
                  <option value="gemini">Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude</option>
                </select>
              </label>
              <label style={{ marginLeft: "1rem" }}>
                Model:{" "}
                <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                  {getModelsForProvider(selectedProvider).map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </label>
            </div>
              <div style={{ marginBottom: "1rem", height: 400, overflowY: "auto", border: "1px solid #ccc" }}>
                {messages.map((msg) => (
                  <div key={msg.id} style={{ margin: "0.5rem 0" }}>
                    <strong>{msg.role}:</strong> {msg.content}
                    {msg.role === "assistant" && msg.model && (
                      <div style={{ fontSize: "0.8rem", color: "gray" }}>Model: {msg.model}</div>
                    )}
                    {!msg.id.startsWith("user-") && !msg.id.startsWith("assistant-") && !msg.id.startsWith("temp-") && (
                      <button
                        style={{ marginLeft: "1rem", color: "blue", textDecoration: "underline" }}
                        onClick={() => openBranchForm(msg.id)}
                      >
                        Branch
                      </button>
                    )}
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
      {branchFromUserMessage && (
        <div style={{ marginBottom: "8px" }}>
          <label>
            Provider:{" "}
            <select value={branchProvider} onChange={(e) => setBranchProvider(e.target.value)}>
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
            </select> 
          </label>
          <label style={{ marginLeft: "1rem" }}>
            Model:{" "}
            <select value={branchModel} onChange={(e) => setBranchModel(e.target.value)}>
              {getModelsForProvider(branchProvider).map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      <button onClick={createBranch} style={{ marginRight: 8 }}>
        Create
      </button>
          <button onClick={closeBranchForm}>Cancel</button>
        </div>
      )}
    </div>
  );
}