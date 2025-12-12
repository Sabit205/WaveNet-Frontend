import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { SocketClient } from "@/components/SocketClient";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WhatsApp Clone",
  description: "Real-time calling app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <header className="flex justify-between items-center p-4 border-b">
            <h1 className="text-xl font-bold">WhatsApp Clone</h1>
            <div>
              <SignedOut>
                <SignInButton />
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </div>
          </header>
          <main className="min-h-screen bg-background">
            <SignedIn>
              <SocketClient />
              {children}
            </SignedIn>
            <SignedOut>
              <div className="flex items-center justify-center h-[80vh]">
                <p className="text-xl">Please sign in to use the app.</p>
              </div>
            </SignedOut>
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}
