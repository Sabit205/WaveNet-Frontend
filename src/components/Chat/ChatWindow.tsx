import { useEffect, useState, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useAuth, useUser } from '@clerk/nextjs';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Check, CheckCheck } from "lucide-react";
import { socket } from '@/lib/socket';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChatWindowProps {
    friend: {
        clerkId: string;
        fullName: string;
        imageUrl: string;
        isOnline: boolean;
    };
    onClose: () => void;
}

export function ChatWindow({ friend, onClose }: ChatWindowProps) {
    const { messages, setMessages, activeChatUser, typingUsers } = useChatStore();
    const { user } = useUser();
    const { getToken } = useAuth();
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch history
    useEffect(() => {
        const fetchHistory = async () => {
            const token = await getToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'}/api/chat/${friend.clerkId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setMessages(data);
            // Mark read
            socket.emit('mark-read', { senderId: friend.clerkId, receiverId: user?.id });
        };
        fetchHistory();
    }, [friend.clerkId, getToken, setMessages, user?.id]);

    // Scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = () => {
        if (!input.trim() || !user) return;
        socket.emit('send-message', {
            senderId: user.id,
            receiverId: friend.clerkId,
            content: input
        });
        setInput('');
        socket.emit('stop-typing', { senderId: user.id, receiverId: friend.clerkId });
    };

    const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value);
        if (!user) return;

        socket.emit('typing', { senderId: user.id, receiverId: friend.clerkId });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('stop-typing', { senderId: user.id, receiverId: friend.clerkId });
        }, 2000);
    };

    const isTyping = typingUsers.includes(friend.clerkId);

    return (
        <div className="flex flex-col h-[500px] w-full max-w-md bg-background border rounded-lg shadow-xl overflow-hidden active-chat-window">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b bg-muted/40">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={friend.imageUrl} />
                            <AvatarFallback>{friend.fullName[0]}</AvatarFallback>
                        </Avatar>
                        {friend.isOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></span>}
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm">{friend.fullName}</h4>
                        {isTyping && <p className="text-xs text-muted-foreground animate-pulse">Typing...</p>}
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50 dark:bg-slate-950" ref={scrollRef}>
                {messages.map((msg, i) => {
                    const isMe = msg.senderId === user?.id;
                    return (
                        <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] px-4 py-2 rounded-lg text-sm ${isMe ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted rounded-bl-none'}`}>
                                <p>{msg.content}</p>
                                <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    {isMe && (
                                        msg.isRead ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Input */}
            <div className="p-3 border-t bg-background flex gap-2">
                <Input
                    value={input}
                    onChange={handleTyping}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type a message..."
                    className="flex-1"
                />
                <Button onClick={handleSend} size="icon">
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
