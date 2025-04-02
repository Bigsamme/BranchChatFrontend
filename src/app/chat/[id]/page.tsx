"use client"

import type React from "react"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

interface Message {
  id: string
  content: string
  role: string // "user" or "assistant"
  created_at: string
  model?: string
}

interface Chat {
  id: string
  ancestorId: string | null // Assuming each chat has an ancestor ID
  branch_of?: string | null // Added to represent the branching relationship
  name?: string | null // <-- Add this line
}

interface CollapsibleState {
  [key: string]: boolean
}

export default function ChatPage() {
  const router = useRouter()
  const params = useParams()
  const chatId = params.id as string

  const { isLoaded, userId, getToken } = useAuth()

  const [messages, setMessages] = useState<Message[]>([])
  const [userInput, setUserInput] = useState("")
  const [showBranchForm, setShowBranchForm] = useState(false)
  const [branchName, setBranchName] = useState("")
  const [branchTags, setBranchTags] = useState("")
  const [branchMsgId, setBranchMsgId] = useState<string | null>(null)
  const [branchFromUserMessage, setBranchFromUserMessage] = useState(false)
  const [branchProvider, setBranchProvider] = useState("gemini")
  const [branchModel, setBranchModel] = useState("gemini-2.0-flash")
  const [allChats, setAllChats] = useState<Chat[]>([])
  const [currentRootChatId, setCurrentRootChatId] = useState<string | null>(null)
  const [compareChatId, setCompareChatId] = useState<string | null>(null)
  const [compareMessages, setCompareMessages] = useState<Message[]>([])
  const [compareUserInput, setCompareUserInput] = useState("")
  const [showSplit, setShowSplit] = useState(false)
  const [bothUserInput, setBothUserInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isCompareTyping, setIsCompareTyping] = useState(false)
  const [collapsedBranches, setCollapsedBranches] = useState<CollapsibleState>({})

  // New state for provider and model selection
  const [selectedProvider, setSelectedProvider] = useState("gemini")
  const [selectedCompareProvider, setSelectedCompareProvider] = useState("gemini")
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash")
  const [selectedCompareModel, setSelectedCompareModel] = useState("gemini-2.0-flash")
  const bottomRef = useRef<HTMLDivElement>(null)
  const compareBottomRef = useRef<HTMLDivElement>(null)

  // Common styles
  const styles = {
    container: {
      display: "flex",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      color: "#333",
      height: "100vh",
      backgroundColor: "#f9fafb",
      overflow: "hidden",
    },
    sidebar: {
      width: "280px",
      padding: "1.5rem 1rem",
      borderRight: "1px solid #e5e7eb",
      backgroundColor: "#fff",
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
      overflowY: "auto" as const,
      transition: "width 0.3s ease",
    },
    sidebarTitle: {
      fontSize: "1.25rem",
      fontWeight: "600",
      marginBottom: "1rem",
      color: "#111827",
      paddingBottom: "0.5rem",
      borderBottom: "1px solid #e5e7eb",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    branchContainer: {
      marginBottom: "0.5rem",
      borderRadius: "0.375rem",
      overflow: "hidden",
      transition: "all 0.2s ease",
    },
    branchHeader: {
      display: "flex",
      alignItems: "center",
      padding: "0.5rem",
      borderRadius: "0.375rem",
      cursor: "pointer",
      backgroundColor: "#f3f4f6",
      transition: "background-color 0.2s",
    },
    branchButton: {
      display: "block",
      width: "100%",
      textAlign: "left" as const,
      padding: "0.5rem",
      marginBottom: "0.25rem",
      borderRadius: "0.375rem",
      border: "none",
      backgroundColor: "transparent",
      cursor: "pointer",
      transition: "background-color 0.2s",
      fontSize: "0.875rem",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    activeBranchButton: {
      backgroundColor: "#e0f2fe",
      fontWeight: "600",
      color: "#0284c7",
      boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    },
    compareButton: {
      fontSize: "0.75rem",
      color: "#059669",
      backgroundColor: "#ecfdf5",
      border: "none",
      borderRadius: "0.25rem",
      padding: "0.25rem 0.5rem",
      marginLeft: "0.5rem",
      cursor: "pointer",
      transition: "all 0.2s ease",
      display: showSplit ? "inline-block" : "none",
    },
    collapseIcon: {
      marginRight: "0.5rem",
      fontSize: "0.75rem",
      width: "16px",
      height: "16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#e5e7eb",
      borderRadius: "50%",
      color: "#4b5563",
      transition: "transform 0.2s ease",
    },
    branchChildren: {
      marginLeft: "1.5rem",
      position: "relative" as const,
      paddingLeft: "1rem",
      borderLeft: "1px dashed #d1d5db",
    },
    mainContent: {
      display: "flex",
      flexDirection: "column" as const,
      flex: 1,
      overflowY: "hidden",
    },
    chatContainer: {
      display: "flex",
      flex: 1,
      overflowY: "hidden",
    },
    chatPanel: {
      display: "flex",
      flexDirection: "column" as const,
      flex: 1,
      padding: "1.5rem",
      overflowY: "hidden",
      position: "relative" as const,
    },
    chatHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "1rem",
      padding: "0.75rem",
      backgroundColor: "#fff",
      borderRadius: "0.5rem",
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
    },
    chatTitle: {
      fontSize: "1.25rem",
      fontWeight: "600",
      color: "#111827",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    },
    viewToggleButton: {
      backgroundColor: "#f3f4f6",
      color: "#4b5563",
      border: "1px solid #e5e7eb",
      borderRadius: "0.375rem",
      padding: "0.5rem 0.75rem",
      fontSize: "0.875rem",
      cursor: "pointer",
      transition: "all 0.2s",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    },
    modelSelector: {
      display: "flex",
      gap: "1rem",
      marginBottom: "1rem",
      padding: "0.75rem",
      backgroundColor: "#fff",
      borderRadius: "0.5rem",
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
    },
    selectLabel: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      fontSize: "0.875rem",
      color: "#4b5563",
    },
    select: {
      padding: "0.375rem 0.75rem",
      borderRadius: "0.25rem",
      border: "1px solid #d1d5db",
      backgroundColor: "#fff",
      fontSize: "0.875rem",
      color: "#111827",
      outline: "none",
      transition: "border-color 0.2s",
    },
    messagesContainer: {
      flex: 1,
      overflowY: "auto" as const,
      padding: "1rem",
      backgroundColor: "#fff",
      borderRadius: "0.5rem",
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
      marginBottom: "1rem",
      scrollBehavior: "smooth" as const,
    },
    messageRow: {
      padding: "0.75rem",
      marginBottom: "0.75rem",
      borderRadius: "0.5rem",
      maxWidth: "85%",
      position: "relative" as const,
      animation: "fadeIn 0.3s ease-in-out",
    },
    userMessage: {
      backgroundColor: "#e0f2fe",
      marginLeft: "auto",
      borderTopRightRadius: "0",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
    },
    assistantMessage: {
      backgroundColor: "#f3f4f6", // Default color
      marginRight: "auto",
      borderTopLeftRadius: "0",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
    },

    // Add new provider-specific message styles
    geminiMessage: {
      backgroundColor: "#e0f2fe", // Light blue for Gemini
      marginRight: "auto",
      borderTopLeftRadius: "0",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
    },
    claudeMessage: {
      backgroundColor: "#ffedd5", // Light orange for Claude
      marginRight: "auto",
      borderTopLeftRadius: "0",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
    },
    openaiMessage: {
      backgroundColor: "#f3f4f6", // Light grey for OpenAI
      marginRight: "auto",
      borderTopLeftRadius: "0",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
    },

    messageRole: {
      fontWeight: "600",
      marginBottom: "0.25rem",
      fontSize: "0.875rem",
      color: "#4b5563",
    },
    messageContent: {
      whiteSpace: "pre-wrap" as const,
      wordBreak: "break-word" as const,
      lineHeight: "1.5",
    },
    // New styles for markdown content
    markdownContent: {
      lineHeight: "1.6",
    },
    messageModel: {
      fontSize: "0.75rem",
      color: "#6b7280",
      marginTop: "0.5rem",
    },
    branchMessageButton: {
      backgroundColor: "transparent",
      color: "#2563eb",
      border: "none",
      padding: "0.25rem 0.5rem",
      marginTop: "0.5rem",
      fontSize: "0.75rem",
      cursor: "pointer",
      borderRadius: "0.25rem",
      transition: "background-color 0.2s",
      display: "flex",
      alignItems: "center",
      gap: "0.25rem",
    },
    inputContainer: {
      display: "flex",
      gap: "0.5rem",
      padding: "0.75rem",
      backgroundColor: "#fff",
      borderRadius: "0.5rem",
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
    },
    textInput: {
      flex: 1,
      padding: "0.75rem 1rem",
      borderRadius: "0.375rem",
      border: "1px solid #d1d5db",
      fontSize: "0.875rem",
      outline: "none",
      transition: "border-color 0.2s",
    },
    sendButton: {
      backgroundColor: "#0284c7",
      color: "#fff",
      border: "none",
      borderRadius: "0.375rem",
      padding: "0 1.25rem",
      fontSize: "0.875rem",
      fontWeight: "500",
      cursor: "pointer",
      transition: "background-color 0.2s",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    },
    bothInputContainer: {
      display: "flex",
      gap: "0.5rem",
      padding: "1rem",
      borderTop: "1px solid #e5e7eb",
      backgroundColor: "#f9fafb",
    },
    branchFormOverlay: {
      position: "fixed" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 50,
      backdropFilter: "blur(2px)",
    },
    branchForm: {
      backgroundColor: "#fff",
      padding: "1.5rem",
      borderRadius: "0.5rem",
      width: "90%",
      maxWidth: "500px",
      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
      animation: "slideIn 0.3s ease-out",
    },
    branchFormTitle: {
      fontSize: "1.25rem",
      fontWeight: "600",
      marginBottom: "1rem",
      color: "#111827",
    },
    branchFormInput: {
      width: "100%",
      padding: "0.75rem",
      marginBottom: "1rem",
      borderRadius: "0.375rem",
      border: "1px solid #d1d5db",
      fontSize: "0.875rem",
    },
    branchFormButtons: {
      display: "flex",
      gap: "0.5rem",
      justifyContent: "flex-end",
      marginTop: "1.5rem",
    },
    branchFormButton: {
      padding: "0.5rem 1rem",
      borderRadius: "0.375rem",
      fontSize: "0.875rem",
      fontWeight: "500",
      cursor: "pointer",
    },
    createButton: {
      backgroundColor: "#0284c7",
      color: "#fff",
      border: "none",
    },
    cancelButton: {
      backgroundColor: "#f3f4f6",
      color: "#4b5563",
      border: "1px solid #d1d5db",
    },
    typingIndicator: {
      display: "flex",
      alignItems: "center",
      padding: "0.75rem",
      marginBottom: "0.75rem",
      borderRadius: "0.5rem",
      backgroundColor: "#f3f4f6",
      maxWidth: "85%",
      marginRight: "auto",
      borderTopLeftRadius: "0",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
    },
    typingDot: {
      width: "8px",
      height: "8px",
      backgroundColor: "#6b7280",
      borderRadius: "50%",
      margin: "0 2px",
      display: "inline-block",
    },
    dot1: {
      animation: "bounce 1s infinite",
    },
    dot2: {
      animation: "bounce 1s infinite 0.2s",
    },
    dot3: {
      animation: "bounce 1s infinite 0.4s",
    },
    // Markdown specific styles
    markdown: {
      "& h1, & h2, & h3, & h4, & h5, & h6": {
        fontWeight: "600",
        marginTop: "1rem",
        marginBottom: "0.5rem",
      },
      "& h1": { fontSize: "1.5rem" },
      "& h2": { fontSize: "1.25rem" },
      "& h3": { fontSize: "1.125rem" },
      "& h4": { fontSize: "1rem" },
      "& p": { marginBottom: "0.75rem" },
      "& ul, & ol": {
        paddingLeft: "1.5rem",
        marginBottom: "0.75rem",
      },
      "& li": { marginBottom: "0.25rem" },
      "& a": {
        color: "#2563eb",
        textDecoration: "underline",
      },
      "& blockquote": {
        borderLeft: "4px solid #d1d5db",
        paddingLeft: "1rem",
        fontStyle: "italic",
        margin: "1rem 0",
      },
      "& code": {
        fontFamily: "monospace",
        backgroundColor: "#f3f4f6",
        padding: "0.2rem 0.4rem",
        borderRadius: "0.25rem",
        fontSize: "0.875rem",
      },
      "& pre": {
        margin: "0.75rem 0",
        padding: "0",
        overflow: "hidden",
        borderRadius: "0.375rem",
      },
      "& img": {
        maxWidth: "100%",
        height: "auto",
        borderRadius: "0.375rem",
        margin: "0.75rem 0",
      },
      "& table": {
        width: "100%",
        borderCollapse: "collapse",
        marginBottom: "1rem",
      },
      "& th, & td": {
        border: "1px solid #d1d5db",
        padding: "0.5rem",
        textAlign: "left",
      },
      "& th": {
        backgroundColor: "#f3f4f6",
        fontWeight: "600",
      },
      "& hr": {
        border: "none",
        borderTop: "1px solid #d1d5db",
        margin: "1rem 0",
      },
      "& strong": {
        fontWeight: "600",
      },
      "& em": {
        fontStyle: "italic",
      },
    },
    keyframes: `
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `,
  }

  // Add a helper function to determine the provider from the model name
  const getProviderFromModel = (model?: string): string => {
    if (!model) return "unknown"
    if (model.startsWith("gemini")) return "gemini"
    if (model.startsWith("gpt") || model.startsWith("text-davinci")) return "openai"
    if (model.startsWith("claude")) return "claude"
    return "unknown"
  }

  const getModelsForProvider = (provider: string) => {
    if (provider === "gemini")
      return [
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
      ]
    if (provider === "openai") return ["gpt-4o-mini", "gpt-4o"]
    if (provider === "claude") return ["claude-3-5-haiku-latest", "claude-3-7-sonnet-latest"]
    return []
  }

  // Toggle branch collapse state
  const toggleBranchCollapse = (chatId: string) => {
    setCollapsedBranches((prev) => ({
      ...prev,
      [chatId]: !prev[chatId],
    }))
  }

  // Fetch all chats
  const fetchAllChats = useCallback(async () => {
    if (!isLoaded || !userId) return
    const token = await getToken()
    try {
      const res = await fetch(`http://localhost:8000/chats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setAllChats(Array.isArray(data) ? data : [])
      const currentChat = data.find((chat: Chat) => chat.id === chatId)
      setCurrentRootChatId(currentChat ? currentChat.ancestorId : null)
    } catch (error) {
      console.error("Error fetching all chats:", error)
    }
  }, [isLoaded, userId, getToken, chatId])

  useEffect(() => {
    fetchAllChats()
  }, [fetchAllChats])

  useEffect(() => {
    const models = getModelsForProvider(selectedProvider)
    if (!models.includes(selectedModel)) {
      setSelectedModel(models[0])
    }
  }, [selectedProvider])

  useEffect(() => {
    const models = getModelsForProvider(selectedCompareProvider)
    if (!models.includes(selectedCompareModel)) {
      setSelectedCompareModel(models[0])
    }
  }, [selectedCompareProvider])

  useEffect(() => {
    const models = getModelsForProvider(branchProvider)
    if (!models.includes(branchModel)) {
      setBranchModel(models[0])
    }
  }, [branchProvider])

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!isLoaded || !userId || !chatId) return
    const token = await getToken()
    try {
      const res = await fetch(`http://localhost:8000/chats/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setMessages(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching messages:", error)
    }
  }, [chatId, isLoaded, userId, getToken])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Fetch messages for the compare chat
  const fetchCompareMessages = useCallback(async () => {
    if (!compareChatId || !isLoaded || !userId) return
    const token = await getToken()
    try {
      const res = await fetch(`http://localhost:8000/chats/${compareChatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setCompareMessages(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching compare messages:", error)
    }
  }, [compareChatId, isLoaded, userId, getToken])

  useEffect(() => {
    fetchCompareMessages()
  }, [fetchCompareMessages])

  // Send a new user message
  const sendMessage = useCallback(async () => {
    if (!isLoaded || !userId || !userInput.trim()) return
    const token = await getToken()
    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userInput,
      created_at: new Date().toISOString(),
    }
    const assistantMsg = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      model: selectedModel,
    }

    setMessages((prev) => [...prev, userMsg])
    setUserInput("")
    setIsTyping(true)

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 100)

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
        },
      )

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No stream")

      const decoder = new TextDecoder()
      let fullText = ""

      // Add the assistant message after a short delay to simulate typing
      setTimeout(() => {
        setMessages((prev) => [...prev, { ...assistantMsg, content: "" }])
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 100)
      }, 500)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        fullText += text
        setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: fullText } : m)))

        // Ensure scrolling happens after content updates
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 100)
      }

      // After streaming is complete, fetch the latest messages to get the real IDs
      const messagesRes = await fetch(`http://localhost:8000/chats/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const messagesData = await messagesRes.json()
      const lastMessages = messagesData.slice(-2) // Get the last two messages

      // Update the messages with real IDs from the backend
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id.startsWith("user-")) {
            return { ...msg, id: lastMessages[0].id }
          }
          if (msg.id.startsWith("assistant-") || msg.id.startsWith("temp-")) {
            return { ...msg, id: lastMessages[1].id }
          }
          return msg
        }),
      )

      setIsTyping(false)
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)
    } catch (err) {
      console.error("Stream failed", err)
      setIsTyping(false)
    }
  }, [chatId, userInput, isLoaded, userId, getToken, selectedProvider, selectedModel])

  // Send a message in the compare chat
  const sendCompareMessage = useCallback(async () => {
    if (!isLoaded || !userId || !compareChatId || !compareUserInput.trim()) return
    const token = await getToken()
    // Create a user message and a temporary assistant message
    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      content: compareUserInput,
      created_at: new Date().toISOString(),
    }
    const assistantMsg = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      model: selectedCompareModel,
    }

    setCompareMessages((prev) => [...prev, userMsg])
    setCompareUserInput("")
    setIsCompareTyping(true)

    setTimeout(() => {
      compareBottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 100)

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
        },
      )

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No stream")
      const decoder = new TextDecoder()
      let fullText = ""

      // Add the assistant message after a short delay to simulate typing
      setTimeout(() => {
        setCompareMessages((prev) => [...prev, { ...assistantMsg, content: "" }])
        setTimeout(() => {
          compareBottomRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 100)
      }, 500)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        fullText += text
        setCompareMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: fullText } : m)))

        // Ensure scrolling happens after content updates
        setTimeout(() => {
          compareBottomRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 100)
      }

      setIsCompareTyping(false)
      setTimeout(() => {
        compareBottomRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)
    } catch (err) {
      console.error("Stream failed", err)
      setIsCompareTyping(false)
    }
  }, [compareChatId, compareUserInput, isLoaded, userId, getToken, selectedCompareProvider, selectedCompareModel])

  const sendBothMessage = useCallback(async () => {
    if (!isLoaded || !userId || !bothUserInput.trim()) return
    if (!compareChatId) {
      console.error("Compare chat is not selected.")
      return
    }
    const token = await getToken()
    // Create separate temporary assistant messages for main and compare chats,
    // and a shared user message.
    const tempMessageMain = {
      id: `temp-main-${Date.now()}`,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      model: selectedModel,
    }
    const tempMessageCompare = {
      id: `temp-compare-${Date.now()}`,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      model: selectedCompareModel,
    }
    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      content: bothUserInput,
      created_at: new Date().toISOString(),
    }

    // Optimistically update the UI for both chats
    setMessages((prev) => [...prev, userMsg])
    setCompareMessages((prev) => [...prev, userMsg])
    setBothUserInput("")
    setIsTyping(true)
    setIsCompareTyping(true)

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      compareBottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 100)

    // Helper function to stream response for a given chat
    const streamResponse = async (
      chatIdParam: string,
      updateFunc: React.Dispatch<React.SetStateAction<Message[]>>,
      tempId: string,
      model: string,
      provider: string,
      scrollRef: React.RefObject<HTMLDivElement>,
      setTypingState: React.Dispatch<React.SetStateAction<boolean>>,
    ) => {
      const res = await fetch(
        `http://localhost:8000/chats/${chatIdParam}/messages?provider=${provider}&model=${model}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: bothUserInput }),
        },
      )

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No stream")
      const decoder = new TextDecoder()
      let fullText = ""

      // Add the assistant message after a short delay to simulate typing
      setTimeout(() => {
        updateFunc((prev) => [
          ...prev,
          { id: tempId, role: "assistant", content: "", created_at: new Date().toISOString(), model },
        ])
        setTimeout(() => {
          scrollRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 100)
      }, 500)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        fullText += text
        updateFunc((prev) => prev.map((msg) => (msg.id === tempId ? { ...msg, content: fullText } : msg)))

        // Ensure scrolling happens after content updates
        setTimeout(() => {
          scrollRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 100)
      }

      setTypingState(false)
    }

    try {
      await Promise.all([
        streamResponse(
          chatId,
          setMessages,
          tempMessageMain.id,
          selectedModel,
          selectedProvider,
          bottomRef,
          setIsTyping,
        ),
        streamResponse(
          compareChatId,
          setCompareMessages,
          tempMessageCompare.id,
          selectedCompareModel,
          selectedCompareProvider,
          compareBottomRef,
          setIsCompareTyping,
        ),
      ])
    } catch (error) {
      console.error("Error sending message to both chats:", error)
      // Remove temporary messages on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageMain.id))
      setCompareMessages((prev) => prev.filter((msg) => msg.id !== tempMessageCompare.id))
      setIsTyping(false)
      setIsCompareTyping(false)
    }
  }, [
    bothUserInput,
    chatId,
    compareChatId,
    isLoaded,
    userId,
    getToken,
    selectedProvider,
    selectedModel,
    selectedCompareProvider,
    selectedCompareModel,
  ])

  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage()
  }

  const handleCompareEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendCompareMessage()
  }

  // Open the branch form for a specific message
  const openBranchForm = (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId) || compareMessages.find((m) => m.id === messageId)
    setBranchFromUserMessage(msg?.role === "user")
    setBranchMsgId(messageId)
    setBranchName("")
    setBranchTags("")
    setShowBranchForm(true)
  }

  // Cancel branching
  const closeBranchForm = () => {
    setShowBranchForm(false)
    setBranchMsgId(null)
  }

  // Create a new branched chat from the chosen message + user-provided name/tags
  const createBranch = async () => {
    if (!branchMsgId) return // no message selected
    const token = await getToken()
    try {
      const bodyData = {
        name: branchName,
        tags: branchTags,
      }
      const res = await fetch(`http://localhost:8000/chats/${chatId}/branch-from/${branchMsgId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bodyData),
      })
      const data = await res.json()
      const originalMsg =
        messages.find((m) => m.id === branchMsgId) || compareMessages.find((m) => m.id === branchMsgId)
      if (data.new_chat_id) {
        const userMsg = {
          id: `user-${Date.now()}`,
          role: "user",
          content: originalMsg?.content || "",
          created_at: new Date().toISOString(),
        }
        const assistantMsg = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "",
          created_at: new Date().toISOString(),
        }
        // Preload previous messages into new chat before streaming
        const prevMessagesRes = await fetch(`http://localhost:8000/chats/${data.new_chat_id}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const prevMessagesData = await prevMessagesRes.json()
        const preserved = Array.isArray(prevMessagesData) ? prevMessagesData : []
        const updatedMessages = [...preserved, userMsg, assistantMsg]
        setMessages(updatedMessages)
      }

      if (originalMsg && originalMsg.role === "user") {
        try {
          const token = await getToken()

          const userMsg = {
            id: `user-${Date.now()}`,
            role: "user",
            content: originalMsg.content,
            created_at: new Date().toISOString(),
          }
          const assistantMsg = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: "",
            created_at: new Date().toISOString(),
            model: branchModel,
          }

          setIsTyping(true)

          const res = await fetch(
            `http://localhost:8000/chats/${data.new_chat_id}/messages?provider=${branchProvider}&model=${branchModel}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ content: originalMsg.content }),
            },
          )

          const reader = res.body?.getReader()
          if (!reader) throw new Error("No stream")

          const decoder = new TextDecoder()
          let fullText = ""
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const text = decoder.decode(value)
            fullText += text
            setMessages((prev) => {
              const updated = [...prev]
              updated[prev.length - 1].content = fullText
              return updated
            })
            bottomRef.current?.scrollIntoView({ behavior: "smooth" })
          }

          const messagesRes = await fetch(`http://localhost:8000/chats/${data.new_chat_id}/messages`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const messagesData = await messagesRes.json()
          const lastMessages = messagesData.slice(-2)
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id.startsWith("user-")) return { ...msg, id: lastMessages[0].id }
              if (msg.id.startsWith("assistant-")) return { ...msg, id: lastMessages[1].id }
              return msg
            }),
          )
          setIsTyping(false)
          router.push(`/chat/${data.new_chat_id}`)
        } catch (error) {
          console.error("Error adding immediate AI reply to new branch:", error)
          setIsTyping(false)
        }
      } else {
        // Just navigate to the new branch if branching from assistant message
        router.push(`/chat/${data.new_chat_id}`)
      }
    } catch (error) {
      console.error("Error branching:", error)
    } finally {
      closeBranchForm()
    }
  }

  // Render branch tree with collapsible sections
  const renderBranchTree = (parentId: string | null) => {
    const branches = allChats.filter((chat) => chat.branch_of === parentId && chat.ancestorId === currentRootChatId)

    if (branches.length === 0) return null

    return branches.map((chat) => {
      const isCollapsed = collapsedBranches[chat.id] || false
      const hasChildren = allChats.some((c) => c.branch_of === chat.id)

      return (
        <div key={chat.id} style={styles.branchContainer}>
          <div style={styles.branchHeader} onClick={() => hasChildren && toggleBranchCollapse(chat.id)}>
            {hasChildren && (
              <div
                style={{
                  ...styles.collapseIcon,
                  transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                }}
              >
                {isCollapsed ? "+" : "−"}
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/chat/${chat.id}`)
              }}
              style={{
                ...styles.branchButton,
                ...(chat.id === chatId ? styles.activeBranchButton : {}),
              }}
            >
              {chat.name || chat.id.substring(0, 8)}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setCompareChatId(chat.id)
              }}
              style={styles.compareButton}
            >
              Compare
            </button>
          </div>

          {!isCollapsed && hasChildren && <div style={styles.branchChildren}>{renderBranchTree(chat.id)}</div>}
        </div>
      )
    })
  }

  // Typing indicator component
  const TypingIndicator = () => {
    const providerColor =
      selectedProvider === "gemini"
        ? styles.geminiMessage.backgroundColor
        : selectedProvider === "claude"
          ? styles.claudeMessage.backgroundColor
          : styles.openaiMessage.backgroundColor

    return (
      <div
        style={{
          ...styles.typingIndicator,
          backgroundColor: providerColor,
        }}
      >
        <div style={styles.messageRole}>AI Assistant</div>
        <div>
          <span style={{ ...styles.typingDot, ...styles.dot1 }}></span>
          <span style={{ ...styles.typingDot, ...styles.dot2 }}></span>
          <span style={{ ...styles.typingDot, ...styles.dot3 }}></span>
        </div>
      </div>
    )
  }

  // Custom component to render markdown content
  const MarkdownContent = ({ content, messageType }: { content: string; messageType: string }) => {
    // State to track which code blocks have been copied
    const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({})

    // Function to copy code to clipboard and show feedback
    const copyToClipboard = (code: string, blockId: string) => {
      navigator.clipboard
        .writeText(code)
        .then(() => {
          // Set this specific block as copied
          setCopiedStates((prev) => ({
            ...prev,
            [blockId]: true,
          }))

          // Reset after 2 seconds
          setTimeout(() => {
            setCopiedStates((prev) => ({
              ...prev,
              [blockId]: false,
            }))
          }, 2000)
        })
        .catch((err) => {
          console.error("Failed to copy code: ", err)
        })
    }

    

    // Determine background color based on message type
    const getBackgroundColor = () => {
      if (messageType === "user") return styles.userMessage.backgroundColor
      if (messageType.includes("gemini")) return styles.geminiMessage.backgroundColor
      if (messageType.includes("claude")) return styles.claudeMessage.backgroundColor
      return styles.openaiMessage.backgroundColor
    }

    // Generate a unique ID for each code block
    const generateBlockId = (code: string, index: number) => {
      return `code-block-${index}-${code.length}`
    }

    // Track code block index
    let codeBlockIndex = 0

    return (
      <div className="markdown-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "")
              const code = String(children).replace(/\n$/, "")

              if (!inline && match) {
                const blockId = generateBlockId(code, codeBlockIndex++)
                const isCopied = copiedStates[blockId] || false
                const backgroundColor = getBackgroundColor()

                return (
                  <div
                    className="code-block-wrapper"
                    style={{
                      backgroundColor: backgroundColor,
                      borderRadius: "0.375rem",
                      overflow: "hidden",
                      margin: "0.75rem 0",
                      border: "1px solid rgba(0,0,0,0.1)",
                    }}
                  >
                    <div
                      className="code-block-header"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.5rem 1rem",
                        backgroundColor: "rgba(0,0,0,0.05)",
                        borderBottom: "1px solid rgba(0,0,0,0.1)",
                      }}
                    >
                      <span
                        className="code-language"
                        style={{
                          textTransform: "uppercase",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          color: "rgba(0,0,0,0.7)",
                        }}
                      >
                        {match[1]}
                      </span>
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(code, blockId)}
                        style={{
                          backgroundColor: isCopied ? "rgba(0,0,0,0.1)" : "transparent",
                          border: "1px solid rgba(0,0,0,0.2)",
                          color: "rgba(0,0,0,0.7)",
                          borderRadius: "0.25rem",
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {isCopied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <div style={{ padding: "0.75rem", backgroundColor: backgroundColor }}>
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          padding: "0.5rem",
                          backgroundColor: "#000", // <-- solid black background
                          color: "#fff", // optional: makes text white for contrast
                          borderRadius: "0.25rem",
                          fontSize: "0.875rem",
                        }}
                        {...props}
                      >
                        {code}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                )
              } else {
                return (
                  <code
                    className={className}
                    style={{
                      backgroundColor: "rgba(0,0,0,0.05)",
                      padding: "0.2rem 0.4rem",
                      borderRadius: "0.25rem",
                      fontFamily: "monospace",
                      fontSize: "0.875rem",
                    }}
                    {...props}
                  >
                    {children}
                  </code>
                )
              }
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    )
  }

  return (
    <>
      {/* Add keyframes for animations */}
      <style dangerouslySetInnerHTML={{ __html: styles.keyframes }} />

      {/* Add styles for markdown content */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
      .markdown-content {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.6;
      }
      .markdown-content h1, 
      .markdown-content h2, 
      .markdown-content h3, 
      .markdown-content h4, 
      .markdown-content h5, 
      .markdown-content h6 {
        font-weight: 600;
        margin-top: 1rem;
        margin-bottom: 0.5rem;
      }
      .markdown-content h1 { font-size: 1.5rem; }
      .markdown-content h2 { font-size: 1.25rem; }
      .markdown-content h3 { font-size: 1.125rem; }
      .markdown-content h4 { font-size: 1rem; }
      .markdown-content p { margin-bottom: 0.75rem; }
      .markdown-content ul, 
      .markdown-content ol { 
        padding-left: 1.5rem; 
        margin-bottom: 0.75rem; 
      }
      .markdown-content li { margin-bottom: 0.25rem; }
      .markdown-content a { 
        color: #2563eb; 
        text-decoration: underline; 
      }
      .markdown-content blockquote {
        border-left: 4px solid rgba(0,0,0,0.1);
        padding-left: 1rem;
        font-style: italic;
        margin: 1rem 0;
        color: rgba(0,0,0,0.7);
      }
      .markdown-content img {
        max-width: 100%;
        height: auto;
        border-radius: 0.375rem;
        margin: 0.75rem 0;
      }
      .markdown-content table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 1rem;
      }
      .markdown-content th, 
      .markdown-content td {
        border: 1px solid rgba(0,0,0,0.1);
        padding: 0.5rem;
        text-align: left;
      }
      .markdown-content th {
        background-color: rgba(0,0,0,0.05);
        font-weight: 600;
      }
      .markdown-content hr {
        border: none;
        border-top: 1px solid rgba(0,0,0,0.1);
        margin: 1rem 0;
      }
      .markdown-content strong {
        font-weight: 600;
      }
      .markdown-content em {
        font-style: italic;
      }
    `,
        }}
      />

      <div style={styles.container}>
        <div style={styles.sidebar}>
          <div style={styles.sidebarTitle}>
            <span>Conversation Branches</span>
            <button
              onClick={() => setShowSplit(!showSplit)}
              style={{
                ...styles.viewToggleButton,
                padding: "0.25rem 0.5rem",
                fontSize: "0.75rem",
              }}
            >
              {showSplit ? "Hide Split" : "Show Split"}
            </button>
          </div>
          {renderBranchTree(null)}
        </div>
        <div style={styles.mainContent}>
          <div style={styles.chatContainer}>
            {showSplit ? (
              <>
                {/* Main Chat Panel */}
                <div style={styles.chatPanel}>
                  <div style={styles.chatHeader}>
                  <h1 style={styles.chatTitle}>
                     {allChats.find((chat) => chat.id === chatId)?.name || chatId.substring(0, 8)}
                  </h1>
                  </div>

                  {/* Provider and Model Selection */}
                  <div style={styles.modelSelector}>
                    <label style={styles.selectLabel}>
                      Provider:{" "}
                      <select
                        value={selectedProvider}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                        style={styles.select}
                      >
                        <option value="gemini">Gemini</option>
                        <option value="openai">OpenAI</option>
                        <option value="claude">Claude</option>
                      </select>
                    </label>
                    <label style={styles.selectLabel}>
                      Model:{" "}
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        style={styles.select}
                      >
                        {getModelsForProvider(selectedProvider).map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div style={styles.messagesContainer}>
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        style={{
                          ...styles.messageRow,
                          ...(msg.role === "user"
                            ? styles.userMessage
                            : msg.role === "assistant" && msg.model
                              ? getProviderFromModel(msg.model) === "gemini"
                                ? styles.geminiMessage
                                : getProviderFromModel(msg.model) === "claude"
                                  ? styles.claudeMessage
                                  : styles.openaiMessage
                              : styles.assistantMessage),
                        }}
                      >
                        <div style={styles.messageRole}>{msg.role === "user" ? "You" : "AI Assistant"}</div>
                        {/* Replace plain text with markdown rendering */}
                        <MarkdownContent
                          content={msg.content}
                          messageType={
                            msg.role === "user" ? "user" : msg.model ? getProviderFromModel(msg.model) : "assistant"
                          }
                        />
                        {msg.role === "assistant" && msg.model && (
                          <div style={styles.messageModel}>Model: {msg.model}</div>
                        )}
                        {!msg.id.startsWith("user-") &&
                          !msg.id.startsWith("assistant-") &&
                          !msg.id.startsWith("temp-") && (
                            <button style={styles.branchMessageButton} onClick={() => openBranchForm(msg.id)}>
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M6 3v12h6l-3 6 12-12h-6l3-6z" />
                              </svg>
                              Branch from this message
                            </button>
                          )}
                      </div>
                    ))}
                    {isTyping && <TypingIndicator />}
                    <div ref={bottomRef} />
                  </div>

                  <div style={styles.inputContainer}>
                    <input
                      style={styles.textInput}
                      placeholder="Type a message..."
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={handleEnterKey}
                    />
                    <button onClick={sendMessage} style={styles.sendButton} disabled={isTyping}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                      </svg>
                      Send
                    </button>
                  </div>
                </div>

                {/* Compare Chat Panel */}
                <div style={styles.chatPanel}>
                  <div style={styles.chatHeader}>
                    <h1 style={styles.chatTitle}>
                    {compareChatId
                      ? `Compare: ${allChats.find((chat) => chat.id === compareChatId)?.name || compareChatId.substring(0, 8)}`
                      : "Select a chat to compare"}
                    </h1>
                  </div>

                  {/* Provider and Model Selection for Compare Chat */}
                  <div style={styles.modelSelector}>
                    <label style={styles.selectLabel}>
                      Provider:{" "}
                      <select
                        value={selectedCompareProvider}
                        onChange={(e) => setSelectedCompareProvider(e.target.value)}
                        style={styles.select}
                      >
                        <option value="gemini">Gemini</option>
                        <option value="openai">OpenAI</option>
                        <option value="claude">Claude</option>
                      </select>
                    </label>
                    <label style={styles.selectLabel}>
                      Model:{" "}
                      <select
                        value={selectedCompareModel}
                        onChange={(e) => setSelectedCompareModel(e.target.value)}
                        style={styles.select}
                      >
                        {getModelsForProvider(selectedCompareProvider).map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {compareChatId ? (
                    <>
                      <div style={styles.messagesContainer}>
                        {compareMessages.map((msg, index) => (
                          <div
                            key={`${msg.id}-${index}`}
                            style={{
                              ...styles.messageRow,
                              ...(msg.role === "user"
                                ? styles.userMessage
                                : msg.role === "assistant" && msg.model
                                  ? getProviderFromModel(msg.model) === "gemini"
                                    ? styles.geminiMessage
                                    : getProviderFromModel(msg.model) === "claude"
                                      ? styles.claudeMessage
                                      : styles.openaiMessage
                                  : styles.assistantMessage),
                            }}
                          >
                            <div style={styles.messageRole}>{msg.role === "user" ? "You" : "AI Assistant"}</div>
                            {/* Replace plain text with markdown rendering */}
                            <MarkdownContent
                              content={msg.content}
                              messageType={
                                msg.role === "user" ? "user" : msg.model ? getProviderFromModel(msg.model) : "assistant"
                              }
                            />
                            {msg.role === "assistant" && msg.model && (
                              <div style={styles.messageModel}>Model: {msg.model}</div>
                            )}
                            {!msg.id.startsWith("user-") &&
                              !msg.id.startsWith("assistant-") &&
                              !msg.id.startsWith("temp-") && (
                                <button style={styles.branchMessageButton} onClick={() => openBranchForm(msg.id)}>
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M6 3v12h6l-3 6 12-12h-6l3-6z" />
                                  </svg>
                                  Branch from this message
                                </button>
                              )}
                          </div>
                        ))}
                        {isCompareTyping && <TypingIndicator />}
                        <div ref={compareBottomRef} />
                      </div>

                      <div style={styles.inputContainer}>
                        <input
                          style={styles.textInput}
                          placeholder="Type a message..."
                          value={compareUserInput}
                          onChange={(e) => setCompareUserInput(e.target.value)}
                          onKeyDown={handleCompareEnterKey}
                          disabled={isCompareTyping}
                        />
                        <button onClick={sendCompareMessage} style={styles.sendButton} disabled={isCompareTyping}>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                          </svg>
                          Send
                        </button>
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        color: "#6b7280",
                        fontSize: "0.875rem",
                      }}
                    >
                      Select a branch to compare using the "Compare" button
                    </div>
                  )}
                </div>
              </>
            ) : (
              // Only Main Chat Panel when split view is disabled
              <div style={styles.chatPanel}>
                <div style={styles.chatHeader}>
                <h1 style={styles.chatTitle}>
                   {allChats.find((chat) => chat.id === chatId)?.name || chatId.substring(0, 8)}
                </h1>
                  <button onClick={() => setShowSplit(!showSplit)} style={styles.viewToggleButton}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="18" rx="2" />
                      <line x1="12" y1="3" x2="12" y2="21" />
                    </svg>
                    Enable Split View
                  </button>
                </div>

                {/* Provider and Model Selection */}
                <div style={styles.modelSelector}>
                  <label style={styles.selectLabel}>
                    Provider:{" "}
                    <select
                      value={selectedProvider}
                      onChange={(e) => setSelectedProvider(e.target.value)}
                      style={styles.select}
                    >
                      <option value="gemini">Gemini</option>
                      <option value="openai">OpenAI</option>
                      <option value="claude">Claude</option>
                    </select>
                  </label>
                  <label style={styles.selectLabel}>
                    Model:{" "}
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      style={styles.select}
                    >
                      {getModelsForProvider(selectedProvider).map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={styles.messagesContainer}>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      style={{
                        ...styles.messageRow,
                        ...(msg.role === "user"
                          ? styles.userMessage
                          : msg.role === "assistant" && msg.model
                            ? getProviderFromModel(msg.model) === "gemini"
                              ? styles.geminiMessage
                              : getProviderFromModel(msg.model) === "claude"
                                ? styles.claudeMessage
                                : styles.openaiMessage
                            : styles.assistantMessage),
                      }}
                    >
                      <div style={styles.messageRole}>{msg.role === "user" ? "You" : "AI Assistant"}</div>
                      {/* Replace plain text with markdown rendering */}
                      <MarkdownContent
                        content={msg.content}
                        messageType={
                          msg.role === "user" ? "user" : msg.model ? getProviderFromModel(msg.model) : "assistant"
                        }
                      />
                      {msg.role === "assistant" && msg.model && (
                        <div style={styles.messageModel}>Model: {msg.model}</div>
                      )}
                      {!msg.id.startsWith("user-") &&
                        !msg.id.startsWith("assistant-") &&
                        !msg.id.startsWith("temp-") && (
                          <button style={styles.branchMessageButton} onClick={() => openBranchForm(msg.id)}>
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M6 3v12h6l-3 6 12-12h-6l3-6z" />
                            </svg>
                            Branch from this message
                          </button>
                        )}
                    </div>
                  ))}
                  {isTyping && <TypingIndicator />}
                  <div ref={bottomRef} />
                </div>

                <div style={styles.inputContainer}>
                  <input
                    style={styles.textInput}
                    placeholder="Type a message..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={handleEnterKey}
                    disabled={isTyping}
                  />
                  <button onClick={sendMessage} style={styles.sendButton} disabled={isTyping}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* If split view is enabled, add an input to send a message to both chats */}
          {showSplit && compareChatId && (
            <div style={styles.bothInputContainer}>
              <input
                style={{
                  ...styles.textInput,
                  flex: 1,
                }}
                placeholder="Type a message for both chats..."
                value={bothUserInput}
                onChange={(e) => setBothUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendBothMessage()
                }}
                disabled={isTyping || isCompareTyping}
              />
              <button
                onClick={sendBothMessage}
                style={{
                  ...styles.sendButton,
                  backgroundColor: "#059669",
                }}
                disabled={isTyping || isCompareTyping}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" />
                  <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
                  <path d="M12 8v8" />
                  <path d="m16 12-4 4-4-4" />
                </svg>
                Send to Both
              </button>
            </div>
          )}
        </div>

        {/* Branch form modal */}
        {showBranchForm && (
          <div style={styles.branchFormOverlay}>
            <div style={styles.branchForm}>
              <h2 style={styles.branchFormTitle}>Create a Branch</h2>
              <p>Branch from message ID: {branchMsgId?.substring(0, 8)}</p>

              <input
                style={styles.branchFormInput}
                placeholder="Branch Name"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
              />

              <input
                style={styles.branchFormInput}
                placeholder="Tags (comma separated)"
                value={branchTags}
                onChange={(e) => setBranchTags(e.target.value)}
              />

              {branchFromUserMessage && (
                <div style={{ marginBottom: "1rem" }}>
                  <label style={styles.selectLabel}>
                    Provider:{" "}
                    <select
                      value={branchProvider}
                      onChange={(e) => setBranchProvider(e.target.value)}
                      style={styles.select}
                    >
                      <option value="gemini">Gemini</option>
                      <option value="openai">OpenAI</option>
                      <option value="claude">Claude</option>
                    </select>
                  </label>
                  <label style={{ ...styles.selectLabel, marginLeft: "1rem" }}>
                    Model:{" "}
                    <select value={branchModel} onChange={(e) => setBranchModel(e.target.value)} style={styles.select}>
                      {getModelsForProvider(branchProvider).map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <div style={styles.branchFormButtons}>
                <button onClick={closeBranchForm} style={{ ...styles.branchFormButton, ...styles.cancelButton }}>
                  Cancel
                </button>
                <button onClick={createBranch} style={{ ...styles.branchFormButton, ...styles.createButton }}>
                  Create Branch
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

