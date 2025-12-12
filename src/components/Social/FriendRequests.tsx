import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { useAuth } from '@clerk/nextjs';
import { useUserStore } from '@/store/useUserStore';
import { Check, X } from "lucide-react";

export function FriendRequests() {
    const { getToken } = useAuth();
    const { friendRequests, setFriendRequests, removeRequest, addFriend } = useUserStore();

    useEffect(() => {
        const fetchRequests = async () => {
            const token = await getToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'}/api/friends/requests`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) setFriendRequests(data);
        };
        fetchRequests();
    }, [getToken, setFriendRequests]);

    const handleResponse = async (requestId: string, action: 'accept' | 'reject') => {
        const token = await getToken();
        await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'}/api/friends/${action}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ requestId })
        });

        removeRequest(requestId);
        if (action === 'accept') {
            // Ideally re-fetch or optimistically update friends
            window.location.reload(); // Simple sync for now
        }
    };

    if (friendRequests.length === 0) return null;

    return (
        <div className="mb-6 p-4 border rounded-lg bg-muted/20">
            <h3 className="font-semibold mb-3">Friend Requests</h3>
            <div className="space-y-2">
                {friendRequests.map(req => (
                    <div key={req._id} className="flex items-center justify-between bg-card p-3 rounded border">
                        <span className="font-medium">{req.sender.fullName}</span>
                        <div className="flex gap-2">
                            <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700" onClick={() => handleResponse(req._id, 'accept')}>
                                <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => handleResponse(req._id, 'reject')}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
