"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { socket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Video, MessageCircle } from "lucide-react";
import { useCallStore } from "@/store/useCallStore";
import { useChatStore } from "@/store/useChatStore";
import { useUserStore } from "@/store/useUserStore";
import { useWebRTC } from "@/components/providers/WebRTCProvider";
import Link from "next/link";
import { SearchBar } from "@/components/Social/SearchBar";
import { FriendRequests } from "@/components/Social/FriendRequests";
import { ChatWindow } from "@/components/Chat/ChatWindow";

interface OnlineUser {
  userId: string;
  userInfo: {
    name: string;
    avatar: string;
  };
}

export default function Home() {
  const { user } = useUser();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const { setCallStatus, setCallType, setRemoteUserId } = useCallStore();
  const { createPeerConnection, startLocalStream } = useWebRTC();
  const { activeChatUser, setActiveChatUser } = useChatStore();
  const { mongoUser } = useUserStore();

  useEffect(() => {
    socket.on("online-users", (users: OnlineUser[]) => {
      // Filter out self
      setOnlineUsers(users.filter(u => u.userId !== user?.id));
    });

    return () => {
      socket.off("online-users");
    };
  }, [user]);

  const startCall = async (targetId: string, type: 'audio' | 'video') => {
    setCallStatus("outgoing");
    setCallType(type);
    setRemoteUserId(targetId);

    // Initialize WebRTC
    const onIceCandidate = (candidate: RTCIceCandidate) => {
      socket.emit('signal', { targetId, signal: { candidate } });
    };
    createPeerConnection(onIceCandidate);
    await startLocalStream(type);

    // Emit call event
    socket.emit("call-user", {
      callerId: user?.id,
      receiverId: targetId,
      callType: type,
      callerName: user?.fullName,
      callerAvatar: user?.imageUrl
    });
  };

  if (!mongoUser) {
    return <div className="flex items-center justify-center min-h-screen">Loading profile...</div>;
  }

  // Get friends list
  const friends = mongoUser.friends || [];

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Social Dashboard</h2>
        <Link href="/call-history">
          <Button variant="outline">Call History</Button>
        </Link>
      </div>

      <SearchBar />
      <FriendRequests />

      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-4">My Friends ({friends.length})</h3>

        {friends.length === 0 ? (
          <div className="text-center p-8 bg-muted/20 rounded-lg border border-dashed">
            <p className="text-muted-foreground">You haven't added any friends yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Use the search bar above to find people!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {friends.map((friend: any) => {
              const isOnline = onlineUsers.some(u => u.userId === friend.clerkId);
              return (
                <Card key={friend._id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar>
                          <AvatarImage src={friend.imageUrl} />
                          <AvatarFallback>{friend.fullName?.[0]}</AvatarFallback>
                        </Avatar>
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                      </div>
                      <div>
                        <span className="font-medium truncate max-w-[150px] block">{friend.fullName}</span>
                        <span className="text-xs text-muted-foreground">{isOnline ? 'Online' : 'Offline'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => setActiveChatUser(friend.clerkId)}>
                        <MessageCircle className="h-5 w-5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => startCall(friend.clerkId, 'audio')} disabled={!isOnline}>
                        <Phone className="h-5 w-5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => startCall(friend.clerkId, 'video')} disabled={!isOnline}>
                        <Video className="h-5 w-5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Chat Window Overlay */}
      {activeChatUser && (
        <div className="fixed bottom-0 right-4 z-40">
          {(() => {
            const friend = friends.find((f: any) => f.clerkId === activeChatUser);
            if (!friend) return null;
            const isOnline = onlineUsers.some(u => u.userId === friend.clerkId);

            return (
              <ChatWindow
                friend={{ ...friend, isOnline }}
                onClose={() => setActiveChatUser(null)}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}
