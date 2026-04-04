import React, { useState, useEffect } from 'react';
import { BarChart3, Eye, CheckSquare, FileText, ShieldAlert, Award, CheckCircle, XCircle, EyeOff, User } from 'lucide-react';
import CandidateProfileModal from '../components/CandidateProfileModal';
import ResponsiveDropdown from '../components/ResponsiveDropdown';
import { buildJdDropdownOption, sortJdsNewestFirst } from '../utils/jdDropdown';

const AnalyseResults = ({ navigateTo }) => {
  const [jds, setJds] = useState([]);
  const apiBase = window.__API_BASE || 'http://localhost:8000';
  const [selectedJd, setSelectedJd] = useState('');
  const [jdDetail, setJdDetail] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [testAnswers, setTestAnswers] = useState([]);
  const [selectedForInterview, setSelectedForInterview] = useState([]);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('10:00');
  const [interviewLocation, setInterviewLocation] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [expandedCandidate, setExpandedCandidate] = useState(null);
  const [showAnswerKey, setShowAnswerKey] = useState(null);
  const [selectedCandidateModal, setSelectedCandidateModal] = useState(null);
  const [violationDetailsCandidate, setViolationDetailsCandidate] = useState(null);

  const getStatusLabel = (statusValue) => {
    const raw = String(statusValue || '').trim();
    if (!raw) return 'Pending';
    return raw.split('|')[0].trim();
  };

  const getStatusBadgeClass = (statusValue) => {
    const label = getStatusLabel(statusValue).toLowerCase();
    if (label === 'major violation' || label === 'suspicious') return 'badge-danger';
    if (label === 'minor violation' || label === 'pending') return 'badge-warning';
    return 'badge-success';
  };

  const isFlaggedStatus = (statusValue) => {
    const label = getStatusLabel(statusValue).toLowerCase();
    return label === 'minor violation' || label === 'suspicious' || label === 'major violation';
  };

  const getStatusMetrics = (statusValue) => {
    const raw = String(statusValue || '');
    const [, suffix = ''] = raw.split('|');
    const parts = suffix.split(';').map(p => p.trim()).filter(Boolean);
    const metrics = {
      tab_switches: 0,
      fullscreen_exits: 0,
      face_missing: 0,
      face_out: 0,
      multi_face: 0,
      long_face_missing: 0,
      violations: 0,
      face_left: 0,
      face_right: 0,
      face_up: 0,
      face_down: 0,
    };

    parts.forEach((entry) => {
      const [k, v] = entry.split('=').map(x => String(x || '').trim());
      if (!k || !v) return;

      if (k === 'violations') {
        const [count] = v.split('/');
        metrics.violations = Number.parseInt(count, 10) || 0;
        return;
      }

      if (Object.prototype.hasOwnProperty.call(metrics, k)) {
        metrics[k] = Number.parseInt(v, 10) || 0;
      }
    });

    return metrics;
  };

  const getViolationSeverity = (statusValue) => {
    const label = getStatusLabel(statusValue || '').toLowerCase();
    if (label === 'major violation') return { level: 'MAJOR', color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' };
    if (label === 'suspicious') return { level: 'SUSPICIOUS', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' };
    if (label === 'minor violation') return { level: 'MINOR', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' };
    return { level: 'NORMAL', color: '#10b981', bgColor: 'rgba(16,185,129,0.1)' };
  };

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/jd/all`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setJds(sortJdsNewestFirst(data.jds.filter(j => ['TEST_SENT', 'TEST_COMPLETED', 'RESULTS_ANALYSED'].includes(j.state))));
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedJd) return;
    fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/jd/${selectedJd}/detail`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setJdDetail(data);
          const validatedCands = (data.candidates || []).filter(c => {
             // 1. Only show candidates who were Shortlisted or Potential
             const status = String(c.Status || c.status || "").toLowerCase().trim();
             const isQualified = status === 'shortlisted' || status === 'potential' || status === 'high potential';
             if (!isQualified) return false;
             
             // 2. Only show candidates who actually have a record in ScheduledTests
             const email = String(c.Email || c.email || "").toLowerCase().trim();
             return (data.scheduled_tests || []).some(t => {
                const candEmail = String(t.Candidate_Email || t.Candidate_Emai || t.email || "").toLowerCase().trim();
                return candEmail === email;
             });
          });
          
          const cands = validatedCands.map(c => {
            const email = String(c.Email || c.email || "").toLowerCase().trim();
            const assessment = (data.scheduled_tests || []).find(t => 
               String(t.Candidate_Email || t.Candidate_Emai || t.email || "").toLowerCase().trim() === email
            );
            return { ...c, test_status: assessment?.Status || 'Pending', test_token: assessment?.Token || '' };
          });

          // Deduplicate by email so the same candidate is shown once even if multiple rows exist.
          const uniqueByEmail = new Map();
          cands.forEach((cand) => {
            const emailKey = String(cand.Email || cand.email || '').toLowerCase().trim();
            if (!emailKey) return;

            const existing = uniqueByEmail.get(emailKey);
            if (!existing) {
              uniqueByEmail.set(emailKey, cand);
              return;
            }

            const existingScore = Number.parseFloat(existing.Score ?? existing.score ?? '-1');
            const nextScore = Number.parseFloat(cand.Score ?? cand.score ?? '-1');
            if (nextScore > existingScore) {
              uniqueByEmail.set(emailKey, cand);
            }
          });

          setCandidates(Array.from(uniqueByEmail.values()));
        }
      });
    // Fetch test answers
    fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/jd/${selectedJd}/candidates`)
      .then(res => res.json())
      .then(() => {
        // Also fetch test answers from the detail endpoint (already included)
      });
  }, [selectedJd]);

  // Fetch TestAnswers for a specific candidate
  const fetchAnswerKey = async (email) => {
    if (showAnswerKey === email) { setShowAnswerKey(null); return; }
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/test/answers/${selectedJd}/${email}`);
      const data = await resp.json();
      
      const answers = [];
      if (data.status === 'success') {
        (data.mcq_answers || []).forEach(a => answers.push(a));
        (data.coding_answers || []).forEach(a => answers.push(a));
      }
      setTestAnswers(answers);
      setShowAnswerKey(email);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleForInterview = (email) => {
    setSelectedForInterview(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const handleScheduleInterview = async () => {
    if (selectedForInterview.length === 0) return alert("Select candidates first");
    if (!interviewDate) return alert("Set interview date");
    
    setScheduling(true);
    const selected = candidates.filter(c => selectedForInterview.includes(c.Email));
    const jdData = jds.find(j => j.jd_id === selectedJd);
    
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/jd/${selectedJd}/schedule_interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: selected.map(c => ({ 
            email: c.Email, 
            name: c.Name, 
            score: c.Score,
            Matched_Skills: c.Matched_Skills,
            AI_Reasoning: c.AI_Reasoning,
            Drive_URL: c.Report_Path || c.Drive_URL 
          })),
          date: interviewDate,
          time: interviewTime,
          location: interviewLocation,
          job_title: jdData?.title || '',
          interviewer: ''
        })
      });
      
      alert(`✅ Interviews scheduled for ${selectedForInterview.length} candidates!`);
      if (navigateTo) navigateTo('interviews');
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setScheduling(false);
    }
  };

  const campaignOptions = [
    { value: '', label: '-- Select JD with test results --' },
    ...jds.map((jd) => buildJdDropdownOption(jd))
  ];

  const proctoringTotals = candidates.reduce((acc, c) => {
    const m = getStatusMetrics(c.test_status);
    acc.violations += m.violations;
    acc.tab_switches += m.tab_switches;
    acc.fullscreen_exits += m.fullscreen_exits;
    acc.face_missing += m.face_missing;
    acc.face_out += m.face_out;
    acc.multi_face += m.multi_face;
    acc.long_face_missing += m.long_face_missing;
    acc.face_left += m.face_left;
    acc.face_right += m.face_right;
    acc.face_up += m.face_up;
    acc.face_down += m.face_down;
    return acc;
  }, {
    violations: 0,
    tab_switches: 0,
    fullscreen_exits: 0,
    face_missing: 0,
    face_out: 0,
    multi_face: 0,
    long_face_missing: 0,
    face_left: 0,
    face_right: 0,
    face_up: 0,
    face_down: 0,
  });

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1>Analyse Test Results</h1>
        <p>Review candidate performance, answer keys, AI analysis, and select finalists for interview.</p>
      </header>

      <div className="card glass-panel" style={{ marginBottom: '24px', position: 'relative', zIndex: 60, overflow: 'visible' }}>
        <div className="card-header">
          <h2 className="card-title"><BarChart3 size={20} color="var(--accent)" /> Select Campaign</h2>
        </div>
        <ResponsiveDropdown value={selectedJd} onChange={setSelectedJd} options={campaignOptions} />
      </div>

      {candidates.length > 0 && (
        <>
          {/* Stats Summary */}
          <div className="grid-3" style={{ marginBottom: '24px' }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--primary)' }}><FileText size={24} /></div>
              <div className="stat-content"><h3>Total Tested</h3><p>{candidates.length}</p></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)' }}><Award size={24} /></div>
              <div className="stat-content"><h3>Selected for Interview</h3><p>{selectedForInterview.length}</p></div>
            </div>
          </div>

          {/* Candidate Results Cards */}
          {candidates.map((cand, idx) => (
            <div key={idx} className="card" style={{ marginBottom: '24px', padding: '0', border: selectedForInterview.includes(cand.Email) ? '2px solid var(--primary)' : '1px solid var(--border-light)', transition: 'all 0.3s', background: selectedForInterview.includes(cand.Email) ? 'rgba(99,102,241,0.05)' : 'var(--bg-card)', overflow: 'hidden' }}>
              <div style={{ padding: '28px' }}>
                {/* Main Header Section */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '24px', flexWrap: 'wrap' }}>
                  <input type="checkbox" checked={selectedForInterview.includes(cand.Email)}
                    onChange={() => toggleForInterview(cand.Email)}
                    style={{ width: '22px', height: '22px', accentColor: 'var(--primary)', cursor: 'pointer', marginTop: '2px', flexShrink: 0 }} />
                  
                  {/* Candidate Info */}
                  <div style={{ flex: 1, minWidth: '250px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-main)' }}>{cand.Name}</h3>
                      <span className={`badge ${cand.Status === 'Shortlisted' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>{cand.Status}</span>
                      {isFlaggedStatus(cand.test_status) && (
                        <span className={`badge ${getStatusBadgeClass(cand.test_status)}`} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                          {getStatusLabel(cand.test_status)}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--text-muted)' }}>📧 {cand.Email}</p>
                    {cand.Matched_Skills && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {cand.Matched_Skills?.split(',').slice(0, 4).map((s, si) => (
                          <span key={si} style={{ fontSize: '0.8rem', padding: '6px 12px', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', borderRadius: '6px', border: '1px solid rgba(99,102,241,0.3)' }}>⭐ {s.trim()}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Score Box */}
                  <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '14px 24px', borderRadius: '10px', border: '1px solid var(--border-light)', minWidth: '110px' }}>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 700 }}>Score</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: parseFloat(cand.Score) >= 50 ? 'var(--success)' : 'var(--danger)' }}>{cand.Score}</div>
                  </div>

                  {/* Violation Severity Button */}
                  {cand.test_status && (
                    <button
                      onClick={() => setViolationDetailsCandidate(violationDetailsCandidate?.Email === cand.Email ? null : cand)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        border: `2px solid ${getViolationSeverity(cand.test_status).color}`,
                        background: getViolationSeverity(cand.test_status).bgColor,
                        color: getViolationSeverity(cand.test_status).color,
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        transition: 'all 0.3s',
                        minWidth: '110px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        {getViolationSeverity(cand.test_status).level}
                      </button>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button className="btn btn-outline" onClick={() => setExpandedCandidate(expandedCandidate === idx ? null : idx)} style={{ padding: '10px 16px', fontSize: '0.9rem', flex: '1', minWidth: '140px' }}>
                    {expandedCandidate === idx ? <><Eye size={16} /> Hide Details</> : <><Eye size={16} /> Show Details</>}
                  </button>
                  <button className="btn btn-outline" onClick={() => fetchAnswerKey(cand.Email)} 
                    style={{ padding: '10px 16px', fontSize: '0.9rem', flex: '1', minWidth: '140px', borderColor: showAnswerKey === cand.Email ? 'var(--accent)' : undefined, color: showAnswerKey === cand.Email ? 'var(--accent)' : undefined }}>
                    {showAnswerKey === cand.Email ? <><EyeOff size={16} /> Hide Answer Key</> : <><CheckSquare size={16} /> View Answer Key</>}
                  </button>
                  <button className="btn btn-primary" onClick={() => setSelectedCandidateModal(cand)} style={{ padding: '10px 16px', fontSize: '0.9rem', flex: '1', minWidth: '140px' }}>
                    <User size={16} /> View Full Profile
                  </button>
                </div>

              {/* Violation Details Section */}
              {violationDetailsCandidate?.Email === cand.Email && (
                <div className="animate-fade-in" style={{ padding: '24px 28px 28px', borderTop: '1px solid var(--border-light)', background: 'rgba(239,68,68,0.03)', marginTop: '20px' }}>
                  <h4 style={{ color: 'var(--danger)', margin: '0 0 16px', fontSize: '1.05rem', fontWeight: 700 }}>🚨 Violation Details</h4>
                  <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '8px', border: `2px solid ${getViolationSeverity(cand.test_status).color}`, marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Severity Level</span>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: getViolationSeverity(cand.test_status).color, textTransform: 'uppercase' }}>
                        {getViolationSeverity(cand.test_status).level}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <p style={{ margin: '0 0 8px' }}>📊 <strong>Status:</strong> {getStatusLabel(cand.test_status)}</p>
                      {(() => {
                        const metrics = getStatusMetrics(cand.test_status);
                        return (
                          <>
                            <p style={{ margin: '0 0 8px' }}>📌 <strong>Violations:</strong> {metrics.violations}/3</p>
                            <p style={{ margin: '0 0 8px' }}>🔄 <strong>Tab Switches:</strong> {metrics.tab_switches}</p>
                            <p style={{ margin: '0 0 8px' }}>🖥️ <strong>Fullscreen Exits:</strong> {metrics.fullscreen_exits}</p>
                            <p style={{ margin: '0 0 8px' }}>👁️ <strong>Face Missing Events:</strong> {metrics.face_missing}</p>
                            <p style={{ margin: '0 0 8px' }}>📍 <strong>Face Out of Frame:</strong> {metrics.face_out}</p>
                            <p style={{ margin: '0 0 8px' }}>👥 <strong>Multiple Faces:</strong> {metrics.multi_face}</p>
                            <p style={{ margin: '0 0 8px' }}>⏱️ <strong>Long Face Missing:</strong> {metrics.long_face_missing}</p>
                            <p style={{ margin: 0 }}>↔️ <strong>Face Directions:</strong> L{metrics.face_left} R{metrics.face_right} U{metrics.face_up} D{metrics.face_down}</p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
              </div>

              {expandedCandidate === idx && (
                <div className="animate-fade-in" style={{ padding: '24px 28px 28px', borderTop: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)' }}>
                  <div className="grid-2" style={{ marginTop: '0', gap: '20px' }}>
                    <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <h4 style={{ color: 'var(--accent)', marginBottom: '12px', marginTop: 0 }}>AI Reasoning</h4>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>{cand.AI_Reasoning || 'No AI analysis available'}</p>
                    </div>
                    <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <h4 style={{ color: 'var(--success)', marginBottom: '12px', marginTop: 0 }}>Matched Skills</h4>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>{cand.Matched_Skills || 'None'}</p>
                      <h4 style={{ color: 'var(--warning)', marginBottom: '10px', marginTop: 0 }}>Proctoring Status</h4>
                      <span className={`badge ${getStatusBadgeClass(cand.test_status)}`}>
                        {cand.test_status || 'Not Tested'}
                      </span>
                      {cand.Report_Path && (
                        <div style={{ marginTop: '16px' }}>
                          <h4 style={{ color: 'var(--primary)', marginBottom: '8px', marginTop: 0 }}>Resume</h4>
                          <a href={`${apiBase}${cand.Report_Path}`} target="_blank" rel="noopener noreferrer"
                            style={{ color: 'var(--accent)', fontSize: '0.9rem', textDecoration: 'none' }}>📄 View Resume PDF</a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Answer Key Comparison */}
              {showAnswerKey === cand.Email && testAnswers.length > 0 && (
                <div className="animate-fade-in" style={{ padding: '24px 28px', borderTop: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)' }}>
                  <h4 style={{ color: 'var(--accent)', margin: '0 0 20px', fontSize: '1.05rem', fontWeight: 700 }}>Answer Key Comparison</h4>
                  <div className="table-wrapper">
                    <table className="table stack-mobile" style={{ fontSize: '0.9rem' }}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Type</th>
                          <th>Question</th>
                          <th>Candidate Answer</th>
                          <th>Correct Answer</th>
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {testAnswers.map((a, ai) => (
                          <tr key={ai} style={{ background: a.isCorrect === true ? 'rgba(16,185,129,0.05)' : a.isCorrect === false ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                            <td data-label="#">{a.qNo}</td>
                            <td data-label="Type"><span className={`badge ${a.type === 'MCQ' ? 'badge-primary' : 'badge-warning'}`}>{a.type}</span></td>
                            <td data-label="Question" style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.question}</td>
                            <td data-label="Candidate" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.candidate || '—'}</td>
                            <td data-label="Correct" style={{ color: 'var(--success)' }}>{a.correct || '—'}</td>
                            <td data-label="Result">
                              {a.isCorrect === true ? <CheckCircle size={18} color="var(--success)" /> :
                               a.isCorrect === false ? <XCircle size={18} color="var(--danger)" /> :
                               <span style={{ color: 'var(--text-muted)' }}>Manual</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    ✅ Correct: {testAnswers.filter(a => a.isCorrect === true).length} / {testAnswers.filter(a => a.type === 'MCQ').length} MCQs
                  </div>
                </div>
              )}

              {showAnswerKey === cand.Email && testAnswers.length === 0 && (
                <div style={{ padding: '15px 20px', color: 'var(--text-muted)', fontSize: '0.85rem', borderTop: '1px solid var(--border-light)' }}>
                  No test submissions found for this candidate yet.
                </div>
              )}
            </div>
          ))}

          {/* Schedule Interview Block */}
          {selectedForInterview.length > 0 && (
            <div className="card" style={{ marginTop: '30px', border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.03)' }}>
              <div className="card-header">
                <h2 className="card-title">Schedule Interviews ({selectedForInterview.length} selected)</h2>
              </div>
              <div className="grid-3" style={{ padding: '0 20px' }}>
                <div className="form-group">
                  <label className="form-label">Interview Date</label>
                  <input type="date" className="form-control" value={interviewDate} onChange={e => setInterviewDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Interview Time</label>
                  <input type="time" className="form-control" value={interviewTime} onChange={e => setInterviewTime(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Location / Meet Link</label>
                  <input type="text" className="form-control" value={interviewLocation} onChange={e => setInterviewLocation(e.target.value)} placeholder="Office / Google Meet link" />
                </div>
              </div>
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <button className="btn btn-primary" onClick={handleScheduleInterview} disabled={scheduling}
                  style={{ padding: '14px 28px', fontSize: '1.05rem', fontWeight: 600, width: '100%', maxWidth: '500px' }}>
                  {scheduling ? 'Scheduling...' : `Schedule Interview & Send Invitations (${selectedForInterview.length})`}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {candidates.length === 0 && selectedJd && (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No test results found yet. Tests may still be in progress.
        </div>
      )}

      {/* Universal Candidate Modal */}
      {selectedCandidateModal && (
        <CandidateProfileModal 
          candidate={selectedCandidateModal} 
          jdId={selectedJd} 
          onClose={() => setSelectedCandidateModal(null)} 
        />
      )}
    </div>
  );
};

export default AnalyseResults;
