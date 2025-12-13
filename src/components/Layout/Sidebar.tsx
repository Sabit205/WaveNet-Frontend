"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { Home, Users, MessageSquare, Video, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Sidebar() {
    const { user } = useUser();
    const { signOut } = useClerk();

    const navItems = [
        { icon: Home, label: "Home", active: true },
        { icon: Users, label: "Friends" },
        { icon: MessageSquare, label: "Messages" },
        { icon: Video, label: "Videos" },
        { icon: Settings, label: "Settings" },
    ];

    if (!user) return null;

    return (
        <div className="w-[280px] hidden md:flex flex-col h-screen sticky top-0 p-4 border-r bg-card">
            <div className="mb-8 pl-2">
                <h1 className="text-2xl font-bold text-primary">WaveNet</h1>
            </div>

            <div className="flex items-center gap-3 mb-8 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <Avatar>
                    <AvatarImage src={user.imageUrl} />
                    <AvatarFallback>{user.fullName?.[0]}</AvatarFallback>
                </Avatar>
                <span className="font-semibold truncate">{user.fullName}</span>
            </div>

            <nav className="flex-1 space-y-1">
                {navItems.map((item) => (
                    <Button
                        key={item.label}
                        variant={item.active ? "secondary" : "ghost"}
                        className="w-full justify-start gap-3 h-12 text-base font-normal"
                    >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                    </Button>
                ))}
            </nav>

            <div className="pt-4 border-t">
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => signOut()}
                >
                    <LogOut className="h-5 w-5" />
                    Log Out
                </Button>
            </div>
        </div>
    );
}
