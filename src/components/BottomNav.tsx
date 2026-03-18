import { MessageSquare, Briefcase, Users, Settings } from "lucide-react";

type Tab = "chats" | "jobs" | "people" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  unreadChats?: number;
  newJobs?: number;
}

const tabs: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
  { id: "chats", label: "Chats", icon: MessageSquare },
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "people", label: "People", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

const BottomNav = ({ activeTab, onTabChange, unreadChats = 0, newJobs = 0 }: BottomNavProps) => {
  const getBadge = (id: Tab) => {
    if (id === "chats" && unreadChats > 0) return unreadChats;
    if (id === "jobs" && newJobs > 0) return newJobs;
    return 0;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-background pb-safe md:hidden">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const badge = getBadge(tab.id);
        return (
            <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="relative flex flex-col items-center gap-0.5 px-4 py-2 transition-transform active:scale-90"
          >
            {isActive && (
              <span className="absolute -top-1 h-1 w-1 rounded-full bg-primary pulse-dot" />
            )}
            <div className="relative">
              <tab.icon className={`h-5 w-5 transition-colors duration-200 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              {badge > 0 && (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 font-display text-[9px] text-accent-foreground">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </div>
            <span className={`font-body text-[10px] transition-colors duration-200 ${isActive ? "text-primary" : "text-muted-foreground"}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
export type { Tab };
