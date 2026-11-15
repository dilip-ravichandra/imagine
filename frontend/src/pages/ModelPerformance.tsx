import React, { useEffect, useMemo, useState } from 'react';
import { Alert, AlertIcon, Badge, Box, Button, Flex, Heading, HStack, SimpleGrid, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { FiDownload, FiExternalLink } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import WorkspaceLayout from '../components/WorkspaceLayout';
import { getResearchOverview, type ResearchOverview, type ResearchVariant } from '../lib/api';

const TABS = ['Overview', 'Speed and size', 'Quality', 'Prompt accuracy', 'Best of N', 'Lessons', 'How we measured'] as const;
type Tab = (typeof TABS)[number];

const INK = '#1E2233', SOFT = '#5B6277', MUTE = '#8A90A2', BORDER = '#E3DACF', PRIMARY = '#5B5BF0', CORAL = '#FF6B57', GREEN = '#13795B';
const TONE: Record<string, string> = { primary: PRIMARY, success: GREEN, coral: '#D9442F', warning: '#B87500' };
const FAMILY_COLOR = (id: string) => (id.startsWith('B') ? '#6B7280' : id.startsWith('T') ? PRIMARY : id.startsWith('O') || id.startsWith('Q') ? '#0F9B8E' : id.startsWith('A') ? '#B87500' : CORAL);
const CATS = ['single', 'two_objects', 'counting', 'colour', 'position'] as const;
const CAT_LABEL: Record<string, string> = { single: 'One object', two_objects: 'Two objects', counting: 'Counting', colour: 'Colours', position: 'Positions' };
const pct = (x: number | null | undefined) => (x == null ? '-' : `${Math.round(100 * x)}%`);

const Card: React.FC<{ title?: string; sub?: string; children: React.ReactNode }> = ({ title, sub, children }) => (
  <Box bg="#FFFFFF" border={`1px solid ${BORDER}`} borderRadius="18px" p={{ base: 4, md: 5 }} boxShadow="card" mb={4}>
    {title && <Heading as="h2" size="sm" color={INK} mb={sub ? 0 : 3}>{title}</Heading>}
    {sub && <Text color={SOFT} fontSize="sm" mb={3}>{sub}</Text>}
    {children}
  </Box>
);

/** Scatter of every variant: x = latency (log scale), y = CLIP. Up and to the left is better. */
const TradeoffChart: React.FC<{ rows: ResearchVariant[] }> = ({ rows }) => {
  const W = 720, H = 330, L = 56, R = 18, T = 16, B = 44;
  const xs = rows.map((r) => Math.log10(r.latency_ms)), ys = rows.map((r) => r.clip);
  const x0 = Math.min(...xs) - 0.08, x1 = Math.max(...xs) + 0.08, y0 = Math.min(...ys) - 0.006, y1 = Math.max(...ys) + 0.006;
  const px = (v: number) => L + ((v - x0) / (x1 - x0)) * (W - L - R);
  const py = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const ticks = [200, 500, 1000, 2000, 5000, 10000].filter((t) => Math.log10(t) > x0 && Math.log10(t) < x1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Quality versus speed for every variant" style={{ width: '100%', height: 'auto' }}>
      <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="#FBF8F4" stroke={BORDER} />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={px(Math.log10(t))} x2={px(Math.log10(t))} y1={T} y2={H - B} stroke={BORDER} strokeDasharray="3 4" />
          <text x={px(Math.log10(t))} y={H - B + 18} textAnchor="middle" fontSize="11" fill={MUTE}>{t >= 1000 ? `${t / 1000}s` : `${t}ms`}</text>
        </g>
      ))}
      <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize="12" fill={SOFT}>Time to make one image (faster is to the left)</text>
      <text transform={`translate(14 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill={SOFT}>How well it matches the prompt (higher is better)</text>
      {rows.map((r) => (
        <g key={r.id}>
          <circle cx={px(Math.log10(r.latency_ms))} cy={py(r.clip)} r={7} fill={FAMILY_COLOR(r.id)} fillOpacity={0.85} stroke="#FFFFFF" strokeWidth={2}><title>{`${r.id}: ${r.latency_ms.toFixed(0)} ms, CLIP ${r.clip.toFixed(3)}`}</title></circle>
          <text x={px(Math.log10(r.latency_ms)) + 10} y={py(r.clip) + 4} fontSize="11" fontWeight="600" fill={INK}>{r.id}</text>
        </g>
      ))}
    </svg>
  );
};

/** Horizontal bars (log scale) with the value printed on each bar. */
const BarList: React.FC<{ items: { label: string; value: number; color: string; text: string }[]; log?: boolean }> = ({ items, log }) => {
  const max = Math.max(...items.map((i) => i.value));
  const w = (v: number) => (log ? Math.max(3, (Math.log10(v + 1) / Math.log10(max + 1)) * 100) : Math.max(3, (v / max) * 100));
  return (
    <Box>
      {items.map((i) => (
        <Flex key={i.label} align="center" gap={3} mb={1.5}>
          <Text w="52px" fontSize="12px" fontWeight={700} color={INK}>{i.label}</Text>
          <Box flex={1} bg="#F5F0EA" borderRadius="6px" h="20px" overflow="hidden"><Box h="100%" w={`${w(i.value)}%`} bg={i.color} borderRadius="6px" /></Box>
          <Text w="86px" fontSize="12px" color={SOFT} textAlign="right">{i.text}</Text>
        </Flex>
      ))}
    </Box>
  );
};

const LineChart: React.FC<{ series: { name: string; color: string; pts: [number, number][] }[]; xTicks: number[] }> = ({ series, xTicks }) => {
  const W = 640, H = 300, L = 46, R = 90, T = 14, B = 36;
  const px = (n: number) => L + (Math.log2(n) / Math.log2(Math.max(...xTicks))) * (W - L - R);
  const py = (v: number) => T + (1 - v) * (H - T - B);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Accuracy versus number of candidates" style={{ width: '100%', height: 'auto' }}>
      <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="#FBF8F4" stroke={BORDER} />
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}><line x1={L} x2={W - R} y1={py(v)} y2={py(v)} stroke={BORDER} strokeDasharray="3 4" /><text x={L - 8} y={py(v) + 4} textAnchor="end" fontSize="11" fill={MUTE}>{Math.round(v * 100)}%</text></g>
      ))}
      {xTicks.map((n) => <text key={n} x={px(n)} y={H - B + 18} textAnchor="middle" fontSize="11" fill={MUTE}>{n}</text>)}
      <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize="12" fill={SOFT}>Candidates generated per prompt (N)</text>
      {series.map((s) => (
        <g key={s.name}>
          <polyline fill="none" stroke={s.color} strokeWidth={3} points={s.pts.map(([n, v]) => `${px(n)},${py(v)}`).join(' ')} />
          {s.pts.map(([n, v]) => <circle key={n} cx={px(n)} cy={py(v)} r={4.5} fill={s.color} stroke="#FFFFFF" strokeWidth={1.5} />)}
          <text x={px(s.pts[s.pts.length - 1][0]) + 8} y={py(s.pts[s.pts.length - 1][1]) + 4} fontSize="11" fontWeight="600" fill={s.color}>{s.name}</text>
        </g>
      ))}
    </svg>
  );
};

const Th2: React.FC<{ children?: React.ReactNode; num?: boolean }> = ({ children, num }) => (
  <Th color={MUTE} fontSize="11px" isNumeric={num} borderColor={BORDER} whiteSpace="nowrap">{children}</Th>
);

const ModelPerformance: React.FC = () => {
  const [data, setData] = useState<ResearchOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Overview');

  useEffect(() => {
    getResearchOverview().then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Could not load the results.'));
  }, []);

  const rows = data?.variants ?? [];
  const sorted = useMemo(() => [...rows].sort((a, b) => b.latency_ms - a.latency_ms), [rows]);
  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'imagineai_research_results.json'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <WorkspaceLayout>
      <Box p={{ base: 4, md: 8 }} minH="100vh">
        <Box maxW="1100px" mx="auto">
          <Flex justify="space-between" align="flex-start" wrap="wrap" gap={3} mb={4}>
            <Box>
              <Heading as="h1" size="xl" color={INK} fontWeight="800" letterSpacing="-0.02em">Research results</Heading>
              <Text color={SOFT} mt={1}>Every number on these pages is measured on our own hardware and read from the result files. Nothing is typed in by hand.</Text>
            </Box>
            <HStack>
              <Button as={Link} to="/lab" size="sm" variant="outline" rightIcon={<FiExternalLink />}>Experiments lab</Button>
              <Button size="sm" variant="brand" leftIcon={<FiDownload />} onClick={exportJson} isDisabled={!data}>Export JSON</Button>
            </HStack>
          </Flex>

          <Flex gap={2} wrap="wrap" mb={5} role="tablist" aria-label="Research sections">
            {TABS.map((t) => (
              <Button key={t} size="sm" role="tab" aria-selected={tab === t} borderRadius="full" onClick={() => setTab(t)}
                bg={tab === t ? PRIMARY : '#FFFFFF'} color={tab === t ? '#FFFFFF' : INK} border="1px solid" borderColor={tab === t ? PRIMARY : BORDER}
                fontWeight={tab === t ? 700 : 500} _hover={{ borderColor: PRIMARY, bg: tab === t ? '#4747DB' : '#EEF0FF' }}>{t}</Button>
            ))}
          </Flex>

          {error && <Alert status="error" borderRadius="12px" mb={4}><AlertIcon />{error}</Alert>}
          {!data && !error && <Flex align="center" gap={3}><Spinner color={PRIMARY} /><Text color={SOFT}>Loading measured results...</Text></Flex>}
          {data && !data.measured && <Alert status="warning" borderRadius="12px"><AlertIcon />No benchmark has been run yet. Run evaluation/scripts/run_fid_benchmark.py.</Alert>}

          {data && data.measured && tab === 'Overview' && (
            <>
              <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4} mb={4}>
                {data.headlines.map((h) => (
                  <Box key={h.label} bg="#FFFFFF" border={`1px solid ${BORDER}`} borderRadius="18px" p={5} boxShadow="card">
                    <Text fontSize="11px" fontWeight={700} color={MUTE} textTransform="uppercase" letterSpacing="0.05em">{h.label}</Text>
                    <Text fontSize="34px" fontWeight={800} color={TONE[h.tone] || PRIMARY} lineHeight="1.15" mt={1}>{h.value}</Text>
                    <Text fontSize="12px" color={SOFT} mt={1}>{h.sub}</Text>
                  </Box>
                ))}
              </SimpleGrid>
              <Card title="What we found" sub="Written from the measurements, in plain words.">
                <Box as="ul" pl={5}>{data.insights.map((i) => <Text as="li" key={i} color={INK} mb={2}>{i}</Text>)}</Box>
              </Card>
              <Card title="Speed against quality" sub="Each dot is one way of running the model. Dots to the upper left are faster and match the prompt better.">
                <TradeoffChart rows={rows} />
                <Flex gap={4} wrap="wrap" mt={2} fontSize="12px" color={SOFT}>
                  {[['Baseline and fp16', '#6B7280'], ['SD-Turbo', PRIMARY], ['LCM (public)', '#0F9B8E'], ['LCM + COCO adapter', '#B87500'], ['Our own LCM-LoRA', CORAL]].map(([n, c]) => (
                    <Flex key={n} align="center" gap={1.5}><Box w="10px" h="10px" borderRadius="full" bg={c} />{n}</Flex>
                  ))}
                </Flex>
              </Card>
            </>
          )}

          {data && data.measured && tab === 'Speed and size' && (
            <>
              <Card title="Time to make one image" sub="Median of repeated runs on a cooled GPU, 512x512. Bars use a log scale, so each step to the right is a big jump.">
                <BarList log items={sorted.map((r) => ({ label: r.id, value: r.latency_ms, color: FAMILY_COLOR(r.id), text: r.latency_ms >= 1000 ? `${(r.latency_ms / 1000).toFixed(1)} s` : `${r.latency_ms.toFixed(0)} ms` }))} />
              </Card>
              <Card title="All variants" sub="Speed-up, memory and size are relative to the baseline (B0).">
                <Box overflowX="auto">
                  <Table size="sm"><Thead><Tr><Th2>ID</Th2><Th2>What it is</Th2><Th2 num>Speed-up</Th2><Th2 num>Latency</Th2><Th2 num>Memory</Th2><Th2 num>Less memory</Th2><Th2 num>Model size</Th2></Tr></Thead>
                    <Tbody>{rows.map((r) => (
                      <Tr key={r.id}><Td borderColor={BORDER}><Badge bg={FAMILY_COLOR(r.id)} color="#FFFFFF" borderRadius="6px">{r.id}</Badge></Td>
                        <Td borderColor={BORDER} fontSize="13px" maxW="420px" whiteSpace="normal">{r.label}</Td>
                        <Td isNumeric borderColor={BORDER} fontWeight={700}>{r.speedup?.toFixed(1)}x</Td>
                        <Td isNumeric borderColor={BORDER}>{r.latency_ms.toFixed(0)} ms</Td>
                        <Td isNumeric borderColor={BORDER}>{(r.vram_mb / 1024).toFixed(1)} GB</Td>
                        <Td isNumeric borderColor={BORDER}>{r.vram_saved_pct?.toFixed(0)}%</Td>
                        <Td isNumeric borderColor={BORDER}>{(r.size_mb / 1024).toFixed(2)} GB</Td></Tr>))}</Tbody></Table>
                </Box>
              </Card>
              {data.tiny_vae && (
                <Card title="Tiny decoder on SD-Turbo (cloud GPU)" sub="Replacing the image decoder with a much smaller one. These rows were measured together on one cloud GPU, so compare them with each other, not with the table above.">
                  <Box overflowX="auto"><Table size="sm"><Thead><Tr><Th2>Variant</Th2><Th2 num>Steps</Th2><Th2>Tiny decoder</Th2><Th2 num>FID</Th2><Th2 num>CLIP</Th2><Th2 num>Latency</Th2><Th2 num>Size</Th2></Tr></Thead>
                    <Tbody>{data.tiny_vae.map((r) => (<Tr key={r.id}><Td borderColor={BORDER} fontWeight={700}>{r.id}</Td><Td isNumeric borderColor={BORDER}>{r.steps}</Td><Td borderColor={BORDER}>{r.tiny_vae ? 'Yes' : 'No'}</Td>
                      <Td isNumeric borderColor={BORDER}>{r.fid.toFixed(1)}</Td><Td isNumeric borderColor={BORDER}>{r.clip.toFixed(3)}</Td><Td isNumeric borderColor={BORDER}>{r.latency_ms.toFixed(0)} ms</Td><Td isNumeric borderColor={BORDER}>{(r.size_mb / 1024).toFixed(2)} GB</Td></Tr>))}</Tbody></Table></Box>
                </Card>
              )}
            </>
          )}

          {data && data.measured && tab === 'Quality' && (
            <>
              <Card title="Image quality and prompt match" sub="FID and KID compare our images with real photos (lower is better). CLIP measures how well the picture matches the text (higher is better).">
                <Box overflowX="auto"><Table size="sm"><Thead><Tr><Th2>ID</Th2><Th2 num>FID</Th2><Th2 num>KID x1000</Th2><Th2 num>CLIP</Th2><Th2 num>Steps</Th2></Tr></Thead>
                  <Tbody>{rows.map((r) => (<Tr key={r.id}><Td borderColor={BORDER}><Badge bg={FAMILY_COLOR(r.id)} color="#FFFFFF" borderRadius="6px">{r.id}</Badge></Td>
                    <Td isNumeric borderColor={BORDER}>{r.fid.toFixed(1)}</Td><Td isNumeric borderColor={BORDER}>{r.kid.toFixed(1)}</Td><Td isNumeric borderColor={BORDER} fontWeight={r.clip === Math.max(...rows.map((x) => x.clip)) ? 800 : 400}>{r.clip.toFixed(3)}</Td><Td isNumeric borderColor={BORDER}>{r.steps}</Td></Tr>))}</Tbody></Table></Box>
                <Text fontSize="12px" color={MUTE} mt={3}>{data.protocol.caveat}</Text>
              </Card>
              {data.cv_ablation && (
                <Card title="Does classical computer vision help?" sub="We applied each classical stage to 300 generated images and measured the result.">
                  <Box overflowX="auto"><Table size="sm"><Thead><Tr><Th2>Stage</Th2><Th2 num>FID</Th2><Th2 num>CLIP</Th2><Th2 num>Time per image</Th2></Tr></Thead>
                    <Tbody>{data.cv_ablation.map((r) => (<Tr key={r.name}><Td borderColor={BORDER}>{r.name}</Td><Td isNumeric borderColor={BORDER}>{r.fid.toFixed(2)}</Td><Td isNumeric borderColor={BORDER}>{r.clip.toFixed(4)}</Td><Td isNumeric borderColor={BORDER}>{r.ms != null ? `${r.ms.toFixed(0)} ms` : '-'}</Td></Tr>))}</Tbody></Table></Box>
                  <Text fontSize="13px" color={SOFT} mt={3}>Result: the metrics barely move, so these stages are optional extras rather than defaults.</Text>
                </Card>
              )}
            </>
          )}

          {data && data.measured && tab === 'Prompt accuracy' && (
            <Card title="Does the picture contain what you asked for?" sub="100 test prompts per model (20 per kind). A different detector model checks each image. Compare models with each other; the checker is not perfect.">
              {!data.prompt_accuracy ? <Text color={SOFT}>Not measured yet.</Text> : (
                <Box overflowX="auto"><Table size="sm"><Thead><Tr><Th2>Model</Th2>{CATS.map((c) => <Th2 key={c} num>{CAT_LABEL[c]}</Th2>)}<Th2 num>Overall</Th2></Tr></Thead>
                  <Tbody>{[...data.prompt_accuracy].sort((a, b) => b.overall - a.overall).map((r) => (
                    <Tr key={r.id}><Td borderColor={BORDER} fontWeight={700}>{r.id}<Text as="span" fontWeight={400} color={MUTE} fontSize="11px" display="block" whiteSpace="normal" maxW="260px">{r.label}</Text></Td>
                      {CATS.map((c) => { const v = r.per_category[c]; return <Td key={c} isNumeric borderColor={BORDER} bg={v == null ? 'transparent' : `rgba(91,91,240,${(0.08 + 0.55 * v).toFixed(2)})`} color={v != null && v > 0.6 ? '#FFFFFF' : INK} fontWeight={600}>{pct(v)}</Td>; })}
                      <Td isNumeric borderColor={BORDER} fontWeight={800}>{pct(r.overall)}</Td></Tr>))}</Tbody></Table></Box>
              )}
            </Card>
          )}

          {data && data.measured && tab === 'Best of N' && (
            <>
              {!data.best_of_n ? <Card><Text color={SOFT}>Not measured yet.</Text></Card> : (
                <>
                  <Card title="Try several times, keep the best" sub={`SD-Turbo makes N candidate images per prompt; a detector picks the one that matches the prompt best. A different detector then scores the chosen image (${data.best_of_n.prompts} prompts), so the selector never marks its own work.`}>
                    <LineChart xTicks={data.best_of_n.rows.map((r) => r.n)} series={[
                      { name: 'Overall', color: PRIMARY, pts: data.best_of_n.rows.map((r) => [r.n, r.overall] as [number, number]) },
                      { name: 'Positions', color: CORAL, pts: data.best_of_n.rows.map((r) => [r.n, r.per_category.position ?? 0] as [number, number]) },
                      { name: 'Counting', color: '#0F9B8E', pts: data.best_of_n.rows.map((r) => [r.n, r.per_category.counting ?? 0] as [number, number]) },
                    ]} />
                  </Card>
                  <Card title="What it costs">
                    <Box overflowX="auto"><Table size="sm"><Thead><Tr><Th2 num>N</Th2><Th2 num>Overall</Th2><Th2 num>Positions</Th2><Th2 num>Counting</Th2><Th2 num>Best possible</Th2><Th2 num>Time (laptop, est.)</Th2></Tr></Thead>
                      <Tbody>{data.best_of_n.rows.map((r) => (<Tr key={r.n}><Td isNumeric borderColor={BORDER} fontWeight={700}>{r.n}</Td><Td isNumeric borderColor={BORDER} fontWeight={700}>{pct(r.overall)}</Td><Td isNumeric borderColor={BORDER}>{pct(r.per_category.position)}</Td><Td isNumeric borderColor={BORDER}>{pct(r.per_category.counting)}</Td><Td isNumeric borderColor={BORDER}>{pct(r.ceiling)}</Td><Td isNumeric borderColor={BORDER}>{r.cost_ms_laptop_est ? `${(r.cost_ms_laptop_est / 1000).toFixed(1)} s` : '-'}</Td></Tr>))}</Tbody></Table></Box>
                    <Text fontSize="12px" color={MUTE} mt={3}>{data.best_of_n.note}</Text>
                  </Card>
                </>
              )}
            </>
          )}

          {data && data.measured && tab === 'Lessons' && (
            <>
              <Text color={SOFT} mb={4}>What did not work, why, and what we did about it. Every number comes from the measurements.</Text>
              {data.failures.map((f) => (
                <Card key={f.title}>
                  <Flex justify="space-between" align="flex-start" gap={3} wrap="wrap" mb={2}>
                    <Heading as="h3" size="sm" color={INK}>{f.title}</Heading>
                    <Badge borderRadius="full" px={3} py={1} textTransform="none" bg={f.severity === 'open' ? '#FFEDEA' : f.severity === 'measured' ? '#FFF4DB' : '#EEF0FF'}
                      color={f.severity === 'open' ? '#B42318' : f.severity === 'measured' ? '#8A5A00' : '#4747DB'}>{f.status}</Badge>
                  </Flex>
                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} fontSize="sm">
                    <Box><Text fontWeight={700} color={MUTE} fontSize="11px" textTransform="uppercase">Why</Text><Text color={INK}>{f.cause}</Text></Box>
                    <Box><Text fontWeight={700} color={MUTE} fontSize="11px" textTransform="uppercase">What we measured</Text><Text color={INK}>{f.evidence}</Text></Box>
                    <Box><Text fontWeight={700} color={MUTE} fontSize="11px" textTransform="uppercase">What we did</Text><Text color={INK}>{f.mitigation}</Text></Box>
                  </SimpleGrid>
                </Card>
              ))}
            </>
          )}

          {data && data.measured && tab === 'How we measured' && (
            <Card title="The test setup" sub="Fixed before we ran anything, and the same for every variant.">
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                {Object.entries({ Baseline: data.protocol.baseline, Data: data.protocol.data, Metrics: data.protocol.metrics, Hardware: data.protocol.hardware }).map(([k, v]) => (
                  <Box key={k} bg="#F7F3EE" borderRadius="14px" p={4}><Text fontSize="11px" fontWeight={700} color={MUTE} textTransform="uppercase">{k}</Text><Text color={INK}>{v}</Text></Box>
                ))}
              </SimpleGrid>
              <Text mt={4} fontSize="sm" color={SOFT}>Reports in the repository: <b>evaluation/reports/eval_P3_*.md</b>, <b>failure_analysis.md</b>, <b>ablation_study.md</b>, <b>mobile_feasibility.md</b>. Reproduce with <b>evaluation/scripts/run_fid_benchmark.py</b>.</Text>
            </Card>
          )}
        </Box>
      </Box>
    </WorkspaceLayout>
  );
};

export default ModelPerformance;
