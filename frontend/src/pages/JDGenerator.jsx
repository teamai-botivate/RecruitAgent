import React, { useState } from 'react';
import { PenTool, CheckCircle, Copy, ArrowRight } from 'lucide-react';

const JDGenerator = ({ navigateTo }) => {
  const [formData, setFormData] = useState({
    companyName: 'Tech Innovators',
    companyType: 'Product Based',
    industry: 'Software Development',
    location: 'Bangalore, Hybrid',
    roleTitle: 'Senior React Developer',
    experience: '4-6 Years',
    employmentType: 'Full Time',
    workMode: 'Hybrid',
    salary: '25-30'
  });
  
  const [loading, setLoading] = useState(false);
  const [generatedJD, setGeneratedJD] = useState(null);
  const [jdId, setJdId] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:8000/jd/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        setGeneratedJD(data.jd);
        setJdId(data.jd_id);
      }
    } catch (err) {
      console.error("Error generating JD:", err);
      setGeneratedJD("AI Engine Failed to process context.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in layout-split">
      
      {/* JD Builder Form */}
      <div className="card glass-panel" style={{ height: 'fit-content' }}>
        <div className="card-header">
          <h2 className="card-title"><PenTool size={20} color="var(--primary)" /> AI JD Builder</h2>
        </div>
        
        <form onSubmit={handleGenerate}>
          {/* Company Details */}
          <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', marginBottom: '16px' }}>1. Company Profile</h3>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input type="text" name="companyName" className="form-control" value={formData.companyName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Industry</label>
              <input type="text" name="industry" className="form-control" value={formData.industry} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Company Type</label>
              <input type="text" name="companyType" className="form-control" value={formData.companyType} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input type="text" name="location" className="form-control" value={formData.location} onChange={handleChange} required />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '24px 0' }} />
          
          {/* Role Details */}
          <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent)', marginBottom: '16px' }}>2. Role Specifics</h3>
          <div className="form-group">
            <label className="form-label">Target Role Title</label>
            <input type="text" name="roleTitle" className="form-control" value={formData.roleTitle} onChange={handleChange} required style={{ borderColor: 'var(--accent)' }} />
          </div>
          
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Experience Level</label>
              <input type="text" name="experience" className="form-control" value={formData.experience} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Offered Salary (LPA)</label>
              <input type="text" name="salary" className="form-control" value={formData.salary} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Employment Type</label>
              <select name="employmentType" className="form-control" value={formData.employmentType} onChange={handleChange}>
                <option value="Full Time">Full Time</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Work Mode</label>
              <select name="workMode" className="form-control" value={formData.workMode} onChange={handleChange}>
                <option value="Hybrid">Hybrid</option>
                <option value="Remote">Remote</option>
                <option value="On-Site">On-Site</option>
              </select>
            </div>
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }} disabled={loading}>
            {loading ? <span className="spinner"></span> : "Synthesize AI Specification"}
          </button>
        </form>
      </div>

      {/* Output Panel */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="card-header">
          <h2 className="card-title">Generated Specification</h2>
          {jdId && <span className="badge badge-success">{jdId}</span>}
        </div>
        
        <div style={{ flex: 1, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '20px', overflowY: 'auto', border: '1px solid var(--border-light)' }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ marginBottom: '16px' }}></div>
              <p>LLM is formulating ATS-friendly JD structure...</p>
            </div>
          ) : generatedJD ? (
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'Inter', fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
              {generatedJD}
            </pre>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)' }}>
              Pending Generation...
            </div>
          )}
        </div>
        
        {generatedJD && (
          <div style={{ display: 'flex', gap: '16px', marginTop: '20px' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigator.clipboard.writeText(generatedJD)}>
              <Copy size={18} /> Copy to Clipboard
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigateTo('screening')}>
              Proceed to Screening <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

export default JDGenerator;
