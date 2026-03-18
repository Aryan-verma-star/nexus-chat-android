import { LogOut, User, Bell, Palette, HardDrive, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const SettingsTab = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto pb-20">
      <div className="px-4 pt-4 pb-3">
        <h2 className="font-display text-lg font-bold text-foreground">Settings</h2>
      </div>

      {/* Profile */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface font-display text-xl text-primary overflow-hidden">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.display_name} className="h-full w-full object-cover" />
            ) : (
              (user?.display_name || user?.username || "?").charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="font-body text-lg font-semibold text-foreground">{user?.display_name || user?.username || "User"}</p>
            <p className="font-body text-xs text-muted-foreground">@{user?.username || "username"}</p>
            <p className="font-body text-xs text-primary mt-0.5">{user?.custom_status || "Online"}</p>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-1">
        <SectionHeader icon={User} label="Profile" />
        <SettingsItem label="Edit Display Name" />
        <SettingsItem label="Change Status" />
        <SettingsItem label="Update Avatar" />

        <SectionHeader icon={Bell} label="Notifications" />
        <ToggleItem label="Message Notifications" defaultOn />
        <ToggleItem label="Job Notifications" defaultOn />
        <ToggleItem label="Sound" defaultOn />

        <SectionHeader icon={Palette} label="Appearance" />
        <SettingsItem label="Theme: Cyber Dark" badge="Active" />
        <SettingsItem label="Font Size: Medium" />

        <SectionHeader icon={HardDrive} label="Storage & Data" />
        <SettingsItem label="Storage Used: 0 MB" />
        <SettingsItem label="Clear Cache" />

        {user?.role === "admin" && (
          <>
            <SectionHeader icon={Shield} label="Admin Panel" />
            <SettingsItem label="User Management" />
            <SettingsItem label="Integration Settings" />
            <SettingsItem label="System Logs" />
          </>
        )}
      </div>

      {/* About */}
      <div className="px-4 py-6 mt-4">
        <p className="font-display text-xs text-muted-foreground text-center">NEXUS v1.0.0</p>
        <p className="font-body text-[11px] text-muted-foreground text-center mt-1">Built with 💚 by the team</p>
      </div>

      {/* Logout */}
      <div className="px-4 pb-8">
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive py-3 font-display text-sm font-semibold text-destructive transition-all duration-200 hover:bg-destructive/10 active:scale-[0.98]"
        >
          <LogOut className="h-4 w-4" />
          Disconnect
        </button>
      </div>
    </div>
  );
};

const SectionHeader = ({ icon: Icon, label }: { icon: typeof User; label: string }) => (
  <div className="flex items-center gap-2 px-4 pt-4 pb-2">
    <Icon className="h-4 w-4 text-primary" />
    <span className="font-display text-xs uppercase tracking-wider text-primary">{label}</span>
  </div>
);

const SettingsItem = ({ label, badge }: { label: string; badge?: string }) => (
  <button className="flex w-full items-center justify-between px-4 py-3 text-left transition-all duration-200 hover:bg-muted/30 active:scale-[0.99]">
    <span className="font-body text-sm text-foreground">{label}</span>
    {badge && (
      <span className="rounded-full bg-primary/20 px-2 py-0.5 font-display text-[9px] text-primary uppercase">{badge}</span>
    )}
  </button>
);

const ToggleItem = ({ label, defaultOn = false }: { label: string; defaultOn?: boolean }) => {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="font-body text-sm text-foreground">{label}</span>
      <div className={`h-6 w-10 rounded-full transition-colors duration-200 ${defaultOn ? "bg-primary" : "bg-muted"} relative cursor-pointer`}>
        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform duration-200 ${defaultOn ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
    </div>
  );
};

export default SettingsTab;
