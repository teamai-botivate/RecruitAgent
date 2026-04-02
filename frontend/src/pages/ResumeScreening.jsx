import React, { useState, useEffect } from 'react';
import { UploadCloud, Link as LinkIcon, BriefcaseIcon, Play, AlertCircle, FileText, Code } from 'lucide-react';
import ResponsiveDropdown from '../components/ResponsiveDropdown';
import { buildJdDropdownOption, sortJdsNewestFirst } from '../utils/jdDropdown';

const ResumeScreening = ({ navigateTo }) => {
  const [jds, setJds] = useState([]);
  const [selectedJd, setSelectedJd] = useState('');
  const [useGmail, setUseGmail] = useState(true);
  const [useLocal, setUseLocal] = useState(false);
  // Gmail forms
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [resumeFiles, setResumeFiles] = useState([]);
  const [topN, setTopN] = useState(5);
  const [gmailStatus, setGmailStatus] = useState({ connected: false, email: '' });
  
  // Job State
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState({ progress: 0, current_step: 'Ready' });
  const [results, setResults] = useState(null);

  const handleLocalFilesSelect = (event) => {
    const picked = Array.from(event.target.files || []);
    if (picked.length === 0) return;

    setResumeFiles(prev => {
      const existing = Array.from(prev || []);
      const merged = [...existing];

      for (const file of picked) {
        const duplicate = merged.some(
          (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
        );
        if (!duplicate) merged.push(file);
      }
      return merged;
    });

    // Allow selecting additional files in the next pick operation.
    event.target.value = '';
  };

  useEffect(() => {
    // Fetch available JDs
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    fetch(`${baseUrl}/jd/all`)
      .then(res => res.json())
      .then(data => {
        if(data.status === 'success' && data.jds.length > 0) {
          setJds(sortJdsNewestFirst(data.jds));
        }
      });
      
    // Gmail Auth Status Logic
    const fetchGmailStatus = () => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      fetch(`${baseUrl}/auth/gmail/status`)
        .then(res => res.json())
        .then(data => setGmailStatus(data))
        .catch(err => console.error(err));
    };
    fetchGmailStatus();
    const interval = setInterval(fetchGmailStatus, 5000);

    const handleMessage = (e) => {
      if (e.data?.type === 'gmail_connected') fetchGmailStatus();
    };
    window.addEventListener('message', handleMessage);
    
    let bc;
    try {
      bc = new BroadcastChannel('gmail_auth');
      bc.onmessage = (e) => {
        if (e.data?.type === 'gmail_connected') fetchGmailStatus();
      };
    } catch(err) {}

    return () => {
      clearInterval(interval);
      window.removeEventListener('message', handleMessage);
      if (bc) bc.close();
    };
  }, []);

  useEffect(() => {
    let interval;
    if (jobId && !results) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:8000/screening/status/${jobId}`);
          const data = await res.json();
          if (data.status === 'processing') {
            setStatus({ progress: data.progress, current_step: data.current_step });
          } else if (data.status === 'completed') {
            setStatus({ progress: 100, current_step: 'Analysis Complete' });
            setResults(data.result);
            setLoading(false);
            clearInterval(interval);
          } else if (data.status === 'error') {
            alert('Pipeline Failed: ' + data.error);
            setLoading(false);
            clearInterval(interval);
          }
        } catch (err) {}
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [jobId, results]);

  const handleStartAnalysis = async () => {
    if (!selectedJd) return alert("Select a JD first");
    
    setLoading(true);
    setResults(null);
    setJobId(null);
    setStatus({ progress: 0, current_step: 'Initializing' });

    // Find full JD text
    const triggerJd = jds.find(j => j.jd_id === selectedJd);
    
    // We didn't save the full JD text in the list API, so we will use the ID as a reference.
    // However, the backend /start endpoint expects jd_text_input or jd_file.
    // In our implementation, we updated the pipeline but screening api uses raw text.
    // For this POC frontend, I'll pass a dummy text if needed, or modify API.
    // Let's pass the Title as text for now, ideally backend fetches the real text based on ID.
    
    const formData = new FormData();
    formData.append('jd_text_input', triggerJd ? "Hiring for " + triggerJd.title : "Any");
    formData.append('top_n', topN);
    formData.append('jd_id', selectedJd);
    
    if (!useGmail && !useLocal) return alert("Please select at least one ingestion source");
    if (useGmail) {
      formData.append('start_date', startDate);
      formData.append('end_date', endDate);
    }
    if (useLocal) {
      if (resumeFiles.length === 0 && !useGmail) {
        setLoading(false);
        return alert("Upload resumes first");
      }
      Array.from(resumeFiles || []).forEach(f => formData.append('resume_files', f));
    }

    try {
      const resp = await fetch('http://localhost:8000/screening/start', {
        method: 'POST',
        body: formData
      });
      const data = await resp.json();
      
      if (data.job_id) {
        setJobId(data.job_id);
      } else {
        alert(data.detail);
        setLoading(false);
      }
    } catch (e) {
      alert("Error starting pipeline: " + e.message);
      setLoading(false);
    }
  };

  const campaignOptions = [
    { value: '', label: '-- Select Active Campaign --' },
    ...jds.map((jd) => buildJdDropdownOption(jd))
  ];

  return (
    <div className="animate-fade-in layout-split-uneven">
      
      {/* Settings Panel */}
      <div className="card glass-panel" style={{ height: 'fit-content' }}>
        <div className="card-header">
          <h2 className="card-title">Multi-stage Analysis Pipeline</h2>
        </div>
        
        <div className="form-group">
          <label className="form-label">Link Job Description ID / Campaign</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center' }}><LinkIcon size={18} color="var(--primary)" /></div>
            <ResponsiveDropdown value={selectedJd} onChange={setSelectedJd} options={campaignOptions} className="screening-campaign-dropdown" />
          </div>
        </div>
        
        <div className="form-group" style={{ marginTop: '24px' }}>
          <label className="form-label">Data Ingestion Source</label>
          <div style={{ display: 'flex', background: 'var(--bg-dark)', padding: '5px', borderRadius: '8px', gap: '5px' }}>
            <button 
              style={{ flex: 1, padding: '10px', background: useGmail ? 'var(--primary)' : 'transparent', color: useGmail ? 'white' : 'var(--text-muted)', border: useGmail ? 'none' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', opacity: useGmail ? 1 : 0.7 }}
              onClick={() => setUseGmail(!useGmail)}
            >
              Gmail OAuth
            </button>
            <button 
              style={{ flex: 1, padding: '10px', background: useLocal ? 'var(--primary)' : 'transparent', color: useLocal ? 'white' : 'var(--text-muted)', border: useLocal ? 'none' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', opacity: useLocal ? 1 : 0.7 }}
              onClick={() => setUseLocal(!useLocal)}
            >
              Local Files
            </button>
          </div>
        </div>
        
        {useGmail && (
          <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-light)', marginBottom: '24px' }}>
            {gmailStatus.connected ? (
              <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px dashed var(--success)', borderRadius: '6px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                <span style={{ fontSize: '1.2rem' }}>✅</span> <span>Fetching Resumes from: <strong>{gmailStatus.email}</strong></span>
              </div>
            ) : (
              <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px dashed var(--danger)', borderRadius: '6px', color: 'var(--danger)', fontSize: '0.9rem' }}>
                ⚠️ Gmail disconnected! Please click "Connect Gmail" in the sidebar to bind your mailbox first.
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">From Date</label>
                <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">To Date</label>
                <input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>
        )}
        
        {useLocal && (
          <div style={{ background: 'var(--bg-input)', padding: '30px', borderRadius: '8px', border: '1px dashed var(--primary)', marginBottom: '24px', textAlign: 'center', cursor: 'pointer' }}>
            <UploadCloud size={32} color="var(--primary)" style={{ marginBottom: '10px' }} />
            <p style={{ color: 'var(--text-main)', fontWeight: 500 }}>Upload Resume PDFs</p>
            <input type="file" multiple accept=".pdf" onChange={handleLocalFilesSelect} style={{ marginTop: '10px', color: 'var(--text-muted)' }} />
            <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Selected: {Array.from(resumeFiles || []).length} file(s)
            </p>
            {Array.from(resumeFiles || []).length > 0 && (
              <div style={{ marginTop: '10px', textAlign: 'left', maxHeight: '120px', overflowY: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {Array.from(resumeFiles || []).map((f, idx) => (
                  <div key={`${f.name}-${f.size}-${idx}`}>• {f.name}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Top Candidates to Analyze (AI Token Costing)</label>
          <input type="number" min="1" max="50" className="form-control" value={topN} onChange={e => setTopN(e.target.value)} />
        </div>

        <button className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} onClick={handleStartAnalysis} disabled={loading || !selectedJd}>
          <Play size={18} /> {loading ? "Pipeline Running..." : "Execute Screening Pipeline"}
        </button>
      </div>

      {/* Progress & Results View */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="card-header">
          <h2 className="card-title">LangGraph Execution Monitor</h2>
          {jobId && <span className="badge badge-success">Job ID: {jobId.split('-')[0]}</span>}
        </div>
        
        {/* Progress Bar Area */}
        {loading && (
          <div style={{ background: 'var(--bg-input)', padding: '24px', borderRadius: 'var(--radius-md)', marginBottom: '24px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{status.current_step}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{status.progress}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--bg-dark)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${status.progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--accent))', transition: 'width 0.4s ease' }}></div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
              LLM Semantic processing agents are actively analyzing vectors...
            </div>
          </div>
        )}

        {/* Results Area */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!loading && !results && (
            <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)' }}>
              <ActivityGraphPlaceholder />
              <p style={{ marginTop: '20px' }}>Awaiting pipeline execution</p>
            </div>
          )}

          {results && (
            <div className="animate-fade-in">
              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <div style={{ flex: 1, padding: '16px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '5px' }}>Analyzed</h3>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{results.candidates.length + results.rejected_count}</div>
                </div>
                <div style={{ flex: 1, padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--success)', marginBottom: '5px' }}>Shortlisted</h3>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{results.candidates.filter(c => c.score.breakdown.Final >= 50).length}</div>
                </div>
                <div style={{ flex: 1, padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--danger)', marginBottom: '5px' }}>Auto-Rejected</h3>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{results.rejected_count}</div>
                </div>
              </div>

              {/* Shortlisted Candidates (Top K) */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ color: 'var(--success)', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px', marginBottom: '20px' }}>
                  Top {results.candidates.filter(c => c.is_selected).length} Candidates Selected
                </h3>
                {results.candidates.filter(c => c.is_selected).map((cand, idx) => (
                  <div key={`short-${idx}`} className="resp-screening-card" style={{ padding: '20px', background: 'var(--bg-input)', border: '1px solid var(--primary)', borderRadius: '8px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr auto', flexWrap: 'wrap', gap: '20px', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.1)' }}>
                    <div style={{ flex: '1 1 250px', minWidth: 0 }}>
                      <h3 style={{ fontSize: '1.2rem', margin: '0 0 5px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {cand.name || cand.candidate_name} 
                        {cand.ai_analyzed && <span className="badge badge-primary">Deep AI Analyzed</span>}
                        <span className="badge badge-success" style={{ background: 'transparent', border: '1px solid var(--success)' }}>TOP MATCH</span>
                      </h3>
                      <p style={{ fontSize: '0.9rem', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cand.email}</p>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '15px' }}>
                        {cand.extracted_skills?.slice(0, 6).map((skill, sIdx) => (
                          <span key={sIdx} style={{ fontSize: '0.75rem', padding: '3px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                            {skill}
                          </span>
                        ))}
                      </div>

                      {cand.ai_analyzed && cand.reasoning && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--accent)', padding: '10px', background: 'rgba(14, 165, 233, 0.1)', borderRadius: '4px', borderLeft: '3px solid var(--accent)', overflowWrap: 'break-word' }}>
                          <strong>AI Summary: </strong> {cand.reasoning}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>ATS Score</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: cand.score.total >= 70 ? 'var(--success)' : cand.score.total >= 50 ? 'var(--warning)' : 'var(--danger)', lineHeight: 1 }}>
                          {cand.score.breakdown?.Final || cand.score.total}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Not Selected Candidates */}
              {(results.candidates.filter(c => !c.is_selected).length > 0 || (results.rejected_candidates && results.rejected_candidates.length > 0)) && (
                <div>
                  <h3 style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px', marginBottom: '20px' }}>
                    Other Interviewed Candidates (Not Selected)
                  </h3>
                  {results.candidates.filter(c => !c.is_selected).map((cand, idx) => (
                    <div key={`rej-${idx}`} className="resp-screening-card" style={{ padding: '15px', background: 'var(--bg-dark)', border: '1px solid var(--border-light)', borderRadius: '8px', marginBottom: '12px', display: 'grid', gridTemplateColumns: '1fr auto', justifyContent: 'space-between', opacity: 0.7, gap: '12px' }}>
                      <div>
                        <h4 style={{ margin: '0 0 5px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {cand.name || cand.candidate_name}
                          <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>Auto-Rejected</span>
                        </h4>
                        <p style={{ fontSize: '0.8rem', margin: 0 }}>{cand.email}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Score</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                           {cand.score.breakdown?.Final || cand.score.total}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Auto-Rejected Candidates (Role Mismatch/Irrelevant) */}
                  {results.rejected_candidates && results.rejected_candidates.map((cand, idx) => (
                    <div key={`auto-rej-${idx}`} className="resp-screening-card" style={{ padding: '15px', background: 'rgba(239, 68, 68, 0.05)', border: '1px dashed var(--danger)', borderRadius: '8px', marginBottom: '12px', display: 'grid', gridTemplateColumns: '1fr auto', justifyContent: 'space-between', opacity: 0.8, gap: '12px' }}>
                      <div>
                        <h4 style={{ margin: '0 0 5px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {cand.name || cand.candidate_name || cand.filename}
                          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}>Role Mismatch (Rejected)</span>
                        </h4>
                        <p style={{ fontSize: '0.85rem', margin: 0, color: 'var(--danger)' }}>{cand.reason || 'Irrelevant profile to JD requirements.'}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--danger)' }}>Score</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--danger)' }}>
                           {cand.score?.total || 0}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Global Next Steps Button */}
              <div style={{ marginTop: '40px', padding: '25px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)', textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 15px', color: 'var(--text-main)', fontSize: '1.2rem' }}>Finalize Screening Stage</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>
                  This will transition all Top Matches to the <strong>Aptitude Generator</strong> state and dispatch polite rejection emails via your connected Gmail to the auto-rejected candidates.
                </p>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '14px 28px', fontSize: '1.05rem', fontWeight: 600, width: '100%', maxWidth: '600px', margin: '0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
                  onClick={async () => {
                    const confirmAction = window.confirm("Are you sure you want to lock the selected candidates and transition to the Aptitude Testing phase?");
                    if (!confirmAction) return;
                    try {
                      // 1. Mark selected candidates in the DB
                      const selectedEmails = results.candidates.filter(c => c.is_selected).map(c => c.email).filter(Boolean);
                      if (selectedEmails.length > 0) {
                        await fetch(`http://localhost:8000/jd/${selectedJd}/candidates/shortlist`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ emails: selectedEmails })
                        });
                      }

                      // 2. Advance pipeline state
                      const res = await fetch(`http://localhost:8000/jd/update_state?jd_id=${selectedJd}&new_state=SCREENING_COMPLETE`, { method: "POST" });
                      if (res.ok) {
                         // 3. Send rejection emails to not-selected candidates
                         const rejected = results.candidates.filter(c => !c.is_selected);
                         if (rejected.length > 0) {
                           const jdData = jds.find(j => j.jd_id === selectedJd);
                           await fetch('http://localhost:8000/test/send-rejection', {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({
                               emails: rejected.map(c => c.email).filter(Boolean),
                               job_title: jdData?.title || '',
                               company_name: jdData?.company || 'RecruitAI'
                             })
                           }).catch(() => {});
                         }
                         alert("🔥 Candidates Shortlisted! Navigating to Aptitude & Coding Generator.");
                         if (navigateTo) navigateTo('aptitude');
                      } else {
                         alert("Failed to update status. Check backend connection.");
                      }
                    } catch (e) {
                      alert("Error: " + e);
                    }
                  }}
                >
                  Move Selected to Aptitude Generator & Send Rejections
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ActivityGraphPlaceholder = () => (
  // Simple SVG placeholder for empty state visualizing a graph node
  <svg width="120" height="120" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="90" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeDasharray="10 10"/>
    <circle cx="100" cy="40" r="15" fill="rgba(99,102,241,0.2)" stroke="var(--primary)" strokeWidth="2"/>
    <circle cx="40" cy="140" r="15" fill="rgba(14,165,233,0.2)" stroke="var(--accent)" strokeWidth="2"/>
    <circle cx="160" cy="140" r="15" fill="rgba(16,185,129,0.2)" stroke="var(--success)" strokeWidth="2"/>
    <path d="M100 55 L50 130" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
    <path d="M100 55 L150 130" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
    <path d="M55 140 L145 140" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
  </svg>
);

export default ResumeScreening;
