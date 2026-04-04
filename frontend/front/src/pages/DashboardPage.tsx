import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getPerformanceInfo, addPerformanceResult, type PerformanceData } from "../lib/api";
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, CartesianGrid 
} from "recharts";
import { Activity, Award, Target, BookOpen, User, CheckCircle, XCircle } from "lucide-react";

import { FAKE_PERFORMANCE_DATA } from "../data/mockPerformance";

export default function DashboardPage() {
  const { user, accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [perfData, setPerfData] = useState<PerformanceData | null>(FAKE_PERFORMANCE_DATA);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    if (accessToken) {
      getPerformanceInfo(accessToken).then(setPerfData).catch(console.error);
    }
  }, [accessToken]);

  const joinedDate = useMemo(() => {
    if (!user?.createdAt) return "-";
    return new Date(user.createdAt).toLocaleDateString();
  }, [user?.createdAt]);

  async function onLogout(): Promise<void> {
    setLoggingOut(true);
    await logout();
    navigate("/login", { replace: true });
  }

  async function simulateAnswer(isCorrect: boolean) {
    if (simulating) return;
    setSimulating(true);

    if (!accessToken) {
      setTimeout(() => {
        setPerfData((prev) => {
          if (!prev) return prev;
          const scoreChange = isCorrect ? 10 : -5;
          const newScore = Math.max(0, prev.currentScore + scoreChange);
          const latest = prev.history[prev.history.length - 1];
          const newHistory = [
            ...prev.history,
            {
              id: Math.random().toString(),
              userId: "guest",
              score: newScore,
              correct: (latest?.correct ?? 0) + (isCorrect ? 1 : 0),
              incorrect: (latest?.incorrect ?? 0) + (isCorrect ? 0 : 1),
              recordedAt: new Date().toISOString()
            }
          ];
          return { currentScore: newScore, history: newHistory };
        });
        setSimulating(false);
      }, 500);
      return;
    }

    try {
      const updated = await addPerformanceResult(accessToken, isCorrect);
      setPerfData(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSimulating(false);
    }
  }

  // Formatting for Recharts
  const evolutionData = useMemo(() => {
    return perfData?.history.map((record, index) => ({
      name: `T-${index}`,
      score: record.score
    })) || [];
  }, [perfData]);

  const latestRecord = perfData && perfData.history.length ? perfData.history[perfData.history.length - 1] : undefined;

  const accuracyData = useMemo(() => {
    if (!latestRecord) return [];
    return [
      { name: "Correct", value: latestRecord.correct, fill: "#ffffff" },
      { name: "Incorrect", value: latestRecord.incorrect, fill: "rgba(255,255,255,0.2)" }
    ];
  }, [latestRecord]);

  return (
    <section className="dashboard-container page-appear" style={{ width: 'min(1000px, 100%)', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <div className="dashboard-head" style={{ background: 'rgba(20,20,26,0.8)', padding: '24px 32px', borderRadius: '24px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', backdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
            <User size={24} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Learner Portal</p>
            <h1 style={{ margin: 0, fontSize: '28px', color: 'var(--text-main)', fontFamily: 'var(--font-display)' }}>Welcome, {user?.name ?? "Learner"}</h1>
          </div>
        </div>
        <button className="button-secondary" type="button" onClick={() => void onLogout()} disabled={loggingOut}>
          {loggingOut ? "Logging out..." : "Log Out"}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div className="dashboard-card" style={{ padding: '24px', width: '100%', margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: 'var(--text-muted)' }}>
            <Award size={20} />
            <span style={{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall Score</span>
          </div>
          <div style={{ fontSize: '48px', fontWeight: 700, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            {perfData?.currentScore ?? 0}
            <span style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: 500 }}>XP</span>
          </div>
        </div>

        <div className="dashboard-card" style={{ padding: '24px', width: '100%', margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: 'var(--text-muted)' }}>
            <Target size={20} />
            <span style={{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accuracy</span>
          </div>
          <div style={{ fontSize: '48px', fontWeight: 700, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            {latestRecord && (latestRecord.correct + latestRecord.incorrect > 0) 
              ? Math.round((latestRecord.correct / (latestRecord.correct + latestRecord.incorrect)) * 100)
              : 0}
            <span style={{ fontSize: '24px', color: 'var(--text-muted)' }}>%</span>
          </div>
        </div>

        <div className="dashboard-card" style={{ padding: '24px', width: '100%', margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: 'var(--text-muted)' }}>
            <BookOpen size={20} />
            <span style={{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Questions Logged</span>
          </div>
          <div style={{ fontSize: '48px', fontWeight: 700, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            {latestRecord ? (latestRecord.correct + latestRecord.incorrect) : 0}
            <span style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: 500 }}>Total</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '24px', marginBottom: '32px' }} className="charts-grid">
        <div className="dashboard-card" style={{ padding: '32px', width: '100%', margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <Activity size={20} color="var(--accent)" />
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Score Evolution</h2>
          </div>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="none" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} />
                <YAxis stroke="none" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(20,20,26,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={3} dot={{ fill: '#000', stroke: 'var(--accent)', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: 'var(--accent)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dashboard-card" style={{ padding: '32px', width: '100%', margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <Target size={20} color="var(--accent)" />
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Progress Ratio</h2>
          </div>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={accuracyData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="none" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500 }} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                  contentStyle={{ backgroundColor: 'rgba(20,20,26,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="dashboard-card" style={{ padding: '32px', width: '100%', margin: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Simulate Learning Activity</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.5 }}>Test the live evolution graph by recording answers. The unified backend processes the result and dynamically updates your XP matrix across the charts above.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <button className="button-primary" style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '220px' }} onClick={() => void simulateAnswer(true)} disabled={simulating}>
            <CheckCircle size={18} />
            Answer Correctly (+10 XP)
          </button>
          <button className="button-secondary" style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '220px' }} onClick={() => void simulateAnswer(false)} disabled={simulating}>
            <XCircle size={18} />
            Answer Incorrectly (-5 XP)
          </button>
        </div>
      </div>
    </section>
  );
}
