import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Search,
  Home,
  Compass,
  Bookmark,
  LayoutGrid,
  Check,
  Plus,
  ChevronRight,
  ChevronDown,
  Paperclip,
  ArrowRight,
  ExternalLink,
  BookOpen,
  Layers,
  Menu,
  X,
  Share2,
  Copy,
  ThumbsUp,
  RotateCcw
} from 'lucide-react';

const INITIAL_SOURCES = [
  {
    id: 1,
    num: 1,
    title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
    domain: 'arxiv.org',
    snippet:
      'We explore general-purpose fine-tuning recipes for RAG models which combine pre-trained parametric memory with non-parametric retrieval from dense vector indexes.',
    favicon: 'Ar',
    url: 'https://arxiv.org/abs/2005.11401'
  },
  {
    id: 2,
    num: 2,
    title: 'Enterprise LLM Architecture: When to Fine-tune vs When to Retrieve',
    domain: 'pinecone.io',
    snippet:
      'Fine-tuning optimizes how the model thinks, behaves, and formats syntax. RAG dictates what the model knows right now with zero hallucinations.',
    favicon: 'Pn',
    url: 'https://pinecone.io/learn'
  },
  {
    id: 3,
    num: 3,
    title: 'Best Practices for Retrieval Grounding & Guardrails',
    domain: 'openai.com',
    snippet:
      'Grounding prompts with strict excerpt citations reduced enterprise hallucination rates to under 0.8% across internal policy documents.',
    favicon: 'Oa',
    url: 'https://openai.com/research'
  },
  {
    id: 4,
    num: 4,
    title: 'Cost Analysis: Vector Search Infrastructure vs GPU Cluster Training',
    domain: 'huggingface.co',
    snippet:
      'For fast-evolving knowledge bases, vector indexing delivers 14x faster time-to-production and eliminates multi-million-dollar training cycles.',
    favicon: 'Hf',
    url: 'https://huggingface.co/blog'
  },
  {
    id: 5,
    num: 5,
    title: 'Dynamic ACL & Permission Governance in Vector Search',
    domain: 'anthropic.com',
    snippet:
      'Pre-filtering vector queries using user security tokens ensures users only retrieve document chunks they have explicit rights to read.',
    favicon: 'An',
    url: 'https://anthropic.com'
  },
  {
    id: 6,
    num: 6,
    title: 'RAG vs Fine-Tuning: Comprehensive Decision Framework',
    domain: 'databricks.com',
    snippet:
      'A practical scorecard for tech executives evaluating data freshness, privacy boundaries, and model customization requirements.',
    favicon: 'Db',
    url: 'https://databricks.com'
  },
  {
    id: 7,
    num: 7,
    title: 'Parameter-Efficient Fine-Tuning (PEFT) and LoRA Workflows',
    domain: 'github.com',
    snippet:
      'Low-Rank Adaptation allows adapting 70B parameter models to specialized domain vocabularies on modest hardware.',
    favicon: 'Gh',
    url: 'https://github.com'
  },
  {
    id: 8,
    num: 8,
    title: 'Evaluating RAG Architectures with Context Relevance Metrics',
    domain: 'langchain.com',
    snippet:
      'Benchmarking retrieval precision, reciprocal rank fusion, and answer faithfulness across enterprise knowledge bases.',
    favicon: 'Lc',
    url: 'https://langchain.com'
  }
];

const INITIAL_RELATED = [
  'What are the latency tradeoffs between hybrid dense-sparse RAG and parameter fine-tuning?',
  'How can chunk-level security and ACLs be enforced dynamically in vector search?',
  'When is fine-tuning preferable for specialized structured JSON output formats?',
  'What evaluation metrics (RAGAS, faithfulness, context recall) benchmark RAG accuracy?'
];

export default function AnswerEngineScreen() {
  const [activeNav, setActiveNav] = useState('search');
  const [activeTab, setActiveTab] = useState('answer');
  const [activeCitationId, setActiveCitationId] = useState(1);
  const [query, setQuery] = useState(
    'When should an enterprise choose Retrieval-Augmented Generation (RAG) over model fine-tuning?'
  );
  const [followUpInput, setFollowUpInput] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [modelName, setModelName] = useState('Sonar Pro');
  const [isCopied, setIsCopied] = useState(false);
  const [sourcesCount, setSourcesCount] = useState(8);

  const textareaRef = useRef(null);
  const sourcesRailRef = useRef(null);

  // Auto-resize textarea
  const handleInputChange = (e) => {
    setFollowUpInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  const handleAskFollowUp = (customQuestion) => {
    const q = customQuestion || followUpInput;
    if (!q.trim()) return;
    setQuery(q);
    setFollowUpInput('');
    setActiveCitationId(1);
    setActiveTab('answer');
    if (textareaRef.current) {
      textareaRef.current.style.height = '52px';
    }
    // Scroll answer to top
    const container = document.querySelector('.main-content-area');
    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCitationClick = (id) => {
    setActiveCitationId(id);
    // On desktop, scroll the matching source card into view
    const cardEl = document.getElementById(`source-card-${id}`);
    if (cardEl && sourcesRailRef.current) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    // On mobile, scroll down to mobile sources
    const mobileCardEl = document.getElementById(`mobile-source-card-${id}`);
    if (mobileCardEl && window.innerWidth < 1024) {
      mobileCardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleCopyAnswer = () => {
    const answerText = `When should an enterprise choose Retrieval-Augmented Generation (RAG) over model fine-tuning?\n\nEnterprises should prioritize Retrieval-Augmented Generation (RAG) when the primary requirement is immediate factual accuracy, continuous data synchronization, and verifiable source traceability. Because RAG queries external vector databases at inference time, knowledge updates occur without costly GPU model retraining cycles.`;
    navigator.clipboard.writeText(answerText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="app-shell">
      {/* --------------------------------------------------------------------
          ZONE 1: Slim 64px Left Icon-Only Nav Rail on White
         -------------------------------------------------------------------- */}
      <aside className="nav-rail">
        {/* Brand Glyph: Rose Sparkle */}
        <button
          className="brand-glyph-btn"
          title="Perplexity Answer Engine"
          onClick={() => setActiveNav('search')}
        >
          <Sparkles size={22} fill="currentColor" />
        </button>

        {/* Icon Navigation Group */}
        <div className="nav-rail-group">
          <button
            className={`nav-rail-item ${activeNav === 'home' ? 'active' : ''}`}
            title="Home"
            onClick={() => setActiveNav('home')}
          >
            <Home size={20} />
          </button>

          <button
            className={`nav-rail-item ${activeNav === 'search' ? 'active' : ''}`}
            title="Search"
            onClick={() => setActiveNav('search')}
          >
            <Search size={20} />
          </button>

          <button
            className={`nav-rail-item ${activeNav === 'discover' ? 'active' : ''}`}
            title="Discover"
            onClick={() => setActiveNav('discover')}
          >
            <Compass size={20} />
          </button>

          <button
            className={`nav-rail-item ${activeNav === 'library' ? 'active' : ''}`}
            title="Library"
            onClick={() => setActiveNav('library')}
          >
            <Bookmark size={20} />
          </button>

          <button
            className={`nav-rail-item ${activeNav === 'spaces' ? 'active' : ''}`}
            title="Spaces"
            onClick={() => setActiveNav('spaces')}
          >
            <LayoutGrid size={20} />
          </button>
        </div>

        {/* Bottom Pinned User Avatar */}
        <button
          className="nav-avatar-btn"
          title="User Profile & Settings"
          onClick={() => alert('Connected as Sarvatha · Enterprise RAG Edition')}
        >
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
            alt="Avatar"
            className="nav-avatar-img"
          />
        </button>
      </aside>

      {/* Mobile Top Hamburger Bar (< md) */}
      <header className="mobile-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--rose)' }}>
            <Sparkles size={18} fill="currentColor" />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--ink)' }}>
              Perplexity
            </span>
          </div>
        </div>

        <button className="nav-avatar-btn" style={{ width: '30px', height: '30px' }}>
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
            alt="Avatar"
            className="nav-avatar-img"
          />
        </button>
      </header>

      {/* --------------------------------------------------------------------
          ZONE 2: Center Max-760px Answer Column
         -------------------------------------------------------------------- */}
      <main className="main-content-area">
        <div className="answer-column animate-fade-in">
          {/* Eyebrow: Rose Sparkle + 'ANSWER' */}
          <div className="eyebrow-row">
            <Sparkles size={14} className="eyebrow-sparkle" fill="currentColor" />
            <span className="eyebrow-text">ANSWER</span>
          </div>

          {/* User's Question Heading */}
          <h1 className="question-heading">{query}</h1>

          {/* Tab Set: Answer / Sources / Images */}
          <div className="answer-tabs">
            <button
              className={`tab-btn ${activeTab === 'answer' ? 'active' : ''}`}
              onClick={() => setActiveTab('answer')}
            >
              Answer
            </button>
            <button
              className={`tab-btn ${activeTab === 'sources' ? 'active' : ''}`}
              onClick={() => setActiveTab('sources')}
            >
              Sources
              <span className="tab-badge">{sourcesCount}</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'images' ? 'active' : ''}`}
              onClick={() => setActiveTab('images')}
            >
              Images
              <span className="tab-badge">3</span>
            </button>

            {/* Quick action icons */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button
                className="composer-icon-btn"
                title={isCopied ? 'Copied to clipboard!' : 'Copy Answer'}
                onClick={handleCopyAnswer}
              >
                {isCopied ? <Check size={16} color="var(--rose)" /> : <Copy size={16} />}
              </button>
              <button
                className="composer-icon-btn"
                title="Share Research"
                onClick={() => alert('Research link copied to clipboard!')}
              >
                <Share2 size={16} />
              </button>
            </div>
          </div>

          {/* Horizontal Source-Chip Strip */}
          <div className="source-chip-strip no-scrollbar">
            {INITIAL_SOURCES.slice(0, 5).map((source) => (
              <div
                key={source.id}
                className={`source-chip ${activeCitationId === source.num ? 'highlighted' : ''}`}
                onClick={() => handleCitationClick(source.num)}
                title={source.title}
              >
                <span className="source-chip-favicon">{source.favicon}</span>
                <span className="source-chip-domain">{source.domain}</span>
                <span className="source-chip-num">{source.num}</span>
              </div>
            ))}
            <div
              className="source-chip-overflow"
              onClick={() => {
                setActiveTab('sources');
                if (sourcesRailRef.current) {
                  sourcesRailRef.current.scrollTo({ top: 300, behavior: 'smooth' });
                }
              }}
            >
              +{sourcesCount - 5}
            </div>
          </div>

          {/* Synthesized Answer Body */}
          {activeTab === 'answer' && (
            <div className="answer-body">
              <p className="answer-paragraph">
                Enterprises should prioritize <strong>Retrieval-Augmented Generation (RAG)</strong> when their primary operational mandate revolves around <strong>immediate knowledge fresh updates</strong>, auditable governance, and strict citation traceability
                <button
                  className="citation-chip"
                  onClick={() => handleCitationClick(1)}
                  title="Citation 1: arXiv RAG Foundation paper"
                >
                  1
                </button>
                . Because RAG decouples information storage from parametric weights by retrieving chunks from vector databases at inference time, company knowledge is immediately updated simply by upserting files into the vector index—avoiding the multi-week engineering overhead and GPU costs of continuous model retraining
                <button
                  className="citation-chip"
                  onClick={() => handleCitationClick(2)}
                  title="Citation 2: Pinecone Enterprise Architecture"
                >
                  2
                </button>
                .
              </p>

              <p className="answer-paragraph">
                In contrast, <strong>Fine-Tuning</strong> excels when a team needs to alter the model’s linguistic behavior, tone, style, or teach it specialized domain syntax (such as internal code generation frameworks or strict schema-compliant JSON extraction)
                <button
                  className="citation-chip"
                  onClick={() => handleCitationClick(3)}
                  title="Citation 3: OpenAI Research"
                >
                  3
                </button>
                . Fine-tuning is rarely an effective strategy for teaching net-new factual knowledge, as parameter drift and silent hallucinations remain prevalent without external retrieval grounding
                <button
                  className="citation-chip"
                  onClick={() => handleCitationClick(4)}
                  title="Citation 4: Hugging Face cost analysis"
                >
                  4
                </button>
                .
              </p>

              {/* Three-Item Check-Bullet List */}
              <div className="check-bullet-list">
                <div className="check-bullet-item">
                  <div className="check-bullet-icon">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <div>
                    <strong>Continuous Knowledge Freshness:</strong> Vector stores sync new internal documentation, Confluence pages, and PDF specs in seconds with zero downtime or training runs.
                  </div>
                </div>

                <div className="check-bullet-item">
                  <div className="check-bullet-icon">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <div>
                    <strong>Auditable Ground Truth & Source Provenance:</strong> Every factual claim carries precise page numbers, exact quoted excerpts, and cosine similarity rankings for compliance review
                    <button
                      className="citation-chip"
                      onClick={() => handleCitationClick(5)}
                    >
                      5
                    </button>
                    .
                  </div>
                </div>

                <div className="check-bullet-item">
                  <div className="check-bullet-icon">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <div>
                    <strong>Chunk-Level Security & Role-Based Access (RBAC):</strong> Dynamic vector filtering guarantees that employees only retrieve sensitive documents matching their security clearance.
                  </div>
                </div>
              </div>

              {/* In-Answer Comparison Card */}
              <div className="comparison-card">
                <div className="comparison-header-row">
                  <span>Feature</span>
                  <span>RAG (Retrieval-Augmented)</span>
                  <span>Model Fine-Tuning</span>
                </div>

                <div className="comparison-body-row">
                  <span className="comparison-cell-feature">Knowledge Updatability</span>
                  <span className="comparison-cell-rag">Real-time (instant vector sync)</span>
                  <span className="comparison-cell-finetune">Static (requires periodic retraining)</span>
                </div>

                <div className="comparison-body-row">
                  <span className="comparison-cell-feature">Primary Use Case</span>
                  <span className="comparison-cell-rag">Dynamic factual recall & audit trails</span>
                  <span className="comparison-cell-finetune">Domain tone, syntax & output formatting</span>
                </div>

                <div className="comparison-body-row">
                  <span className="comparison-cell-feature">Upfront & Ongoing Cost</span>
                  <span className="comparison-cell-rag">Low-to-moderate (Vector DB index)</span>
                  <span className="comparison-cell-finetune">High (GPU compute & training pipelines)</span>
                </div>

                <div className="comparison-body-row">
                  <span className="comparison-cell-feature">Hallucination Control</span>
                  <span className="comparison-cell-rag">Strict (grounding prompts & quotes)</span>
                  <span className="comparison-cell-finetune">Moderate (prone to confidence drift)</span>
                </div>
              </div>

              {/* Closing Hybrid-Takeaway Paragraph */}
              <p className="answer-paragraph">
                In practice, modern enterprise architectures rarely treat RAG and fine-tuning as mutually exclusive options. Instead, leading engineering teams deploy a <strong>hybrid design pattern</strong>: fine-tuning compact, cost-efficient foundation models (such as Llama 3 or Mistral) on domain-specific phrasing and JSON schemas, while connecting them to a high-throughput RAG pipeline for live fact-checking, document context, and deterministic source citations.
              </p>
            </div>
          )}

          {/* Sources Tab View */}
          {activeTab === 'sources' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '16px 0' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--slate-meta)', marginBottom: '8px' }}>
                All {INITIAL_SOURCES.length} sources analyzed and ranked for this synthesis:
              </div>
              {INITIAL_SOURCES.map((source) => (
                <div
                  key={source.id}
                  className={`source-card ${activeCitationId === source.num ? 'active-citation' : ''}`}
                  onClick={() => setActiveCitationId(source.num)}
                >
                  <div className="source-card-top">
                    <div className="source-card-brand">
                      <span className="source-card-favicon">{source.favicon}</span>
                      <span className="source-card-domain">{source.domain}</span>
                    </div>
                    <span className="source-card-badge">{source.num}</span>
                  </div>
                  <div className="source-card-title">{source.title}</div>
                  <div className="source-card-snippet">{source.snippet}</div>
                </div>
              ))}
            </div>
          )}

          {/* Images Tab View */}
          {activeTab === 'images' && (
            <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', margin: '20px 0' }}>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--hairline)', overflow: 'hidden' }}>
                <div style={{ height: '140px', background: '#eef2f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-meta)', fontSize: '0.82rem' }}>
                  Architecture Diagram
                </div>
                <div style={{ padding: '12px', fontSize: '0.82rem', fontWeight: 600 }}>RAG Dual-Store Pipeline</div>
              </div>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--hairline)', overflow: 'hidden' }}>
                <div style={{ height: '140px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-meta)', fontSize: '0.82rem' }}>
                  Latency Comparison
                </div>
                <div style={{ padding: '12px', fontSize: '0.82rem', fontWeight: 600 }}>Vector Index vs LoRA</div>
              </div>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--hairline)', overflow: 'hidden' }}>
                <div style={{ height: '140px', background: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-meta)', fontSize: '0.82rem' }}>
                  Hallucination Benchmark
                </div>
                <div style={{ padding: '12px', fontSize: '0.82rem', fontWeight: 600 }}>TruthfulQA Scores</div>
              </div>
            </div>
          )}

          {/* Mobile Stacked Sources Section (< lg) */}
          <div className="mobile-sources-section">
            <div className="related-header">
              <BookOpen size={14} color="var(--rose)" />
              <span>SOURCES ({INITIAL_SOURCES.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {INITIAL_SOURCES.slice(0, 4).map((source) => (
                <div
                  key={source.id}
                  id={`mobile-source-card-${source.num}`}
                  className={`source-card ${activeCitationId === source.num ? 'active-citation' : ''}`}
                  onClick={() => setActiveCitationId(source.num)}
                >
                  <div className="source-card-top">
                    <div className="source-card-brand">
                      <span className="source-card-favicon">{source.favicon}</span>
                      <span className="source-card-domain">{source.domain}</span>
                    </div>
                    <span className="source-card-badge">{source.num}</span>
                  </div>
                  <div className="source-card-title">{source.title}</div>
                  <div className="source-card-snippet">{source.snippet}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RELATED Block: Four Hairline-Divided Follow-Up Question Rows */}
          <section className="related-section">
            <div className="related-header">
              <Layers size={14} color="var(--slate-meta)" />
              <span>RELATED</span>
            </div>

            <div className="related-list">
              {INITIAL_RELATED.map((relatedQ, idx) => (
                <div
                  key={idx}
                  className="related-item-row"
                  onClick={() => handleAskFollowUp(relatedQ)}
                  title="Ask this question"
                >
                  <div className="related-item-left">
                    <Plus size={16} className="related-plus-icon" />
                    <span>{relatedQ}</span>
                  </div>
                  <ChevronRight size={16} className="related-chevron" />
                </div>
              ))}
            </div>
          </section>

          {/* Ask-a-Follow-Up Composer (Normal flow at end of column) */}
          <div className="composer-card">
            <textarea
              ref={textareaRef}
              rows={2}
              className="composer-textarea"
              placeholder="Ask a follow-up..."
              value={followUpInput}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAskFollowUp();
                }
              }}
            />

            <div className="composer-bottom-bar">
              <div className="composer-tools-left">
                <button
                  className="composer-icon-btn"
                  title="Attach Document or PDF"
                  onClick={() => alert('Document attachment dialog opened')}
                >
                  <Paperclip size={16} />
                </button>

                {/* Model Selector Chip: Sonar Pro with Rose Dot and Caret */}
                <div
                  className="model-selector-chip"
                  title="Active Model: Sonar Pro (Grounded Search)"
                  onClick={() => {
                    const next = modelName === 'Sonar Pro' ? 'Gemini 2.5 Flash' : 'Sonar Pro';
                    setModelName(next);
                  }}
                >
                  <span className="model-rose-dot" />
                  <span>{modelName}</span>
                  <ChevronDown size={14} color="var(--slate-meta)" />
                </div>
              </div>

              {/* Round Rose Send Button */}
              <button
                className="composer-send-btn"
                title="Send query"
                onClick={() => handleAskFollowUp()}
                disabled={!followUpInput.trim()}
              >
                <ArrowRight size={16} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* --------------------------------------------------------------------
          ZONE 3: 320px Right Sources Rail (Hidden below lg)
         -------------------------------------------------------------------- */}
      <aside className="sources-rail">
        <div className="sources-rail-header">
          <div className="sources-rail-title">
            <BookOpen size={16} color="var(--rose)" />
            <span>Sources</span>
            <span className="sources-count-badge">{sourcesCount}</span>
          </div>
          <button
            className="composer-icon-btn"
            title="Refresh Sources"
            onClick={() => alert('Sources refreshed from vector database')}
          >
            <RotateCcw size={14} />
          </button>
        </div>

        <div className="sources-cards-list" ref={sourcesRailRef}>
          {INITIAL_SOURCES.map((source) => (
            <div
              key={source.id}
              id={`source-card-${source.num}`}
              className={`source-card ${activeCitationId === source.num ? 'active-citation' : ''}`}
              onClick={() => setActiveCitationId(source.num)}
            >
              <div className="source-card-top">
                <div className="source-card-brand">
                  <span className="source-card-favicon">{source.favicon}</span>
                  <span className="source-card-domain">{source.domain}</span>
                </div>
                <span className="source-card-badge">{source.num}</span>
              </div>
              <div className="source-card-title">{source.title}</div>
              <div className="source-card-snippet">{source.snippet}</div>
            </div>
          ))}
        </div>

        <div className="sources-rail-footer">
          <button
            className="show-all-sources-btn"
            onClick={() => setActiveTab('sources')}
          >
            Show all {sourcesCount} sources
          </button>
        </div>
      </aside>
    </div>
  );
}
