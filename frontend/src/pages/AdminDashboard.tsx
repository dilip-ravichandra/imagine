import React, { useCallback, useEffect, useState } from 'react';
import { Box, Flex, Grid, GridItem, Text, Heading, Button, Spinner } from '@chakra-ui/react';
import WorkspaceLayout from '../components/WorkspaceLayout';
import {
  getCapabilities,
  getModelCatalogue,
  getGalleryItems,
  CapabilitiesResponse,
  ModelCatalogueEntry,
} from '../lib/api';

interface Snapshot {
  health: string;
  latencyMs: number;
  capabilities: CapabilitiesResponse | null;
  models: ModelCatalogueEntry[];
  galleryCount: number | null;
  checkedAt: string;
}

const AdminDashboard: React.FC = () => {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const t0 = performance.now();
      const healthRes = await fetch('/health');
      const health = healthRes.ok ? 'ok' : `HTTP ${healthRes.status}`;
      const latencyMs = Math.round(performance.now() - t0);
      const [capabilities, cat, gallery] = await Promise.all([
        getCapabilities().catch(() => null),
        getModelCatalogue().catch(() => ({ models: [] as ModelCatalogueEntry[] })),
        (getGalleryItems() as Promise<{ items?: unknown[]; total?: number }>).catch(() => null),
      ]);
      setSnap({
        health,
        latencyMs,
        capabilities,
        models: cat.models,
        galleryCount: gallery ? (gallery.total ?? gallery.items?.length ?? 0) : null,
        checkedAt: new Date().toLocaleTimeString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const cards = snap
    ? [
        { label: 'API health', value: snap.health === 'ok' ? 'Online' : snap.health, sub: `${snap.latencyMs} ms round trip`, ok: snap.health === 'ok' },
        {
          label: 'Generation',
          value: snap.capabilities?.generation_available ? 'Available' : 'Unavailable',
          sub: snap.capabilities ? `mode: ${snap.capabilities.deployment_mode}` : 'capabilities unreachable',
          ok: !!snap.capabilities?.generation_available,
        },
        { label: 'Models available', value: `${snap.models.filter((m) => m.available).length} / ${snap.models.length}`, sub: 'from the model catalogue', ok: snap.models.some((m) => m.available) },
        { label: 'Gallery items', value: snap.galleryCount ?? '-', sub: 'stored on this server', ok: snap.galleryCount !== null },
      ]
    : [];

  return (
    <WorkspaceLayout>
      <Box p={{ base: 4, md: 8 }} maxW="1400px">
        <Flex justify="space-between" align="center" mb={8} wrap="wrap" gap={3}>
          <Box>
            <Heading size="lg" color="#1E2233" fontWeight="700">System Status</Heading>
            <Text color="#5B6277" fontSize="14px" mt={1}>
              Live checks against this server. No placeholder users or activity: only what the backend reports right now.
            </Text>
          </Box>
          <Flex align="center" gap={3}>
            {snap && <Text fontSize="12px" color="#8A90A2">checked {snap.checkedAt}</Text>}
            <Button size="sm" onClick={refresh} isLoading={loading} bg="#5B5BF0" color="#FFFFFF" fontWeight={700}>Refresh</Button>
          </Flex>
        </Flex>

        {loading && !snap && <Flex align="center" gap={3} color="#5B6277"><Spinner size="sm" /> Checking services...</Flex>}
        {error && <Text color="#E5484D" role="alert">{error}</Text>}

        {snap && (
          <>
            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }} gap={5} mb={8}>
              {cards.map((c) => (
                <GridItem key={c.label}>
                  <Box bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="14px" p={5}>
                    <Text color="#5B6277" fontSize="12px" textTransform="uppercase" letterSpacing="0.08em">{c.label}</Text>
                    <Text color={c.ok ? '#5B5BF0' : '#E5484D'} fontSize="2xl" fontWeight={700} mt={2}>{c.value}</Text>
                    <Text color="#8A90A2" fontSize="12px" mt={1}>{c.sub}</Text>
                  </Box>
                </GridItem>
              ))}
            </Grid>

            <Box bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="14px" p={5}>
              <Text color="#1E2233" fontWeight={600} mb={4}>Model registry</Text>
              <Flex direction="column" gap={3}>
                {snap.models.length === 0 && <Text color="#5B6277" fontSize="sm">The catalogue endpoint returned no models.</Text>}
                {snap.models.map((m) => (
                  <Flex key={m.id} justify="space-between" align="flex-start" gap={4} borderTop="1px solid #EFE8DF" pt={3} wrap="wrap">
                    <Box>
                      <Text color="#1E2233" fontSize="sm" fontWeight={600}>{m.display_name}</Text>
                      <Text color="#8A90A2" fontSize="xs">{m.checkpoint} · {m.role}</Text>
                      {!m.available && <Text color="#C77700" fontSize="xs">{m.availability_reason}</Text>}
                    </Box>
                    <Text color={m.available ? '#4747DB' : '#E5484D'} fontSize="sm" fontWeight={600}>{m.available ? 'available' : 'unavailable'}</Text>
                  </Flex>
                ))}
              </Flex>
            </Box>
          </>
        )}
      </Box>
    </WorkspaceLayout>
  );
};

export default AdminDashboard;
