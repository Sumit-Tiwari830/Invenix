import React, { useEffect, useState, useRef } from "react";
import { api, API_BASE_URL } from "../lib/api";
import { Send, Plus, Loader, MessageSquare, Trash2, Database, Brain, Bot, User } from "lucide-react";
import Answer from "../components/Answer";

export default function Chat() {
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [kbs, setKbs] = useState([]);
  
  // Message inputs & streams
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingCitations, setStreamingCitations] = useState([]);

  // Modal / Selection states
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [selectedKbId, setSelectedKbId] = useState("");
  const [newChatTitle, setNewChatTitle] = useState("");

  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchChats();
    fetchKbs();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchChats = async () => {
    try {
      const data = await api.get("/chat");
      setChats(data);
      if (data.length > 0 && !activeChat) {
        handleSelectChat(data[0].id);
      }
    } catch (e) {
      console.error("Failed to fetch chats:", e);
    }
  };

  const fetchKbs = async () => {
    try {
      const data = await api.get("/knowledge-base");
      setKbs(data);
      if (data.length > 0) {
        setSelectedKbId(data[0].id.toString());
      }
    } catch (e) {
      console.error("Failed to fetch knowledge bases:", e);
    }
  };

  const handleSelectChat = async (chatId) => {
    try {
      const data = await api.get(`/chat/${chatId}`);
      setActiveChat(data);
      
      // Format existing messages (extract base64 citations if any)
      const formatted = data.messages.map((msg) => {
        if (msg.role !== "assistant" || !msg.content) return msg;

        if (msg.content.includes("__LLM_RESPONSE__")) {
          try {
            const [base64Part, responseText] = msg.content.split("__LLM_RESPONSE__");
            const contextData = JSON.parse(atob(base64Part.trim()));
            return {
              ...msg,
              content: responseText || "",
              citations: contextData.context || [],
            };
          } catch (e) {
            console.error("Failed to parse historical citations:", e);
          }
        }
        return msg;
      });

      setMessages(formatted);
      // Clear streaming states
      setStreamingText("");
      setStreamingCitations([]);
    } catch (e) {
      alert("Failed to load chat thread.");
    }
  };

  const handleCreateChat = async (e) => {
    e.preventDefault();
    if (!newChatTitle.trim() || !selectedKbId) return;

    try {
      const newChat = await api.post("/chat", {
        title: newChatTitle,
        knowledge_base_id: parseInt(selectedKbId, 10),
      });
      setNewChatTitle("");
      setShowNewChatModal(false);
      await fetchChats();
      handleSelectChat(newChat.id);
    } catch (e) {
      alert("Failed to create chat session.");
    }
  };

  const handleDeleteChat = async (chatId, e) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat session?")) return;

    try {
      await api.delete(`/chat/${chatId}`);
      if (activeChat?.id === chatId) {
        setActiveChat(null);
        setMessages([]);
      }
      await fetchChats();
    } catch (e) {
      alert("Failed to delete chat session.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeChat || isLoading) return;

    const userMessageText = input;
    setInput("");
    setIsLoading(true);
    setStreamingText("");
    setStreamingCitations([]);

    // Add user message locally
    setMessages((prev) => [...prev, { id: Date.now(), role: "user", content: userMessageText }]);

    try {
      const response = await fetch(`${API_BASE_URL}/chat/${activeChat.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: userMessageText }),
      });

      if (!response.ok) {
        throw new Error("Chat request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let partialText = "";
      let hasParsedCitations = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        partialText += decoder.decode(value, { stream: true });
        const lines = partialText.split("\n");
        partialText = lines.pop() || ""; // Save trailing incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;

          // Parse stream lines matching format: 0:"content"\n or 3:"error"\n
          const typeMatch = line.match(/^(\d+):"([\s\S]*)"$/);
          if (typeMatch) {
            const streamType = typeMatch[1];
            let streamValue = typeMatch[2];

            // Unescape quotes and newlines
            streamValue = streamValue.replace(/\\"/g, '"').replace(/\\n/g, "\n");

            if (streamType === "0") {
              // Check if chunk contains Base64 citations
              if (streamValue.includes("__LLM_RESPONSE__") && !hasParsedCitations) {
                const [base64Part, rest] = streamValue.split("__LLM_RESPONSE__");
                try {
                  const contextData = JSON.parse(atob(base64Part.trim()));
                  setStreamingCitations(contextData.context || []);
                } catch (e) {
                  console.error("Failed to parse citations from stream:", e);
                }
                hasParsedCitations = true;
                setStreamingText((prev) => prev + rest);
              } else {
                setStreamingText((prev) => prev + streamValue);
              }
            } else if (streamType === "3") {
              alert(`Assistant Error: ${streamValue}`);
            }
          }
        }
      }

      // Sync active chat session
      await handleSelectChat(activeChat.id);
    } catch (e) {
      console.error(e);
      alert("Error sending message.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-screen overflow-hidden">
      {/* Chats Drawer/List */}
      <aside className="w-80 glass-panel border-r border-white/5 flex flex-col h-full z-10 shrink-0">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-100 flex items-center gap-2 text-sm">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            Chat History
          </h2>
          <button
            onClick={() => setShowNewChatModal(true)}
            className="p-2 rounded-xl glass-btn-primary flex items-center justify-center text-xs"
            title="New Chat Session"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {chats.length > 0 ? (
            chats.map((chat) => {
              const isSelected = activeChat?.id === chat.id;
              return (
                <div
                  key={chat.id}
                  onClick={() => handleSelectChat(chat.id)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-250 group border ${
                    isSelected
                      ? "bg-indigo-500/10 border-indigo-500/30 text-white font-medium"
                      : "border-transparent text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MessageSquare className={`w-4 h-4 shrink-0 ${isSelected ? "text-indigo-400" : "text-zinc-600"}`} />
                    <span className="truncate text-xs">{chat.title}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteChat(chat.id, e)}
                    className="p-1 rounded hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="text-center text-zinc-600 text-xs py-10">No chats started yet.</div>
          )}
        </div>
      </aside>

      {/* Main Chat Thread Area */}
      <section className="flex-1 flex flex-col h-full bg-black/10 relative">
        {/* Chat Header */}
        {activeChat ? (
          <header className="px-6 py-4 glass-panel border-b border-white/5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-zinc-100 text-sm">{activeChat.title}</h3>
              <p className="text-[10px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                <span>RAG Active (Ollama local model)</span>
              </p>
            </div>
          </header>
        ) : (
          <header className="px-6 py-4 glass-panel border-b border-white/5">
            <h3 className="font-semibold text-zinc-400 text-sm">No Chat Selected</h3>
          </header>
        )}

        {/* Messages feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
          {activeChat ? (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 max-w-3xl ${
                  msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                }`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                  msg.role === "user" 
                    ? "bg-zinc-800 border-zinc-700 text-zinc-100" 
                    : "bg-gradient-to-tr from-indigo-500 to-purple-600 border-indigo-400/20 text-white"
                }`}>
                  {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Body */}
                <div className={`rounded-2xl px-5 py-3.5 border ${
                  msg.role === "user"
                    ? "bg-indigo-500/10 border-indigo-500/20 text-zinc-100"
                    : "glass-panel text-zinc-300"
                } max-w-[85%]`}>
                  {msg.role === "assistant" ? (
                    <Answer markdown={msg.content} citations={msg.citations} />
                  ) : (
                    <span className="text-sm leading-relaxed">{msg.content}</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-2">
                <Brain className="w-8 h-8 text-indigo-400 animate-pulse-glow" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Select or Create a Chat Thread</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs leading-normal">
                  Connect to your knowledge bases, upload your papers or documents, and ask your local AI questions.
                </p>
              </div>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="glass-btn-primary px-4 py-2 rounded-xl text-xs"
              >
                Create New Chat
              </button>
            </div>
          )}

          {/* Streaming Block */}
          {isLoading && (streamingText || streamingCitations.length > 0) && (
            <div className="flex gap-4 max-w-3xl mr-auto">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 border-indigo-400/20 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="rounded-2xl px-5 py-3.5 glass-panel text-zinc-300 max-w-[85%]">
                <Answer markdown={streamingText} citations={streamingCitations} />
              </div>
            </div>
          )}

          {isLoading && !streamingText && (
            <div className="flex gap-4 max-w-3xl mr-auto">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 border-indigo-400/20 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="flex items-center gap-2 text-zinc-500 text-sm italic">
                <Loader className="w-4 h-4 animate-spin" />
                <span>Ollama is thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        {activeChat && (
          <form
            onSubmit={handleSubmit}
            className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent"
          >
            <div className="flex gap-3 max-w-4xl mx-auto glass-panel p-2 rounded-2xl border-white/8 shadow-2xl">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                placeholder={`Ask ${activeChat.title}...`}
                className="flex-1 bg-transparent text-white px-4 text-sm focus:outline-none placeholder-zinc-500"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-3 rounded-xl glass-btn-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </section>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateChat}
            className="w-full max-w-md glass-panel border border-white/10 rounded-2xl p-6 space-y-4 animate-pulse-glow"
          >
            <h2 className="font-semibold text-lg text-white">Start New Chat</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">Chat Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Discuss Qwen features"
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-sm"
                  value={newChatTitle}
                  onChange={(e) => setNewChatTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">Select Knowledge Base</label>
                {kbs.length > 0 ? (
                  <select
                    className="w-full glass-input rounded-xl px-4 py-2.5 text-sm bg-zinc-950"
                    value={selectedKbId}
                    onChange={(e) => setSelectedKbId(e.target.value)}
                  >
                    {kbs.map((kb) => (
                      <option key={kb.id} value={kb.id}>
                        {kb.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs text-amber-400 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                    You need to create a Knowledge Base first!
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="glass-btn-secondary px-4 py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={kbs.length === 0}
                className="glass-btn-primary px-4 py-2 rounded-xl text-xs disabled:opacity-40"
              >
                Create Session
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
