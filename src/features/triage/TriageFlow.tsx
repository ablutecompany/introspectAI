import { useState, useCallback, useRef } from 'react';
import type {
  FrictionArea,
  FunctionalImpact,
  ImmediateGoal,
  TriageState,
} from '../../types/internalState';
import {
  Q1,
  Q2_MIXED,
  Q3_NORMAL,
  Q_IMMEDIATE_GOAL,
  SUBTYPE_QUESTIONS,
  buildQ3Mixed,
  buildTriageSummary,
  resolveDetailLevel,
} from '../../engine/triageEngine';

// ─── Step definitions ─────────────────────────────────────────────────────────

type TriageStep =
  | 'q1_friction'
  | 'q2_subtype'
  | 'q2_mixed_two'
  | 'q3_mixed_dominant'
  | 'q3_impact'
  | 'q4_goal'
  | 'summary';

interface PartialTriage {
  frictionArea?: Exclude<FrictionArea, 'G'>;
  path?: 'normal' | 'mixed';
  subtype?: string | null;
  mixedCandidates?: [Exclude<FrictionArea, 'G'>, Exclude<FrictionArea, 'G'>];
  secondaryArea?: Exclude<FrictionArea, 'G'>;
  functionalImpact?: FunctionalImpact;
  goal?: ImmediateGoal;
}

interface Props {
  onComplete: (result: TriageState) => void;
}

// ─── Progress mapping ─────────────────────────────────────────────────────────

const TOTAL_NORMAL = 4;
const TOTAL_MIXED = 5;

function getStepNumber(step: TriageStep, path: 'normal' | 'mixed' | undefined): number {
  const map: Record<TriageStep, number> = {
    q1_friction: 1,
    q2_subtype: 2,
    q2_mixed_two: 2,
    q3_mixed_dominant: 3,
    q3_impact: path === 'mixed' ? 4 : 3,
    q4_goal: path === 'mixed' ? 5 : 4,
    summary: path === 'mixed' ? TOTAL_MIXED : TOTAL_NORMAL,
  };
  return map[step] ?? 1;
}

// ─── Chip Component ───────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  variant?: 'default' | 'selected' | 'secondary';
}

function Chip({ label, selected = false, disabled = false, onClick, variant = 'default' }: ChipProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`triage-chip ${selected ? 'triage-chip--selected' : ''} ${variant === 'secondary' ? 'triage-chip--secondary' : ''}`}
    >
      {selected && <span className="triage-chip__check">✓</span>}
      {label}
    </button>
  );
}

// ─── Main TriageFlow component ────────────────────────────────────────────────

export function TriageFlow({ onComplete }: Props) {
  const [step, setStep] = useState<TriageStep>('q1_friction');
  const [data, setData] = useState<PartialTriage>({});
  const [mixedSelections, setMixedSelections] = useState<Set<string>>(new Set());
  const [summaryText, setSummaryText] = useState('');
  const [animating, setAnimating] = useState(false);
  // Holds the completed triage during the summary screen to avoid any-cast
  const pendingTriageRef = useRef<TriageState | null>(null);

  const advance = useCallback((nextStep: TriageStep, patch: Partial<PartialTriage>) => {
    setAnimating(true);
    setTimeout(() => {
      setData((prev) => ({ ...prev, ...patch }));
      setStep(nextStep);
      setAnimating(false);
    }, 200);
  }, []);

  // ─── Q1 handler ────────────────────────────────────────────────────────────
  const handleQ1 = (areaId: FrictionArea) => {
    if (areaId === 'G') {
      advance('q2_mixed_two', { path: 'mixed' });
    } else {
      advance('q2_subtype', {
        frictionArea: areaId as Exclude<FrictionArea, 'G'>,
        path: 'normal',
      });
    }
  };

  // ─── Q2 normal (subtype) handler ────────────────────────────────────────────
  const handleQ2Subtype = (subtypeId: string) => {
    advance('q3_impact', { subtype: subtypeId });
  };

  // ─── Q2 mixed: toggle selection (max 2) ─────────────────────────────────────
  const toggleMixedSelection = (areaId: string) => {
    setMixedSelections((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) {
        next.delete(areaId);
      } else if (next.size < 2) {
        next.add(areaId);
      }
      return next;
    });
  };

  const handleQ2MixedConfirm = () => {
    if (mixedSelections.size !== 2) return;
    const [first, second] = Array.from(mixedSelections) as [
      Exclude<FrictionArea, 'G'>,
      Exclude<FrictionArea, 'G'>
    ];
    advance('q3_mixed_dominant', { mixedCandidates: [first, second] });
  };

  // ─── Q3 mixed: choose dominant ───────────────────────────────────────────────
  const handleQ3MixedDominant = (dominantId: Exclude<FrictionArea, 'G'>) => {
    const [a, b] = data.mixedCandidates!;
    const secondary = dominantId === a ? b : a;
    advance('q2_subtype', { frictionArea: dominantId, secondaryArea: secondary });
  };

  // ─── Q3 normal: functional impact ───────────────────────────────────────────
  const handleQ3Impact = (impactId: FunctionalImpact) => {
    advance('q4_goal', { functionalImpact: impactId });
  };

  // ─── Q4/Q5: immediate goal ───────────────────────────────────────────────────
  const handleGoal = (goalId: ImmediateGoal) => {
    const partial = { ...data, goal: goalId };

    const triage: TriageState = {
      path: partial.path!,
      primary_problem_area: partial.frictionArea!,
      primary_problem_subtype: partial.subtype ?? null,
      secondary_problem_area: partial.secondaryArea ?? null,
      functional_impact_area: partial.functionalImpact ?? null,
      immediate_goal: goalId,
      detail_level: resolveDetailLevel(partial.subtype ?? null),
      completedAt: Date.now(),
    };

    const text = buildTriageSummary(triage);
    pendingTriageRef.current = triage;
    advance('summary', { goal: goalId });
    setSummaryText(text);
  };

  const handleSummaryConfirm = () => {
    if (pendingTriageRef.current) onComplete(pendingTriageRef.current);
  };

  // ─── Step calculations ───────────────────────────────────────────────────────
  const stepNum = getStepNumber(step, data.path);
  const totalSteps = data.path === 'mixed' ? TOTAL_MIXED : TOTAL_NORMAL;
  const progressPct = step === 'summary' ? 100 : Math.round(((stepNum - 1) / totalSteps) * 100);

  // ─── Render helpers ──────────────────────────────────────────────────────────

  const renderProgress = () => (
    <div className="triage-progress">
      <div className="triage-progress__track">
        <div className="triage-progress__fill" style={{ width: `${progressPct}%` }} />
      </div>
      {step !== 'summary' && (
        <span className="triage-progress__label">
          {stepNum} / {totalSteps}
        </span>
      )}
    </div>
  );

  const renderQ1 = () => (
    <div className={`triage-screen ${animating ? 'triage-screen--exit' : 'triage-screen--enter'}`}>
      <p className="triage-intro">introspect</p>
      <h2 className="triage-question">{Q1.text}</h2>
      <div className="triage-chips">
        {Q1.options.map((opt) => (
          <Chip
            key={opt.id}
            label={opt.label}
            onClick={() => handleQ1(opt.id as FrictionArea)}
            variant={opt.id === 'G' ? 'secondary' : 'default'}
          />
        ))}
      </div>
    </div>
  );

  const renderQ2Subtype = () => {
    const area = data.frictionArea;
    if (!area) return null;
    const q = SUBTYPE_QUESTIONS[area];
    return (
      <div className={`triage-screen ${animating ? 'triage-screen--exit' : 'triage-screen--enter'}`}>
        <p className="triage-area-badge">{Q1.options.find((o) => o.id === area)?.label}</p>
        <h2 className="triage-question">{q.text}</h2>
        <div className="triage-chips">
          {q.options.map((opt) => (
            <Chip
              key={opt.id}
              label={opt.label}
              onClick={() => handleQ2Subtype(opt.id)}
              variant={opt.isDiffuse ? 'secondary' : 'default'}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderQ2MixedTwo = () => (
    <div className={`triage-screen ${animating ? 'triage-screen--exit' : 'triage-screen--enter'}`}>
      <h2 className="triage-question">{Q2_MIXED.text}</h2>
      <p className="triage-hint">{Q2_MIXED.hint}</p>
      <div className="triage-chips">
        {Q2_MIXED.options.map((opt) => (
          <Chip
            key={opt.id}
            label={opt.label}
            selected={mixedSelections.has(opt.id)}
            disabled={!mixedSelections.has(opt.id) && mixedSelections.size >= 2}
            onClick={() => toggleMixedSelection(opt.id)}
          />
        ))}
      </div>
      <div className="triage-action">
        <button
          onClick={handleQ2MixedConfirm}
          disabled={mixedSelections.size !== 2}
          className="triage-btn-confirm"
        >
          Confirmar escolha
        </button>
      </div>
    </div>
  );

  const renderQ3MixedDominant = () => {
    if (!data.mixedCandidates) return null;
    const [first, second] = data.mixedCandidates;
    const q = buildQ3Mixed(first, second);
    return (
      <div className={`triage-screen ${animating ? 'triage-screen--exit' : 'triage-screen--enter'}`}>
        <h2 className="triage-question">{q.text}</h2>
        <div className="triage-chips triage-chips--two">
          {q.options.map((opt) => (
            <Chip
              key={opt.id}
              label={opt.label}
              onClick={() => handleQ3MixedDominant(opt.id as Exclude<FrictionArea, 'G'>)}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderQ3Impact = () => (
    <div className={`triage-screen ${animating ? 'triage-screen--exit' : 'triage-screen--enter'}`}>
      <h2 className="triage-question">{Q3_NORMAL.text}</h2>
      <div className="triage-chips">
        {Q3_NORMAL.options.map((opt) => (
          <Chip
            key={opt.id}
            label={opt.label}
            onClick={() => handleQ3Impact(opt.id as FunctionalImpact)}
            variant={opt.id === 'F' ? 'secondary' : 'default'}
          />
        ))}
      </div>
    </div>
  );

  const renderGoal = () => (
    <div className={`triage-screen ${animating ? 'triage-screen--exit' : 'triage-screen--enter'}`}>
      <h2 className="triage-question">{Q_IMMEDIATE_GOAL.text}</h2>
      <div className="triage-chips">
        {Q_IMMEDIATE_GOAL.options.map((opt) => (
          <Chip
            key={opt.id}
            label={opt.label}
            onClick={() => handleGoal(opt.id as ImmediateGoal)}
            variant={opt.id === 'F' ? 'secondary' : 'default'}
          />
        ))}
      </div>
    </div>
  );

  const renderSummary = () => (
    <div className={`triage-screen triage-screen--summary ${animating ? 'triage-screen--exit' : 'triage-screen--enter'}`}>
      <p className="triage-summary__label">Orientação inicial</p>
      <div className="triage-summary__text">
        {summaryText.split('\n\n').map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
      <button onClick={handleSummaryConfirm} className="triage-btn-confirm triage-btn-confirm--primary">
        Continuar
      </button>
    </div>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="triage-container">
      {renderProgress()}
      <div className="triage-body">
        {step === 'q1_friction' && renderQ1()}
        {step === 'q2_subtype' && renderQ2Subtype()}
        {step === 'q2_mixed_two' && renderQ2MixedTwo()}
        {step === 'q3_mixed_dominant' && renderQ3MixedDominant()}
        {step === 'q3_impact' && renderQ3Impact()}
        {step === 'q4_goal' && renderGoal()}
        {step === 'summary' && renderSummary()}
      </div>
    </div>
  );
}
