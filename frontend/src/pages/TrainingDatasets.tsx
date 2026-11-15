import React, { useEffect, useState } from 'react';
import { Box, Flex, Text, Heading, Spinner, Code } from '@chakra-ui/react';
import WorkspaceLayout from '../components/WorkspaceLayout';
import { getTrainingRuns, TrainingRunsResponse } from '../lib/api';

const statusColor = (s: string) => (s === 'done' || s === 'complete' ? '#4747DB' : s === 'failed' ? '#E5484D' : '#C77700');

const Card: React.FC<{ label: string; value: React.ReactNode; sub?: string; color: string }> = ({ label, value, sub, color }) => (
  <Box flex="1 1 190px" bg="#FFFFFF" borderRadius="14px" border="1px solid #E3DACF" p={5}>
    <Text color="#5B6277" fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" mb={2}>{label}</Text>
    <Text color={color} fontSize="2xl" fontWeight={700} lineHeight={1}>{value}</Text>
    {sub && <Text color="#5B6277" fontSize="xs" mt={1}>{sub}</Text>}
  </Box>
);

const TrainingDatasets: React.FC = () => {
  const [data, setData] = useState<TrainingRunsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getTrainingRuns()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load training records.'));
  }, []);

  const runs = data?.runs ?? [];
  const datasets = data?.datasets ?? [];
  const approved = runs.filter((r) => r.approved).length;

  return (
    <WorkspaceLayout>
      <Box p={{ base: 4, md: 8 }} minH="100vh" bg="#FBF8F4">
        <Box mb={7}>
          <Heading size="lg" color="#1E2233" fontWeight={700}>Training &amp; Datasets</Heading>
          <Text color="#5B6277" mt={1} fontSize="sm">
            Real records read from this project&apos;s adapter folders and dataset manifests. Training runs offline on a GPU; this page shows what was actually run.
          </Text>
        </Box>

        {!data && !error && <Flex align="center" gap={3} color="#5B6277"><Spinner size="sm" /> Loading training records...</Flex>}
        {error && <Text color="#E5484D" role="alert">Could not load training records: {error}</Text>}

        {data && (
          <>
            <Flex gap={4} mb={7} wrap="wrap">
              <Card label="Adapters trained" value={runs.length} sub="LoRA runs on disk" color="#5B5BF0" />
              <Card label="Approved by blind review" value={approved} sub="hash-bound approval.json" color="#4747DB" />
              <Card label="Datasets" value={datasets.length} sub="with licence + leakage guard" color="#C77700" />
              <Card label="Training images" value={datasets.reduce((a, d) => Math.max(a, d.train ?? 0), 0).toLocaleString()} sub="largest dataset (COCO captions)" color="#0F9B8E" />
            </Flex>

            <Box bg="#FFFFFF" borderRadius="16px" border="1px solid #E3DACF" overflowX="auto" mb={7}>
              <Text color="#1E2233" fontWeight={600} px={5} pt={5} pb={3}>Adapter training runs</Text>
              <Box as="table" w="100%" fontSize="sm" style={{ borderCollapse: 'collapse' }}>
                <Box as="thead" color="#5B6277" fontSize="xs" textTransform="uppercase" bg="#FFFFFF">
                  <tr>
                    {['Run', 'Base model', 'Steps', 'Rank', 'LR', 'Status', 'Review', 'Size', 'SHA-256'].map((h) => (
                      <Box as="th" key={h} px={4} py={3} textAlign="left" whiteSpace="nowrap">{h}</Box>
                    ))}
                  </tr>
                </Box>
                <tbody>
                  {runs.map((r) => (
                    <Box as="tr" key={r.name} borderTop="1px solid #E3DACF" color="#1E2233" _hover={{ bg: '#EFE8DF' }}>
                      <Box as="td" px={4} py={3} fontWeight={600}>{r.name}</Box>
                      <Box as="td" px={4} py={3} color="#5B6277">{r.base_model?.split('/').pop()}</Box>
                      <Box as="td" px={4} py={3}>{r.steps ?? '-'}</Box>
                      <Box as="td" px={4} py={3}>{r.rank ?? '-'}</Box>
                      <Box as="td" px={4} py={3}>{r.learning_rate ?? '-'}</Box>
                      <Box as="td" px={4} py={3} color={statusColor(r.status)}>{r.status}</Box>
                      <Box as="td" px={4} py={3} color={r.approved ? '#4747DB' : '#5B6277'}>{r.approved ? 'approved' : 'not approved'}</Box>
                      <Box as="td" px={4} py={3}>{r.weights_mb != null ? `${r.weights_mb} MB` : '-'}</Box>
                      <Box as="td" px={4} py={3} color="#5B6277"><Code bg="transparent" color="#5B6277">{r.sha256}</Code></Box>
                    </Box>
                  ))}
                </tbody>
              </Box>
            </Box>

            <Flex gap={5} wrap="wrap" mb={7}>
              {datasets.map((d) => (
                <Box key={d.name} flex="1 1 320px" bg="#FFFFFF" borderRadius="16px" border="1px solid #E3DACF" p={5}>
                  <Text color="#1E2233" fontWeight={600}>{d.name}</Text>
                  <Text color="#5B6277" fontSize="xs" mb={3}>{d.description}</Text>
                  <Text color="#1E2233" fontSize="sm">
                    {d.train?.toLocaleString()} train · {d.validation?.toLocaleString()} validation (held out, used for FID/CLIP)
                  </Text>
                  {d.leakage_guard && <Text color="#5B6277" fontSize="xs" mt={2}>Leakage guard: {d.leakage_guard}</Text>}
                  <Text color="#5B6277" fontSize="xs" mt={2}>
                    Licences: {Object.entries(d.licences).map(([k, v]) => `${k} (${v})`).join(', ') || 'n/a'}
                  </Text>
                </Box>
              ))}
            </Flex>

            <Box bg="#FFFFFF" borderRadius="16px" border="1px solid #E3DACF" p={5}>
              <Text color="#1E2233" fontWeight={600} mb={2}>Reproduce a run</Text>
              <Code display="block" whiteSpace="pre-wrap" bg="#FFFFFF" color="#5B5BF0" p={3} borderRadius="8px" fontSize="xs">
                {data.reproduce}
              </Code>
              <Text color="#5B6277" fontSize="xs" mt={2}>
                Few-step distillation (LCM) uses ai_engine/training/third_party/train_lcm_distill_lora_sd_wds.py; see docs/COLAB_LCM_SPEED_FINETUNE.md.
              </Text>
            </Box>
          </>
        )}
      </Box>
    </WorkspaceLayout>
  );
};

export default TrainingDatasets;
