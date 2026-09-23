import { useEffect, useState } from 'react';
import { PLAYER_COLORS, Pill, useButton, useHot, usePlayers, type ChannelContext, type MusicRequest, type Wiimote } from '../../core';
import { QUESTIONS, crowdFor, type Question } from './questions';

const MUSIC: MusicRequest = { url: '/assets/vote/music/loop.mp3', synth: 'menu', fade: 0.8 };
type Phase = 'vote' | 'predict' | 'reveal';

interface Round {
  q: Question;
  crowd: number[];
}

function pickQuestion(seen: Set<number>): { i: number; q: Question } {
  if (seen.size >= QUESTIONS.length) seen.clear();
  let i = Math.floor(Math.random() * QUESTIONS.length);
  while (seen.has(i)) i = (i + 1) % QUESTIONS.length;
  seen.add(i);
  return { i, q: QUESTIONS[i] };
}

const colorOf = (r: Wiimote) => PLAYER_COLORS[(r.player - 1 + 4) % 4];

function Card({
  label,
  phase,
  votes,
  guesses,
  pct,
  winner,
  onPick,
}: {
  label: string;
  phase: Phase;
  votes: Wiimote[];
  guesses: Wiimote[];
  pct: number;
  winner: boolean;
  onPick(r: Wiimote): void;
}) {
  const { ref, hovered } = useHot<HTMLDivElement>({ onClick: onPick, disabled: phase === 'reveal', clickSound: 'tick' });
  return (
    <div ref={ref} className={`vote-card ${hovered && phase !== 'reveal' ? 'vote-card--hover' : ''} ${phase === 'reveal' && winner ? 'vote-card--winner' : ''}`}>
      {phase === 'reveal' && <div className="vote-pct">{pct}%</div>}
      <div>{label}</div>
      {phase === 'reveal' && (
        <div className="vote-bar">
          <i style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="vote-badges">
        {phase === 'reveal' &&
          votes.map((r) => (
            <i key={r.id} style={{ background: colorOf(r) }} title="voted">
              {r.player}
            </i>
          ))}
        {phase !== 'vote' &&
          guesses.map((r) => (
            <i key={`g${r.id}`} className="vote-badge--guess" style={{ background: colorOf(r) }} title="predicted">
              {r.player}
            </i>
          ))}
      </div>
    </div>
  );
}

/** Everybody Votes: answer, predict the crowd, reveal. */
export function VoteApp({ ctx }: { ctx: ChannelContext }) {
  const players = usePlayers();
  const [seen] = useState(() => new Set<number>());
  const [round, setRound] = useState<Round>(() => {
    const { q } = pickQuestion(seen);
    return { q, crowd: crowdFor(q) };
  });
  const [n, setN] = useState(1);
  const [phase, setPhase] = useState<Phase>('vote');
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [guesses, setGuesses] = useState<Record<string, number>>({});
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    ctx.audio.playMusic(MUSIC);
  }, [ctx]);

  const allIn = (map: Record<string, number>) => players.length > 0 && players.every((p) => map[p.id] !== undefined);

  // advance automatically once everyone has answered
  useEffect(() => {
    if (phase === 'vote' && allIn(votes)) {
      const t = window.setTimeout(() => {
        setPhase('predict');
        ctx.audio.play('page');
      }, 900);
      return () => window.clearTimeout(t);
    }
    if (phase === 'predict' && allIn(guesses)) {
      const t = window.setTimeout(() => reveal(), 900);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, votes, guesses, players]);

  const winner = round.crowd.indexOf(Math.max(...round.crowd));

  const reveal = () => {
    setPhase('reveal');
    ctx.audio.play('cheer');
    setScores((s) => {
      const next = { ...s };
      for (const p of players) if (guesses[p.id] === winner) next[p.id] = (next[p.id] ?? 0) + 1;
      return next;
    });
  };

  const next = () => {
    const { q } = pickQuestion(seen);
    setRound({ q, crowd: crowdFor(q) });
    setVotes({});
    setGuesses({});
    setPhase('vote');
    setN((x) => x + 1);
    ctx.audio.play('open');
  };

  const pick = (r: Wiimote, i: number) => {
    if (phase === 'vote') setVotes((v) => ({ ...v, [r.id]: i }));
    else if (phase === 'predict') setGuesses((g) => ({ ...g, [r.id]: i }));
  };

  useButton('a', () => {
    if (phase === 'reveal') next();
  });
  useButton('b', () => ctx.exit());

  const answered = phase === 'vote' ? votes : guesses;
  return (
    <div className="vote">
      <div className="vote-top">
        <span>
          free<b>Vote</b> · question {n}
        </span>
        <div className="vote-scores">
          {players.map((p) => (
            <div key={p.id} className="vote-score" style={{ borderColor: colorOf(p) }}>
              {scores[p.id] ?? 0}
              <small>{p.kind === 'phone' ? p.name : `Player ${p.player}`}</small>
            </div>
          ))}
        </div>
      </div>
      <div className="vote-phase">{phase === 'vote' ? 'Cast your vote (A on a card)' : phase === 'predict' ? 'Now predict: what did the crowd choose?' : `The crowd said…`}</div>
      <h1 className="vote-q">{round.q.q}</h1>
      <div className="vote-cards">
        {round.q.choices.map((label, i) => (
          <Card
            key={`${n}-${i}`}
            label={label}
            phase={phase}
            votes={players.filter((p) => votes[p.id] === i)}
            guesses={players.filter((p) => guesses[p.id] === i)}
            pct={round.crowd[i]}
            winner={i === winner}
            onPick={(r) => pick(r, i)}
          />
        ))}
      </div>
      <div className="vote-foot">
        {phase !== 'reveal' && (
          <div className="vote-waiting">
            waiting for
            {players.map((p) => (
              <i key={p.id} className={answered[p.id] !== undefined ? 'done' : ''} style={{ background: colorOf(p) }}>
                {p.player}
              </i>
            ))}
          </div>
        )}
        {phase === 'vote' && Object.keys(votes).length > 0 && !allIn(votes) && (
          <Pill small onClick={() => setPhase('predict')} clickSound="page">
            Close the vote
          </Pill>
        )}
        {phase === 'predict' && Object.keys(guesses).length > 0 && !allIn(guesses) && (
          <Pill small onClick={reveal} clickSound="page">
            Reveal
          </Pill>
        )}
        {phase === 'reveal' && (
          <>
            <span>{players.filter((p) => guesses[p.id] === winner).length > 0 ? `Right: ${players.filter((p) => guesses[p.id] === winner).map((p) => `P${p.player}`).join(', ')}` : 'Nobody guessed the crowd!'}</span>
            <Pill onClick={next} clickSound="start">
              Next question (A)
            </Pill>
          </>
        )}
        <Pill small onClick={() => ctx.exit()} clickSound="back">
          Wii Menu
        </Pill>
      </div>
    </div>
  );
}
