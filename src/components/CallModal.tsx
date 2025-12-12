import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Phone, Video } from "lucide-react";
import { useCallStore } from "@/store/useCallStore";

interface CallModalProps {
    onAccept: () => void;
    onReject: () => void;
}

export function CallModal({ onAccept, onReject }: CallModalProps) {
    const { callStatus, caller, callType } = useCallStore();
    const isOpen = callStatus === 'incoming';

    if (!caller) return null;

    return (
        <Dialog open={isOpen} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center">Incoming {callType} Call</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center space-y-4 py-4">
                    <Avatar className="h-24 w-24">
                        <AvatarImage src={caller.avatar} />
                        <AvatarFallback>{caller.name[0]}</AvatarFallback>
                    </Avatar>
                    <h3 className="text-xl font-semibold">{caller.name}</h3>
                    <p className="text-muted-foreground animate-pulse">is calling you...</p>
                </div>
                <DialogFooter className="flex justify-center sm:justify-center gap-4">
                    <Button variant="destructive" size="icon" className="h-12 w-12 rounded-full" onClick={onReject}>
                        <Phone className="h-6 w-6 rotate-[135deg]" />
                    </Button>
                    <Button variant="default" size="icon" className="h-12 w-12 rounded-full bg-green-500 hover:bg-green-600" onClick={onAccept}>
                        {callType === 'video' ? <Video className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
