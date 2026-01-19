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

    useEffect(() => {
        if (conversationId) {
            const fetchMessages = async () => {
                try {
                    const res = await axios.get(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/messages/${conversationId}`);
                    setMessages(res.data);
                } catch (error) {
                    console.error(error);
                }
            };
            fetchMessages();
        }
    }, [conversationId]);

    useEffect(() => {
        // Auto-scroll to bottom on new messages
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    useEffect(() => {
        if (!socket || !conversationId) return;

        // Join the conversation room
        socket.emit("joinConversation", conversationId);

        const handleNewMessage = (message: any) => {
            if (message.conversationId === conversationId) {
                setMessages((prev) => [...prev, message]);
            }
        };

        socket.on("newMessage", handleNewMessage);

        return () => {
            socket.off("newMessage", handleNewMessage);
            // Optional: leave room if needed, but disconnect handles it
        }
    }, [socket, conversationId]);

    const handleSend = async () => {
        if (!inputText.trim() || !user || !conversationId) return;

        try {
            const res = await axios.post(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/messages`, {
                conversationId,
                senderId: user.id,
                content: inputText
            });
            setInputText("");
            // Optimistic update not strictly needed if socket is fast, 
            // but we can rely on the socket event coming back.
            // If we want instant feedback before server ack:
            // setMessages(prev => [...prev, { ...res.data }]); 
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
                    <AvatarImage src={otherUser?.image} />
                    <AvatarFallback>{otherUser?.username?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-bold">{otherUser?.username || 'User'}</p>
                    <p className="text-xs text-green-500">{otherUser?.online ? 'Online' : 'Offline'}</p>
                </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                    {messages.map((msg, i) => (
                        <div key={i} className={cn("flex", msg.sender?.clerkId === user?.id ? "justify-end" : "justify-start")}>
                            <div className={cn("max-w-[70%] p-3 rounded-lg", msg.sender?.clerkId === user?.id ? "bg-blue-500 text-white" : "bg-slate-100")}>
                                <p>{msg.content}</p>
                                <p className="text-[10px] opacity-70 text-right mt-1">10:00 AM</p>
                            </div>
                        </div>
                    ))}
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
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
                <Button onClick={handleSend}>
                    <Send className="h-5 w-5" />
                </Button>
            </div>
        </div>
    );
}
