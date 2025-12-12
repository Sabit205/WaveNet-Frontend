import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserPlus, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserStore } from '@/store/useUserStore';
import { useAuth } from '@clerk/nextjs';

export function SearchBar() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const { getToken } = useAuth();
    const { friendRequests } = useUserStore(); // To disable button if already pending

    const handleSearch = async () => {
        if (!query) return;
        try {
            const token = await getToken();
            // Since we are frontend, simple fetch to our backend logic
            const res = await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'}/api/users/search?query=${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setResults(data);
        } catch (err) {
            console.error("Search failed", err);
        }
    };

    const sendRequest = async (receiverClerkId: string) => {
        try {
            const token = await getToken();
            await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'}/api/friends/request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ receiverClerkId })
            });
            alert("Request sent!");
        } catch (err) {
            alert("Failed to send request");
        }
    };

    return (
        <div className="w-full max-w-md mx-auto mb-6 space-y-4">
            <div className="flex gap-2">
                <Input
                    placeholder="Search users by name or email..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} size="icon"><Search className="h-4 w-4" /></Button>
            </div>

            {results.length > 0 && (
                <div className="bg-card border rounded-md p-2 space-y-2">
                    {results.map(user => (
                        <div key={user.clerkId} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={user.imageUrl} />
                                    <AvatarFallback>{user.fullName[0]}</AvatarFallback>
                                </Avatar>
                                <div className="text-sm">
                                    <p className="font-medium">{user.fullName}</p>
                                    <p className="text-muted-foreground text-xs">{user.email}</p>
                                </div>
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => sendRequest(user.clerkId)}>
                                <UserPlus className="h-4 w-4 mr-2" />
                                Add
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
