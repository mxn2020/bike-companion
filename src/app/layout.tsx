// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import MobileNav from "./components/MobileNav";
import Sidebar from "./components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fitness Bike Companion",
  description: "Control and monitor your fitness bike",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn(inter.className, "antialiased")}>
        <div className="flex h-screen">
          <Sidebar className="hidden md:flex" />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
          <MobileNav className="md:hidden fixed bottom-0 left-0 right-0" />
        </div>
      </body>
    </html>
  );
}
