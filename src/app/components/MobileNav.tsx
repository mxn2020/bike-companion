// components/MobileNav.tsx

'use client'

import { FileScan, Activity, Sliders, Dumbbell, Bug } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
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

export default function MobileNav({ className }: { className?: string }) {
  const pathname = usePathname();
  
  return (
    <div className={cn("bg-white border-t", className)}>
      <nav className="flex justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;
          
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center py-2 px-4",
                isActive ? "text-blue-600" : "text-gray-600"
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs mt-1">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
