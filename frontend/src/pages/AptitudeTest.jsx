import React, { useState, useEffect } from 'react';
import { Code, Users, ArrowRight, CheckSquare, Square, Trash2, Edit3, Plus, Save, Sparkles, BookOpen, Settings, Eye, EyeOff, ChevronDown, ChevronUp, User } from 'lucide-react';
import CandidateProfileModal from '../components/CandidateProfileModal';
import ResponsiveDropdown from '../components/ResponsiveDropdown';

const AptitudeTest = ({ navigateTo }) => {
  const [jds, setJds] = useState([]);
  const [selectedJd, setSelectedJd] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [jdDetail, setJdDetail] = useState(null);
  const [selectedCandidateModal, setSelectedCandidateModal] = useState(null);

  const [testSettings, setTestSettings] = useState({
    difficulty_level: 'Medium',
    mcq_count: 20,
    coding_count: -1, // -1 = auto-detect
    custom_instructions: '',
    include_coding: true,
  });

  const [loading, setLoading] = useState(false);
  const [generatedTest, setGeneratedTest] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Per-question selection state
  const [selectedMcqs, setSelectedMcqs] = useState({});
  const [selectedCoding, setSelectedCoding] = useState({});

  // Edit mode
  const [editingMcq, setEditingMcq] = useState(null);
  const [editingCoding, setEditingCoding] = useState(null);
  const [expandedMcq, setExpandedMcq] = useState(null);
  const [expandedCoding, setExpandedCoding] = useState(null);

  // Section visibility
  const [showMcqSection, setShowMcqSection] = useState(true);
  const [showCodingSection, setShowCodingSection] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/jd/all')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setJds(data.jds.filter(jd => jd.state !== 'JD_CREATED'));
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedJd) return;
    fetch(`http://localhost:8000/jd/${selectedJd}/candidates?status=Shortlisted`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') setCandidates(data.candidates);
      });

    // Get JD details for company name
    fetch(`http://localhost:8000/jd/${selectedJd}/detail`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') setJdDetail(data.jd);
      });
  }, [selectedJd]);

  const handleGenerate = async () => {
    if (!selectedJd) return alert("Select a campaign first");
    const jdData = jds.find(j => j.jd_id === selectedJd);

    setLoading(true);
    setGeneratedTest(null);
    setSaved(false);
    try {
      const resp = await fetch('http://localhost:8000/test/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd_text: jdDetail?.jd_text || `Role: ${jdData.title}, Company: ${jdData.company}`,
          difficulty_level: testSettings.difficulty_level,
          mcq_count: testSettings.mcq_count,
          coding_count: testSettings.include_coding ? testSettings.coding_count : 0,
          custom_instructions: testSettings.custom_instructions,
        })
      });
      const data = await resp.json();
      if (data.detail) throw new Error(data.detail);
      
      setGeneratedTest(data);

      // Auto-select all questions
      const mcqMap = {};
      (data.mcqs || []).forEach((_, i) => { mcqMap[i] = true; });
      setSelectedMcqs(mcqMap);

      const codingMap = {};
      (data.coding_questions || []).forEach((_, i) => { codingMap[i] = true; });
      setSelectedCoding(codingMap);

    } catch (e) {
      alert("Error generating test: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTest = async () => {
    if (!generatedTest) return;
    setSaving(true);

    // Filter only selected questions
    const finalMcqs = (generatedTest.mcqs || []).filter((_, i) => selectedMcqs[i]);
    const finalCoding = (generatedTest.coding_questions || []).filter((_, i) => selectedCoding[i]);

    if (finalMcqs.length === 0) {
      alert("Select at least 1 MCQ question");
      setSaving(false);
      return;
    }

    try {
      const jdData = jds.find(j => j.jd_id === selectedJd);
      const resp = await fetch('http://localhost:8000/test/save-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd_id: selectedJd,
          mcqs: finalMcqs,
          coding_questions: finalCoding,
          difficulty: testSettings.difficulty_level,
          company_name: jdData?.company || '',
        })
      });
      const data = await resp.json();
      if (data.status === 'success') {
        setSaved(true);
        alert(`✅ Test finalized! ${data.mcq_count} MCQs and ${data.coding_count} Coding questions saved.`);
      } else {
        throw new Error(data.detail || 'Save failed');
      }
    } catch (e) {
      alert("Error saving: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleMcq = (idx) => setSelectedMcqs(prev => ({ ...prev, [idx]: !prev[idx] }));
  const toggleCoding = (idx) => setSelectedCoding(prev => ({ ...prev, [idx]: !prev[idx] }));

  const selectAllMcqs = () => {
    const all = {};
    (generatedTest?.mcqs || []).forEach((_, i) => { all[i] = true; });
    setSelectedMcqs(all);
  };
  const deselectAllMcqs = () => setSelectedMcqs({});

  const updateMcq = (idx, field, value) => {
    const updated = { ...generatedTest };
    updated.mcqs[idx] = { ...updated.mcqs[idx], [field]: value };
    setGeneratedTest(updated);
  };

  const updateMcqOption = (qIdx, optIdx, value) => {
    const updated = { ...generatedTest };
    const opts = [...updated.mcqs[qIdx].options];
    opts[optIdx] = value;
    updated.mcqs[qIdx] = { ...updated.mcqs[qIdx], options: opts };
    setGeneratedTest(updated);
  };

  const updateCoding = (idx, field, value) => {
    const updated = { ...generatedTest };
    updated.coding_questions[idx] = { ...updated.coding_questions[idx], [field]: value };
    setGeneratedTest(updated);
  };

  const deleteMcq = (idx) => {
    const updated = { ...generatedTest };
    updated.mcqs = updated.mcqs.filter((_, i) => i !== idx);
    setGeneratedTest(updated);
    const newSel = {};
    Object.keys(selectedMcqs).forEach(k => {
      const ki = parseInt(k);
      if (ki < idx) newSel[ki] = selectedMcqs[ki];
      else if (ki > idx) newSel[ki - 1] = selectedMcqs[ki];
    });
    setSelectedMcqs(newSel);
  };

  const deleteCoding = (idx) => {
    const updated = { ...generatedTest };
    updated.coding_questions = updated.coding_questions.filter((_, i) => i !== idx);
    setGeneratedTest(updated);
    const newSel = {};
    Object.keys(selectedCoding).forEach(k => {
      const ki = parseInt(k);
      if (ki < idx) newSel[ki] = selectedCoding[ki];
      else if (ki > idx) newSel[ki - 1] = selectedCoding[ki];
    });
    setSelectedCoding(newSel);
  };

  const addCustomMcq = () => {
    const updated = { ...generatedTest };
    const newIdx = updated.mcqs.length;
    updated.mcqs.push({
      id: `Custom_${Date.now()}`,
      question: "New Custom Question?",
      options: ["Option A", "Option B", "Option C", "Option D"],
      answer: "Option A",
      explanation: "Explanation here"
    });
    setGeneratedTest(updated);
    setSelectedMcqs(prev => ({ ...prev, [newIdx]: true }));
    setEditingMcq(newIdx);
    setShowMcqSection(true);
  };

  const addCustomCoding = () => {
    const updated = { ...generatedTest };
    if (!updated.coding_questions) updated.coding_questions = [];
    const newIdx = updated.coding_questions.length;
    updated.coding_questions.push({
      title: "New Custom Problem",
      description: "Write a function to...",
      constraints: "O(n) time",
      example_input: "input",
      example_output: "output",
      test_cases: [
        { input: "in1", expected_output: "out1" },
        { input: "in2", expected_output: "out2" }
      ],
      difficulty: "Medium",
      hints: []
    });
    setGeneratedTest(updated);
    setSelectedCoding(prev => ({ ...prev, [newIdx]: true }));
    setEditingCoding(newIdx);
    setShowCodingSection(true);
  };

  const selectedMcqCount = Object.values(selectedMcqs).filter(Boolean).length;
  const selectedCodingCount = Object.values(selectedCoding).filter(Boolean).length;
  const totalMcqs = generatedTest?.mcqs?.length || 0;
  const totalCoding = generatedTest?.coding_questions?.length || 0;

  const campaignOptions = [
    { value: '', label: '-- Select Campaign --' },
    ...jds.map((jd) => ({
      value: jd.jd_id,
      label: `${jd.title} (${jd.jd_id})`,
      fullLabel: `${jd.title} • ${jd.company} - ${jd.state?.replace(/_/g, ' ') || ''}`
    }))
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1>Aptitude & Coding Generator</h1>
        <p>Generate AI-powered tests, review every question, then finalize and send.</p>
      </header>

      {/* Selected Candidates */}
      {candidates.length > 0 && (
        <div className="card" style={{ marginBottom: '24px', border: '1px solid rgba(16,185,129,0.3)' }}>
          <div className="card-header">
            <h2 className="card-title"><Users size={20} color="var(--success)" /> Shortlisted Candidates ({candidates.length})</h2>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', padding: '0 20px 20px' }}>
            {candidates.map((c, i) => (
              <div key={i} style={{ padding: '10px 14px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{c.Name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{c.Email}</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.9rem' }}>Score: {c.Score}</span>
                  <button onClick={() => setSelectedCandidateModal(c)} className="btn btn-sm btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', fontSize: '0.7rem', color: 'var(--accent)', borderColor: 'var(--accent)', marginLeft: '10px' }}>
                     <User size={12} /> Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Configuration */}
      <div className="card glass-panel" style={{ marginBottom: '32px' }}>
        <div className="card-header">
          <h2 className="card-title"><Settings size={20} color="var(--accent)" /> Test Configuration</h2>
        </div>

        <div className="form-group">
          <label className="form-label">Link Campaign Pipeline</label>
          <ResponsiveDropdown value={selectedJd} onChange={setSelectedJd} options={campaignOptions} />
        </div>

        <div className="grid-2" style={{ marginTop: '16px' }}>
          <div className="form-group">
            <label className="form-label">Difficulty Level</label>
            <select className="form-control" value={testSettings.difficulty_level} onChange={e => setTestSettings({ ...testSettings, difficulty_level: e.target.value })}>
              <option value="Low">Low — Fundamental Concepts</option>
              <option value="Medium">Medium — Application Level</option>
              <option value="Hard">Hard — Expert / System Design</option>
            </select>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">MCQ Count</label>
              <input type="number" className="form-control" value={testSettings.mcq_count}
                onChange={e => setTestSettings({ ...testSettings, mcq_count: parseInt(e.target.value) || 20 })} min={5} max={50} />
            </div>
            <div className="form-group">
              <label className="form-label">Include Coding?</label>
              <select className="form-control" value={testSettings.include_coding ? 'yes' : 'no'}
                onChange={e => setTestSettings({ ...testSettings, include_coding: e.target.value === 'yes' })}>
                <option value="yes">Yes — Auto Detect</option>
                <option value="no">No — Skip Coding</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Custom Instructions for AI</label>
          <input type="text" className="form-control" placeholder="E.g., Focus on React Hooks, Python AsyncIO, SQL Joins"
            value={testSettings.custom_instructions} onChange={e => setTestSettings({ ...testSettings, custom_instructions: e.target.value })} />
        </div>

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleGenerate} disabled={loading || !selectedJd}>
          <Sparkles size={18} /> {loading ? 'Generating AI Assessment...' : 'Generate Test Questions'}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* GENERATED TEST REVIEW PANEL                               */}
      {/* ══════════════════════════════════════════════════════════ */}
      {generatedTest && (
        <div className="animate-fade-in">

          {/* Summary Bar */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>{selectedMcqCount}/{totalMcqs}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>MCQs Selected</div>
            </div>
            <div style={{ flex: 1, minWidth: '200px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent)' }}>{selectedCodingCount}/{totalCoding}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Coding Selected</div>
            </div>
            <div style={{ flex: 1, minWidth: '200px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: generatedTest.role_type === 'technical' ? 'var(--success)' : 'var(--warning)' }}>
                {generatedTest.role_type === 'technical' ? '⚡' : '📋'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {generatedTest.role_type || 'Technical'} Role
              </div>
            </div>
          </div>

          {/* ── MCQ SECTION ── */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setShowMcqSection(!showMcqSection)}>
              <h2 className="card-title"><BookOpen size={20} color="var(--primary)" /> MCQ Questions ({totalMcqs})</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="btn btn-outline" onClick={e => { e.stopPropagation(); addCustomMcq(); }}
                  style={{ padding: '4px 10px', fontSize: '0.75rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                  <Plus size={14} style={{ verticalAlign: 'middle' }} /> Add Custom
                </button>
                <button className="btn btn-outline" onClick={e => { e.stopPropagation(); selectedMcqCount === totalMcqs ? deselectAllMcqs() : selectAllMcqs(); }}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                  {selectedMcqCount === totalMcqs ? 'Deselect All' : 'Select All'}
                </button>
                {showMcqSection ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>

            {showMcqSection && (generatedTest.mcqs || []).map((mcq, idx) => (
              <div key={idx} style={{
                padding: '16px 20px', borderBottom: '1px solid var(--border-light)',
                background: selectedMcqs[idx] ? 'rgba(99,102,241,0.04)' : 'rgba(239,68,68,0.03)',
                transition: 'background 0.2s'
              }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  {/* Checkbox */}
                  <button onClick={() => toggleMcq(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', marginTop: '2px' }}>
                    {selectedMcqs[idx]
                      ? <CheckSquare size={20} color="var(--primary)" />
                      : <Square size={20} color="var(--text-muted)" />}
                  </button>

                  {/* Question Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Q{idx + 1}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => setExpandedMcq(expandedMcq === idx ? null : idx)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                          {expandedMcq === idx ? <EyeOff size={14} color="var(--text-muted)" /> : <Eye size={14} color="var(--text-muted)" />}
                        </button>
                        <button onClick={() => setEditingMcq(editingMcq === idx ? null : idx)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                          <Edit3 size={14} color="var(--accent)" />
                        </button>
                        <button onClick={() => { if (window.confirm('Delete this question?')) deleteMcq(idx); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                          <Trash2 size={14} color="var(--danger)" />
                        </button>
                      </div>
                    </div>

                    {/* Question text */}
                    {editingMcq === idx ? (
                      <textarea className="form-control" value={mcq.question} rows={2} style={{ marginBottom: '8px', fontSize: '0.9rem' }}
                        onChange={e => updateMcq(idx, 'question', e.target.value)} />
                    ) : (
                      <p style={{ margin: '0 0 8px', color: 'var(--text-main)', fontWeight: 500, fontSize: '0.95rem', lineHeight: 1.5 }}>{mcq.question}</p>
                    )}

                    {/* Options — always visible */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                      {(mcq.options || []).map((opt, oi) => (
                        <div key={oi} style={{
                          padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem',
                          background: opt === mcq.answer ? 'rgba(16,185,129,0.12)' : 'var(--bg-input)',
                          border: `1px solid ${opt === mcq.answer ? 'var(--success)' : 'var(--border-light)'}`,
                          color: opt === mcq.answer ? 'var(--success)' : 'var(--text-main)',
                          fontWeight: opt === mcq.answer ? 600 : 400,
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word'
                        }}>
                          {editingMcq === idx ? (
                            <input type="text" value={opt} className="form-control" style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                              onChange={e => updateMcqOption(idx, oi, e.target.value)} />
                          ) : (
                            <span><strong>{String.fromCharCode(65 + oi)}.</strong> {opt}</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Correct answer selector in edit mode */}
                    {editingMcq === idx && (
                      <div style={{ marginTop: '8px' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Correct Answer:</label>
                        <select className="form-control" value={mcq.answer} style={{ fontSize: '0.85rem', marginTop: '4px' }}
                          onChange={e => updateMcq(idx, 'answer', e.target.value)}>
                          {(mcq.options || []).map((opt, oi) => (
                            <option key={oi} value={opt}>{String.fromCharCode(65 + oi)}. {opt}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Explanation (expanded) */}
                    {expandedMcq === idx && mcq.explanation && (
                      <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(99,102,241,0.06)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        💡 <strong>Explanation:</strong> {mcq.explanation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── CODING SECTION ── */}
          {totalCoding > 0 && (
            <div className="card" style={{ marginBottom: '24px' }}>
              <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setShowCodingSection(!showCodingSection)}>
                <h2 className="card-title"><Code size={20} color="var(--accent)" /> Coding Questions ({totalCoding})</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button className="btn btn-outline" onClick={e => { e.stopPropagation(); addCustomCoding(); }}
                    style={{ padding: '4px 10px', fontSize: '0.75rem', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                    <Plus size={14} style={{ verticalAlign: 'middle' }} /> Add Custom
                  </button>
                  {showCodingSection ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>

              {showCodingSection && (generatedTest.coding_questions || []).map((cq, idx) => (
                <div key={idx} style={{
                  padding: '20px', borderBottom: '1px solid var(--border-light)',
                  background: selectedCoding[idx] ? 'rgba(14,165,233,0.04)' : 'rgba(239,68,68,0.03)',
                }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <button onClick={() => toggleCoding(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', marginTop: '2px' }}>
                      {selectedCoding[idx]
                        ? <CheckSquare size={20} color="var(--accent)" />
                        : <Square size={20} color="var(--text-muted)" />}
                    </button>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>
                          {editingCoding === idx ? (
                            <input type="text" className="form-control" value={cq.title} style={{ fontSize: '1rem', fontWeight: 600 }}
                              onChange={e => updateCoding(idx, 'title', e.target.value)} />
                          ) : cq.title}
                        </h3>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => setEditingCoding(editingCoding === idx ? null : idx)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                            <Edit3 size={14} color="var(--accent)" />
                          </button>
                          <button onClick={() => { if (window.confirm('Delete?')) deleteCoding(idx); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                            <Trash2 size={14} color="var(--danger)" />
                          </button>
                        </div>
                      </div>

                      {editingCoding === idx ? (
                        <textarea className="form-control" value={cq.description} rows={3} style={{ fontSize: '0.85rem', marginBottom: '8px' }}
                          onChange={e => updateCoding(idx, 'description', e.target.value)} />
                      ) : (
                        <p style={{ margin: '0 0 10px', color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>{cq.description}</p>
                      )}

                      {cq.constraints && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--warning)', marginBottom: '8px' }}>⚙️ Constraints: {cq.constraints}</div>
                      )}

                      {/* Test cases preview */}
                      {(cq.test_cases || []).length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {cq.test_cases.slice(0, 3).map((tc, ti) => (
                            <div key={ti} style={{ padding: '6px 10px', background: 'var(--bg-input)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
                              <strong>TC{ti + 1}:</strong> {tc.input?.substring(0, 30)} → {(tc.expected_output || tc.output)?.substring(0, 30)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── SAVE & PROCEED ── */}
          <div className="card" style={{ border: saved ? '1px solid var(--success)' : '1px solid var(--primary)', background: saved ? 'rgba(16,185,129,0.06)' : 'rgba(99,102,241,0.06)' }}>
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 8px', color: saved ? 'var(--success)' : 'var(--primary)' }}>
                {saved ? '✅ Test Finalized!' : '📋 Review Complete?'}
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                {saved 
                  ? `${selectedMcqCount} MCQs and ${selectedCodingCount} Coding questions saved. Proceed to scheduling.`
                  : `You have selected ${selectedMcqCount} MCQs and ${selectedCodingCount} Coding questions. Save to finalize.`}
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {!saved && (
                  <button className="btn btn-primary" onClick={handleSaveTest} disabled={saving} style={{ padding: '14px 28px', fontSize: '1rem', fontWeight: 600 }}>
                    <Save size={18} /> {saving ? 'Saving...' : 'Save & Finalize Test'}
                  </button>
                )}
                {saved && (
                  <button className="btn btn-primary" onClick={() => navigateTo && navigateTo('schedule_test')}
                    style={{ padding: '14px 28px', fontSize: '1rem', fontWeight: 600, background: 'var(--success)' }}>
                    <ArrowRight size={18} /> Schedule & Send Test Links
                  </button>
                )}
              </div>
            </div>
          </div>
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

export default AptitudeTest;
