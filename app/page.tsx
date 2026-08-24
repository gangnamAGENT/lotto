'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const LOTTO_NUMBERS = Array.from({ length: 45 }, (_, index) => index + 1);
const SAMPLE_NUMBERS = [3, 8, 14, 22, 31, 42];
const TICKETS_PER_WEEK = 100;
const PRICE_PER_TICKET = 1_000;

type Rank = 1 | 2 | 3 | 4 | 5;
type RankCounts = Record<Rank, number>;
type SimulationStatus = 'idle' | 'running' | 'paused' | 'won' | 'error';
type SimulationSpeed = 'normal' | 'turbo';
type Draw = { numbers: number[]; bonus: number };

type WorkerEvent =
  | { type: 'progress'; runId: string; weeks: number; ranks: RankCounts; latestDraw: Draw; recentRank: Rank | null }
  | { type: 'won'; runId: string; weeks: number; ranks: RankCounts; latestDraw: Draw }
  | { type: 'error'; runId: string; message: string };

const RANK_DETAILS: Array<{ rank: Rank; condition: string; odds: string }> = [
  { rank: 1, condition: '6개 일치', odds: '1 / 8,145,060' },
  { rank: 2, condition: '5개 + 보너스', odds: '1 / 1,357,510' },
  { rank: 3, condition: '5개 일치', odds: '1 / 35,724' },
  { rank: 4, condition: '4개 일치', odds: '1 / 733' },
  { rank: 5, condition: '3개 일치', odds: '1 / 45' },
];

const numberFormatter = new Intl.NumberFormat('ko-KR');
const yearFormatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });

function emptyRanks(): RankCounts {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

function ballTone(number: number) {
  if (number <= 10) return 'yellow';
  if (number <= 20) return 'blue';
  if (number <= 30) return 'coral';
  if (number <= 40) return 'slate';
  return 'green';
}

function LottoBall({
  number,
  small = false,
  muted = false,
}: {
  number: number;
  small?: boolean;
  muted?: boolean;
}) {
  return (
    <span className={`lotto-ball ${ballTone(number)}${small ? ' small' : ''}${muted ? ' muted' : ''}`}>
      {number}
    </span>
  );
}

function formatMoney(value: number) {
  return `₩ ${numberFormatter.format(value)}`;
}

function formatYears(weeks: number) {
  if (weeks === 0) return '0년';
  if (weeks < 52) return '1년 미만';
  return `약 ${yearFormatter.format(weeks / 52)}년`;
}

function makeRunId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export default function Home() {
  const [selected, setSelected] = useState<number[]>([]);
  const [status, setStatus] = useState<SimulationStatus>('idle');
  const [speed, setSpeed] = useState<SimulationSpeed>('normal');
  const [weeks, setWeeks] = useState(0);
  const [ranks, setRanks] = useState<RankCounts>(emptyRanks);
  const [latestDraw, setLatestDraw] = useState<Draw | null>(null);
  const [recentRank, setRecentRank] = useState<Rank | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const workerRef = useRef<Worker | null>(null);
  const activeRunRef = useRef('');
  const jackpotRef = useRef<HTMLElement | null>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const isLocked = status !== 'idle' && status !== 'error';
  const totalTickets = weeks * TICKETS_PER_WEEK;
  const totalCost = totalTickets * PRICE_PER_TICKET;

  useEffect(() => {
    const worker = new Worker('/lotto-worker.js', { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerEvent>) => {
      const message = event.data;
      if (message.runId !== activeRunRef.current) return;

      if (message.type === 'error') {
        setErrorMessage(message.message);
        setStatus('error');
        return;
      }

      setWeeks(message.weeks);
      setRanks(message.ranks);
      setLatestDraw(message.latestDraw);

      if (message.type === 'progress') {
        setRecentRank(message.recentRank);
      } else {
        setRecentRank(1);
        setStatus('won');
      }
    };

    worker.onerror = () => {
      setErrorMessage('시뮬레이션을 시작하지 못했습니다. 페이지를 새로고침해 주세요.');
      setStatus('error');
    };

    return () => worker.terminate();
  }, []);

  useEffect(() => {
    if (status !== 'won') return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => {
      jackpotRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }, 150);
  }, [status]);

  const toggleNumber = (number: number) => {
    if (isLocked) return;
    setSelected((current) => {
      if (current.includes(number)) return current.filter((item) => item !== number);
      if (current.length >= 6) return current;
      return [...current, number].sort((a, b) => a - b);
    });
  };

  const autoPick = () => {
    if (isLocked) return;
    const pool = [...LOTTO_NUMBERS];
    const randomValues = new Uint32Array(pool.length);
    crypto.getRandomValues(randomValues);
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swapIndex = randomValues[index] % (index + 1);
      [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }
    setSelected(pool.slice(0, 6).sort((a, b) => a - b));
  };

  const startSimulation = () => {
    if (selected.length !== 6 || !workerRef.current) return;
    const nextRunId = makeRunId();
    activeRunRef.current = nextRunId;
    setWeeks(0);
    setRanks(emptyRanks());
    setLatestDraw(null);
    setRecentRank(null);
    setErrorMessage('');
    setStatus('running');
    workerRef.current.postMessage({ type: 'start', runId: nextRunId, selected, speed });
  };

  const togglePause = () => {
    if (!workerRef.current) return;
    if (status === 'running') {
      workerRef.current.postMessage({ type: 'pause', runId: activeRunRef.current });
      setStatus('paused');
    } else if (status === 'paused') {
      workerRef.current.postMessage({ type: 'resume', runId: activeRunRef.current });
      setStatus('running');
    }
  };

  const toggleSpeed = () => {
    const nextSpeed = speed === 'normal' ? 'turbo' : 'normal';
    setSpeed(nextSpeed);
    workerRef.current?.postMessage({ type: 'setSpeed', runId: activeRunRef.current, speed: nextSpeed });
  };

  const resetSimulation = (clearNumbers = false) => {
    workerRef.current?.postMessage({ type: 'reset', runId: activeRunRef.current });
    activeRunRef.current = makeRunId();
    setStatus('idle');
    setSpeed('normal');
    setWeeks(0);
    setRanks(emptyRanks());
    setLatestDraw(null);
    setRecentRank(null);
    setErrorMessage('');
    if (clearNumbers) setSelected([]);
  };

  const statusLabel = {
    idle: '준비',
    running: speed === 'turbo' ? '터보 실행 중' : '실행 중',
    paused: '일시정지',
    won: '1등 당첨',
    error: '오류',
  }[status];

  const displayNumbers = latestDraw?.numbers ?? (selected.length ? selected : SAMPLE_NUMBERS);

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="로또 랩 처음으로">
          <span className="brand-mark" aria-hidden="true">L</span>
          <span>LOTTO LAB</span>
        </a>
        <span className="simulation-label"><i aria-hidden="true" /> 브라우저 확률 시뮬레이션</span>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">THE LONG SHOT EXPERIMENT</p>
          <h1>1등이 될 때까지,<br /><em>시간을 돌려보세요.</em></h1>
        </div>
        <div className="hero-copy">
          <p>내가 고른 번호 6개를 매주 똑같이 100장씩 샀다면, 몇 년 만에 1등이 될까요?</p>
          <div className="odds-chip"><strong>1</strong><span>/</span><b>8,145,060</b><small>매주 당첨 확률</small></div>
        </div>
      </section>

      <section className="workspace" aria-label="로또 번호 선택과 시뮬레이션">
        <article className="panel picker-panel">
          <div className="panel-heading">
            <div><span className="step">01</span><h2>나의 번호 선택</h2></div>
            <strong>{selected.length}<span> / 6</span></strong>
          </div>

          <div className="number-grid" aria-label="1부터 45까지 번호 선택">
            {LOTTO_NUMBERS.map((number) => {
              const isSelected = selectedSet.has(number);
              return (
                <button
                  type="button"
                  key={number}
                  className={`number-button ${isSelected ? `selected ${ballTone(number)}` : ''}`}
                  aria-pressed={isSelected}
                  aria-label={`${number}번${isSelected ? ' 선택됨' : ' 선택'}`}
                  onClick={() => toggleNumber(number)}
                  disabled={isLocked}
                >
                  {number}
                  {isSelected && <span aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>

          <div className="picker-footer">
            <div className="selection-preview" aria-live="polite">
              {selected.length === 0 ? (
                <span className="empty-selection">번호를 6개 골라주세요</span>
              ) : selected.map((number) => <LottoBall key={number} number={number} small />)}
            </div>
            <div className="picker-actions">
              <button type="button" onClick={() => setSelected([])} disabled={!selected.length || isLocked}>초기화</button>
              <button type="button" className="auto-button" onClick={autoPick} disabled={isLocked}>↻ 자동선택</button>
            </div>
          </div>

          {isLocked && status !== 'won' && (
            <p className="locked-note">시뮬레이션 중에는 번호가 고정됩니다.</p>
          )}
        </article>

        <article className={`panel simulator-panel ${status === 'won' ? 'is-won' : ''}`}>
          <div className="panel-heading inverse">
            <div><span className="step">02</span><h2>시뮬레이션</h2></div>
            <span className="status-dot" data-status={status} aria-live="polite">{statusLabel}</span>
          </div>

          <div className={`draw-stage ${status === 'running' ? 'is-running' : ''}`}>
            <div className="draw-caption">
              <p>{latestDraw ? '최근 추첨 번호' : '선택한 번호'}</p>
              {latestDraw && (
                <span className={recentRank ? 'rank-hit' : ''}>{recentRank ? `${recentRank}등` : '낙첨'}</span>
              )}
            </div>
            <div className="draw-balls">
              {displayNumbers.map((number, index) => (
                <LottoBall key={`${number}-${index}`} number={number} muted={!selected.length && !latestDraw} />
              ))}
              {latestDraw && (
                <><span className="bonus-plus" aria-hidden="true">+</span><span className="bonus-wrap"><LottoBall number={latestDraw.bonus} /><small>보너스</small></span></>
              )}
            </div>
          </div>

          <div className="live-stats">
            <div><span>누적 주차</span><strong>{numberFormatter.format(weeks)}<small>주</small></strong></div>
            <div><span>예상 기간</span><strong>{formatYears(weeks)}</strong></div>
            <div><span>구매 티켓</span><strong>{numberFormatter.format(totalTickets)}<small>장</small></strong></div>
            <div><span>총 구매액</span><strong>{formatMoney(totalCost)}</strong></div>
          </div>

          {status === 'idle' || status === 'error' ? (
            <>
              <button type="button" className="start-button" disabled={selected.length !== 6} onClick={startSimulation}>
                <span>{selected.length === 6 ? '시뮬레이션 시작' : `${6 - selected.length}개 더 선택하세요`}</span>
                <b aria-hidden="true">→</b>
              </button>
              {errorMessage && <p className="error-message" role="alert">{errorMessage}</p>}
            </>
          ) : status === 'won' ? (
            <div className="won-controls">
              <button type="button" className="start-button" onClick={startSimulation}><span>같은 번호로 한 번 더</span><b aria-hidden="true">↻</b></button>
              <button type="button" className="text-control" onClick={() => resetSimulation(true)}>번호 다시 고르기</button>
            </div>
          ) : (
            <div className="simulation-controls">
              <button type="button" className="control-button primary" onClick={togglePause}>
                <span aria-hidden="true">{status === 'paused' ? '▶' : 'Ⅱ'}</span>{status === 'paused' ? '계속하기' : '일시정지'}
              </button>
              <button type="button" className={`control-button ${speed === 'turbo' ? 'active' : ''}`} onClick={toggleSpeed} aria-pressed={speed === 'turbo'}>
                <span aria-hidden="true">⚡</span>{speed === 'turbo' ? '터보 켜짐' : '터보'}
              </button>
              <button type="button" className="text-control" onClick={() => resetSimulation(false)}>중단</button>
            </div>
          )}
          <p className="same-number-note">매주 동일한 번호로 100장 · 주 100,000원</p>
        </article>
      </section>

      {status === 'won' && latestDraw && (
        <section className="jackpot-banner" ref={jackpotRef} aria-labelledby="jackpot-title" role="status">
          <div className="jackpot-copy">
            <p className="eyebrow">SIMULATION COMPLETE</p>
            <h2 id="jackpot-title"><span>마침내,</span> 1등입니다.</h2>
            <p>{numberFormatter.format(weeks)}주 동안 같은 번호를 믿은 끝에 100장 모두 1등에 당첨됐습니다.</p>
          </div>
          <div className="jackpot-numbers" aria-label={`1등 번호 ${latestDraw.numbers.join(', ')}, 보너스 ${latestDraw.bonus}`}>
            <div>{latestDraw.numbers.map((number) => <LottoBall key={number} number={number} />)}</div>
            <span>보너스 <LottoBall number={latestDraw.bonus} small /></span>
          </div>
          <div className="jackpot-summary">
            <div><span>걸린 시간</span><strong>{formatYears(weeks)}</strong></div>
            <div><span>총 구매액</span><strong>{formatMoney(totalCost)}</strong></div>
          </div>
        </section>
      )}

      <section className="rank-section" aria-labelledby="rank-title">
        <div className="section-heading">
          <div><p className="eyebrow">WINNING LOG</p><h2 id="rank-title">등수별 당첨 기록</h2></div>
          <p>한 주에 당첨되면 동일한 100장 모두 같은 등수로 집계됩니다.</p>
        </div>
        <div className="rank-table">
          {RANK_DETAILS.map(({ rank, condition, odds }) => (
            <article className={rank === 1 && status === 'won' ? 'jackpot-rank' : ''} key={rank}>
              <div className="rank-name"><span>{rank}</span><strong>{rank}등</strong></div>
              <div><small>당첨 조건</small><b>{condition}</b></div>
              <div><small>공식 확률</small><b>{odds}</b></div>
              <div><small>당첨 주차</small><b>{numberFormatter.format(ranks[rank])}회</b></div>
              <div className="rank-tickets"><small>당첨 티켓</small><strong>{numberFormatter.format(ranks[rank] * TICKETS_PER_WEEK)}장</strong></div>
            </article>
          ))}
        </div>
      </section>

      <section className="fact-strip" aria-label="시뮬레이션 안내">
        <span aria-hidden="true">!</span>
        <p><strong>100장을 사도 당첨 확률은 그대로예요.</strong> 같은 번호 100장은 당첨 가능성을 높이지 않고, 당첨될 경우 당첨 티켓 수만 100배가 됩니다.</p>
      </section>

      <footer>
        <span>LOTTO LAB · 2026</span>
        <p>실제 구매나 번호 예측이 아닌 무작위 확률 체험입니다.</p>
      </footer>
    </main>
  );
}
