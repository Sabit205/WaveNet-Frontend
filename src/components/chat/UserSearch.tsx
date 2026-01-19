"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useUser } from "@clerk/nextjs";
import axios from "axios";
import { useRouter } from "next/navigation";

export function UserSearch({ onConversationCreated }: { onConversationCreated?: (id: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const { user: currentUser } = useUser();
    const router = useRouter();

    // Debounce search (simplified)
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm) {
                setLoading(true);
                try {
                    // Actual search API with currentUser exclusion
                    const res = await axios.get(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/search?q=${searchTerm}&exclude=${currentUser?.id}`);
                    setUsers(res.data);
                } catch (error) {
                    console.error(error);
                } finally {
                    setLoading(false);
                }
            } else {
                setUsers([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, currentUser]);

    const startConversation = async (otherUserId: string) => {
        try {
            const res = await axios.post(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/conversations`, {
                senderId: currentUser?.id,
                receiverId: otherUserId
            });
            setIsOpen(false);
            if (onConversationCreated) {
                onConversationCreated(res.data._id);
            }
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-muted-foreground">
                    <Search className="mr-2 h-4 w-4" />
                    Search users...
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Search Users</DialogTitle>
                </DialogHeader>
                <Input
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="mt-4 space-y-2">
                    {loading && <p className="text-sm text-center">Loading...</p>}
                    {users.map((u) => (
                        <div key={u._id} className="flex items-center justify-between p-2 hover:bg-slate-100 rounded-lg cursor-pointer" onClick={() => startConversation(u._id)}>
                            <div className="flex items-center gap-2">
                                <Avatar>
                                    <AvatarImage src={u.image} />
                                    <AvatarFallback>{u.username[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium">{u.username}</p>
                                    <p className="text-xs text-muted-foreground">{u.email}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
