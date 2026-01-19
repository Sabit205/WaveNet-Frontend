"use client";

import { UserSearch } from "./UserSearch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import axios from "axios";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useSocket } from "@/providers/SocketProvider";

interface SidebarProps {
    className?: string;
    onSelectConversation?: (id: string, user: any) => void;
    selectedId?: string;
}

export function Sidebar({ className, onSelectConversation, selectedId }: SidebarProps) {
    const { user, isLoaded } = useUser();
    const [conversations, setConversations] = useState<any[]>([]);
    const { socket } = useSocket();

    const fetchConversations = async () => {
        if (user?.id) {
            try {
                const res = await axios.get(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/conversations/${user.id}`);
                setConversations(res.data);
            } catch (error) {
                console.error("Error fetching conversations:", error);
            }
        }
    };

    useEffect(() => {
        if (user && socket) {
            socket.emit("setup", user);

            const handleUserOnline = (userId: string) => {
                setConversations(prev => prev.map(c => {
                    const other = getOtherParticipant(c);
                    if (other.clerkId === userId) {
                        // We could update local state here if we had deep structure access
                        // For now, refetching is safe and consistent
                    }
                    return c;
                }));
                fetchConversations();
            };

            socket.on('userOnline', handleUserOnline);

            return () => {
                socket.off('userOnline', handleUserOnline);
            };
        }
    }, [user, socket]);

    useEffect(() => {
        fetchConversations();
    }, [user]);

    const getOtherParticipant = (conv: any) => {
        return conv.participants.find((p: any) => p.clerkId !== user?.id) || {};
    };

    const handleConversationCreated = (conversationId: string) => {
        fetchConversations();
    };

    return (
        <div className={cn("flex flex-col h-full bg-slate-50 border-r w-80", className)}>
            <div className="p-4 border-b">
                <h1 className="text-xl font-bold mb-4">WaveNet</h1>
                <UserSearch onConversationCreated={handleConversationCreated} />
            </div>
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                    {/* Conversation List */}
                    {conversations.length === 0 && (
                        <p className="text-center text-muted-foreground text-sm p-4">No conversations yet.</p>
                    )}
                    {conversations.map(conv => {
                        const otherUser = getOtherParticipant(conv);
                        return (
                            <div
                                key={conv._id}
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-slate-200",
                                    selectedId === conv._id ? "bg-slate-200" : ""
                                )}
                                onClick={() => onSelectConversation && onSelectConversation(conv._id, otherUser)}
                            >
                                <Avatar>
                                    <AvatarImage src={otherUser.image} />
                                    <AvatarFallback>{otherUser.username?.[0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-medium truncate">{otherUser.username || 'User'}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {conv.lastMessage?.content || 'Started a conversation'}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
            <div className="p-4 border-t">
                {/* User Profile / Settings */}
                <div className="flex items-center gap-2">
                    <Avatar>
                        <AvatarImage src={user?.imageUrl} />
                        <AvatarFallback>{user?.firstName?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="text-sm">
                        <p className="font-medium">{user?.fullName}</p>
                        <p className="text-xs text-muted-foreground">Online</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
