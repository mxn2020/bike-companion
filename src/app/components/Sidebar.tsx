// components/Sidebar.tsx

'use client'

import { Home, FileScan, Activity, Sliders, Dumbbell, Bug } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const menuItems = [
    { icon: FileScan, label: "Scanner", href: "/scanner" },
    { icon: Activity, label: "Monitor", href: "/monitor" },
    { icon: Sliders, label: "Control", href: "/control" },
    { icon: Dumbbell, label: "Training", href: "/training" },
  {
    icon: Bug,
    label: "Debug",
    href: "/debug"
  }
];

export default function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  
  return (
    <div className={cn("w-64 bg-slate-50 p-4 flex flex-col", className)}>
      <div className="font-bold text-xl mb-8">Bike Companion</div>
      <nav className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg",
                isActive ? "bg-slate-200" : "hover:bg-slate-100"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
