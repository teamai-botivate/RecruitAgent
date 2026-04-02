import React, { useState, useEffect } from 'react';
import { CalendarCheck, MapPin, Clock, UserCheck, CheckCircle2, User } from 'lucide-react';
import CandidateProfileModal from '../components/CandidateProfileModal';
import ResponsiveDropdown from '../components/ResponsiveDropdown';
import { buildJdDropdownOption, sortJdsNewestFirst } from '../utils/jdDropdown';

const ScheduledInterviews = ({ navigateTo }) => {
  const [jds, setJds] = useState([]);
  const [selectedJd, setSelectedJd] = useState('');
  const [interviews, setInterviews] = useState([]);
  const [selectedForHire, setSelectedForHire] = useState([]);
  const [joiningDates, setJoiningDates] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [selectedCandidateModal, setSelectedCandidateModal] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/jd/all`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setJds(sortJdsNewestFirst(data.jds.filter(j => ['INTERVIEW_SCHEDULED', 'RESULTS_ANALYSED', 'APTITUDE_GENERATED', 'HIRED'].includes(j.state))));
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedJd) return;
    fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/jd/${selectedJd}/detail`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setInterviews(data.interviews || []);
        }
      });
  }, [selectedJd]);

  const toggleHire = (email) => {
    setSelectedForHire(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const handleConfirmHired = async () => {
    if (selectedForHire.length === 0) return alert("Select at least one candidate to mark as hired");
    
    const missingDates = selectedForHire.filter(email => !joiningDates[email]);
    if (missingDates.length > 0) return alert("Please set joining dates for all selected candidates");

    setConfirming(true);
    const selected = interviews.filter(i => selectedForHire.includes(i.Candidate_Email));
    const jdData = jds.find(j => j.jd_id === selectedJd);

    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/jd/${selectedJd}/confirm_hired`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: selected.map(c => ({
            email: c.Candidate_Email,
            name: c.Candidate_Name,
            score: c.Score || '',
            joining_date: joiningDates[c.Candidate_Email],
            Matched_Skills: c.Matched_Skills,
            AI_Reasoning: c.AI_Reasoning,
            Drive_URL: c.Drive_URL
          })),
          role: jdData?.title || ''
        })
      });

      alert(`🎉 ${selectedForHire.length} candidate(s) marked as HIRED! Pipeline complete.`);
      if (navigateTo) navigateTo('joined');
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setConfirming(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Scheduled': return 'var(--warning)';
      case 'Completed': return 'var(--success)';
      case 'Hired': return 'var(--primary)';
      default: return 'var(--text-muted)';
    }
  };

  const campaignOptions = [
    { value: '', label: '-- Select JD with scheduled interviews --' },
    ...jds.map((jd) => buildJdDropdownOption(jd))
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1>Scheduled Interviews</h1>
        <p>View all interview schedules, conduct interviews, and finalize hiring decisions.</p>
      </header>

      <div className="card glass-panel" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h2 className="card-title"><CalendarCheck size={20} color="var(--accent)" /> Select Campaign</h2>
        </div>
        <ResponsiveDropdown value={selectedJd} onChange={setSelectedJd} options={campaignOptions} />
      </div>

      {interviews.length > 0 && (
        <>
          {/* Interview Cards */}
          {interviews.map((interview, idx) => (
            <div key={idx} className="card" style={{ marginBottom: '16px', border: selectedForHire.includes(interview.Candidate_Email) ? '2px solid var(--success)' : '1px solid var(--border-light)' }}>
              <div className="resp-candidate-row" style={{ padding: '20px', display: 'flex', gap: '15px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <input type="checkbox"
                  checked={selectedForHire.includes(interview.Candidate_Email)}
                  onChange={() => toggleHire(interview.Candidate_Email)}
                  style={{ width: '20px', height: '20px', accentColor: 'var(--success)', cursor: 'pointer', marginTop: '4px', flexShrink: 0 }} />

                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <h3 style={{ margin: '0 0 4px', color: 'var(--text-main)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    {interview.Candidate_Name}
                    <span className="badge" style={{ background: 'transparent', border: `1px solid ${getStatusColor(interview.Status)}`, color: getStatusColor(interview.Status) }}>
                      {interview.Status}
                    </span>
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{interview.Candidate_Email}</p>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}><CalendarCheck size={14} /> {interview.Interview_Date}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}><Clock size={14} /> {interview.Interview_Time}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}><MapPin size={14} /> {interview.Location || 'TBD'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Score</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)' }}>{interview.Score || '-'}</div>
                  </div>
                  <button className="btn btn-sm btn-outline" onClick={() => setSelectedCandidateModal(interview)} style={{ color: 'var(--primary)', borderColor: 'var(--primary)', padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <User size={12} /> Profile
                  </button>

                  {/* Joining Date Input */}
                  {selectedForHire.includes(interview.Candidate_Email) && (
                    <div className="animate-fade-in">
                      <label style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'block', marginBottom: '4px' }}>Joining Date</label>
                      <input type="date" className="form-control" style={{ width: '160px', padding: '6px 10px', fontSize: '0.85rem' }}
                        value={joiningDates[interview.Candidate_Email] || ''}
                        onChange={e => setJoiningDates({ ...joiningDates, [interview.Candidate_Email]: e.target.value })} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Confirm Hiring Button */}
          {selectedForHire.length > 0 && (
            <div style={{ marginTop: '30px', padding: '25px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 10px', color: 'var(--success)' }}>
                <CheckCircle2 size={22} style={{ verticalAlign: 'middle' }} /> Finalize Hiring Decision
              </h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>
                This will mark {selectedForHire.length} candidate(s) as <strong>HIRED</strong> and record their joining dates.
              </p>
              <button className="btn btn-primary" onClick={handleConfirmHired} disabled={confirming}
                style={{ padding: '14px 28px', fontSize: '1.05rem', fontWeight: 600, width: '100%', maxWidth: '500px', background: 'var(--success)' }}>
                <UserCheck size={18} /> {confirming ? 'Confirming...' : `Confirm ${selectedForHire.length} Candidate(s) as Hired`}
              </button>
            </div>
          )}
        </>
      )}

      {interviews.length === 0 && selectedJd && (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No interviews scheduled yet for this JD. Complete the results analysis stage first.
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

export default ScheduledInterviews;
