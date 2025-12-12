import { useEffect, useRef, useCallback } from 'react';
import { socket } from '@/lib/socket';
import { useCallStore } from '@/store/useCallStore';
import { useUser } from '@clerk/nextjs';

const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
};

export const useWebRTC = () => {
    const { user } = useUser();
    const {
        callStatus,
        callType,
        setLocalStream,
        setRemoteStream,
        setCallStatus,
        resetCall
    } = useCallStore();

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const createPeerConnection = useCallback(() => {
        if (peerConnection.current) return;

        peerConnection.current = new RTCPeerConnection(STUN_SERVERS);

        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate && callStatus === 'active') { // Only send if active or connecting
                // We need the targetId here. This is a simplification. 
                // In a real app, we'd store the targetId in the store or pass it around.
                // For now, we rely on the socket handler in the component to send this, 
                // OR we emit here if we know the target.
                // Actually, let's expose the candidate handling to the component or store.
            }
        };

        peerConnection.current.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };
    }, [callStatus, setRemoteStream]);

    const startLocalStream = useCallback(async (type: 'audio' | 'video') => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: type === 'video'
            });

            localStreamRef.current = stream;
            setLocalStream(stream);

            // Add tracks to peer connection
            if (peerConnection.current) {
                stream.getTracks().forEach(track => {
                    peerConnection.current?.addTrack(track, stream);
                });
            }
            return stream;
        } catch (err) {
            console.error('Error accessing media devices:', err);
        }
    }, [setLocalStream]);

    const endCall = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        resetCall();
    }, [resetCall]);

    return {
        peerConnection,
        startLocalStream,
        endCall,
        createPeerConnection
    };
};
