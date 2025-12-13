"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { socket } from "@/lib/socket";
import { useChatStore } from '@/store/useChatStore';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Send, Phone, Video, Image as ImageIcon, Paperclip, Loader2, Check, CheckCheck, FileText, Trash2 } from "lucide-react";
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

// Attachment structure for staging
interface Attachment {
    id: string;
    file: File;
    localUrl: string; // For immediate preview
    cloudUrl?: string; // Set after upload
    type: 'image' | 'video' | 'file';
    isUploading: boolean;
}

export function ChatWindow({ friend, onClose }: ChatWindowProps) {
    const { user } = useUser();
    const { getToken } = useAuth();
    const [newMessage, setNewMessage] = useState("");

    // Staging state
    const [attachments, setAttachments] = useState<Attachment[]>([]);

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
    }, [conversationMessages, typingUsers, attachments]);

    // Handle Upload Logic per file
    const uploadFileToCloudinary = async (file: File): Promise<string> => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "");
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

        if (!cloudName) throw new Error("Missing Cloudinary Config");

        let resourceType = 'raw';
        if (file.type.startsWith('image/')) resourceType = 'image';
        else if (file.type.startsWith('video/')) resourceType = 'video';

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
            method: "POST",
            body: formData
        });

        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        return data.secure_url;
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;

        const newAttachments: Attachment[] = [];
        const files = Array.from(e.target.files);

        // 1. Create local previews immediately
        for (const file of files) {
            let type: 'image' | 'video' | 'file' = 'file';
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type.startsWith('video/')) type = 'video';

            newAttachments.push({
                id: Math.random().toString(36).substring(7),
                file,
                localUrl: URL.createObjectURL(file),
                type,
                isUploading: true
            });
        }

        setAttachments(prev => [...prev, ...newAttachments]);

        // 2. Start uploads in background
        for (const att of newAttachments) {
            try {
                const cloudUrl = await uploadFileToCloudinary(att.file);
                setAttachments(prev => prev.map(p => p.id === att.id ? { ...p, cloudUrl, isUploading: false } : p));
            } catch (err) {
                console.error("Upload failed for", att.file.name, err);
                // Remove failed upload or show error state. Removing for now.
                setAttachments(prev => prev.filter(p => p.id !== att.id));
                alert(`Failed to upload ${att.file.name}`);
            }
        }

        // Reset input so same file can be selected again if needed
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeAttachment = (id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    };

    const handleSendMessage = () => {
        const isUploadingAny = attachments.some(a => a.isUploading);
        if (isUploadingAny) {
            alert("Please wait for files to finish uploading.");
            return;
        }

        if ((!newMessage.trim() && attachments.length === 0) || !user) return;

        // 1. Send Text Message (if exists)
        if (newMessage.trim()) {
            socket.emit("send-message", {
                senderId: user.id,
                receiverId: friend.clerkId,
                content: newMessage.trim(),
                type: 'text',
                fileUrl: "",
                fileName: "",
                createdAt: new Date().toISOString(),
                isRead: false
            });
        }

        // 2. Send Media Messages (one per attachment)
        // Since backend doesn't support array, we send distinct messages.
        attachments.forEach(att => {
            if (att.cloudUrl) {
                socket.emit("send-message", {
                    senderId: user.id,
                    receiverId: friend.clerkId,
                    content: att.type === 'file' ? att.file.name : att.type.toUpperCase(),
                    type: att.type,
                    fileUrl: att.cloudUrl,
                    fileName: att.file.name,
                    createdAt: new Date().toISOString(),
                    isRead: false
                });
            }
        });

        // Reset state
        setNewMessage("");
        setAttachments([]);
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
                            <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card border rounded-bl-none'
                                }`}>
                                {/* Media Content */}
                                {msg.type === 'image' && msg.fileUrl && (
                                    <div className="mb-2">
                                        <img src={msg.fileUrl} alt="Shared" className="rounded-lg max-h-[300px] w-full object-cover bg-black/10" loading="lazy" />
                                    </div>
                                )}
                                {msg.type === 'video' && msg.fileUrl && (
                                    <div className="mb-2">
                                        <video src={msg.fileUrl} controls className="rounded-lg max-h-[300px] w-full bg-black/90 aspect-video" >
                                            Your browser does not support the video tag.
                                        </video>
                                    </div>
                                )}
                                {msg.type === 'file' && msg.fileUrl && (
                                    <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 p-3 rounded-lg mb-2 ${isMe ? 'bg-white/10 hover:bg-white/20' : 'bg-muted hover:bg-muted/80'} transition-colors`}>
                                        <div className="p-2 bg-background/50 rounded-full">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{msg.fileName || "Attachment"}</p>
                                            <p className="text-xs opacity-70">Click to Download</p>
                                        </div>
                                    </a>
                                )}

                                {/* Text Content */}
                                {/* Logic: Show text if it exists AND it's not just the default 'IMAGE'/'VIDEO' type labels */}
                                {msg.content && msg.content !== 'IMAGE' && msg.content !== 'VIDEO' && msg.content !== 'FILE' && (
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
            {attachments.length > 0 && (
                <div className="px-4 py-2 bg-background border-t flex gap-2 overflow-x-auto min-h-[80px]">
                    {attachments.map(att => (
                        <div key={att.id} className="relative group shrink-0 w-16 h-16 rounded-md border overflow-hidden">
                            {att.type === 'image' && (
                                <img src={att.localUrl} alt="Preview" className="w-full h-full object-cover" />
                            )}
                            {att.type === 'video' && (
                                <div className="w-full h-full bg-black flex items-center justify-center">
                                    <Video className="h-6 w-6 text-white" />
                                </div>
                            )}
                            {att.type === 'file' && (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                    <FileText className="h-6 w-6 text-muted-foreground" />
                                </div>
                            )}

                            {/* Loading Overlay */}
                            {att.isUploading && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                                </div>
                            )}

                            {/* Remove Button */}
                            <button
                                onClick={() => removeAttachment(att.id)}
                                className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div className="p-3 bg-card border-t flex items-center gap-2">
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                    multiple
                    accept="image/*,video/*,application/pdf"
                />

                <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-primary hover:bg-muted"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach Files"
                >
                    <Paperclip className="h-5 w-5" />
                </Button>

                <Input
                    placeholder={attachments.length > 0 ? "Add a caption..." : "Type a message..."}
                    className="flex-1 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary h-10 rounded-full px-4"
                    value={newMessage}
                    onChange={handleTyping}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />

                <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={(!newMessage.trim() && attachments.length === 0) || attachments.some(a => a.isUploading)}
                    className="rounded-full h-10 w-10 shrink-0 shadow-sm transition-all"
                >
                    <Send className="h-4 w-4 ml-0.5" />
                </Button>
            </div>
        </div>
    );
}
