import React, { useState, useEffect } from 'react';
import { User, FileText, Brain, Code, X, ExternalLink, Award } from 'lucide-react';
import { createPortal } from 'react-dom';

const CandidateProfileModal = ({ candidate, onClose, jdId }) => {
  const apiBase = window.__API_BASE || 'http://localhost:8000';
  const [activeTab, setActiveTab] = useState('resume');
  const [testAnswers, setTestAnswers] = useState(null);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [proctoringData, setProctoringData] = useState(null);

  // Fallback property mapping with comprehensive coverage for all pipeline stages
  const email = candidate.Email || candidate.Candidate_Email || candidate.email || candidate.CandidateEmail || '';
  const name = candidate.Name || candidate.Candidate_Name || candidate.name || candidate.CandidateName || 'Unknown Candidate';
  const driveUrl = candidate.Drive_URL || candidate.drive_url || candidate.Report_Path || candidate.Resume_Drive_URL || '';
  const reasoning = candidate.AI_Reasoning || candidate.reasoning || 'No AI reasoning recorded for this candidate.';
  const score = candidate.Score || candidate.Final_Score || candidate.Total_Score || candidate.score || 'N/A';
  const skills = candidate.Matched_Skills || candidate.extracted_skills || candidate.Skills || '';

  useEffect(() => {
    if (activeTab === 'test' && !testAnswers && email && jdId) {
      setLoadingAnswers(true);
        fetch(`${apiBase}/test/answers/${jdId}/${email}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                const combined = [...(data.mcq_answers || []), ...(data.coding_answers || [])];
                setTestAnswers(combined);
            } else {
                setTestAnswers([]);
            }
        })
        .catch(err => {
            console.error("Failed to fetch answers:", err);
            setTestAnswers([]);
        })
        .finally(() => setLoadingAnswers(false));

      fetch(`${apiBase}/test/proctoring/${jdId}/${email}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            setProctoringData(data);
          } else {
            setProctoringData({ total_events: 0, highest_severity: 'info', events: [] });
          }
        })
        .catch(() => setProctoringData({ total_events: 0, highest_severity: 'info', events: [] }));
    }
  }, [activeTab, jdId, email, testAnswers, apiBase]);

  const getProxyUrl = (url) => {
    if (!url) return '';
    const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const fileId = fileIdMatch ? fileIdMatch[1] : null;
    if (fileId) return `${apiBase}/screening/drive/proxy/${fileId}`;
    return url;
  };

  const finalPdfUrl = getProxyUrl(driveUrl);

  return createPortal(
    <div className="modal-outer" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="card animate-scale-up modal-container" style={{ width: '95%', maxWidth: '1200px', height: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)', border: '1px solid var(--border-light)', overflow: 'hidden', padding: 0, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        
        {/* Modern Header */}
        <div className="modal-header" style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0, flex: 1 }}>
            <div style={{ width: '48px', height: '48px', minWidth: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)' }}>
              <User size={24} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</h2>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><FileText size={14} /> {email}</span>
                <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}><Award size={16} /> Score: {score}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '10px', border: 'none', color: 'var(--text-main)', cursor: 'pointer', flexShrink: 0 }}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Vertical Sidebar Navigation */}
          <div className="modal-sidebar-nav" style={{ width: '240px', borderRight: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.01)', padding: '24px 16px', flexDirection: 'column', display: 'flex' }}>
             {[
               { id: 'resume', label: 'View Resume', icon: <FileText size={18} /> },
               { id: 'ai', label: 'AI Selection Reasoning', icon: <Brain size={18} /> },
               { id: 'test', label: 'Assessment Results', icon: <Code size={18} /> }
             ].map(tab => (
               <button 
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id)}
                 style={{ 
                   width: '100%', padding: '14px 18px', borderRadius: '12px', border: 'none', 
                   display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px',
                   cursor: 'pointer', fontSize: '0.95rem', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                   fontWeight: activeTab === tab.id ? 600 : 400,
                   background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                   color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
                   boxShadow: activeTab === tab.id ? '0 10px 15px -3px rgba(99, 102, 241, 0.3)' : 'none'
                 }}
               >
                 {tab.icon} {tab.label}
               </button>
             ))}
          </div>

          {/* Main Content Area */}
          <div className="modal-main-content" style={{ flex: 1, overflowY: 'auto', padding: '32px', background: 'var(--bg-dark)' }}>
            
            {/* TAB 1: RESUME */}
            {activeTab === 'resume' && (
              <div className="animate-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                 <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                   <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Candidate Resume</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>Securely served via internal Shared Drive proxy</p>
                   </div>
                   <a href={finalPdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}>
                     View Full PDF <ExternalLink size={16} />
                   </a>
                 </div>
                 {finalPdfUrl ? (
                   <iframe src={finalPdfUrl} width="100%" height="100%" style={{ border: '1px solid var(--border-light)', borderRadius: '16px', flex: 1, background: '#1a1a1a', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', minHeight: '400px' }} title="Resume PDF"></iframe>
                 ) : (
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', minHeight: '300px' }}>
                     <FileText size={64} style={{ opacity: 0.1, marginBottom: '20px' }} />
                     <h3>No PDF Available</h3>
                     <p>Resume file was not found or link is missing for this pipeline stage.</p>
                   </div>
                 )}
              </div>
            )}

            {/* TAB 2: AI ANALYSIS */}
            {activeTab === 'ai' && (
              <div className="animate-fade-in">
                <div style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.02) 100%)', padding: '24px', borderRadius: '20px', border: '1px solid rgba(99, 102, 241, 0.2)', marginBottom: '32px' }}>
                  <h3 style={{ margin: '0 0 20px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.3rem' }}>
                    <Brain size={24} /> AI Screening Reasoning
                  </h3>
                  <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p style={{ margin: 0, lineHeight: 1.8, color: 'var(--text-main)', whiteSpace: 'pre-wrap', fontSize: '1rem', overflowWrap: 'break-word' }}>
                       {reasoning}
                    </p>
                  </div>
                </div>

                {skills && (
                  <div>
                    <h4 style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '1.5px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Code size={16} /> Matched Technical Arsenal
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {(typeof skills === 'string' ? skills.split(',') : Array.isArray(skills) ? skills : []).map((skill, i) => (
                        <span key={i} className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '8px 16px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 500 }}>
                          {(skill || '').toString().trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: TEST RESULTS */}
            {activeTab === 'test' && (
              <div className="animate-fade-in">
                 {!jdId || !email ? (
                   <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Required metadata missing to fetch evaluation data.</div>
                 ) : loadingAnswers ? (
                   <div style={{ textAlign: 'center', padding: '80px' }}>
                     <div className="spinner" style={{ width: '48px', height: '48px', margin: 'auto' }}></div>
                     <p style={{ marginTop: '20px', color: 'var(--text-muted)', fontWeight: 500 }}>Analyzing Assessment Data...</p>
                   </div>
                 ) : !testAnswers || testAnswers.length === 0 ? (
                   <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '20px' }}>
                     <Code size={64} style={{ opacity: 0.1, marginBottom: '24px' }} />
                     <h3>No Detailed Answers Found</h3>
                     <p>Possible reasons: Candidate skipped the test, or test results haven't synced with the database yet.</p>
                   </div>
                 ) : (
                   <div>
                     <div style={{ marginBottom: '20px', padding: '14px 16px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                          Proctoring Events: <strong>{proctoringData?.total_events ?? 0}</strong>
                        </span>
                        <span className="badge badge-warning" style={{ textTransform: 'capitalize' }}>
                          Highest Severity: {proctoringData?.highest_severity || 'info'}
                        </span>
                     </div>

                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.3rem' }}>
                          <Code size={24} color="var(--warning)" /> Technical Evaluation Details
                        </h3>
                        <div className="badge badge-warning" style={{ padding: '8px 16px', borderRadius: '8px' }}>
                          {testAnswers.length} Questions Evaluated
                        </div>
                     </div>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                       {testAnswers.map((ans, idx) => (
                          <div key={idx} className="glass-panel" style={{ padding: '20px', borderRadius: '16px', borderLeft: `8px solid ${ans.isCorrect ? 'var(--success)' : 'var(--danger)'}`, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '2px' }}>
                                QUESTION {ans.qNo || idx+1} • {ans.type || 'MCQ'}
                              </span>
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <span style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, background: ans.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: ans.isCorrect ? 'var(--success)' : 'var(--danger)', border: `1px solid ${ans.isCorrect ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}` }}>
                                  {ans.isCorrect ? 'PASS' : 'FAIL'}
                                </span>
                              </div>
                            </div>

                            <div style={{ fontWeight: 600, marginBottom: '20px', fontSize: '1.1rem', color: 'var(--text-main)', lineHeight: 1.5, overflowWrap: 'break-word' }}>
                              {ans.question}
                            </div>
                            
                            <div className="grid-2" style={{ marginBottom: '20px' }}>
                              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '10px', fontWeight: 700, letterSpacing: '1px' }}>CANDIDATE RESPONSE</span>
                                <div style={{ 
                                  color: ans.isCorrect ? 'var(--success)' : '#f87171', 
                                  wordBreak: 'break-word', 
                                  fontFamily: ans.type === 'Coding' ? "'Fira Code', 'Courier New', monospace" : 'inherit',
                                  fontSize: ans.type === 'Coding' ? '0.85rem' : '1rem',
                                  whiteSpace: ans.type === 'Coding' ? 'pre-wrap' : 'normal',
                                  lineHeight: 1.6,
                                  overflowWrap: 'break-word'
                                }}>
                                  {ans.candidate || 'No Answer'}
                                </div>
                              </div>
                              <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'block', marginBottom: '10px', fontWeight: 700, letterSpacing: '1px' }}>IDEAL LOGIC / ANSWER</span>
                                <div style={{ color: 'var(--success)', wordBreak: 'break-word', fontSize: '0.95rem', lineHeight: 1.6, overflowWrap: 'break-word' }}>
                                  {ans.correct || 'Reference Logic Applied'}
                                </div>
                              </div>
                            </div>
                            
                            {ans.explanation && (
                              <div style={{ padding: '16px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                  <Brain size={18} color="var(--primary)" />
                                  <strong style={{ color: 'var(--primary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>AI Debug Advisor (HR ONLY)</strong>
                                </div>
                                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
                                  {ans.explanation}
                                </div>
                              </div>
                            )}
                          </div>
                       ))}
                     </div>

                     {!!(proctoringData?.events || []).length && (
                       <div style={{ marginTop: '28px' }}>
                         <h4 style={{ margin: '0 0 14px', fontSize: '1rem' }}>Proctoring Timeline</h4>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                           {(proctoringData.events || []).map((ev, idx) => (
                             <div key={idx} style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                               <div>
                                 <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{String(ev.event_type || 'unknown').replace(/_/g, ' ')}</div>
                                 <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{ev.details || 'No details'}</div>
                               </div>
                               <div style={{ textAlign: 'right' }}>
                                 <div style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>{ev.severity || 'info'}</div>
                                 <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{ev.event_time || ev.recorded_at || '-'}</div>
                               </div>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                 )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CandidateProfileModal;
