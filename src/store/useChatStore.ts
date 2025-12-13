import { create } from 'zustand';

export interface Message {
    _id: string;
    senderId: string;
    receiverId: string;
    content: string;
    type: 'text' | 'image' | 'video' | 'file';
    fileUrl?: string;
    fileName?: string;
    isRead: boolean;
    createdAt: string;
}

interface ChatStore {
    activeChatUser: string | null;
    messages: Message[];
    typingUsers: string[];

    setActiveChatUser: (userId: string | null) => void;
    setMessages: (messages: Message[]) => void;
    addMessage: (message: Message) => void;
    fetchMessages: (senderId: string, receiverId: string, getToken: () => Promise<string | null>) => Promise<void>;

    addTypingUser: (userId: string) => void;
    removeTypingUser: (userId: string) => void;

    markMessagesAsRead: (senderId: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
    activeChatUser: null,
    messages: [],
    typingUsers: [],

    setActiveChatUser: (userId) => set({ activeChatUser: userId }),
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

    fetchMessages: async (senderId, receiverId, getToken) => {
        try {
            const token = await getToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'}/api/chat/${receiverId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                set({ messages: data });
            }
        } catch (error) {
            console.error("Failed to fetch messages:", error);
        }
    },

    addTypingUser: (userId) => set((state) => ({
        typingUsers: state.typingUsers.includes(userId)
            ? state.typingUsers
            : [...state.typingUsers, userId]
    })),

    removeTypingUser: (userId) => set((state) => ({
        typingUsers: state.typingUsers.filter(id => id !== userId)
    })),

    markMessagesAsRead: (senderId) => set((state) => ({
        messages: state.messages.map(msg =>
            msg.senderId === senderId ? { ...msg, isRead: true } : msg
        )
    }))
}));
