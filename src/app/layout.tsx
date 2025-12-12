import { WebRTCProvider } from "@/components/providers/WebRTCProvider";

// ... imports

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
              <WebRTCProvider>
                <SocketClient />
                {children}
              </WebRTCProvider>
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
