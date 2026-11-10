import React, { useState } from 'react';
import SyllabusPlanner from '../components/study/SyllabusPlanner';
import StudyReadinessAuditor from '../components/study/StudyReadinessAuditor';

export default function StudyScreen() {
  const [activeView, setActiveView] = useState('planner'); // 'planner' | 'auditor'

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {activeView === 'planner' ? (
        <SyllabusPlanner onOpenAuditor={() => setActiveView('auditor')} />
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <StudyReadinessAuditor onBackToPlanner={() => setActiveView('planner')} />
        </div>
      )}
    </div>
  );
}

