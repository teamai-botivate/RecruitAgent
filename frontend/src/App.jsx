import React, { useState, useEffect } from 'react';
import { LayoutDashboard, FileText, UploadCloud, GraduationCap, CalendarClock, BarChart3, CalendarCheck, PartyPopper, Mail, Code, Menu, CheckCircle2 } from 'lucide-react';

import Dashboard from './pages/Dashboard';
import JDGenerator from './pages/JDGenerator';
import ResumeScreening from './pages/ResumeScreening';
import AptitudeTest from './pages/AptitudeTest';
import ScheduleTest from './pages/ScheduleTest';
import AnalyseResults from './pages/AnalyseResults';
import ScheduledInterviews from './pages/ScheduledInterviews';
import Joined from './pages/Joined';
import TestEnvironment from './pages/TestEnvironment';

function App() {
  const getInitialPage = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('page') || 'dashboard';
  };
  const [currentPage, setCurrentPage] = useState(getInitialPage);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);

  useEffect(() => {
    // Poll for Gmail connection status
    const checkGmail = async () => {
      try {
        const res = await fetch('http://localhost:8000/auth/gmail/status?company_id=default_company');
        const data = await res.json();
        setGmailConnected(data.connected);
      } catch (e) {
        // fail silently
      }
    };
    checkGmail();
    const interval = setInterval(checkGmail, 5000);

    const handleMessage = (e) => {
      if (e.data?.type === 'gmail_connected') checkGmail();
    };
    window.addEventListener('message', handleMessage);
    
    let bc;
    try {
      bc = new BroadcastChannel('gmail_auth');
      bc.onmessage = (e) => {
        if (e.data?.type === 'gmail_connected') checkGmail();
      };
    } catch(err) {}

    return () => {
      clearInterval(interval);
      window.removeEventListener('message', handleMessage);
      if (bc) bc.close();
    };
  }, []);
  const connectGmail = () => {
    window.open("http://localhost:8000/auth/gmail/start?company_id=default_company", "Gmail Connect", "width=600,height=700");
  };

  const disconnectGmail = async () => {
    try {
      const res = await fetch('http://localhost:8000/auth/gmail/disconnect?company_id=default_company', {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to disconnect Gmail');
      setGmailConnected(false);
    } catch (e) {
      alert(e.message || 'Failed to disconnect Gmail');
    }
  };

  const renderContent = () => {
    switch(currentPage) {
      case 'dashboard': return <Dashboard navigateTo={setCurrentPage} />;
      case 'jd': return <JDGenerator navigateTo={setCurrentPage} />;
      case 'screening': return <ResumeScreening navigateTo={setCurrentPage} />;
      case 'aptitude': return <AptitudeTest navigateTo={setCurrentPage} />;
      case 'schedule_test': return <ScheduleTest navigateTo={setCurrentPage} />;
      case 'analyse': return <AnalyseResults navigateTo={setCurrentPage} />;
      case 'interviews': return <ScheduledInterviews navigateTo={setCurrentPage} />;
      case 'joined': return <Joined />;
      case 'test_env': return <TestEnvironment />;
      default: return <Dashboard navigateTo={setCurrentPage} />;
    }
  };

  if (currentPage === 'test_env') {
    return (
      <div className="app-layout">
        <main style={{ width: '100vw', marginLeft: '0', padding: 0 }}>
          {renderContent()}
        </main>
      </div>
    );
  }

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { key: 'jd', label: 'Generate JD', icon: <FileText size={20} /> },
    { key: 'screening', label: 'Screen Resumes', icon: <UploadCloud size={20} /> },
    { key: 'aptitude', label: 'Aptitude & Coding', icon: <Code size={20} /> },
    { key: 'schedule_test', label: 'Schedule Tests', icon: <CalendarClock size={20} /> },
    { key: 'analyse', label: 'Analyse Results', icon: <BarChart3 size={20} /> },
    { key: 'interviews', label: 'Interviews', icon: <CalendarCheck size={20} /> },
    { key: 'joined', label: 'Joined', icon: <PartyPopper size={20} /> },
  ];

  return (
    <div className="app-layout">
      {/* Sidebar Overlay (mobile) */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-icon">AI</div>
          <div>
            <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700 }}>RecruitAI</h2>
            <p style={{ fontSize: '0.75rem', margin: 0 }}>Hiring System V2</p>
          </div>
        </div>
        
        <nav className="nav-links">
          {navItems.map(item => (
            <button
              key={item.key}
              className={`nav-btn ${currentPage === item.key ? 'active' : ''}`}
              onClick={() => { setCurrentPage(item.key); setSidebarOpen(false); }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        
        <div style={{ padding: '24px 16px', borderTop: '1px solid var(--border-light)' }}>
          {gmailConnected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px 16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', fontWeight: 600 }}>
                <CheckCircle2 size={18} /> Gmail Connected
              </div>
              <button className="btn btn-outline" style={{ width: '100%' }} onClick={disconnectGmail}>
                <Mail size={16} /> Disconnect Gmail
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={connectGmail}>
              <Mail size={18} /> Connect Gmail
            </button>
          )}
        </div>
      </aside>
      
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingBottom: '0' }}>
        {/* Mobile Header */}
        <div className="mobile-header">
          <button className="mobile-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open navigation menu">
            <Menu size={24} />
          </button>
          <div className="logo-icon" style={{ width: 28, height: 28, fontSize: 12 }}>AI</div>
          <span style={{ fontWeight: 600 }}>RecruitAI</span>
        </div>

        <div className="main-content-inner">
          {renderContent()}
        </div>
        
        {/* Footer */}
        <footer style={{
          textAlign: 'center', padding: '16px', marginTop: 'auto',
          borderTop: '1px solid var(--border-light)', background: 'var(--bg-panel)',
          fontSize: '0.85rem', color: 'var(--text-muted)'
        }}>
          Powered by <a href="https://botivate.in" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>Botivate</a>
        </footer>
      </main>
    </div>
  );
}

export default App;
