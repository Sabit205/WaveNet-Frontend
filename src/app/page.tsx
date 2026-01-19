"use client";

import { Sidebar } from "@/components/chat/Sidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export default function Home() {
  const { userId } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Middleware handles auth protection

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      {/* Desktop Sidebar */}
      <Sidebar
        className="hidden md:flex flex-shrink-0"
        onSelectConversation={setSelectedConversationId}
        selectedId={selectedConversationId}
      />

      {/* Mobile Sidebar (Drawer) */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="p-0 border-r border-sidebar-border bg-transparent w-80">
          <Sidebar
            className="w-full h-full border-none"
            onSelectConversation={(id, user) => {
              setSelectedConversationId(id);
              setIsMobileOpen(false);
            }}
            selectedId={selectedConversationId}
          />
        </SheetContent>
      </Sheet>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative z-0">
        <ChatWindow
          conversationId={selectedConversationId}
          onMobileMenuClick={() => setIsMobileOpen(true)}
        />
      </div>
    </div>
  );
}
