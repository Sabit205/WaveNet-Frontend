"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { socket } from "@/lib/socket";
import { useChatStore } from '@/store/useChatStore';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Send, Phone, Video, Image as ImageIcon, Paperclip, Loader2, Check, CheckCheck, FileText } from "lucide-react";
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

interface PreviewFile {
    url: string;
    name: string;
    type: 'image' | 'video' | 'file';
}

export function ChatWindow({ friend, onClose }: ChatWindowProps) {
    const { user } = useUser();
    const { getToken } = useAuth();
    const [newMessage, setNewMessage] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);

    const { messages, fetchMessages, typingUsers } = useChatStore();
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { setCallStatus, setCallType, setRemoteUserId } = useCallStore();
    const { createPeerConnection, startLocalStream } = useWebRTC();

    const conversationMessages = messages.filter(
        msg => (msg.senderId === user?.id && msg.receiverId === friend.clerkId) ||
            (msg.senderId === friend.clerkId && msg.receiverId === user?.id)
    );

    useEffect(() => {
        if (user && friend) {
            fetchMessages(user.id, friend.clerkId, getToken);
            socket.emit('mark-read', { senderId: friend.clerkId, receiverId: user.id });
        }
    }, [user, friend, fetchMessages, getToken]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [conversationMessages, typingUsers, previewFile]);

    const handleSendMessage = () => {
        if ((!newMessage.trim() && !previewFile) || !user) return;

        const messageType = previewFile ? previewFile.type : 'text';
        const content = newMessage.trim() || (previewFile ? (previewFile.type === 'file' ? previewFile.name : previewFile.type.toUpperCase()) : '');

        const messageData = {
            senderId: user.id,
            receiverId: friend.clerkId,
            content: content,
            type: messageType,
            fileUrl: previewFile?.url || "",
            fileName: previewFile?.name || "",
            createdAt: new Date().toISOString(),
            isRead: false
        };

        socket.emit("send-message", messageData);

        // Reset state
        setNewMessage("");
        setPreviewFile(null);
        socket.emit("stop-typing", { senderId: user.id, receiverId: friend.clerkId });
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
                alert("Cloudinary configuration missing");
                return;
            }

            // Simple heuristic for resource type. 
            // Cloudinary supports 'image', 'video', 'raw' (for other files).
            let resourceType = 'raw';
            if (file.type.startsWith('image/')) resourceType = 'image';
            else if (file.type.startsWith('video/')) resourceType = 'video';

            const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
                method: "POST",
                body: formData
            });

            if (!res.ok) throw new Error("Upload failed");
            const data = await res.json();

            // Store in preview, don't send yet
            let type: 'image' | 'video' | 'file' = 'file';
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type.startsWith('video/')) type = 'video';

            setPreviewFile({
                url: data.secure_url,
                name: file.name,
                type: type
            });

        } catch (error) {
            console.error(error);
            alert("Upload failed");
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
        <div className="flex flex-col h-[550px] w-full max-w-md bg-background border rounded-t-xl shadow-2xl overflow-hidden fixed bottom-0 right-4 md:right-[320px] z-50 transition-all duration-300">
            {/* Header */}
            <div className="p-3 border-b bg-primary text-primary-foreground flex justify-between items-center shadow-md z-10">
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
                        {isTyping ? <span className="text-xs animate-pulse opacity-90">Typing...</span> : <span className="text-xs opacity-80">{friend.isOnline ? 'Active' : 'Offline'}</span>}
                    </div>
                </div>
                <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/20 rounded-full" onClick={() => startCall('audio')}><Phone className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/20 rounded-full" onClick={() => startCall('video')}><Video className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/20 rounded-full" onClick={onClose}><X className="h-4 w-4" /></Button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30 scroll-smooth">
                {conversationMessages.map((msg, i) => {
                    const isMe = msg.senderId === user?.id;
                    return (
                        <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-2xl p-3 shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card border rounded-bl-none'
                                }`}>
                                {/* Media Content */}
                                {msg.type === 'image' && (
                                    <div className="mb-2">
                                        <img src={msg.fileUrl} alt="Shared" className="rounded-lg max-h-[250px] w-full object-cover bg-black/10" />
                                    </div>
                                )}
                                {msg.type === 'video' && (
                                    <div className="mb-2">
                                        <video src={msg.fileUrl} controls className="rounded-lg max-h-[250px] w-full bg-black/90 aspect-video" />
                                    </div>
                                )}
                                {msg.type === 'file' && (
                                    <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 p-3 rounded-lg mb-2 ${isMe ? 'bg-white/10 hover:bg-white/20' : 'bg-muted hover:bg-muted/80'} transition-colors`}>
                                        <div className="p-2 bg-background/50 rounded-full">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{msg.fileName || "Attachment"}</p>
                                            <p className="text-xs opacity-70">Click to view</p>
                                        </div>
                                    </a>
                                )}

                                {/* Text Content */}
                                {msg.content && (msg.type === 'text' || (msg.content !== msg.type && msg.content !== msg.type.toUpperCase() && msg.content !== msg.fileName)) && (
                                    <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                                )}

                                {/* Metadata */}
                                <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    {isMe && (msg.isRead ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={scrollRef} />
            </div>

            {/* Staging / Preview Area */}
            {previewFile && (
                <div className="px-4 py-2 bg-background border-t flex items-center justify-between animate-in slide-in-from-bottom-5">
                    <div className="flex items-center gap-3 overflow-hidden">
                        {previewFile.type === 'image' && (
                            <img src={previewFile.url} alt="Preview" className="h-12 w-12 object-cover rounded-md border" />
                        )}
                        {previewFile.type === 'video' && (
                            <div className="h-12 w-12 bg-black rounded-md flex items-center justify-center">
                                <Video className="h-6 w-6 text-white" />
                            </div>
                        )}
                        {previewFile.type === 'file' && (
                            <div className="h-12 w-12 bg-muted rounded-md flex items-center justify-center">
                                <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate max-w-[200px]">{previewFile.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{previewFile.type}</p>
                        </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setPreviewFile(null)}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Input Area */}
            <div className="p-3 bg-card border-t flex items-center gap-2">
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                // Accept all, let handler decide
                />

                <div className="flex gap-0.5">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-primary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || !!previewFile}
                        title="Upload File"
                    >
                        {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                    </Button>
                </div>

                <Input
                    placeholder="Type a message..."
                    className="flex-1 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary h-10 rounded-full px-4"
                    value={newMessage}
                    onChange={handleTyping}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={(!newMessage.trim() && !previewFile) || isUploading}
                    className="rounded-full h-10 w-10 shrink-0 shadow-sm"
                >
                    <Send className="h-4 w-4 ml-0.5" />
                </Button>
            </div>
        </div>
    );
}
