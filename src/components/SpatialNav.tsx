import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutDashboard, Settings, User, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function SpatialNav({ user }: { user: any }) {
  const router = useRouterState();
  const currentPath = router.location.pathname;

  const links = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", requiresAuth: true },
    { to: "/institutions", icon: BookOpen, label: "Standards" },
    { to: "/reviews", icon: User, label: "Profile", requiresAuth: true },
  ];

  return (
    <nav className="fixed left-4 md:left-8 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-6 py-8 px-3 glass-pill hidden md:flex">
      {links.map((link) => {
        if (link.requiresAuth && !user) return null;
        const isActive = currentPath === link.to;
        const Icon = link.icon;
        
        return (
          <Link
            key={link.to}
            to={link.to}
            className={cn(
              "p-3 rounded-full transition-all duration-300 group relative",
              isActive ? "bg-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.3)]" : "text-white/60 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon className="w-5 h-5" />
            
            {/* Tooltip */}
            <span className="absolute left-full ml-4 px-2 py-1 bg-black/80 backdrop-blur-md text-white text-xs font-medium rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {link.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
