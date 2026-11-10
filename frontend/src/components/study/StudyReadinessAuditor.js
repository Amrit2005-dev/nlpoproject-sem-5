import React, { useState, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowLeft,
  Loader2,
  Sparkles,
  X,
  FileCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '../../services/api';
import { studyApi } from '../../services/studyApi';

export default function StudyReadinessAuditor({ onBackToPlanner }) {
  const [documents, setDocuments] = useState([]);
  const [selectedSyllabus, setSelectedSyllabus] = useState(null);
  const [selectedNotes, setSelectedNotes] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [expandedTopicId, setExpandedTopicId] = useState(null);

  // Load existing documents for easy selection
  useEffect(() => {
    async function loadDocs() {
      try {
        const docs = await api.getDocuments();
        setDocuments(docs || []);
        // Check for cached latest audit
        const latest = await studyApi.getLatestAudit();
        if (latest && latest.topics && latest.topics.length > 0) {
          setAuditResult(latest);
        }
      } catch (e) {
        console.warn('Could not load documents for auditor:', e);
      }
    }
    loadDocs();
  }, []);

  const handleUploadSyllabus = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const doc = await api.uploadDocument(file);
      const docObj = {
        id: doc.document_id || doc.id,
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      };
      setSelectedSyllabus(docObj);
      setDocuments(prev => [docObj, ...prev]);
    } catch (err) {
      alert(err.message || 'Error uploading syllabus PDF');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadNotes = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsUploading(true);
    try {
      for (const file of files) {
        const doc = await api.uploadDocument(file);
        const docObj = {
          id: doc.document_id || doc.id,
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        };
        setSelectedNotes(prev => [...prev, docObj]);
      }
    } catch (err) {
      alert(err.message || 'Error uploading notes PDF');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRunAudit = async () => {
    if (!selectedSyllabus) {
      alert('Please select or upload a Syllabus PDF first.');
      return;
    }
    setIsAnalyzing(true);
    try {
      const notesIds = selectedNotes.map(n => n.id);
      const res = await studyApi.runAudit(selectedSyllabus.id, notesIds);
      setAuditResult(res);
    } catch (err) {
      alert(err.message || 'Failed to analyze syllabus coverage.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper to render Donut Chart SVG
  const renderDonutChart = (result) => {
    const total = (result.covered_count + result.partial_count + result.missing_count) || 1;
    const coveredAngle = (result.covered_count / total) * 360;
    const partialAngle = (result.partial_count / total) * 360;
    const missingAngle = (result.missing_count / total) * 360;

    // SVG donut path calculations
    const radius = 68;
    const circumference = 2 * Math.PI * radius;
    const coveredStroke = (result.covered_count / total) * circumference;
    const partialStroke = (result.partial_count / total) * circumference;
    const missingStroke = (result.missing_count / total) * circumference;

    return (
      <div style={{ position: 'relative', width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle */}
          <circle cx="90" cy="90" r={radius} fill="none" stroke="var(--border-color, #e2e8f0)" strokeWidth="18" />
          
          {/* Covered (Green) */}
          {coveredStroke > 0 && (
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke="#10b981"
              strokeWidth="18"
              strokeDasharray={`${coveredStroke} ${circumference}`}
              strokeDashoffset="0"
              strokeLinecap="round"
            />
          )}

          {/* Partial (Yellow) */}
          {partialStroke > 0 && (
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="18"
              strokeDasharray={`${partialStroke} ${circumference}`}
              strokeDashoffset={`-${coveredStroke}`}
              strokeLinecap="round"
            />
          )}

          {/* Missing (Red) */}
          {missingStroke > 0 && (
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke="#ef4444"
              strokeWidth="18"
              strokeDasharray={`${missingStroke} ${circumference}`}
              strokeDashoffset={`-${coveredStroke + partialStroke}`}
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* Center Text */}
        <div style={{ position: 'absolute', textAlign: 'center' }}>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {result.overall_coverage}%
          </div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Overall Coverage
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '28px 24px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
      {/* Header matching Image 2 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
            }}
          >
            <Sparkles size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Study-Readiness Auditor
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Check if you have enough material for all your syllabus topics.
            </p>
          </div>
        </div>

        {onBackToPlanner && (
          <button
            onClick={onBackToPlanner}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Planner</span>
          </button>
        )}
      </div>

      {/* Top Upload Section (Two Cards + Analyze Button) matching Image 2 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr)) 180px',
          gap: '16px',
          alignItems: 'stretch',
          marginBottom: '28px'
        }}
      >
        {/* Card 1: Upload Syllabus */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
            Upload Syllabus
          </div>

          {selectedSyllabus ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-secondary, #f8fafc)',
                border: '1px solid var(--border-color)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <FileText size={18} color="#6366f1" />
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedSyllabus.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {selectedSyllabus.size || 'PDF'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedSyllabus(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px' }}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '18px 12px',
                  border: '2px dashed var(--border-color)',
                  borderRadius: '10px',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--accent-primary, #6366f1)',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                <UploadCloud size={18} />
                <span>Choose Syllabus PDF</span>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleUploadSyllabus}
                  disabled={isUploading}
                  style={{ display: 'none' }}
                />
              </label>

              {/* Quick Select from existing documents */}
              {documents.length > 0 && (
                <select
                  onChange={(e) => {
                    const doc = documents.find(d => (d.id || d.document_id) === e.target.value);
                    if (doc) {
                      setSelectedSyllabus({
                        id: doc.id || doc.document_id,
                        name: doc.filename || doc.name,
                        size: 'Indexed'
                      });
                    }
                  }}
                  defaultValue=""
                  style={{
                    padding: '7px 10px',
                    borderRadius: '7px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontSize: '12px'
                  }}
                >
                  <option value="" disabled>Or choose from indexed PDFs...</option>
                  {documents.map((d, i) => (
                    <option key={i} value={d.id || d.document_id}>
                      {d.filename || d.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Card 2: Upload Study Materials */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
            Upload Study Materials
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {selectedNotes.map((note, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary, #f8fafc)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <FileText size={16} color="#10b981" />
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {note.name}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNotes(prev => prev.filter((_, i) => i !== idx))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '8px' }}>
              <label
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '8px',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                <UploadCloud size={15} />
                <span>+ Add Notes PDF</span>
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleUploadNotes}
                  disabled={isUploading}
                  style={{ display: 'none' }}
                />
              </label>

              {documents.length > 0 && (
                <select
                  onChange={(e) => {
                    const doc = documents.find(d => (d.id || d.document_id) === e.target.value);
                    if (doc && !selectedNotes.some(n => n.id === (doc.id || doc.document_id))) {
                      setSelectedNotes(prev => [...prev, {
                        id: doc.id || doc.document_id,
                        name: doc.filename || doc.name,
                        size: 'Indexed'
                      }]);
                    }
                  }}
                  defaultValue=""
                  style={{
                    maxWidth: '130px',
                    padding: '6px 8px',
                    borderRadius: '7px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontSize: '12px'
                  }}
                >
                  <option value="" disabled>+ Add Stored</option>
                  {documents.map((d, i) => (
                    <option key={i} value={d.id || d.document_id}>
                      {d.filename || d.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Action Button: Analyze Coverage */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={handleRunAudit}
            disabled={isAnalyzing || !selectedSyllabus}
            style={{
              width: '100%',
              height: '100%',
              minHeight: '80px',
              backgroundColor: '#6366f1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '14px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: isAnalyzing || !selectedSyllabus ? 'not-allowed' : 'pointer',
              opacity: isAnalyzing || !selectedSyllabus ? 0.6 : 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
              transition: 'all 0.18s'
            }}
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                <span>Auditing...</span>
              </>
            ) : (
              <>
                <Sparkles size={22} />
                <span>Analyze Coverage</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Section matching Image 2 */}
      {auditResult && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 340px) 1fr',
            gap: '20px',
            alignItems: 'start'
          }}
        >
          {/* Left Card: Coverage Summary */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '22px',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0' }}>
              Coverage Summary
            </h2>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '22px' }}>
              {renderDonutChart(auditResult)}
            </div>

            {/* Legend Stats matching Image 2 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Covered</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {auditResult.covered_count} topics
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Partial</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {auditResult.partial_count} topics
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Missing</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {auditResult.missing_count} topics
                </span>
              </div>
            </div>
          </div>

          {/* Right Card: Topic-wise Report matching Image 2 */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '22px',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Topic-wise Report
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {auditResult.topics.length} syllabus topics evaluated
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {auditResult.topics.map((t, idx) => {
                const isExpanded = expandedTopicId === t.id;
                let badgeBg = '#dcfce7';
                let badgeText = '#15803d';
                let badgeBorder = '#bbf7d0';
                let Icon = CheckCircle2;

                if (t.status === 'Partial') {
                  badgeBg = '#fef3c7';
                  badgeText = '#b45309';
                  badgeBorder = '#fde68a';
                  Icon = AlertCircle;
                } else if (t.status === 'Missing') {
                  badgeBg = '#fee2e2';
                  badgeText = '#b91c1c';
                  badgeBorder = '#fecaca';
                  Icon = XCircle;
                }

                return (
                  <div
                    key={t.id || idx}
                    onClick={() => setExpandedTopicId(isExpanded ? null : t.id)}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      backgroundColor: 'var(--bg-main)',
                      cursor: 'pointer',
                      transition: 'background 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', minWidth: '18px' }}>
                          {idx + 1}.
                        </span>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {t.topic_name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            backgroundColor: badgeBg,
                            color: badgeText,
                            border: `1px solid ${badgeBorder}`,
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '11.5px',
                            fontWeight: 700
                          }}
                        >
                          <Icon size={13} />
                          <span>{t.status}</span>
                        </div>
                        {isExpanded ? <ChevronUp size={14} color="var(--text-secondary)" /> : <ChevronDown size={14} color="var(--text-secondary)" />}
                      </div>
                    </div>

                    {/* Expandable Evidence Snippet */}
                    {isExpanded && (
                      <div
                        style={{
                          marginTop: '10px',
                          paddingTop: '10px',
                          borderTop: '1px dashed var(--border-color)',
                          fontSize: '12.5px',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        {t.notes_snippet ? (
                          <>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>
                              Found in Notes (Match: {Math.round(t.max_similarity * 100)}%):
                            </div>
                            <div style={{ fontStyle: 'italic', backgroundColor: 'var(--bg-card)', padding: '8px 10px', borderRadius: '6px' }}>
                              "{t.notes_snippet}"
                            </div>
                          </>
                        ) : (
                          <div style={{ color: '#ef4444' }}>
                            No strong coverage found in uploaded study notes. Recommended to add reference lecture slides or notes covering this topic.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

