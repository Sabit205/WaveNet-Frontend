"use client";

import { UserSearch } from "./UserSearch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import axios from "axios";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

export function Sidebar({ className }: { className?: string }) {
    const { user, isLoaded } = useUser();
    const [conversations, setConversations] = useState<any[]>([]);

    useEffect(() => {
        if (user?.id) {
            const fetchConversations = async () => {
                try {
                    const res = await axios.get(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/conversations/${user.id}`);
                    setConversations(res.data);
                } catch (error) {
                    console.error("Error fetching conversations:", error);
                }
            };
            fetchConversations();
        }
    }, [user]);

    const getOtherParticipant = (conv: any) => {
        return conv.participants.find((p: any) => p.clerkId !== user?.id) || {};
    };

    return (
        <div className={cn("flex flex-col h-full bg-slate-50 border-r w-80", className)}>
            <div className="p-4 border-b">
                <h1 className="text-xl font-bold mb-4">WaveNet</h1>
                <UserSearch />
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
                            <div key={conv._id} className="flex items-center gap-3 p-3 hover:bg-slate-200 rounded-lg cursor-pointer">
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
