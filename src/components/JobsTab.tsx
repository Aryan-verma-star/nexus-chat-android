import { useState, useEffect } from "react";
import { Clock, DollarSign, Briefcase, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Job } from "@/lib/supabase";

const JobsTab = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "new" | "claimed" | "completed">("all");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const result = await api.jobs.list();
        setJobs(result.data);
      } catch (err) {
        console.error("Failed to load jobs:", err);
      } finally {
        setLoading(false);
      }
    };
    loadJobs();
  }, []);

  const handleClaim = async (jobId: string) => {
    setClaiming(jobId);
    try {
      await api.jobs.claim(jobId);
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "claimed", claimed_by: user?.id } : j));
    } catch (err) {
      console.error("Failed to claim job:", err);
    } finally {
      setClaiming(null);
    }
  };

  const filtered = jobs.filter((j) => filter === "all" || j.status === filter);

  const statusColor = (s: string) => {
    switch (s) {
      case "new": return "bg-warning/20 text-warning";
      case "claimed": return "bg-secondary/20 text-secondary";
      case "completed": return "bg-primary/20 text-primary";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const platformColor = (p: string) => p === "fiverr" ? "bg-primary/20 text-primary" : "bg-secondary/20 text-secondary";

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold text-foreground">Job Board</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(["all", "new", "claimed", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap rounded-full px-3 py-1 font-display text-[10px] uppercase tracking-wider transition-all duration-200 active:scale-95 ${
                filter === f ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
              }`}
            >
              {f} ({jobs.filter((j) => f === "all" || j.status === f).length})
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-20">
        {filtered.map((job) => (
          <div key={job.id} className="rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <span className={`rounded-full px-2 py-0.5 font-display text-[10px] uppercase tracking-wider ${platformColor(job.platform)}`}>
                {job.platform}
              </span>
              <span className="font-body text-[11px] text-muted-foreground">{formatTime(job.created_at)}</span>
            </div>
            <h3 className="font-body text-base font-semibold text-foreground mb-1">{job.title}</h3>
            <p className="font-body text-sm text-muted-foreground line-clamp-2 mb-3">{job.description}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 font-body text-sm font-semibold text-primary">
                  <DollarSign className="h-3.5 w-3.5" />{job.budget_amount || "0"}
                </span>
                {job.deadline && (
                  <span className="flex items-center gap-1 font-body text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />{new Date(job.deadline).toLocaleDateString()}
                  </span>
                )}
              </div>
              <span className={`rounded-full px-2 py-0.5 font-display text-[10px] uppercase ${statusColor(job.status)}`}>
                {job.status === "claimed" ? `Claimed by ${job.claimer?.display_name || "Someone"}` : job.status}
              </span>
            </div>
            {job.status === "new" && (
              <button 
                onClick={() => handleClaim(job.id)}
                disabled={claiming === job.id}
                className="mt-3 w-full rounded-xl bg-gradient-sent py-2.5 font-display text-xs font-bold uppercase tracking-wider text-primary-foreground transition-all duration-200 hover:brightness-110 disabled:opacity-50 active:scale-[0.98]"
              >
                {claiming === job.id ? <Loader2 className="h-4 w-4 mx-auto animate-spin" /> : "Claim Job"}
              </button>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-2xl mb-2">💼</span>
            <p className="font-body text-sm text-muted-foreground">No jobs available right now</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobsTab;
