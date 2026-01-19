"use client";

import { Sidebar } from "@/components/chat/Sidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default function Home() {
  const { userId } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();

  // if (!userId) {
  //   redirect("/sign-in");
  // }
  // Redirect logic should technically be in middleware or server component, 
  // but for client component we can just show nothing or custom logic.

  return (
    <div className="flex h-screen items-center justify-center bg-slate-100">
      <div className="flex w-full h-full max-w-[1600px] bg-white shadow-xl overflow-hidden">
        <Sidebar className="hidden md:flex" />
        <ChatWindow conversationId={selectedConversationId} />
      </div>
    </div>
  );
}
