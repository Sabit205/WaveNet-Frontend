"use client";

import React, { createContext, useContext, useRef, useCallback, useState } from 'react';
import { useCallStore } from '@/store/useCallStore';
import { useUser } from '@clerk/nextjs';

interface WebRTCContextType {
    peerConnection: React.MutableRefObject<RTCPeerConnection | null>;
    createPeerConnection: (onIceCandidate: (candidate: RTCIceCandidate) => void) => void;
    startLocalStream: (type: 'audio' | 'video') => Promise<MediaStream | undefined>;
    endCall: () => void;
    toggleAudio: (enabled: boolean) => void;
    toggleVideo: (enabled: boolean) => void;
}

const WebRTCContext = createContext<WebRTCContextType | null>(null);

const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
};

export const WebRTCProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useUser();
    const {
        setLocalStream,
        setRemoteStream,
        resetCall
    } = useCallStore();

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const createPeerConnection = useCallback((onIceCandidate: (candidate: RTCIceCandidate) => void) => {
        if (peerConnection.current) return;

        peerConnection.current = new RTCPeerConnection(STUN_SERVERS);

        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                onIceCandidate(event.candidate);
            }
        };

        peerConnection.current.ontrack = (event) => {
            console.log("Received remote track", event.streams[0]);
            if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
            } else {
                const newStream = new MediaStream();
                newStream.addTrack(event.track);
                setRemoteStream(newStream);
            }
        };

        peerConnection.current.onconnectionstatechange = () => {
            console.log("Connection state:", peerConnection.current?.connectionState);
            if (peerConnection.current?.connectionState === "failed" || peerConnection.current?.connectionState === "disconnected") {
                endCall();
            }
        };
    }, [setRemoteStream]);

    const startLocalStream = useCallback(async (type: 'audio' | 'video') => {
        try {
            const constraints = {
                audio: true, // Always request audio for now to ensure mic works, can toggle off later
                video: type === 'video'
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            localStreamRef.current = stream;
            setLocalStream(stream);

            if (peerConnection.current) {
                // Remove old tracks
                const senders = peerConnection.current.getSenders();
                senders.forEach(sender => {
                    if (sender.track) {
                        // Don't remove here blindly, might break negotiation. 
                        // Better to replaceTrack if possible, or remove and add.
                        // For simplicity in this app, we'll remove all and re-add.
                        peerConnection.current?.removeTrack(sender);
                    }
                });

                // Add new tracks
                stream.getTracks().forEach(track => {
                    peerConnection.current?.addTrack(track, stream);
                });
            } else {
                console.warn("PeerConnection not initialized when starting local stream");
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
