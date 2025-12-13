"use client";

import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import { useUserStore } from "@/store/useUserStore";
import { useChatStore } from "@/store/useChatStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Search, MoreHorizontal, Video, Phone } from "lucide-react";

interface OnlineUser {
    userId: string;
    userInfo: {
        name: string;
        avatar: string;
    };
}

export function RightPanel() {
    const { mongoUser } = useUserStore();
    const { setActiveChatUser } = useChatStore();
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

    useEffect(() => {
        socket.on("online-users", (users: OnlineUser[]) => {
            setOnlineUsers(users);
        });
        return () => {
            socket.off("online-users");
        };
    }, []);

    const friends = mongoUser?.friends || [];
    const onlineFriends = friends.filter((friend: any) =>
        onlineUsers.some(u => u.userId === friend.clerkId)
    );
    const offlineFriends = friends.filter((friend: any) =>
        !onlineUsers.some(u => u.userId === friend.clerkId)
    );

    return (
        <div className="w-[280px] hidden xl:flex flex-col h-screen sticky top-0 p-4 border-l bg-card overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-muted-foreground">Contacts</h2>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Search className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="space-y-1">
                {friends.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No friends yet</p>
                )}

                {/* Online Friends */}
                {onlineFriends.map((friend: any) => (
                    <div
                        key={friend.clerkId}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer group"
                        onClick={() => setActiveChatUser(friend.clerkId)}
                    >
                        <div className="relative">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src={friend.imageUrl} />
                                <AvatarFallback>{friend.fullName?.[0]}</AvatarFallback>
                            </Avatar>
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background"></span>
                        </div>
                        <span className="font-medium text-sm truncate flex-1">{friend.fullName}</span>
                    </div>
                ))}

                {/* Offline Friends (Optional, maybe separated) */}
                {offlineFriends.length > 0 && <div className="my-2 border-t" />}

                {offlineFriends.map((friend: any) => (
                    <div
                        key={friend.clerkId}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer group opacity-70"
                        onClick={() => setActiveChatUser(friend.clerkId)}
                    >
                        <div className="relative">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src={friend.imageUrl} />
                                <AvatarFallback>{friend.fullName?.[0]}</AvatarFallback>
                            </Avatar>
                        </div>
                        <span className="font-medium text-sm truncate flex-1">{friend.fullName}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
