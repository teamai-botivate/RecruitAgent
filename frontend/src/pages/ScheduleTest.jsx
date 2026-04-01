import React, { useState, useEffect } from 'react';
import { Send, Calendar, Clock, Users, CheckSquare, AlertCircle, User } from 'lucide-react';
import CandidateProfileModal from '../components/CandidateProfileModal';
import ResponsiveDropdown from '../components/ResponsiveDropdown';

const ScheduleTest = ({ navigateTo }) => {
  const [jds, setJds] = useState([]);
  const [selectedJd, setSelectedJd] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [testDate, setTestDate] = useState('');
  const [testTime, setTestTime] = useState('10:00');
  const [duration, setDuration] = useState(60);
  const [sending, setSending] = useState(false);
  const [sendingChannel, setSendingChannel] = useState('');
  const [sent, setSent] = useState(false);
  const [jdDetail, setJdDetail] = useState(null);
  const [sendProgress, setSendProgress] = useState('');
  const [selectedCandidateModal, setSelectedCandidateModal] = useState(null);

  useEffect(() => {
    fetch('http://localhost:8000/jd/all')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setJds(data.jds.filter(j => ['APTITUDE_GENERATED', 'TEST_SCHEDULED', 'SCREENING_COMPLETE'].includes(j.state)));
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedJd) return;
    fetch(`http://localhost:8000/jd/${selectedJd}/candidates?status=Shortlisted`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setCandidates(data.candidates);
          setSelectedCandidates(data.candidates.map(c => c.Email));
        }
      });
    
    // Get JD detail for company name
    fetch(`http://localhost:8000/jd/${selectedJd}/detail`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') setJdDetail(data.jd);
      });
  }, [selectedJd]);

  const toggleCandidate = (email) => {
    setSelectedCandidates(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const toggleAll = () => {
    if (selectedCandidates.length === candidates.length) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates(candidates.map(c => c.Email));
    }
  };

  const handleSendTests = async (channel = 'email') => {
    if (selectedCandidates.length === 0) return alert("Select at least one candidate");
    if (!testDate) return alert("Set a test date");

    setSending(true);
    setSendingChannel(channel);
    const selected = candidates.filter(c => selectedCandidates.includes(c.Email));
    const jdData = jds.find(j => j.jd_id === selectedJd);
    const companyName = jdDetail?.company || jdData?.company || 'RecruitAI';

    try {
      for (let i = 0; i < selected.length; i++) {
        const cand = selected[i];
        setSendProgress(`Sending to ${cand.Name || cand.Email} (${i + 1}/${selected.length})...`);
        
        const token = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        const testLink = `${window.location.origin}/?page=test_env&token=${token}`;

        const resp = await fetch('http://localhost:8000/test/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jd_id: selectedJd,
            channel,
            candidates: [{ email: cand.Email, name: cand.Name, phone: cand.Phone || cand.phone || '' }],
            job_title: jdData?.title || '',
            test_date: testDate,
            duration_minutes: parseInt(duration),
            mcq_count: 0,  // Backend fetches from GeneratedTests sheet
            coding_count: 0,
            assessment_link: testLink,
            mcqs: [],
            coding_questions: [],
            company_name: companyName,
          })
        });
        
        const result = await resp.json();
        if (result.status !== 'success') {
          throw new Error(result.detail || 'Failed to send');
        }
      }

      // Update pipeline state
      await fetch(`http://localhost:8000/jd/update_state?jd_id=${selectedJd}&new_state=TEST_SENT`, { method: 'POST' });

      setSent(true);
      setSendProgress('');
      const channelText = channel === 'both' ? 'Email + WhatsApp' : channel === 'whatsapp' ? 'WhatsApp' : 'Email';
      alert(`✅ Test links sent to ${selectedCandidates.length} candidates via ${channelText}!`);
    } catch (e) {
      alert("Error sending tests: " + e.message);
    } finally {
      setSending(false);
      setSendingChannel('');
      setSendProgress('');
    }
  };

  const campaignOptions = [
    { value: '', label: '-- Select JD with generated test --' },
    ...jds.map((jd) => ({
      value: jd.jd_id,
      label: `${jd.title} (${jd.jd_id})`,
      fullLabel: `${jd.title} • ${jd.company} (${jd.jd_id}) - ${jd.state?.replace(/_/g, ' ') || ''}`
    }))
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1>Schedule & Send Tests</h1>
        <p>Select candidates, configure test window, and dispatch secure proctored test links.</p>
      </header>

      <div className="card glass-panel" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h2 className="card-title"><Calendar size={20} color="var(--accent)" /> Test Configuration</h2>
        </div>

        <div className="form-group">
          <label className="form-label">Select Campaign (JD)</label>
          <ResponsiveDropdown value={selectedJd} onChange={setSelectedJd} options={campaignOptions} />
        </div>

        <div className="grid-3" style={{ marginTop: '20px' }}>
          <div className="form-group">
            <label className="form-label"><Calendar size={14} /> Test Date</label>
            <input type="date" className="form-control" value={testDate} onChange={e => setTestDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label"><Clock size={14} /> Test Time</label>
            <input type="time" className="form-control" value={testTime} onChange={e => setTestTime(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Duration (minutes)</label>
            <input type="number" className="form-control" value={duration} onChange={e => setDuration(e.target.value)} min={15} max={180} />
          </div>
        </div>
      </div>

      {/* Candidate Selection */}
      {candidates.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <h2 className="card-title"><Users size={20} /> Select Candidates ({selectedCandidates.length}/{candidates.length})</h2>
            <button className="btn btn-outline" onClick={toggleAll} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
              <CheckSquare size={14} /> {selectedCandidates.length === candidates.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {candidates.map((cand, idx) => (
            <div key={idx}
              className="resp-candidate-row"
              onClick={() => toggleCandidate(cand.Email)}
              style={{
                padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap',
                cursor: 'pointer', borderBottom: '1px solid var(--border-light)',
                background: selectedCandidates.includes(cand.Email) ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                transition: 'background 0.2s'
              }}>
              <input type="checkbox" checked={selectedCandidates.includes(cand.Email)} readOnly
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', flexShrink: 0 }} />
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {cand.Name}
                  <span className="badge badge-success" style={{ background: 'transparent', border: '1px solid var(--success)' }}>
                    {cand.Status}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cand.Email}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', opacity: 0.9 }}>{cand.Phone || cand.phone || 'Phone not found'}</div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>ATS Score</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)' }}>{cand.Score}</div>
                </div>
                <button className="btn btn-sm btn-outline" onClick={(e) => { e.stopPropagation(); setSelectedCandidateModal(cand); }} style={{ color: 'var(--primary)', borderColor: 'var(--primary)', padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <User size={12} /> Profile
                </button>
              </div>
            </div>
          ))}

          <div style={{ padding: '24px', textAlign: 'center' }}>
            {sendProgress && (
              <div style={{ marginBottom: '16px', padding: '10px 16px', background: 'rgba(99,102,241,0.08)', borderRadius: '8px', color: 'var(--primary)', fontSize: '0.9rem' }}>
                <Send size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> {sendProgress}
              </div>
            )}
            <div className="resp-btn-group" style={{ width: '100%', maxWidth: '700px', margin: '0 auto' }}>
              <button
                className="btn btn-primary"
                style={{ padding: '14px 22px', fontSize: '1rem', fontWeight: 600, flex: 1 }}
                onClick={() => handleSendTests('email')}
                disabled={sending || selectedCandidates.length === 0 || !testDate || sent}>
                <Send size={18} /> {sending && sendingChannel === 'email' ? 'Sending Email...' : 'Send via Email'}
              </button>
              <button
                className="btn btn-outline"
                style={{ padding: '14px 22px', fontSize: '1rem', fontWeight: 600, flex: 1 }}
                onClick={() => handleSendTests('whatsapp')}
                disabled={sending || selectedCandidates.length === 0 || !testDate || sent}>
                <Send size={18} /> {sending && sendingChannel === 'whatsapp' ? 'Sending WhatsApp...' : 'Send via WhatsApp'}
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '14px 22px', fontSize: '1rem', fontWeight: 600, flex: 1 }}
                onClick={() => handleSendTests('both')}
                disabled={sending || selectedCandidates.length === 0 || !testDate || sent}>
                <Send size={18} /> {sending && sendingChannel === 'both' ? 'Sending Both...' : 'Send via Both'}
              </button>
            </div>
            {sent && (
              <div style={{ marginTop: '16px' }}>
                <button className="btn btn-secondary" style={{ padding: '12px 24px', fontSize: '1rem', fontWeight: 600 }}
                  onClick={() => { if (navigateTo) navigateTo('analyse'); }}>
                  Proceed to Results Analysis →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {candidates.length === 0 && selectedJd && (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <AlertCircle size={40} color="var(--warning)" style={{ marginBottom: '12px' }} />
          <p>No shortlisted candidates found for this JD. Complete the screening stage first.</p>
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

export default ScheduleTest;
