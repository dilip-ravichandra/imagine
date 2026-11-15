import React, { useMemo, useState } from 'react';
import { Box, Flex, Text, Heading, Button, Input, Select, Image, Alert, AlertIcon, Spinner, SimpleGrid } from '@chakra-ui/react';
import WorkspaceLayout from '../components/WorkspaceLayout';
import { explainTopic, generateWithModel, Lesson, LessonDiagram, toSameOriginImageUrl } from '../lib/api';

const LEVELS = [
  { label: 'Kids (simple words)', value: 'Beginner' },
  { label: 'Students', value: 'Intermediate' },
  { label: 'Advanced', value: 'Advanced' },
];
const IDEAS = [
  { icon: '💧', title: 'The water cycle' }, { icon: '🌱', title: 'How photosynthesis works' }, { icon: '🫀', title: 'Parts of the human heart' },
  { icon: '🌍', title: 'Layers of the Earth' }, { icon: '⚡', title: 'How a circuit works' }, { icon: '🦋', title: 'Butterfly life cycle' },
];

const W = 760, H = 440, NW = 150, NH = 46;
type P = { x: number; y: number };

function layout(d: LessonDiagram): Record<string, P> {
  const n = d.nodes, pos: Record<string, P> = {};
  if (d.type === 'flow') {
    const perRow = n.length > 6 ? 4 : n.length > 3 ? 3 : n.length;
    const rows = Math.ceil(n.length / perRow);
    n.forEach((node, i) => {
      const r = Math.floor(i / perRow), c = i % perRow;
      const cols = r === rows - 1 ? n.length - r * perRow : perRow;
      const col = r % 2 === 0 ? c : cols - 1 - c; // snake so arrows never cross the whole diagram
      const gap = (W - 60) / perRow;
      const x = W / 2 + (col - (cols - 1) / 2) * gap;
      pos[node.id] = { x, y: rows === 1 ? H / 2 : 70 + (r * (H - 140)) / (rows - 1) };
    });
    return pos;
  }
  const cx = W / 2, cy = H / 2, rx = W / 2 - NW / 2 - 24, ry = H / 2 - NH / 2 - 24;
  if (d.type === 'parts' && n.length > 1) {
    pos[n[0].id] = { x: cx, y: cy };
    n.slice(1).forEach((node, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / (n.length - 1);
      pos[node.id] = { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
    });
    return pos;
  }
  n.forEach((node, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n.length; pos[node.id] = { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }; });
  return pos;
}

function clip(a: P, b: P, pad = 4): P {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.min(dx ? (NW / 2 + pad) / Math.abs(dx) : Infinity, dy ? (NH / 2 + pad) / Math.abs(dy) : Infinity);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

function wrap(label: string): string[] {
  if (label.length <= 17) return [label];
  const words = label.split(' '); let best = 1, diff = 99;
  for (let i = 1; i < words.length; i++) { const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length); if (d < diff) { diff = d; best = i; } }
  return words.length > 1 ? [words.slice(0, best).join(' '), words.slice(best).join(' ')] : [label];
}

const Diagram: React.FC<{ d: LessonDiagram; title: string }> = ({ d, title }) => {
  const pos = useMemo(() => layout(d), [d]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Diagram: ${title}. ${d.caption}`} style={{ width: '100%', height: 'auto', background: '#FFFFFF', borderRadius: 12, border: '1px solid #E3DACF' }}>
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#5B5BF0" /></marker>
      </defs>
      {d.edges.map((e, i) => {
        const a = pos[e.from], b = pos[e.to];
        if (!a || !b || e.from === e.to) return null;
        const s = clip(a, b), t = clip(b, a);
        const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
        return (
          <g key={i}>
            <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#5B5BF0" strokeWidth={2} markerEnd="url(#arr)" />
            {e.label && (<>
              <rect x={mx - e.label.length * 3.4 - 4} y={my - 9} width={e.label.length * 6.8 + 8} height={17} rx={8} fill="#FFFFFF" stroke="#E3DACF" />
              <text x={mx} y={my + 4} textAnchor="middle" fontSize={11} fill="#5B6277">{e.label}</text>
            </>)}
          </g>
        );
      })}
      {d.nodes.map((n, i) => {
        const p = pos[n.id]; if (!p) return null;
        const lines = wrap(n.label);
        return (
          <g key={n.id}>
            <rect x={p.x - NW / 2} y={p.y - NH / 2} width={NW} height={NH} rx={12} fill="#EEF0FF" stroke="#5B5BF0" strokeWidth={1.5} />
            <circle cx={p.x - NW / 2} cy={p.y - NH / 2} r={10} fill="#5B5BF0" />
            <text x={p.x - NW / 2} y={p.y - NH / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#FFFFFF">{i + 1}</text>
            {lines.map((l, k) => <text key={k} x={p.x} y={p.y + 4 + (k - (lines.length - 1) / 2) * 15} textAnchor="middle" fontSize={13} fontWeight={600} fill="#1E2233">{l}</text>)}
          </g>
        );
      })}
    </svg>
  );
};

const LearnStudio: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('Intermediate');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pic, setPic] = useState('');
  const [picBusy, setPicBusy] = useState(false);
  const [shown, setShown] = useState<Record<number, boolean>>({});

  const learn = async (t: string) => {
    const q = t.trim();
    if (q.length < 2 || busy) return;
    setTopic(q); setBusy(true); setError(''); setLesson(null); setPic(''); setShown({});
    try { setLesson(await explainTopic(q, level)); }
    catch (e) { setError(e instanceof Error ? e.message : 'The lesson could not be written.'); }
    finally { setBusy(false); }
  };

  const makePicture = async () => {
    if (!lesson) return;
    setPicBusy(true); setError('');
    try {
      const r = await generateWithModel({ prompt: `${lesson.image_prompt || lesson.title}, clean educational illustration, no text`, modelChoice: 'sd_turbo', width: 512, height: 512, resolution: 512, steps: 1, category: 'single' });
      setPic(toSameOriginImageUrl(r.image_url));
    } catch (e) { setError(e instanceof Error ? e.message : 'The picture could not be made.'); }
    finally { setPicBusy(false); }
  };

  return (
    <WorkspaceLayout>
      <Box px={{ base: 4, md: 8 }} py={8} maxW="1100px" mx="auto" bg="#FBF8F4" minH="100vh">
        <Heading size="lg" color="#1E2233" fontWeight={700}>Learn anything, visually</Heading>
        <Text color="#5B6277" mt={1} mb={6} fontSize="sm">Type a topic. You get a short lesson, a labelled diagram, and a quick quiz.</Text>

        <Flex gap={3} direction={{ base: 'column', md: 'row' }} mb={4} as="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); void learn(topic); }}>
          <Input aria-label="Topic to learn" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} placeholder="e.g. How do volcanoes erupt?" bg="#FFFFFF" borderColor="#E3DACF" />
          <Select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value)} maxW={{ md: '220px' }} bg="#FFFFFF" borderColor="#E3DACF">
            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </Select>
          <Button type="submit" bg="#5B5BF0" color="#FFFFFF" _hover={{ bg: '#4747DB' }} isLoading={busy} loadingText="Writing" isDisabled={topic.trim().length < 2}>Teach me</Button>
        </Flex>

        {!lesson && !busy && (
          <SimpleGrid columns={{ base: 2, md: 3 }} spacing={3} mb={4}>
            {IDEAS.map((i) => (
              <Button key={i.title} variant="outline" justifyContent="flex-start" borderColor="#E3DACF" bg="#FFFFFF" color="#1E2233" onClick={() => void learn(i.title)}>
                <Text as="span" mr={2}>{i.icon}</Text>{i.title}
              </Button>
            ))}
          </SimpleGrid>
        )}
        {error && <Alert status="error" borderRadius="12px" mb={4} role="alert"><AlertIcon />{error}</Alert>}
        {busy && <Flex align="center" gap={3} color="#5B6277" py={10} justify="center"><Spinner /> Writing your lesson and drawing the diagram…</Flex>}

        {lesson && (
          <Box>
            <Heading size="md" color="#1E2233" mb={2}>{lesson.title}</Heading>
            <Text color="#1E2233" mb={5} fontSize="sm" lineHeight="1.7">{lesson.summary}</Text>

            <Diagram d={lesson.diagram} title={lesson.title} />
            {lesson.diagram.caption && <Text fontSize="xs" color="#8A90A2" mt={2}>{lesson.diagram.caption}</Text>}
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2} mt={3} as="ol" listStyleType="none">
              {lesson.diagram.nodes.map((n, i) => (
                <Flex as="li" key={n.id} gap={2} fontSize="sm" color="#1E2233">
                  <Flex flexShrink={0} w="20px" h="20px" borderRadius="full" bg="#5B5BF0" color="#FFFFFF" fontSize="11px" fontWeight={700} align="center" justify="center">{i + 1}</Flex>
                  <Text><b>{n.label}.</b> {n.note}</Text>
                </Flex>
              ))}
            </SimpleGrid>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5} mt={6}>
              <Box bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="16px" p={4}>
                <Heading size="sm" mb={2} color="#1E2233">Key points</Heading>
                <Box as="ul" pl={4} fontSize="sm" color="#1E2233">{lesson.key_points.map((k, i) => <li key={i} style={{ marginBottom: 6 }}>{k}</li>)}</Box>
              </Box>
              <Box bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="16px" p={4}>
                <Heading size="sm" mb={2} color="#1E2233">Step by step</Heading>
                <Box as="ol" pl={4} fontSize="sm" color="#1E2233">{lesson.steps.map((s, i) => <li key={i} style={{ marginBottom: 6 }}><b>{s.title}</b> {s.text}</li>)}</Box>
              </Box>
            </SimpleGrid>

            <Box bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="16px" p={4} mt={5}>
              <Heading size="sm" mb={2} color="#1E2233">Check yourself</Heading>
              {lesson.quiz.map((q, i) => (
                <Box key={i} mb={3} fontSize="sm" color="#1E2233">
                  <Text fontWeight={600}>{i + 1}. {q.q}</Text>
                  {shown[i] ? <Text color="#2E7D32" mt={1}>{q.a}</Text>
                    : <Button size="xs" mt={1} variant="outline" borderColor="#E3DACF" onClick={() => setShown((s) => ({ ...s, [i]: true }))}>Show answer</Button>}
                </Box>
              ))}
            </Box>

            <Flex gap={3} mt={5} align="start" wrap="wrap">
              <Button variant="outline" borderColor="#E3DACF" bg="#FFFFFF" onClick={makePicture} isLoading={picBusy} loadingText="Drawing">Make an illustration</Button>
              <Button variant="ghost" onClick={() => { setLesson(null); setTopic(''); }}>New topic</Button>
            </Flex>
            {pic && <Image src={pic} alt={`Illustration: ${lesson.title}`} mt={4} borderRadius="12px" maxW="360px" border="1px solid #E3DACF" />}
          </Box>
        )}
      </Box>
    </WorkspaceLayout>
  );
};

export default LearnStudio;
