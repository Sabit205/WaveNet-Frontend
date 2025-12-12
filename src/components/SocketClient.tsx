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
        setRemoteUserId,
        resetCall
    } = useCallStore();
    const { createPeerConnection, startLocalStream, endCall, peerConnection } = useWebRTC();

    useEffect(() => {
        if (!user) return;

        const handleConnect = () => {
            socket.emit("user-online", {
                userId: user.id,
                userInfo: {
                    name: user.fullName,
                    avatar: user.imageUrl
                }
            });
        };

        socket.on('connect', handleConnect);

        // If already connected, emit immediately
        if (socket.connected) {
            handleConnect();
        } else {
            socket.connect();
        }

        socket.on("incoming-call", ({ callerId, callerName, callerAvatar, callType }) => {
            setCallStatus("incoming");
            setCaller({ id: callerId, name: callerName, avatar: callerAvatar });
            setCallType(callType);
            setRemoteUserId(callerId); // IMPORTANT: Set remote user ID for callee
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
                setRemoteUserId(senderId); // Ensure we know who sent the offer
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
        createPeerConnection();
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
        // We rely on the store state or just emit end-call. 
        // Ideally we should pass the targetId, but the backend can look it up or we use remoteUserId.
        // The store has remoteUserId.
        const { remoteUserId, callType } = useCallStore.getState();
        if (remoteUserId) {
            socket.emit("end-call", { receiverId: remoteUserId, callType });
        }
        endCall();
    };

    return (
        <>
            <CallModal onAccept={handleAcceptCall} onReject={handleRejectCall} />
            {(callStatus === 'active' || callStatus === 'outgoing') && <ActiveCall onEndCall={handleEndCall} />}
        </>
    );
}
