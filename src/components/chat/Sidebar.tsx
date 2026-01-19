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
    const { user } = useUser();
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

            const handleUserStatus = () => {
                fetchConversations();
            };

            socket.on('userOnline', handleUserStatus);
            socket.on('userOffline', handleUserStatus);

            return () => {
                socket.off('userOnline', handleUserStatus);
                socket.off('userOffline', handleUserStatus);
            };
        }
    }, [user, socket]);

    useEffect(() => {
        fetchConversations();
    }, [user]);

    const getOtherParticipant = (conv: any) => {
        return conv.participants.find((p: any) => p.clerkId !== user?.id) || {};
    };

    const handleConversationCreated = () => {
        fetchConversations();
    };

    return (
        <div className={cn(
            "flex flex-col h-full w-80 border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl supports-[backdrop-filter]:bg-sidebar/60 transition-all duration-300",
            className
        )}>
            {/* Header / Search */}
            <div className="p-6 border-b border-sidebar-border/50 space-y-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-primary/25">
                        W
                    </div>
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                    WaveNet
                </h1>
                <UserSearch onConversationCreated={handleConversationCreated} />
            </div>

            {/* Conversation List */}
            <ScrollArea className="flex-1 px-3 py-4">
                <div className="space-y-1">
                    {conversations.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm opacity-60">
                            <p>No conversations yet.</p>
                        </div>
                    )}
                    {conversations.map(conv => {
                        const otherUser = getOtherParticipant(conv);
                        const isSelected = selectedId === conv._id;

                        return (
                            <div
                                key={conv._id}
                                className={cn(
                                    "group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200",
                                    "hover:bg-sidebar-accent/50",
                                    isSelected
                                        ? "bg-gradient-to-r from-primary/10 to-purple-500/5 border-l-4 border-primary shadow-sm"
                                        : "border-l-4 border-transparent"
                                )}
                                onClick={() => onSelectConversation && onSelectConversation(conv._id, otherUser)}
                            >
                                <div className="relative shrink-0">
                                    <Avatar className="h-10 w-10 border-2 border-background shadow-sm group-hover:scale-105 transition-transform">
                                        <AvatarImage src={otherUser.image} />
                                        <AvatarFallback className="bg-gradient-to-br from-purple-100 to-indigo-100 text-primary">
                                            {otherUser.username?.[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                    {otherUser.online && (
                                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full shadow-sm animate-pulse"></span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <p className={cn(
                                            "font-semibold text-sm truncate transition-colors",
                                            isSelected ? "text-primary" : "text-foreground"
                                        )}>
                                            {otherUser.username || 'User'}
                                        </p>
                                        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                                            {/* Could add time here if available in conv summary */}
                                        </span>
                                    </div>
                                    <p className={cn(
                                        "text-xs truncate transition-colors",
                                        isSelected ? "text-primary/70 font-medium" : "text-muted-foreground"
                                    )}>
                                        {conv.lastMessage?.content || 'Started a conversation'}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>

            {/* Current User Footer */}
            <div className="p-4 border-t border-sidebar-border/50 bg-background/50 backdrop-blur-md">
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors cursor-pointer group">
                    <Avatar className="h-9 w-9 border border-border group-hover:border-primary/50 transition-colors">
                        <AvatarImage src={user?.imageUrl} />
                        <AvatarFallback>{user?.firstName?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{user?.fullName}</p>
                        <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                            Online
                        </p>
                    </div>
                    {/* Settings Icon or similar could go here */}
                </div>
            </div>
        </div>
    );
}
