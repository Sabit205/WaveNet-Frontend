"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { socket } from "@/lib/socket";
import { useChatStore } from '@/store/useChatStore';
import { useUserStore } from '@/store/useUserStore';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Send, Phone, Video, Image as ImageIcon, Paperclip, Loader2, Check, CheckCheck, FileText, Trash2, Mic, AlertCircle } from "lucide-react";
import { useCallStore } from '@/store/useCallStore';
import { useWebRTC } from '@/components/providers/WebRTCProvider';

interface ChatWindowProps {
    friend: {
        clerkId: string;
        fullName: string;
        imageUrl: string;
        // isOnline prop is now optional/fallback as we check store
        isOnline?: boolean;
    };
    onClose: () => void;
}

interface Attachment {
    id: string;
    file: File;
    localUrl: string;
    cloudUrl?: string;
    type: 'image' | 'video' | 'audio' | 'file';
    isUploading: boolean;
    error?: string;
}

export function ChatWindow({ friend, onClose }: ChatWindowProps) {
    const { user } = useUser();
    const { getToken } = useAuth();
    const [newMessage, setNewMessage] = useState("");
    const [attachments, setAttachments] = useState<Attachment[]>([]);

    const { messages, fetchMessages, typingUsers } = useChatStore();
    const { onlineUsers } = useUserStore(); // Get global online status
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { setCallStatus, setCallType, setRemoteUserId } = useCallStore();
    const { createPeerConnection, startLocalStream } = useWebRTC();

    // Determine if friend is online checking the store
    const isFriendOnline = onlineUsers.includes(friend.clerkId);

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
    }, [conversationMessages, typingUsers, attachments]);

    // --- SECURE UPLOAD LOGIC ---
    const getUploadSignature = async () => {
        const token = await getToken();
        if (!token) throw new Error("No auth token");

        const res = await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'}/api/upload/sign`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Failed to sign request");
        return res.json();
    };

    const uploadFileToCloudinary = async (file: File): Promise<string> => {
        const { signature, timestamp, folder, cloudName, apiKey } = await getUploadSignature();

        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", apiKey);
        formData.append("timestamp", timestamp.toString());
        formData.append("signature", signature);
        if (folder) formData.append("folder", folder);

        let resourceType = 'raw';
        if (file.type.startsWith('image/')) resourceType = 'image';
        else if (file.type.startsWith('video/')) resourceType = 'video';
        else if (file.type.startsWith('audio/')) resourceType = 'video';

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
            method: "POST",
            body: formData
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message || "Cloudinary Upload Failed");
        }

        const data = await res.json();
        return data.secure_url;
    };

    const validateFile = (file: File): string | null => {
        const MAX_IMG_SIZE = 5 * 1024 * 1024;
        const MAX_VIDEO_SIZE = 20 * 1024 * 1024;
        const MAX_AUDIO_DOC_SIZE = 10 * 1024 * 1024;

        if (file.type.startsWith('image/') && file.size > MAX_IMG_SIZE) return "Image too large (Max 5MB)";
        if (file.type.startsWith('video/') && file.size > MAX_VIDEO_SIZE) return "Video too large (Max 20MB)";
        if ((file.type.startsWith('audio/') || file.type === 'application/pdf') && file.size > MAX_AUDIO_DOC_SIZE) return "File too large (Max 10MB)";

        return null;
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const files = Array.from(e.target.files);
        const newAttachments: Attachment[] = [];

        for (const file of files) {
            const error = validateFile(file);
            if (error) {
                alert(`${file.name}: ${error}`);
                continue;
            }

            let type: 'image' | 'video' | 'audio' | 'file' = 'file';
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type.startsWith('video/')) type = 'video';
            else if (file.type.startsWith('audio/')) type = 'audio';

            newAttachments.push({
                id: Math.random().toString(36).substring(7),
                file,
                localUrl: URL.createObjectURL(file), // Local preview
                type,
                isUploading: true
            });
        }

        if (newAttachments.length === 0) return;
        setAttachments(prev => [...prev, ...newAttachments]);

        for (const att of newAttachments) {
            try {
                const cloudUrl = await uploadFileToCloudinary(att.file);
                setAttachments(prev => prev.map(p => p.id === att.id ? { ...p, cloudUrl, isUploading: false } : p));
            } catch (err: any) {
                console.error(err);
                setAttachments(prev => prev.map(p => p.id === att.id ? { ...p, isUploading: false, error: "Upload Failed" } : p));
            }
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeAttachment = (id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    };

    const handleSendMessage = () => {
        const isUploadingAny = attachments.some(a => a.isUploading);
        if (isUploadingAny) {
            alert("Wait for uploads to finish.");
            return;
        }

        if (!newMessage.trim() && attachments.length === 0) return;

        // 1. Text Message
        if (newMessage.trim()) {
            socket.emit("send-message", {
                senderId: user?.id,
                receiverId: friend.clerkId,
                content: newMessage.trim(),
                type: 'text',
                createdAt: new Date().toISOString(),
                isRead: false
            });
        }

        // 2. Media Messages
        attachments.forEach(att => {
            if (att.cloudUrl && !att.error) {
                socket.emit("send-message", {
                    senderId: user?.id,
                    receiverId: friend.clerkId,
                    content: att.type === 'file' ? att.file.name : att.type.toUpperCase(),
                    type: att.type,
                    fileUrl: att.cloudUrl,
                    fileName: att.file.name,
                    fileSize: att.file.size,
                    mimeType: att.file.type,
                    createdAt: new Date().toISOString(),
                    isRead: false
                });
            }
        });

        setNewMessage("");
        setAttachments([]);
        socket.emit("stop-typing", { senderId: user?.id, receiverId: friend.clerkId });
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

    // ... call logic ...
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
        <div className="flex flex-col h-[600px] w-full max-w-md bg-background border rounded-t-xl shadow-2xl overflow-hidden fixed bottom-0 right-4 md:right-[320px] z-50 transition-all duration-300">
            {/* Header */}
            <div className="p-3 border-b bg-primary text-primary-foreground flex justify-between items-center shadow-md z-10 transition-colors duration-300">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Avatar className="h-9 w-9 border-2 border-white/20">
                            <AvatarImage src={friend.imageUrl} />
                            <AvatarFallback>{friend.fullName?.[0]}</AvatarFallback>
                        </Avatar>
                        {isFriendOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-primary animate-in zoom-in"></span>}
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm leading-tight">{friend.fullName}</h4>
                        {isTyping ? (
                            <span className="text-xs animate-pulse opacity-90 text-primary-foreground">Typing...</span>
                        ) : (
                            <span className={`text-xs transition-opacity ${isFriendOnline ? 'opacity-90' : 'opacity-60'}`}>
                                {isFriendOnline ? 'Active' : 'Offline'}
                            </span>
                        )}
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
                            <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card border rounded-bl-none'
                                }`}>
                                {/* Media Rendering with Fallback */}
                                {['image', 'video', 'audio', 'file'].includes(msg.type) && !msg.fileUrl && (
                                    <div className="p-2 mb-2 bg-black/20 rounded-md flex items-center gap-2 text-xs opacity-70">
                                        <AlertCircle className="h-4 w-4" />
                                        <span>Media content unavailable</span>
                                    </div>
                                )}

                                {msg.type === 'image' && msg.fileUrl && (
                                    <img src={msg.fileUrl} alt="Shared" className="rounded-lg max-h-[300px] w-full object-cover bg-black/10 mb-2" loading="lazy" />
                                )}
                                {msg.type === 'video' && msg.fileUrl && (
                                    <video src={msg.fileUrl} controls className="rounded-lg max-h-[300px] w-full bg-black/90 aspect-video mb-2" />
                                )}
                                {msg.type === 'audio' && msg.fileUrl && (
                                    <div className={`flex items-center gap-3 p-3 rounded-lg mb-2 ${isMe ? 'bg-white/10' : 'bg-muted'}`}>
                                        <Mic className="h-5 w-5" />
                                        <audio src={msg.fileUrl} controls className="h-8 w-[200px]" />
                                    </div>
                                )}
                                {msg.type === 'file' && msg.fileUrl && (
                                    <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 p-3 rounded-lg mb-2 ${isMe ? 'bg-white/10 hover:bg-white/20' : 'bg-muted hover:bg-muted/80'} transition-colors`}>
                                        <div className="p-2 bg-background/50 rounded-full"><FileText className="h-5 w-5" /></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{msg.fileName || "Attachment"}</p>
                                            <p className="text-[10px] opacity-70">
                                                {msg.fileSize ? `${(msg.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Download'}
                                            </p>
                                        </div>
                                    </a>
                                )}

                                {/* Text Content */}
                                {msg.content && !['IMAGE', 'VIDEO', 'AUDIO', 'FILE'].includes(msg.content) && (
                                    <p className="text-sm break-words whitespace-pre-wrap px-1">{msg.content}</p>
                                )}

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

            {/* Staging Area */}
            {attachments.length > 0 && (
                <div className="px-4 py-2 bg-background border-t flex gap-2 overflow-x-auto min-h-[80px]">
                    {attachments.map(att => (
                        <div key={att.id} className="relative group shrink-0 w-16 h-16 rounded-md border overflow-hidden bg-muted">
                            {att.type === 'image' && <img src={att.localUrl} className="w-full h-full object-cover" />}
                            {att.type === 'video' && <div className="w-full h-full flex items-center justify-center"><Video className="h-6 w-6 text-foreground" /></div>}
                            {att.type === 'audio' && <div className="w-full h-full flex items-center justify-center"><Mic className="h-6 w-6 text-foreground" /></div>}
                            {att.type === 'file' && <div className="w-full h-full flex items-center justify-center"><FileText className="h-6 w-6 text-foreground" /></div>}

                            {att.isUploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="h-5 w-5 text-white animate-spin" /></div>}
                            {att.error && <div className="absolute inset-0 bg-destructive/50 flex items-center justify-center text-[10px] text-white font-bold p-1 text-center">Error</div>}

                            <button onClick={() => removeAttachment(att.id)} className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-md p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input */}
            <div className="p-3 bg-card border-t flex items-center gap-2">
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} multiple accept="image/*,video/mp4,video/webm,audio/*,application/pdf" />
                <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} className="text-muted-foreground hover:text-primary"><Paperclip className="h-5 w-5" /></Button>

                <Input placeholder={attachments.length > 0 ? "Add caption..." : "Message..."} className="flex-1 bg-muted/50 border-none rounded-full" value={newMessage} onChange={handleTyping} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} />

                <Button size="icon" onClick={handleSendMessage} disabled={(!newMessage && attachments.length === 0) || attachments.some(a => a.isUploading)} className="rounded-full shadow-sm"><Send className="h-4 w-4 ml-0.5" /></Button>
            </div>
        </div>
    );
}
