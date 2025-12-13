"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { socket } from "@/lib/socket";
import { useChatStore } from "@/store/useChatStore";
import { useUserStore } from "@/store/useUserStore";
import Layout from "@/components/Layout/Layout";
import { SearchBar } from "@/components/Social/SearchBar";
import { FriendRequests } from "@/components/Social/FriendRequests";
import { ChatWindow } from "@/components/Chat/ChatWindow";

export default function Home() {
  const { user } = useUser();
  const { activeChatUser, setActiveChatUser } = useChatStore();
  const { mongoUser } = useUserStore();

  if (!mongoUser) {
    return <div className="flex items-center justify-center min-h-screen">Loading profile...</div>;
  }

  // Get friends list
  const friends = mongoUser.friends || [];

  return (
    <Layout>
      <div className="container mx-auto p-4 max-w-2xl pt-8">
        {/* Dynamic Feed / Dashboard Area */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-6">Welcome, {user?.firstName}</h2>

          <FriendRequests />

          <div className="bg-card border rounded-xl p-6 shadow-sm mb-6">
            <h3 className="font-semibold text-lg mb-4">Find Friends</h3>
            <SearchBar />
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/20 rounded-lg text-center cursor-pointer hover:bg-muted/30">
                <span className="block text-2xl mb-2">👋</span>
                <span className="font-medium">Say Hello</span>
              </div>
              <div className="p-4 bg-muted/20 rounded-lg text-center cursor-pointer hover:bg-muted/30">
                <span className="block text-2xl mb-2">📸</span>
                <span className="font-medium">Share Photo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Window Overlay - Persist logic */}
        {activeChatUser && (
          <div className="fixed bottom-0 right-4 z-50 md:right-[300px] w-80 shadow-2xl">
            {(() => {
              const friend = friends.find((f: any) => f.clerkId === activeChatUser);
              if (!friend) return null;
              // We don't strictly need isOnline passed here if ChatWindow uses store, 
              // but passing prop is fine.
              return (
                <ChatWindow
                  friend={friend} // Socket handling for online status is in ChatWindow or global
                  onClose={() => setActiveChatUser(null)}
                />
              );
            })()}
          </div>
        )}
      </div>
    </Layout>
  );
}
