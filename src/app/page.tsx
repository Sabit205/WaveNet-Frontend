"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { socket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Video } from "lucide-react";
import { useCallStore } from "@/store/useCallStore";
import { useWebRTC } from "@/hooks/useWebRTC";
import Link from "next/link";

export default function Home() {
  const { user } = useUser();
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const { setCallStatus, setCallType, setRemoteUserId } = useCallStore();
  const { createPeerConnection, startLocalStream } = useWebRTC();

  useEffect(() => {
    socket.on("online-users", (users: string[]) => {
      setOnlineUsers(users.filter(id => id !== user?.id));
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
    createPeerConnection();
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

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Online Users</h2>
        <Link href="/call-history">
          <Button variant="outline">Call History</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {onlineUsers.length === 0 ? (
          <p className="text-muted-foreground">No other users online.</p>
        ) : (
          onlineUsers.map((userId) => (
            <Card key={userId}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar>
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
                  </div>
                  <span className="font-medium truncate max-w-[150px]">{userId}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => startCall(userId, 'audio')}>
                    <Phone className="h-5 w-5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => startCall(userId, 'video')}>
                    <Video className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
