"use client";

import { useEffect, useRef } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { socket } from "@/lib/socket";
import { useCallStore } from "@/store/useCallStore";
import { useChatStore } from "@/store/useChatStore";
import { useUserStore } from "@/store/useUserStore";
import { CallModal } from "./CallModal";
import { ActiveCall } from "./ActiveCall";
import { useWebRTC } from "@/components/providers/WebRTCProvider";
import { useRouter } from "next/navigation";

export function SocketClient() {
    const { user } = useUser();
    const { getToken } = useAuth();
    const {
        callStatus,
        setCallStatus,
        setCaller,
        setCallType,
        setRemoteUserId,
        resetCall
    } = useCallStore();
    const { createPeerConnection, startLocalStream, endCall, peerConnection } = useWebRTC();
    const candidateQueue = useRef<RTCIceCandidate[]>([]);

    const { activeChatUser, addMessage, addTypingUser, removeTypingUser, markMessagesAsRead } = useChatStore();
    const { setMongoUser } = useUserStore();

    useEffect(() => {
        if (!user) return;

        const handleConnect = async () => {
            // Sync user with backend
            try {
                const token = await getToken();
                const res = await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'}/api/users/sync`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        email: user.primaryEmailAddress?.emailAddress,
                        fullName: user.fullName,
                        imageUrl: user.imageUrl
                    })
                });
                if (!res.ok) throw new Error("Sync failed");
                const data = await res.json();
                setMongoUser(data);
            } catch (err) {
                console.error("Failed to sync user", err);
            }

            // Emit online
            socket.emit("user-online", {
                userId: user.id,
                userInfo: {
                    name: user.fullName,
                    avatar: user.imageUrl
                }
            });
        };

        socket.on('connect', handleConnect);

        if (socket.connected) {
            handleConnect();
        } else {
            socket.connect();
        }

        // --- Chat Events ---
        socket.on("new-message", (message) => {
            const currentActive = useChatStore.getState().activeChatUser;
            // Only add if it belongs to current chat? Or add to store anyway?
            // Ideally add to store, and UI filters. For now, simple store:
            if (currentActive === message.senderId || currentActive === message.receiverId) {
                addMessage(message);
                if (currentActive === message.senderId) {
                    socket.emit('mark-read', { senderId: message.senderId, receiverId: user.id });
                }
            }
        });

        socket.on("message-sent", (message) => {
            addMessage(message);
        });

        socket.on("typing", ({ senderId }) => {
            addTypingUser(senderId);
        });

        socket.on("stop-typing", ({ senderId }) => {
            removeTypingUser(senderId);
        });

        socket.on("messages-read", ({ byUserId }) => {
            markMessagesAsRead(user.id);
        });

        // --- Presence Events ---
        socket.on("online-users", (users: { userId: string }[]) => {
            const ids = users.map(u => u.userId);
            useUserStore.getState().setOnlineUsers(ids);
        });

        // --- Social Events ---
        socket.on("friend-request-received", (request) => {
            const { addRequest } = useUserStore.getState();
            addRequest(request);
        });

        socket.on("friend-request-accepted", ({ friend }) => {
            const { addFriend, removeRequest } = useUserStore.getState();
            addFriend(friend);
            // Also re-fetch profile to be safe
            handleConnect();
        });

        // --- Call Events ---
        socket.on("incoming-call", ({ callerId, callerName, callerAvatar, callType }) => {
            setCallStatus("incoming");
            setCaller({ id: callerId, name: callerName, avatar: callerAvatar });
            setCallType(callType);
            setRemoteUserId(callerId);
        });

        socket.on("call-accepted", async ({ signal }) => {
            setCallStatus("active");
            if (peerConnection.current) {
                const offer = await peerConnection.current.createOffer();
                await peerConnection.current.setLocalDescription(offer);
                const { remoteUserId } = useCallStore.getState();
                if (remoteUserId) {
                    socket.emit('signal', { targetId: remoteUserId, signal: offer });
                }
            }
        });

        socket.on("call-rejected", () => {
            alert("Call rejected");
            resetCall();
        });

        socket.on("call-ended", () => {
            endCall();
        });

        socket.on("signal", async ({ senderId, signal }) => {
            const onIceCandidate = (candidate: RTCIceCandidate) => {
                const { remoteUserId } = useCallStore.getState();
                if (remoteUserId) {
                    socket.emit('signal', { targetId: remoteUserId, signal: { candidate } });
                }
            };

            if (!peerConnection.current) createPeerConnection(onIceCandidate);

            if (signal.type === 'offer') {
                // Do NOT setRemoteUserId(senderId) here because senderId is a Socket ID, 
                // and we need a User ID. We already have the User ID from 'incoming-call'.

                await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(signal));
                const answer = await peerConnection.current?.createAnswer();
                await peerConnection.current?.setLocalDescription(answer);

                const { remoteUserId } = useCallStore.getState();
                if (remoteUserId) {
                    socket.emit('signal', { targetId: remoteUserId, signal: answer });
                }

                // Process queued candidates
                while (candidateQueue.current.length > 0) {
                    const candidate = candidateQueue.current.shift();
                    if (candidate) {
                        await peerConnection.current?.addIceCandidate(candidate);
                    }
                }

            } else if (signal.type === 'answer') {
                await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(signal));
                // Process queued candidates
                while (candidateQueue.current.length > 0) {
                    const candidate = candidateQueue.current.shift();
                    if (candidate) {
                        await peerConnection.current?.addIceCandidate(candidate);
                    }
                }
            } else if (signal.candidate) {
                const candidate = new RTCIceCandidate(signal.candidate);
                if (peerConnection.current?.remoteDescription) {
                    await peerConnection.current?.addIceCandidate(candidate);
                } else {
                    // Queue it
                    candidateQueue.current.push(candidate);
                }
            }
        });

        return () => {
            socket.off("connect", handleConnect);
            socket.off("new-message");
            socket.off("message-sent");
            socket.off("typing");
            socket.off("stop-typing");
            socket.off("messages-read");
            socket.off("friend-request-received");
            socket.off("friend-request-accepted");
            socket.off("incoming-call");
            socket.off("call-accepted");
            socket.off("call-rejected");
            socket.off("call-ended");
            socket.off("signal");
            if (socket.connected) socket.disconnect();
        };
    }, [user, setCallStatus, setCaller, setCallType, resetCall, endCall, createPeerConnection, peerConnection, setRemoteUserId]);

    // Handle Ice Candidates emission
    useEffect(() => {
        if (peerConnection.current) {
            peerConnection.current.onicecandidate = (event) => {
                if (event.candidate) {
                    const { remoteUserId } = useCallStore.getState();
                    if (remoteUserId) {
                        socket.emit('signal', { targetId: remoteUserId, signal: { candidate: event.candidate } });
                    }
                }
            };
        }
    }, [peerConnection]);


    const handleAcceptCall = async () => {
        const { caller, callType } = useCallStore.getState();
        if (!caller) return;

        setCallStatus("active");

        // Define callback here or reuse if possible. 
        // Since handleIceCandidate is defined inside the component but not in this scope easily without refactoring,
        // we can redefine it or move it out. 
        // Better to move handleIceCandidate to component scope.
        const onIceCandidate = (candidate: RTCIceCandidate) => {
            const { remoteUserId } = useCallStore.getState();
            if (remoteUserId) {
                socket.emit('signal', { targetId: remoteUserId, signal: { candidate } });
            }
        };

        createPeerConnection(onIceCandidate);
        const stream = await startLocalStream(callType || 'audio');

        socket.emit("call-accepted", { callerId: caller.id });
    };

    const handleRejectCall = () => {
        const { caller } = useCallStore.getState();
        if (caller) {
            socket.emit("call-rejected", { callerId: caller.id });
        }
        resetCall();
    };

    const handleEndCall = () => {
        const { remoteUserId, callType } = useCallStore.getState();
        if (remoteUserId && user) {
            socket.emit("end-call", { callerId: user.id, receiverId: remoteUserId, callType });
        }
        endCall();
        // Return to dashboard logic
        useChatStore.getState().setActiveChatUser(null);
    };

    return (
        <>
            <CallModal onAccept={handleAcceptCall} onReject={handleRejectCall} />
            {(callStatus === 'active' || callStatus === 'outgoing') && <ActiveCall onEndCall={handleEndCall} />}
        </>
    );
}
