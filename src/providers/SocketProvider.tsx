"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";
import { io as ClientIO } from "socket.io-client";

type SocketContextType = {
    socket: any | null;
    isConnected: boolean;
};

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const socketInstance = new (ClientIO as any)(process.env.NEXT_PUBLIC_SERVER_URL!, {
            withCredentials: true,
        });

        socketInstance.on("connect", () => {
            setIsConnected(true);
            // We need user info here. 
            // Since we can't easily access hook state inside this effect without deps,
            // we'll rely on a second effect or assume user is available via props if we refactor.
            // BUT, cleaner way: The consuming component (like Sidebar or Page) invokes the setup.
        });

        socketInstance.on("disconnect", () => {
            setIsConnected(false);
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
