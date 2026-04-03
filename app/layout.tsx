import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "./contexts/AuthContext";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "mBook - Landscaping Measurements",
  description: "Mobile web application for landscaping measurement management",
  applicationName: "mBook",
  manifest: "/manifest.webmanifest",
  // Why: dedicated square PNG sizes keep browser tabs and home-screen shortcuts crisp instead of stretching the wide hero logo.
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: ["/favicon-32x32.png"],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          {children}
          {/* Why: register once at app root so all routes benefit from offline caching. */}
          <ServiceWorkerRegistration />
        </AuthProvider>
      </body>
    </html>
  );
}
