import { create } from 'zustand';

export type CallType = 'audio' | 'video';
export type CallStatus = 'idle' | 'incoming' | 'outgoing' | 'active';

interface CallState {
    callStatus: CallStatus;
    callType: CallType | null;
    caller: {
        id: string;
        name: string;
        avatar: string;
    } | null;
    remoteUserId: string | null;
    remoteStream: MediaStream | null;
    localStream: MediaStream | null;

    setCallStatus: (status: CallStatus) => void;
    setCallType: (type: CallType | null) => void;
    setCaller: (caller: { id: string; name: string; avatar: string } | null) => void;
    setRemoteUserId: (id: string | null) => void;
    setRemoteStream: (stream: MediaStream | null) => void;
    setLocalStream: (stream: MediaStream | null) => void;
    resetCall: () => void;
}

export const useCallStore = create<CallState>((set) => ({
    callStatus: 'idle',
    callType: null,
    caller: null,
    remoteUserId: null,
    remoteStream: null,
    localStream: null,

    setCallStatus: (status) => set({ callStatus: status }),
    setCallType: (type) => set({ callType: type }),
    setCaller: (caller) => set({ caller, remoteUserId: caller?.id || null }),
    setRemoteUserId: (id) => set({ remoteUserId: id }),
    setRemoteStream: (stream) => set({ remoteStream: stream }),
    setLocalStream: (stream) => set({ localStream: stream }),
    resetCall: () => set({
        callStatus: 'idle',
        callType: null,
        caller: null,
        remoteUserId: null,
        remoteStream: null,
        localStream: null
    })
}));
