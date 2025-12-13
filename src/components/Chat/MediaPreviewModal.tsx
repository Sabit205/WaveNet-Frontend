"use client";

import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { X, Download, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface MediaPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileUrl: string;
    type: 'image' | 'video';
    fileName?: string;
}

export function MediaPreviewModal({ isOpen, onClose, fileUrl, type, fileName }: MediaPreviewModalProps) {
    const [zoom, setZoom] = useState(1);

    const handleDownload = async () => {
        try {
            const response = await fetch(fileUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName || `download-${Date.now()}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Download failed:", error);
            // Fallback: Open in new tab
            window.open(fileUrl, '_blank');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl w-full h-[80vh] p-0 bg-background/95 backdrop-blur-sm border-none shadow-2xl flex flex-col items-center justify-center overflow-hidden">
                {/* Controls */}
                <div className="absolute top-4 right-4 flex gap-2 z-50">
                    <Button variant="secondary" size="icon" onClick={handleDownload} title="Download">
                        <Download className="h-4 w-4" />
                    </Button>
                    <DialogClose asChild>
                        <Button variant="secondary" size="icon">
                            <X className="h-4 w-4" />
                        </Button>
                    </DialogClose>
                </div>

                {/* Content */}
                <div className="flex-1 w-full flex items-center justify-center overflow-auto p-4">
                    {type === 'image' && (
                        <div className="relative group transition-transform duration-200" style={{ transform: `scale(${zoom})` }}>
                            <img
                                src={fileUrl}
                                alt="Preview"
                                className="max-h-[70vh] max-w-full object-contain rounded-md shadow-lg"
                            />
                            {/* Zoom Controls Overlay */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-1 rounded-full">
                                <Button size="sm" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20 rounded-full" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20 rounded-full" onClick={() => setZoom(1)}><Maximize2 className="h-4 w-4" /></Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20 rounded-full" onClick={() => setZoom(z => Math.min(3, z + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    )}
                    {type === 'video' && (
                        <video
                            src={fileUrl}
                            controls
                            autoPlay
                            className="max-h-[75vh] max-w-full rounded-md shadow-lg bg-black cursor-pointer"
                        />
                    )}
                </div>

                <div className="w-full text-center pb-4 text-sm text-muted-foreground">
                    {fileName || "Media Preview"}
                </div>
            </DialogContent>
        </Dialog>
    );
}
