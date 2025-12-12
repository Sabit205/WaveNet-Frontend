"use client";

import React, { createContext, useContext, useRef, useCallback, useState } from 'react';
import { useCallStore } from '@/store/useCallStore';
import { useUser } from '@clerk/nextjs';

interface WebRTCContextType {
    peerConnection: React.MutableRefObject<RTCPeerConnection | null>;
    createPeerConnection: () => void;
    startLocalStream: (type: 'audio' | 'video') => Promise<MediaStream | undefined>;
    endCall: () => void;
    toggleAudio: (enabled: boolean) => void;
    toggleVideo: (enabled: boolean) => void;
}

const WebRTCContext = createContext<WebRTCContextType | null>(null);

const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
};

export const WebRTCProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useUser();
    const {
        callStatus,
        setLocalStream,
        setRemoteStream,
        resetCall
    } = useCallStore();

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const createPeerConnection = useCallback(() => {
        if (peerConnection.current) return;

        peerConnection.current = new RTCPeerConnection(STUN_SERVERS);

        peerConnection.current.onicecandidate = (event) => {
            // Handled in SocketClient via the ref
        };

        peerConnection.current.ontrack = (event) => {
            console.log("Received remote track", event.streams[0]);
            setRemoteStream(event.streams[0]);
        };
    }, [setRemoteStream]);

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

    const toggleAudio = useCallback((enabled: boolean) => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => track.enabled = enabled);
        }
    }, []);

    const toggleVideo = useCallback((enabled: boolean) => {
        if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach(track => track.enabled = enabled);
        }
    }, []);

    return (
        <WebRTCContext.Provider value={{ peerConnection, createPeerConnection, startLocalStream, endCall, toggleAudio, toggleVideo }}>
            {children}
        </WebRTCContext.Provider>
    );
};

export const useWebRTC = () => {
    const context = useContext(WebRTCContext);
    if (!context) {
        throw new Error("useWebRTC must be used within a WebRTCProvider");
    }
    return context;
};
