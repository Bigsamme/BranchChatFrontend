"use client"

import type React from "react"

import { useAuth } from "@clerk/nextjs"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"

interface Chat {
  id: string
  name: string
  created_at: string
  branch_of?: string
}

export default function DashboardPage() {
  const [chatsLoaded, setChatsLoaded] = useState(false)
  const [activePlan, setActivePlan] = useState<string | null>(null)
  const router = useRouter()
  const { isLoaded, userId, getToken } = useAuth()
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(false)
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null)
  const [tokenCount, setTokenCount] = useState<number | null>(null)
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null)
  // Add a new state to track expanded chat IDs
  const [expandedChatIds, setExpandedChatIds] = useState<Set<string>>(new Set())

  const handleSubscribe = async (plan: string) => {
    if (!isLoaded || !userId) return
    const token = await getToken()
    try {
      const res = await fetch("http://localhost:8000/create-checkout-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error("Error creating Stripe Checkout session:", error)
    }
  }

  const handleManageSubscription = async () => {
    if (!isLoaded || !userId) return
    const token = await getToken()
    try {
      const res = await fetch("http://localhost:8000/create-portal-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error("Error creating Stripe portal session:", error)
    }
  }

  // Fetch existing chats
  const fetchChats = useCallback(async () => {
    // 1) If user/auth not ready, show empty state
    if (!isLoaded || !userId) {
      setChatsLoaded(true);
      return;
    }
  
    const token = await getToken();
    try {
      const res = await fetch("http://localhost:8000/chats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
  
      console.log("Raw /chats response:", json);
  
      // Unwrap the response data: if the JSON is an array, use it directly; otherwise, try json.data, defaulting to [].
      const data = Array.isArray(json) ? json : (json.data ?? []);
  
      console.log("Unwrapped chats data:", data);
  
      if (Array.isArray(data)) {
        setChats(data);
      } else {
        setChats([]); // fallback if the response is not an array
      }
    } catch (error) {
      console.error("Error fetching chats:", error);
      setChats([]); // fallback: no chats
    } finally {
      setChatsLoaded(true);
    }
  }, [isLoaded, userId, getToken]);

  useEffect(() => {
    fetchChats()
  }, [fetchChats])

  // New effect to fetch the token count
  useEffect(() => {
    const fetchTokenCount = async () => {
      if (!isLoaded || !userId) return
      const token = await getToken()
      try {
        const res = await fetch("http://localhost:8000/user/token_count", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        setTokenCount(data.token_count ?? null)
        setActivePlan(data.plan ?? null)
      } catch (error) {
        console.error("Error fetching token count:", error)
      }
    }
    fetchTokenCount()
  }, [isLoaded, userId, getToken])

  // New effect to inject Stripe script
  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://js.stripe.com/v3/buy-button.js"
    script.async = true
    document.body.appendChild(script)
  }, [])

  // Create a new empty chat
  const createChat = async () => {
    if (!isLoaded || !userId) return
    setLoading(true)
    const token = await getToken()
    try {
      const res = await fetch("http://localhost:8000/chats", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await res.json()
      if (data.chat_id) {
        // Navigate to the new chat
        router.push(`/chat/${data.chat_id}`)
      }
    } catch (error) {
      console.error("Error creating chat:", error)
    } finally {
      setLoading(false)
    }
  }

  // Delete a chat
  const deleteChat = async (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent navigation when clicking delete
    if (!isLoaded || !userId) return
    setDeletingChatId(chatId)
    const token = await getToken()
    try {
      const res = await fetch(`http://localhost:8000/chats/${chatId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (res.ok) {
        setChats((prev) => prev.filter((chat) => chat.id !== chatId))
      }
    } catch (error) {
      console.error("Error deleting chat:", error)
    } finally {
      setDeletingChatId(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date)
  }

  // Add a toggle function to expand/collapse branches
  const toggleChatExpansion = (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent navigation when clicking the toggle
    setExpandedChatIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(chatId)) {
        newSet.delete(chatId)
      } else {
        newSet.add(chatId)
      }
      return newSet
    })
  }

  // Update the renderChatTree function to handle collapsible branches
  const renderChatTree = (chat: Chat, chats: Chat[], level = 0) => {
    const children = chats.filter((c) => c.branch_of === chat.id)
    const hasChildren = children.length > 0
    const isExpanded = expandedChatIds.has(chat.id)

    return (
      <div
        key={chat.id}
        style={{
          paddingLeft: `${level * 20}px`,
          margin: "8px 0",
          position: "relative",
        }}
      >
        {level > 0 && (
          <div
            style={{
              position: "absolute",
              left: `${(level - 1) * 20 + 8}px`,
              top: "-8px",
              width: "16px",
              height: "24px",
              borderLeft: "2px solid #e0e0e0",
              borderBottom: "2px solid #e0e0e0",
              borderBottomLeftRadius: "6px",
              zIndex: 1,
            }}
          />
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 14px",
            borderRadius: "8px",
            transition: "all 0.2s ease",
            position: "relative",
            cursor: "pointer",
            backgroundColor: hoveredChatId === chat.id ? "#f0f7ff" : "transparent",
            border: hoveredChatId === chat.id ? "1px solid #d0e3ff" : "1px solid transparent",
            boxShadow: hoveredChatId === chat.id ? "0 2px 5px rgba(0,112,243,0.08)" : "none",
            zIndex: 2,
          }}
          onMouseEnter={() => setHoveredChatId(chat.id)}
          onMouseLeave={() => setHoveredChatId(null)}
          onClick={() => router.push(`/chat/${chat.id}`)}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0070f3",
              backgroundColor: hoveredChatId === chat.id ? "#e0f0ff" : "#f0f7ff",
              borderRadius: "50%",
              transition: "all 0.2s ease",
            }}
          >
            💬
          </div>
          <span
            style={{
              fontWeight: "500",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: hoveredChatId === chat.id ? "#0070f3" : "#333",
              transition: "color 0.2s ease",
            }}
          >
            {chat.name || "Untitled Chat"}
          </span>
          <span
            style={{
              fontSize: "12px",
              color: hoveredChatId === chat.id ? "#0070f3" : "#888",
              display: window.innerWidth > 768 ? "block" : "none",
              transition: "color 0.2s ease",
            }}
          >
            {formatDate(chat.created_at)}
          </span>

          {hasChildren && (
            <button
              onClick={(e) => toggleChatExpansion(chat.id, e)}
              style={{
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "bold",
                color: "#fff",
                backgroundColor: "#0070f3",
                borderRadius: "50%",
                marginRight: "4px",
                border: "none",
                cursor: "pointer",
                transition: "transform 0.2s ease, background-color 0.2s ease",
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              {isExpanded ? "▲" : "▼"}
            </button>
          )}

          <button
            onClick={(e) => deleteChat(chat.id, e)}
            disabled={deletingChatId === chat.id}
            style={{
              backgroundColor: hoveredChatId === chat.id ? "#ffebee" : "transparent",
              border: "none",
              color: "#ff4d4f",
              cursor: "pointer",
              padding: "6px 10px",
              borderRadius: "6px",
              opacity: deletingChatId === chat.id ? 0.5 : hoveredChatId === chat.id ? 1 : 0,
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {deletingChatId === chat.id ? "..." : "🗑️"}
          </button>
        </div>

        {hasChildren && isExpanded && (
          <div
            style={{
              borderLeft: "2px solid #e0e0e0",
              marginLeft: "12px",
              paddingLeft: "12px",
              position: "relative",
              maxHeight: "1000px",
              overflow: "hidden",
              transition: "max-height 0.3s ease",
              opacity: 1,
            }}
          >
            {children.map((child) => renderChatTree(child, chats, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "32px 16px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
        color: "#333",
        backgroundColor: "#fafafa",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: window.innerWidth > 768 ? "row" : "column",
          justifyContent: "space-between",
          alignItems: window.innerWidth > 768 ? "center" : "flex-start",
          marginBottom: "32px",
          gap: "16px",
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: "700",
              margin: "0 0 8px 0",
              color: "#111",
              background: "linear-gradient(90deg, #0070f3, #00a2ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Dashboard
          </h1>
          <p
            style={{
              fontSize: "16px",
              color: "#666",
              margin: "0",
            }}
          >
            Manage your chats and subscription
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          {tokenCount !== null && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "#fff8e1",
                padding: "8px 14px",
                borderRadius: "20px",
                border: "1px solid #ffe082",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              }}
            >
              <span style={{ color: "#ffa000", fontSize: "16px" }}>🪙</span>
              <span style={{ fontWeight: "600", color: "#f57c00" }}>{tokenCount} Credits</span>
            </div>
          )}
          <button
            onClick={createChat}
            disabled={loading}
            style={{
              backgroundColor: "#0070f3",
              color: "white",
              border: "none",
              padding: "12px 20px",
              borderRadius: "8px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease",
              boxShadow: "0 4px 14px rgba(0, 118, 255, 0.25)",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = "#0060df"
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 118, 255, 0.35)"
                e.currentTarget.style.transform = "translateY(-1px)"
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = "#0070f3"
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(0, 118, 255, 0.25)"
                e.currentTarget.style.transform = "translateY(0)"
              }
            }}
          >
            {loading ? "Creating..." : "➕ New Chat"}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: window.innerWidth > 768 ? "2fr 1fr" : "1fr",
          gap: "24px",
        }}
      >
        <div
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: "12px",
            overflow: "hidden",
            backgroundColor: "white",
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e5e5e5",
              background: "linear-gradient(to right, #f7f9fc, #ffffff)",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "600",
                margin: "0 0 4px 0",
                color: "#0070f3",
              }}
            >
              Your Chats
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "#666",
                margin: "0",
              }}
            >
              View and manage your conversation history
            </p>
          </div>
          <div style={{ padding: "20px 24px" }}>
          {!chatsLoaded ? (
  <p>Loading chats...</p>
) : chats.length === 0 ? (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 0",
      textAlign: "center",
      backgroundColor: "#f9fafc",
      borderRadius: "8px",
    }}
  >
    <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.7 }}>
      💬
    </div>
    <h3 style={{ fontSize: "20px", fontWeight: "600", margin: "0 0 8px 0", color: "#333" }}>
      No chats yet
    </h3>
    <p style={{ fontSize: "15px", color: "#666", margin: "0 0 20px 0", maxWidth: "300px" }}>
      Create your first chat to get started with your AI assistant
    </p>
    <button
      onClick={createChat}
      disabled={loading}
      style={{
        backgroundColor: "#0070f3",
        color: "white",
        border: "none",
        padding: "12px 24px",
        borderRadius: "8px",
        fontWeight: "500",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.7 : 1,
        boxShadow: "0 4px 14px rgba(0, 118, 255, 0.25)",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.backgroundColor = "#0060df"
          e.currentTarget.style.transform = "translateY(-1px)"
        }
      }}
      onMouseLeave={(e) => {
        if (!loading) {
          e.currentTarget.style.backgroundColor = "#0070f3"
          e.currentTarget.style.transform = "translateY(0)"
        }
      }}
    >
      {loading ? "Creating..." : "Create New Chat"}
    </button>
  </div>
) : (
  <div
    style={{
      maxHeight: "600px",
      overflowY: "auto",
      paddingRight: "8px",
      scrollbarWidth: "thin",
      scrollbarColor: "#d4d4d4 #f4f4f4",
    }}
  >
    {chats.filter((chat) => !chat.branch_of).map((rootChat) =>
      renderChatTree(rootChat, chats)
    )}
  </div>
)}
          </div>
        </div>

        <div
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: "12px",
            overflow: "hidden",
            backgroundColor: "white",
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e5e5e5",
              background: "linear-gradient(to right, #f7f9fc, #ffffff)",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "600",
                margin: "0 0 4px 0",
                color: "#0070f3",
              }}
            >
              Subscription Plans
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "#666",
                margin: "0",
              }}
            >
              Choose a plan that works for you
            </p>
          </div>
          <div style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: "10px",
                  padding: "20px",
                  transition: "all 0.3s ease",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#0070f3"
                  e.currentTarget.style.backgroundColor = "#f5f9ff"
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 118, 255, 0.1)"
                  e.currentTarget.style.transform = "translateY(-2px)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e5e5e5"
                  e.currentTarget.style.backgroundColor = "white"
                  e.currentTarget.style.boxShadow = "none"
                  e.currentTarget.style.transform = "translateY(0)"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        margin: "0 0 6px 0",
                        color: "#333",
                      }}
                    >
                      Starter
                    </h3>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#666",
                        margin: "0",
                      }}
                    >
                      For casual users
                    </p>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#333",
                        margin: "4px 0 0 0",
                      }}
                    >
                      Credits: 100,000
                    </p>
                  </div>
                  <div
                    style={{
                      backgroundColor: "#f5f5f5",
                      padding: "6px 12px",
                      borderRadius: "20px",
                      fontSize: "15px",
                      fontWeight: "600",
                      color: "#333",
                    }}
                  >
                    $19/mo
                  </div>
                </div>
                {activePlan === "starter" ? (
  <button
    onClick={handleManageSubscription}
    style={{
      marginTop: "20px",
      width: "100%",
      padding: "10px 16px",
      backgroundColor: "white",
      color: "#0070f3",
      border: "1px solid #0070f3",
      borderRadius: "8px",
      fontWeight: "500",
      cursor: "pointer",
      transition: "all 0.2s ease",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = "#0070f3";
      e.currentTarget.style.color = "white";
      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 118, 255, 0.25)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = "white";
      e.currentTarget.style.color = "#0070f3";
      e.currentTarget.style.boxShadow = "none";
    }}
  >
    Manage Subscription
  </button>
) : (
  <button
    onClick={() => handleSubscribe("starter")}
    style={{
      marginTop: "20px",
      width: "100%",
      padding: "10px 16px",
      backgroundColor: "white",
      color: "#0070f3",
      border: "1px solid #0070f3",
      borderRadius: "8px",
      fontWeight: "500",
      cursor: "pointer",
      transition: "all 0.2s ease",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = "#0070f3";
      e.currentTarget.style.color = "white";
      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 118, 255, 0.25)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = "white";
      e.currentTarget.style.color = "#0070f3";
      e.currentTarget.style.boxShadow = "none";
    }}
  >
    Subscribe
  </button>
)}
              </div>

              <div
                style={{
                  border: "2px solid #0070f3",
                  borderRadius: "10px",
                  padding: "20px",
                  backgroundColor: "#f5f9ff",
                  position: "relative",
                  boxShadow: "0 6px 20px rgba(0, 118, 255, 0.15)",
                  transform: "scale(1.02)",
                  zIndex: 1,
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 8px 30px rgba(0, 118, 255, 0.2)"
                  e.currentTarget.style.transform = "scale(1.03)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 118, 255, 0.15)"
                  e.currentTarget.style.transform = "scale(1.02)"
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "-12px",
                    right: "20px",
                    backgroundColor: "#0070f3",
                    color: "white",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: "600",
                    boxShadow: "0 4px 8px rgba(0, 118, 255, 0.25)",
                  }}
                >
                  Popular
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        margin: "0 0 6px 0",
                        color: "#0070f3",
                      }}
                    >
                      Pro
                    </h3>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#666",
                        margin: "0",
                      }}
                    >
                      For power users
                    </p>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#333",
                        margin: "4px 0 0 0",
                      }}
                    >
                      Credits: 500,000
                    </p>
                  </div>
                  <div
                    style={{
                      backgroundColor: "#e1f5fe",
                      padding: "6px 12px",
                      borderRadius: "20px",
                      fontSize: "15px",
                      fontWeight: "600",
                      color: "#0070f3",
                      border: "1px solid #b3e5fc",
                    }}
                  >
                    $49/mo
                  </div>
                </div>
                {activePlan === "pro" ? (
  <button
    onClick={handleManageSubscription}
    style={{
      marginTop: "20px",
      width: "100%",
      padding: "12px 16px",
      backgroundColor: "#0070f3",
      color: "white",
      border: "none",
      borderRadius: "8px",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.2s ease",
      boxShadow: "0 4px 14px rgba(0, 118, 255, 0.25)",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = "#0060df";
      e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 118, 255, 0.35)";
      e.currentTarget.style.transform = "translateY(-1px)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = "#0070f3";
      e.currentTarget.style.boxShadow = "0 4px 14px rgba(0, 118, 255, 0.25)";
      e.currentTarget.style.transform = "translateY(0)";
    }}
  >
    Manage Subscription
  </button>
) : (
  <button
    onClick={() => handleSubscribe("pro")}
    style={{
      marginTop: "20px",
      width: "100%",
      padding: "12px 16px",
      backgroundColor: "#0070f3",
      color: "white",
      border: "none",
      borderRadius: "8px",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.2s ease",
      boxShadow: "0 4px 14px rgba(0, 118, 255, 0.25)",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = "#0060df";
      e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 118, 255, 0.35)";
      e.currentTarget.style.transform = "translateY(-1px)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = "#0070f3";
      e.currentTarget.style.boxShadow = "0 4px 14px rgba(0, 118, 255, 0.25)";
      e.currentTarget.style.transform = "translateY(0)";
    }}
  >
    Subscribe
  </button>
)}
              </div>

              <div
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: "10px",
                  padding: "20px",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#0070f3"
                  e.currentTarget.style.backgroundColor = "#f5f9ff"
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 118, 255, 0.1)"
                  e.currentTarget.style.transform = "translateY(-2px)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e5e5e5"
                  e.currentTarget.style.backgroundColor = "white"
                  e.currentTarget.style.boxShadow = "none"
                  e.currentTarget.style.transform = "translateY(0)"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        margin: "0 0 6px 0",
                        color: "#333",
                      }}
                    >
                      Power
                    </h3>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#666",
                        margin: "0",
                      }}
                    >
                      For teams and businesses
                    </p>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#333",
                        margin: "4px 0 0 0",
                      }}
                    >
                      Credits: 5,000,000
                    </p>
                  </div>
                  <div
                    style={{
                      backgroundColor: "#f5f5f5",
                      padding: "6px 12px",
                      borderRadius: "20px",
                      fontSize: "15px",
                      fontWeight: "600",
                      color: "#333",
                    }}
                  >
                    $99/mo
                  </div>
                </div>
                {activePlan === "power" ? (
  <button
    onClick={handleManageSubscription}
    style={{
      marginTop: "20px",
      width: "100%",
      padding: "10px 16px",
      backgroundColor: "white",
      color: "#0070f3",
      border: "1px solid #0070f3",
      borderRadius: "8px",
      fontWeight: "500",
      cursor: "pointer",
      transition: "all 0.2s ease",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = "#0070f3";
      e.currentTarget.style.color = "white";
      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 118, 255, 0.25)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = "white";
      e.currentTarget.style.color = "#0070f3";
      e.currentTarget.style.boxShadow = "none";
    }}
  >
    Manage Subscription
  </button>
) : (
  <button
    onClick={() => handleSubscribe("power")}
    style={{
      marginTop: "20px",
      width: "100%",
      padding: "10px 16px",
      backgroundColor: "white",
      color: "#0070f3",
      border: "1px solid #0070f3",
      borderRadius: "8px",
      fontWeight: "500",
      cursor: "pointer",
      transition: "all 0.2s ease",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = "#0070f3";
      e.currentTarget.style.color = "white";
      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 118, 255, 0.25)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = "white";
      e.currentTarget.style.color = "#0070f3";
      e.currentTarget.style.boxShadow = "none";
    }}
  >
    Subscribe
  </button>
)}
              </div>
            </div>
          </div>
          <div
            style={{
              padding: "20px 24px",
              borderTop: "1px solid #e5e5e5",
              background: "linear-gradient(to right, #f7f9fc, #ffffff)",
            }}
          >
            <button
              onClick={handleManageSubscription}
              style={{
                width: "100%",
                padding: "12px 16px",
                backgroundColor: "white",
                color: "#333",
                border: "1px solid #e5e5e5",
                borderRadius: "8px",
                fontWeight: "500",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f5f5f5"
                e.currentTarget.style.borderColor = "#d5d5d5"
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.05)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "white"
                e.currentTarget.style.borderColor = "#e5e5e5"
                e.currentTarget.style.boxShadow = "none"
              }}
            >
              💳 Manage Subscription
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

