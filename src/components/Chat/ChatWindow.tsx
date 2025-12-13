"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { socket } from "@/lib/socket";
import { useChatStore } from '@/store/useChatStore';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Send, Phone, Video, Image as ImageIcon, Paperclip, Loader2, Check, CheckCheck } from "lucide-react";
import { useCallStore } from '@/store/useCallStore';
import { useWebRTC } from '@/components/providers/WebRTCProvider';

interface ChatWindowProps {
    friend: {
        clerkId: string;
        fullName: string;
        imageUrl: string;
        isOnline?: boolean;
    };
    onClose: () => void;
}

export function ChatWindow({ friend, onClose }: ChatWindowProps) {
    const { user } = useUser();
    const { getToken } = useAuth();
    const [newMessage, setNewMessage] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const { messages, fetchMessages, typingUsers, setMessages } = useChatStore();
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { setCallStatus, setCallType, setRemoteUserId } = useCallStore();
    const { createPeerConnection, startLocalStream } = useWebRTC();

    // Filter messages for this specific conversation
    // Note: If fetchMessages clears store, this filter might be redundant but safe.
    // Ideally useChatStore should store messages by conversation ID or we filter here.
    // Assuming store holds current active conversation messages or all messages.
    // For now, let's restart conversation on open.

    // We filter just in case the store holds mixed messages, though typically we'd clear or fetch fresh.
    const conversationMessages = messages.filter(
        msg => (msg.senderId === user?.id && msg.receiverId === friend.clerkId) ||
            (msg.senderId === friend.clerkId && msg.receiverId === user?.id)
    );

    useEffect(() => {
        if (user && friend) {
            // Fetch history when opening
            fetchMessages(user.id, friend.clerkId, getToken);
            // Mark read immediately
            socket.emit('mark-read', { senderId: friend.clerkId, receiverId: user.id });
        }
    }, [user, friend, fetchMessages, getToken]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [conversationMessages, typingUsers]);

    const handleSendMessage = (content: string, type: 'text' | 'image' | 'video' | 'file' = 'text', fileData?: { url: string, name: string }) => {
        if ((!content && type === 'text') || !user) return;

        const messageData = {
            senderId: user.id,
            receiverId: friend.clerkId,
            content: content || (type === 'text' ? '' : type), // Fallback content
            type,
            fileUrl: fileData?.url || "",
            fileName: fileData?.name || "",
            createdAt: new Date().toISOString(),
            isRead: false
        };

        socket.emit("send-message", messageData);
        setNewMessage("");

        // Optimistic update (optional, but socket usually echoes back)
        // addMessage(messageData); 
    };

    const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewMessage(e.target.value);
        if (!user) return;

        socket.emit("typing", { senderId: user.id, receiverId: friend.clerkId });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit("stop-typing", { senderId: user?.id, receiverId: friend.clerkId });
        }, 3000);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "");
            const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

            if (!cloudName) {
                alert("Cloudinary Cloud Name is missing in .env");
                return;
            }

            // Determine resource type
            const resourceType = file.type.startsWith('video') ? 'video' : 'image';
            // Note: 'raw' is used for files usually, but let's stick to image/video for now unless it's a generic file.
            // If PDF or other, use 'auto' or 'raw'.

            const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
                method: "POST",
                body: formData
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error?.message || "Upload failed");
            }
            const data = await res.json();

            let type: 'image' | 'video' | 'file' = 'file';
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type.startsWith('video/')) type = 'video';

            handleSendMessage(type.toUpperCase(), type, { url: data.secure_url, name: file.name });

        } catch (error) {
            console.error(error);
            alert("Failed to upload file. Check console for details.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const startCall = async (type: 'audio' | 'video') => {
        setCallStatus("outgoing");
        setCallType(type);
        setRemoteUserId(friend.clerkId);

        const onIceCandidate = (candidate: RTCIceCandidate) => {
            socket.emit('signal', { targetId: friend.clerkId, signal: { candidate } });
        };
        createPeerConnection(onIceCandidate);
        await startLocalStream(type);

        socket.emit("call-user", {
            callerId: user?.id,
            receiverId: friend.clerkId,
            callType: type,
            callerName: user?.fullName,
            callerAvatar: user?.imageUrl
        });
    };

    const isTyping = typingUsers.includes(friend.clerkId);

    return (
        <div className="flex flex-col h-[500px] w-full max-w-md bg-background border rounded-t-xl shadow-2xl overflow-hidden fixed bottom-0 right-4 md:right-[320px] z-50">
            {/* Header */}
            <div className="p-3 border-b bg-primary text-primary-foreground flex justify-between items-center shadow-md">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Avatar className="h-9 w-9 border-2 border-white/20">
                            <AvatarImage src={friend.imageUrl} />
                            <AvatarFallback>{friend.fullName?.[0]}</AvatarFallback>
                        </Avatar>
                        {friend.isOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-primary"></span>}
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm leading-tight">{friend.fullName}</h4>
                        {isTyping ? (
                            <span className="text-xs opacity-90 animate-pulse font-medium">Typing...</span>
                        ) : (
                            <span className="text-xs opacity-80">{friend.isOnline ? 'Active now' : 'Offline'}</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/20 rounded-full" onClick={() => startCall('audio')}>
                        <Phone className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/20 rounded-full" onClick={() => startCall('video')}>
                        <Video className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/20 rounded-full" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
                {conversationMessages.map((msg, i) => {
                    const isMe = msg.senderId === user?.id;
                    return (
                        <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-2xl p-3 shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card border rounded-bl-none'
                                }`}>
                                {msg.type === 'text' && <p className="text-sm break-words">{msg.content}</p>}

                                {msg.type === 'image' && (
                                    <div className="space-y-1">
                                        <img src={msg.fileUrl} alt="Shared" className="rounded-lg max-h-[200px] object-cover w-full bg-black/10" />
                                        {msg.content !== 'IMAGE' && <p className="text-sm">{msg.content}</p>}
                                    </div>
                                )}

                                {msg.type === 'video' && (
                                    <div className="space-y-1">
                                        <video src={msg.fileUrl} controls className="rounded-lg max-h-[200px] w-full bg-black" />
                                        {msg.content !== 'VIDEO' && <p className="text-sm">{msg.content}</p>}
                                    </div>
                                )}

                                <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    {isMe && (
                                        msg.isRead ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {/* Invisible element to auto-scroll to */}
                <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-card border-t flex items-center gap-2">
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                    // Support basic images and videos
                    accept="image/*,video/*"
                />

                <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-primary hover:bg-muted"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    title="Send Photo/Video"
                >
                    {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
                </Button>

                <Input
                    placeholder="Type a message..."
                    className="flex-1 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary h-10 rounded-full px-4"
                    value={newMessage}
                    onChange={handleTyping}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(newMessage)}
                />
                <Button
                    size="icon"
                    onClick={() => handleSendMessage(newMessage)}
                    disabled={!newMessage.trim() && !isUploading}
                    className="rounded-full h-10 w-10 shrink-0 shadow-sm"
                >
                    <Send className="h-4 w-4 ml-0.5" />
                </Button>
            </div>
        </div>
    );
}
