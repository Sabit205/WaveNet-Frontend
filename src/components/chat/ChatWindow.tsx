"use client";

import { useEffect, useState, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Paperclip } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSocket } from "@/providers/SocketProvider";
import { useUser } from "@clerk/nextjs";
import axios from "axios";
import { cn } from "@/lib/utils";

export function ChatWindow({ conversationId, otherUser }: { conversationId?: string, otherUser?: any }) {
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState("");
    const { socket } = useSocket();
    const { user } = useUser();
    const scrollRef = useRef<HTMLDivElement>(null);

    const [chatPartner, setChatPartner] = useState<any>(otherUser);
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch Messages & Partner Details
    useEffect(() => {
        if (conversationId) {
            const fetchData = async () => {
                try {
                    const msgsRes = await axios.get(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/messages/${conversationId}`);
                    setMessages(msgsRes.data);

                    const convRes = await axios.get(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/conversations/detail/${conversationId}`);
                    const partner = convRes.data.participants.find((p: any) => p.clerkId !== user?.id);
                    if (partner) setChatPartner(partner);
                } catch (error) {
                    console.error(error);
                }
            };
            fetchData();
        }
    }, [conversationId, user]);

    // Update partner from prop if needed
    useEffect(() => {
        if (otherUser && !chatPartner) {
            setChatPartner(otherUser);
        }
    }, [otherUser]);

    // Socket Events & Logic
    useEffect(() => {
        if (!socket || !conversationId) return;

        socket.emit("joinConversation", conversationId);

        // Mark messages as seen when entering
        if (user?.id) {
            socket.emit("markMessagesSeen", { conversationId, userId: user.id });
        }

        const handleNewMessage = (message: any) => {
            if (message.conversationId === conversationId) {
                setMessages((prev) => [...prev, message]);
                // If message is from other user, mark it as seen
                if (user?.id && message.sender?.clerkId !== user.id) {
                    socket.emit("markMessagesSeen", { conversationId, userId: user.id });
                }
            }
        };

        const handleUserStatus = (userId: string) => {
            if (chatPartner?.clerkId === userId) {
                setChatPartner((prev: any) => ({ ...prev, online: true }));
            }
        };

        const handleUserOffline = (userId: string) => {
            if (chatPartner?.clerkId === userId) {
                setChatPartner((prev: any) => ({ ...prev, online: false }));
            }
        };

        const handleTyping = (room: string) => {
            if (room === conversationId) setIsTyping(true);
        };

        const handleStopTyping = (room: string) => {
            if (room === conversationId) setIsTyping(false);
        };

        const handleMessagesSeen = (data: any) => {
            if (data.conversationId === conversationId) {
                setMessages(prev => prev.map(msg => ({ ...msg, seen: true })));
            }
        };

        socket.on("newMessage", handleNewMessage);
        socket.on("userOnline", handleUserStatus);
        socket.on("userOffline", handleUserOffline);
        socket.on("typing", handleTyping);
        socket.on("stopTyping", handleStopTyping);
        socket.on("messagesSeen", handleMessagesSeen);

        return () => {
            socket.off("newMessage", handleNewMessage);
            socket.off("userOnline", handleUserStatus);
            socket.off("userOffline", handleUserOffline);
            socket.off("typing", handleTyping);
            socket.off("stopTyping", handleStopTyping);
            socket.off("messagesSeen", handleMessagesSeen);
        }
    }, [socket, conversationId, chatPartner?.clerkId, user?.id]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isTyping]);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputText(e.target.value);

        if (!socket || !conversationId) return;

        if (!isTyping) {
            // Only emit if we weren't already typing to reduce traffic
            socket.emit('typing', conversationId);
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('stopTyping', conversationId);
        }, 3000);
    };

    const handleSend = async () => {
        if (!inputText.trim() || !user || !conversationId) return;

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        socket.emit('stopTyping', conversationId);

        try {
            await axios.post(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/messages`, {
                conversationId,
                senderId: user.id,
                content: inputText
            });
            setInputText("");
        } catch (error) {
            console.error(error);
        }
    };

    if (!conversationId) {
        return (
            <div className="flex-1 flex items-center justify-center bg-white text-muted-foreground">
                Select a conversation to start chatting
            </div>
        )
    }

    return (
        <div className="flex flex-col flex-1 h-full bg-white">
            {/* Header */}
            <div className="p-4 border-b flex items-center gap-3">
                <Avatar>
                    <AvatarImage src={chatPartner?.image} />
                    <AvatarFallback>{chatPartner?.username?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-bold">{chatPartner?.username || 'User'}</p>
                    <p className="text-xs text-green-500">{chatPartner?.online ? 'Online' : 'Offline'}</p>
                </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                    {messages.map((msg, i) => {
                        const isOwn = msg.sender?.clerkId === user?.id;
                        return (
                            <div key={i} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                                <div className={cn("max-w-[70%] p-3 rounded-lg", isOwn ? "bg-blue-500 text-white" : "bg-slate-100")}>
                                    <p>{msg.content}</p>
                                    <div className="flex items-center justify-end gap-1 mt-1">
                                        <p className="text-[10px] opacity-70">
                                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        {isOwn && (
                                            <span className={cn("text-[10px] font-bold", msg.seen ? "text-blue-200" : "text-white/60")}>
                                                {msg.seen ? "✓✓" : "✓"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-slate-100 p-3 rounded-lg text-xs italic text-muted-foreground animate-pulse">
                                {chatPartner?.username || 'User'} is typing...
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t flex gap-2">
                <Button variant="ghost" size="icon">
                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                </Button>
                <Input
                    placeholder="Type a message..."
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
                <Button onClick={handleSend}>
                    <Send className="h-5 w-5" />
                </Button>
            </div>
        </div>
    );
}
