import { useEffect, useRef } from 'react';
import { useCallStore } from '@/store/useCallStore';
import { Button } from "@/components/ui/button";
import { PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";

interface ActiveCallProps {
    onEndCall: () => void;
}

export function ActiveCall({ onEndCall }: ActiveCallProps) {
    const { localStream, remoteStream, callType } = useCallStore();
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            {/* Remote Video (Main) */}
            <div className="flex-1 relative overflow-hidden">
                {remoteStream ? (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-white">
                        <p>Connecting...</p>
                    </div>
                )}

                {/* Local Video (PiP) */}
                {callType === 'video' && (
                    <div className="absolute bottom-24 right-4 w-32 h-48 bg-gray-900 rounded-lg overflow-hidden shadow-lg border border-gray-800">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="h-20 bg-gray-900/90 flex items-center justify-center gap-6">
                <Button variant="secondary" size="icon" className="rounded-full h-12 w-12">
                    <Mic className="h-5 w-5" />
                </Button>

                <Button
                    variant="destructive"
                    size="icon"
                    className="rounded-full h-14 w-14"
                    onClick={onEndCall}
                >
                    <PhoneOff className="h-6 w-6" />
                </Button>

                {callType === 'video' && (
                    <Button variant="secondary" size="icon" className="rounded-full h-12 w-12">
                        <Video className="h-5 w-5" />
                    </Button>
                )}
            </div>
        </div>
    );
}
