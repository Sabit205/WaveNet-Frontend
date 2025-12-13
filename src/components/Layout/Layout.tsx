"use client";

import { Sidebar } from "./Sidebar";
import { RightPanel } from "./RightPanel";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-background text-foreground font-sans">
            <Sidebar />
            <main className="flex-1 min-w-0 md:border-r border-border">
                {children}
            </main>
            <RightPanel />
        </div>
    );
}
