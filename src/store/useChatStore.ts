import { create } from 'zustand';

export interface Message {
    _id: string;
    senderId: string;
    receiverId: string;
    content: string;
    type: 'text' | 'image';
    isRead: boolean;
    createdAt: string;
}

interface ChatStore {
    activeChatUser: string | null; // Clerk ID of the user we are chatting with
    messages: Message[];
    typingUsers: string[]; // List of user IDs currently typing to us

    setActiveChatUser: (userId: string | null) => void;
    setMessages: (messages: Message[]) => void;
    addMessage: (message: Message) => void;

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
