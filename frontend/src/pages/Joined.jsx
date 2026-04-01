import React, { useState, useEffect } from 'react';
import { PartyPopper, Briefcase, Calendar, Mail, Award, Eye } from 'lucide-react';
import CandidateProfileModal from '../components/CandidateProfileModal';
import ResponsiveDropdown from '../components/ResponsiveDropdown';

const Joined = () => {
  const [joined, setJoined] = useState([]);
  const [jds, setJds] = useState([]);
  const [selectedJd, setSelectedJd] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedCandidateModal, setSelectedCandidateModal] = useState(null);

  useEffect(() => {
    // Fetch all JDs for filter
    fetch('http://localhost:8000/jd/all')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setJds(data.jds);
        }
      });

    // Fetch all joined candidates
    fetch('http://localhost:8000/jd/joined/all')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setJoined(data.joined || []);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filteredJoined = selectedJd === 'all' 
    ? joined 
    : joined.filter(p => p.JD_ID === selectedJd);

  const formatCampaignLabel = (jd) => {
    const rawTitle = (jd?.title || '').trim();
    const shortTitle = rawTitle.length > 16 ? `${rawTitle.slice(0, 16)}...` : rawTitle;
    return `${shortTitle} (${jd.jd_id})`;
  };

  const campaignOptions = [
    { value: 'all', label: '-- All Campaigns --' },
    ...jds
      .filter(jd => joined.some(p => p.JD_ID === jd.jd_id))
      .map(jd => ({
        value: jd.jd_id,
        label: formatCampaignLabel(jd),
        fullLabel: `${jd.title} (${jd.jd_id})`
      }))
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PartyPopper size={28} color="var(--success)" /> Hired & Joined
          </h1>
          <p>All successfully hired candidates across all campaigns.</p>
        </div>
        <div className="badge badge-success" style={{ fontSize: '1.1rem', padding: '10px 16px' }}>
          {filteredJoined.length} Hires Displayed
        </div>
      </header>

      {/* JD Filter Selection */}
      <div className="card glass-panel" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h2 className="card-title"><Briefcase size={20} color="var(--accent)" /> Select Campaign</h2>
        </div>
        <ResponsiveDropdown value={selectedJd} onChange={setSelectedJd} options={campaignOptions} className="joined-campaign-dropdown" />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" style={{ margin: 'auto' }}></div></div>
      ) : filteredJoined.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <PartyPopper size={60} color="rgba(255,255,255,0.1)" style={{ marginBottom: '20px' }} />
          <h3 style={{ color: 'var(--text-muted)' }}>No hires found for this filter</h3>
          <p style={{ color: 'var(--text-muted)' }}>Try selecting all campaigns or check other JD IDs.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table stack-mobile">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Role</th>
                <th>JD ID</th>
                <th>Score</th>
                <th>Joining Date</th>
                <th>Hired At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJoined.map((person, idx) => (
                <tr key={idx} className="animate-fade-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                  <td data-label="Candidate">
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{person.Candidate_Name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Mail size={12} /> {person.Candidate_Email}
                    </div>
                    <button
                      onClick={() => setSelectedCandidateModal(person)}
                      className="btn btn-sm btn-outline joined-mobile-profile-btn"
                      style={{ marginTop: '8px', alignItems: 'center', gap: '5px' }}
                    >
                      <Eye size={14} /> Profile
                    </button>
                  </td>
                  <td data-label="Role">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Briefcase size={14} color="var(--primary)" /> {person.Role}
                    </span>
                  </td>
                  <td data-label="JD ID">
                    <span className="badge badge-primary" style={{ background: 'transparent', border: '1px solid var(--primary)' }}>
                      {person.JD_ID}
                    </span>
                  </td>
                  <td data-label="Score">
                    <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '1.1rem' }}>
                      <Award size={14} /> {person.Final_Score || '-'}
                    </span>
                  </td>
                  <td data-label="Joining Date">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent)' }}>
                      <Calendar size={14} /> {person.Joining_Date}
                    </span>
                  </td>
                  <td data-label="Hired At" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{person.Hired_At}</td>
                  <td data-label="Actions" style={{ textAlign: 'right' }} className="joined-actions-cell">
                    <button onClick={() => setSelectedCandidateModal(person)} className="btn btn-sm btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                       <Eye size={14} /> View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Universal Candidate Modal */}
      {selectedCandidateModal && (
        <CandidateProfileModal 
          candidate={selectedCandidateModal} 
          jdId={selectedCandidateModal.JD_ID} 
          onClose={() => setSelectedCandidateModal(null)} 
        />
      )}
    </div>
  );
};

export default Joined;
