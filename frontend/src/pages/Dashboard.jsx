import React, { useState, useEffect } from 'react';
import { Users, FileCheck, Target, TrendingUp, RefreshCw } from 'lucide-react';

const Dashboard = ({ navigateTo }) => {
  const [jds, setJds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJdModal, setSelectedJdModal] = useState(null);

  // Poll for JD Data
  useEffect(() => {
    const fetchJds = async () => {
      try {
        const response = await fetch('http://localhost:8000/jd/all');
        const data = await response.json();
        if (data.status === 'success') {
          setJds(data.jds);
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchJds();
    // Poll every 10 seconds to update dashboard
    const interval = setInterval(fetchJds, 10000);
    return () => clearInterval(interval);
  }, []);

  const totalCandidates = jds.reduce((sum, jd) => sum + jd.candidate_count, 0);
  const totalShortlisted = jds.reduce((sum, jd) => sum + jd.shortlisted_count, 0);

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Recruitment Command Center</h1>
          <p>Real-time overview of your pipeline state and candidate metrics.</p>
        </div>
        <button className="btn btn-outline" onClick={() => window.location.reload()}>
          <RefreshCw size={18} /> Refresh Data
        </button>
      </header>

      {/* KPI Stats */}
      <div className="grid-4" style={{ marginBottom: '40px' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)' }}>
            <FileCheck size={28} />
          </div>
          <div className="stat-content">
            <h3>Active Roles</h3>
            <p>{jds.length}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(14, 165, 233, 0.1)', color: 'var(--accent)' }}>
            <Users size={28} />
          </div>
          <div className="stat-content">
            <h3>Total Sourced</h3>
            <p>{totalCandidates}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
            <Target size={28} />
          </div>
          <div className="stat-content">
            <h3>Interviewing</h3>
            <p>{totalShortlisted}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
            <TrendingUp size={28} />
          </div>
          <div className="stat-content">
            <h3>Conversion Rate</h3>
            <p>{totalCandidates ? Math.round((totalShortlisted / totalCandidates) * 100) : 0}%</p>
          </div>
        </div>
      </div>

      {/* Pipeline Status Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Active Hiring Pipelines</h2>
          <span className="badge badge-primary">LangGraph Status</span>
        </div>
        
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto' }}></div></div>
        ) : jds.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No active jobs. Start by generating a Job Description.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table stack-mobile">
              <thead>
                <tr>
                  <th>Job Title (ID)</th>
                  <th>Company</th>
                  <th>Pipeline State</th>
                  <th>Created</th>
                  <th>Total CVs</th>
                  <th>Selected</th>
                </tr>
              </thead>
              <tbody>
                {jds.map((jd, idx) => (
                  <tr key={idx} onClick={() => setSelectedJdModal(jd)} style={{ cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(99,102,241,0.05)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                    <td data-label="Job Title">
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{jd.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{jd.jd_id}</div>
                    </td>
                    <td data-label="Company">{jd.company}</td>
                    <td data-label="State">
                      <span className={`badge ${jd?.state === 'HIRED' ? 'badge-success' : jd?.state === 'CLOSED' ? 'badge-secondary' : jd?.state === 'JD_CREATED' ? 'badge-primary' : jd?.state?.includes('INTERVIEW') ? 'badge-warning' : 'badge-warning'}`} style={jd?.state === 'CLOSED' ? {background: '#4b5563', color: '#fff'} : {}}>
                        {(jd?.state || 'UNKNOWN').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td data-label="Created" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{jd.created_at || '—'}</td>
                    <td data-label="Total CVs" style={{ fontWeight: 600 }}>{jd.candidate_count}</td>
                    <td data-label="Selected" style={{ color: 'var(--success)', fontWeight: 600 }}>{jd.selected_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* JD Detailed Modal Overlay */}
      {selectedJdModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-dark)', border: '1px solid var(--border-light)', padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-light)', paddingBottom: '20px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.8rem', margin: '0 0 5px', color: 'var(--text-main)' }}>{selectedJdModal.title}</h2>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>Campaign ID: {selectedJdModal.jd_id} • {selectedJdModal.company}</p>
              </div>
              <button onClick={() => setSelectedJdModal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            {/* Visual Pipeline Stepper */}
            {(() => {
              const stages = [
                { key: 'JD_CREATED', label: 'JD Created' },
                { key: 'SCREENING_COMPLETE', label: 'Screened' },
                { key: 'APTITUDE_GENERATED', label: 'Test Generated' },
                { key: 'TEST_SENT', label: 'Test Sent' },
                { key: 'TEST_COMPLETED', label: 'Test Done' },
                { key: 'RESULTS_ANALYSED', label: 'Analysed' },
                { key: 'INTERVIEW_SCHEDULED', label: 'Interview' },
                { key: 'HIRED', label: 'Hired' },
                { key: 'CLOSED', label: 'Closed' }
              ];
              const stateOrder = stages.map(s => s.key);
              const currentIdx = stateOrder.indexOf(selectedJdModal?.state);
              
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', padding: '16px 10px', background: 'var(--bg-input)', borderRadius: '10px', overflowX: 'auto' }}>
                  {stages.map((stage, i) => {
                    const isCompleted = i < currentIdx;
                    const isActive = i === currentIdx;
                    return (
                      <React.Fragment key={stage.key}>
                        <div style={{ textAlign: 'center', minWidth: '60px' }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%', margin: '0 auto 6px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700,
                            background: isCompleted ? 'var(--success)' : isActive ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                            color: isCompleted || isActive ? '#fff' : 'var(--text-muted)',
                            border: isActive ? '2px solid var(--primary)' : 'none',
                            boxShadow: isActive ? '0 0 10px rgba(99,102,241,0.5)' : 'none'
                          }}>
                            {isCompleted ? '✓' : i + 1}
                          </div>
                          <div style={{ fontSize: '0.6rem', color: isActive ? 'var(--primary)' : isCompleted ? 'var(--success)' : 'var(--text-muted)', fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap' }}>
                            {stage.label}
                          </div>
                        </div>
                        {i < stages.length - 1 && (
                          <div style={{ flex: 1, height: '2px', margin: '0 2px', marginBottom: '16px', background: i < currentIdx ? 'var(--success)' : 'rgba(255,255,255,0.08)' }}></div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })()}

            <div className="grid-2" style={{ marginBottom: '24px' }}>
              <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '8px' }}>
                 <p style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.8rem', marginBottom: '5px' }}>Current State</p>
                 <span className={`badge ${selectedJdModal?.state === 'HIRED' ? 'badge-success' : selectedJdModal?.state === 'CLOSED' ? 'badge-secondary' : selectedJdModal?.state === 'JD_CREATED' ? 'badge-primary' : 'badge-warning'}`} style={selectedJdModal?.state === 'CLOSED' ? {background: '#4b5563', color: '#fff', fontSize: '1rem', padding: '8px 12px'} : { fontSize: '1rem', padding: '8px 12px' }}>
                   {(selectedJdModal?.state || 'UNKNOWN').replace(/_/g, ' ')}
                 </span>
                 {selectedJdModal?.created_at && (
                   <p style={{ margin: '12px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>📅 Created: {selectedJdModal.created_at}</p>
                 )}
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '8px', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                 <div>
                    <h4 style={{ margin: '0 0 5px', color: 'var(--text-muted)' }}>Total</h4>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{selectedJdModal.candidate_count}</p>
                 </div>
                 <div>
                    <h4 style={{ margin: '0 0 5px', color: 'var(--success)' }}>Selected</h4>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--success)' }}>{selectedJdModal.selected_count}</p>
                 </div>
              </div>
            </div>

            <h3 style={{ marginBottom: '15px' }}>Next Pipeline Action</h3>
            <div style={{ padding: '20px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
               {selectedJdModal.state === 'JD_CREATED' ? (
                 <>
                   <p style={{ color: 'var(--text-main)', marginBottom: '15px' }}>This Job Description is ready. Start screening candidate resumes now.</p>
                   <button className="btn btn-primary" onClick={() => { setSelectedJdModal(null); if(navigateTo) navigateTo('screening'); }} style={{ width: '100%' }}>Screen Resumes for {selectedJdModal.title}</button>
                 </>
               ) : selectedJdModal.state === 'SCREENING_COMPLETE' ? (
                 <>
                   <p style={{ color: 'var(--text-main)', marginBottom: '15px' }}>Screening complete. Generate aptitude & coding tests for shortlisted candidates.</p>
                   <button className="btn btn-primary" onClick={() => { setSelectedJdModal(null); if(navigateTo) navigateTo('aptitude'); }} style={{ width: '100%' }}>Generate Aptitude Test for {selectedJdModal.title}</button>
                 </>
               ) : selectedJdModal.state === 'APTITUDE_GENERATED' ? (
                 <>
                   <p style={{ color: 'var(--text-main)', marginBottom: '15px' }}>Test generated. Schedule and send test links to candidates.</p>
                   <button className="btn btn-primary" onClick={() => { setSelectedJdModal(null); if(navigateTo) navigateTo('schedule_test'); }} style={{ width: '100%' }}>Schedule Tests for {selectedJdModal.title}</button>
                 </>
               ) : ['TEST_SCHEDULED', 'TEST_SENT'].includes(selectedJdModal.state) ? (
                 <>
                   <p style={{ color: 'var(--text-main)', marginBottom: '15px' }}>Tests are sent. Wait for submissions, then analyse results.</p>
                   <button className="btn btn-primary" onClick={() => { setSelectedJdModal(null); if(navigateTo) navigateTo('schedule_test'); }} style={{ width: '100%' }}>View Test Status</button>
                 </>
               ) : selectedJdModal.state === 'TEST_COMPLETED' || selectedJdModal.state === 'RESULTS_ANALYSED' ? (
                 <>
                   <p style={{ color: 'var(--text-main)', marginBottom: '15px' }}>Results are in. Analyse performance and select finalists for interview.</p>
                   <button className="btn btn-primary" onClick={() => { setSelectedJdModal(null); if(navigateTo) navigateTo('analyse'); }} style={{ width: '100%', background: 'var(--accent)' }}>Analyse Results & Select Finalists</button>
                 </>
               ) : selectedJdModal.state === 'INTERVIEW_SCHEDULED' ? (
                  <>
                    <p style={{ color: 'var(--text-main)', marginBottom: '15px' }}>Interviews scheduled. Conduct interviews and mark candidates as hired.</p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn-primary" onClick={() => { setSelectedJdModal(null); if(navigateTo) navigateTo('interviews'); }} style={{ flex: 2, background: 'var(--success)' }}>View Interviews & Hire</button>
                      <button className="btn btn-outline" onClick={async () => {
                         if(window.confirm("Are you sure you want to CLOSE this campaign without hiring anyone?")) {
                            try {
                              const res = await fetch(`http://localhost:8000/jd/${selectedJdModal.jd_id}/close_campaign`, { method: 'POST' });
                              if(res.ok) setSelectedJdModal(null);
                            } catch(e) { alert("Failed to close."); }
                         }
                      }} style={{ flex: 1, color: 'var(--danger)', borderColor: 'var(--danger)' }}>Close Campaign</button>
                    </div>
                  </>
               ) : selectedJdModal.state === 'HIRED' ? (
                 <>
                   <p style={{ color: 'var(--text-main)', marginBottom: '15px' }}>🎉 Pipeline complete! Candidates have been hired successfully.</p>
                   <button className="btn btn-primary" onClick={() => { setSelectedJdModal(null); if(navigateTo) navigateTo('joined'); }} style={{ width: '100%', background: 'var(--success)' }}>View Joined Candidates</button>
                 </>
               ) : selectedJdModal.state === 'CLOSED' ? (
                  <>
                    <p style={{ color: 'var(--text-main)', marginBottom: '15px' }}>📁 This campaign has been CLOSED without finding a suitable hire.</p>
                    <button className="btn btn-outline" onClick={() => setSelectedJdModal(null)} style={{ width: '100%' }}>Back to Dashboard</button>
                  </>
               ) : (
                 <>
                    <p style={{ color: 'var(--text-main)', marginBottom: '15px' }}>Pipeline is in state: {selectedJdModal.state}</p>
                    <button className="btn btn-outline" onClick={() => setSelectedJdModal(null)} style={{ width: '100%' }}>Close</button>
                 </>
               )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
