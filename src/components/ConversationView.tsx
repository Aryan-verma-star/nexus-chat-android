import { useState, useRef, useEffect } from "react";
import { ArrowLeft, MoreVertical, Send, Paperclip, Smile, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Conversation, Message } from "@/lib/supabase";

interface ConversationViewProps {
  conversationId: string;
  onBack: () => void;
  onRefresh?: () => void;
}

const ConversationView = ({ conversationId, onBack, onRefresh }: ConversationViewProps) => {
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [convData, messagesData] = await Promise.all([
          api.conversations.get(conversationId),
          api.conversations.getMessages(conversationId),
        ]);
        setConversation(convData);
        setMessages(messagesData.data);
        await api.conversations.markRead(conversationId);
      } catch (err) {
        console.error("Failed to load conversation:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    setSending(true);
    try {
      const newMsg = await api.conversations.sendMessage(conversationId, input.trim());
      setMessages(prev => [...prev, newMsg]);
      setInput("");
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }
      onRefresh?.();
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Conversation not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-3 bg-background">
        <button onClick={onBack} className="p-1 md:hidden transition-transform active:scale-95">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="relative">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface font-display text-sm text-primary">
            {(conversation.name || "?").charAt(0)}
          </div>
          {conversation.type === "direct" && conversation.members?.some(m => m.profile?.is_online) && (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body text-base font-semibold text-foreground truncate">{conversation.name || "Direct Chat"}</p>
          <p className="font-body text-[11px] text-muted-foreground">
            {conversation.type === "direct"
              ? conversation.members?.find(m => m.user_id !== user?.id)?.profile?.is_online 
                ? <span className="text-primary">online</span> 
                : "offline"
              : `${conversation.members?.length || 0} members`}
          </p>
        </div>
        <button className="p-2 transition-transform active:scale-95">
          <MoreVertical className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Date separator */}
        <div className="flex justify-center">
          <span className="rounded-full bg-muted px-3 py-1 font-body text-[11px] text-muted-foreground">
            Today
          </span>
        </div>

        {messages.map((msg, i) => {
          const isSent = msg.sender_id === user?.id;
          return (
            <div
              key={msg.id}
              className={`flex ${isSent ? "justify-end" : "justify-start"} animate-slide-up`}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div
                className={`max-w-[80%] px-3.5 py-2.5 ${
                  isSent
                    ? "bg-gradient-sent text-primary-foreground rounded-2xl rounded-br-md"
                    : "bg-surface text-foreground rounded-2xl rounded-bl-md"
                }`}
              >
                {!isSent && (
                  <p className="font-body text-[11px] text-primary mb-1">{msg.sender?.display_name || "Unknown"}</p>
                )}
                <p className="font-body text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <div className={`mt-1 flex items-center gap-1 ${isSent ? "justify-end" : ""}`}>
                  <span className={`font-body text-[11px] ${isSent ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {formatTime(msg.created_at)}
                  </span>
                  {isSent && (
                    <span className={`text-[11px] ${msg.is_edited ? "text-primary-foreground/80" : "text-primary-foreground/40"}`}>
                      {msg.is_edited ? "edited" : "✓✓"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-border bg-card px-3 py-2.5">
        <div className="flex items-end gap-2">
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors transition-transform active:scale-95">
            <Paperclip className="h-5 w-5" />
          </button>
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 pr-10 font-body text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all duration-200 focus:border-primary focus:shadow-[0_0_10px_rgba(0,255,136,0.2)]"
              style={{ maxHeight: 120 }}
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              <Smile className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-sent text-primary-foreground transition-all duration-200 disabled:opacity-30 active:scale-95"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConversationView;
