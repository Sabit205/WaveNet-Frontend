import { create } from 'zustand';

export interface Friend {
    _id: string;
    clerkId: string;
    fullName: string;
    email: string;
    imageUrl: string;
}

export interface FriendRequest {
    _id: string;
    sender: Friend;
    receiver: string; // ID
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string;
}

interface UserStore {
    friends: Friend[];
    friendRequests: FriendRequest[];
    mongoUser: any | null; // Full MongoDB user object

    setFriends: (friends: Friend[]) => void;
    setFriendRequests: (requests: FriendRequest[]) => void;
    setMongoUser: (user: any) => void;

    addFriend: (friend: Friend) => void;
    removeRequest: (requestId: string) => void;
    addRequest: (request: FriendRequest) => void;
}

export const useUserStore = create<UserStore>((set) => ({
    friends: [],
    friendRequests: [],
    mongoUser: null,

    setFriends: (friends) => set({ friends }),
    setFriendRequests: (requests) => set({ friendRequests: requests }),
    setMongoUser: (user) => set({ mongoUser: user }),

    addFriend: (friend) => set((state) => ({ friends: [...state.friends, friend] })),

    removeRequest: (requestId) => set((state) => ({
        friendRequests: state.friendRequests.filter(req => req._id !== requestId)
    })),

    addRequest: (request) => set((state) => ({
        friendRequests: [...state.friendRequests, request]
    }))
}));
