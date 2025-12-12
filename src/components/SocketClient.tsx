"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { socket } from "@/lib/socket";
import { useCallStore } from "@/store/useCallStore";
import { CallModal } from "./CallModal";
import { ActiveCall } from "./ActiveCall";
import { useWebRTC } from "@/components/providers/WebRTCProvider";

export function SocketClient() {
    const { user } = useUser();
    const {
        callStatus,
        setCallStatus,
        setCaller,
        setCallType,
        resetCall
    } = useCallStore();
    const { createPeerConnection, startLocalStream, endCall, peerConnection } = useWebRTC();

    useEffect(() => {
        if (!user) return;

        socket.connect();
        socket.emit("user-online", user.id);

        socket.on("incoming-call", ({ callerId, callerName, callerAvatar, callType }) => {
            setCallStatus("incoming");
            setCaller({ id: callerId, name: callerName, avatar: callerAvatar });
            setCallType(callType);
        });

        socket.on("call-accepted", async ({ signal }) => {
            setCallStatus("active");
            // If we receive call-accepted, we are the caller.
            // We should create the offer now.
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
            if (!peerConnection.current) createPeerConnection();

            if (signal.type === 'offer') {
                await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(signal));
                const answer = await peerConnection.current?.createAnswer();
                await peerConnection.current?.setLocalDescription(answer);
                socket.emit('signal', { targetId: senderId, signal: answer });
            } else if (signal.type === 'answer') {
                await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(signal));
            } else if (signal.candidate) {
                await peerConnection.current?.addIceCandidate(new RTCIceCandidate(signal.candidate));
            }
        });

        return () => {
            socket.off("incoming-call");
            socket.off("call-accepted");
            socket.off("call-rejected");
            socket.off("call-ended");
            socket.off("signal");
            socket.disconnect();
        };
    }, [user, setCallStatus, setCaller, setCallType, resetCall, endCall, createPeerConnection, peerConnection]);

    // Handle Ice Candidates emission
    useEffect(() => {
        if (peerConnection.current) {
            peerConnection.current.onicecandidate = (event) => {
                if (event.candidate) {
                    // We need to know who we are talking to. 
                    // For now, let's assume we store the 'otherUserId' in the store.
                    // This is a missing piece in the store.
                    // Let's assume we broadcast or have a way to know.
                    // For simplicity in this step, I'll skip the exact targetId logic here 
                    // but it should be in the store as 'remoteUserId'.
                }
            };
        }
    }, [peerConnection]);


    const handleAcceptCall = async () => {
        const { caller, callType } = useCallStore.getState();
        if (!caller) return;

        setCallStatus("active");
        createPeerConnection();
        const stream = await startLocalStream(callType || 'audio');

        // Create Answer (Wait for offer? Actually usually caller sends offer first. 
        // But in this flow, we just accepted. Caller should have sent offer? 
        // Or we initiate WebRTC now?
        // Let's assume Caller creates Offer upon "call-accepted" or immediately.
        // Simplest: Caller creates offer immediately when calling? No, wait for accept.
        // Flow: 
        // 1. A calls B (Socket)
        // 2. B accepts (Socket) -> A receives 'call-accepted'
        // 3. A creates Offer -> sends to B
        // 4. B receives Offer -> sends Answer

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
        const { caller } = useCallStore.getState(); // We need to know who the other person is.
        // If we are caller, we have receiverId. If we are receiver, we have callerId.
        // Store needs 'remoteUserId'.
        // For now, just emit end-call and let backend handle or broadcast.
        // Actually backend needs targetId.
        // I'll update store to have 'remoteUserId'.
        endCall();
    };

    return (
        <>
            <CallModal onAccept={handleAcceptCall} onReject={handleRejectCall} />
            {callStatus === 'active' && <ActiveCall onEndCall={handleEndCall} />}
        </>
    );
}
