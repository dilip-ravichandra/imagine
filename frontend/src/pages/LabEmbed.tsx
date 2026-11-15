import React, { useState } from 'react';
import { Box, Button, Flex, Heading, Spinner, Text } from '@chakra-ui/react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiBarChart2, FiExternalLink } from 'react-icons/fi';
import WorkspaceLayout from '../components/WorkspaceLayout';

const TAB_NAMES = ['generate', 'batch', 'stress', 'pipeline', 'comparison', 'robustness', 'failures', 'catalogue', 'about'];

/** The research dashboard (Stress Lab, batch tests, pipeline, failure analysis...) shown inside the main app,
 *  so there is one sidebar, one look and one place to go. Deep link with /lab?tab=stress. */
const LabEmbed: React.FC = () => {
  const [params] = useSearchParams();
  const raw = params.get('tab') || 'generate';
  const tab = TAB_NAMES.includes(raw) ? raw : 'generate';
  const [loaded, setLoaded] = useState(false);
  return (
    <WorkspaceLayout>
      <Box p={{ base: 3, md: 6 }} minH="100vh">
        <Flex justify="space-between" align="flex-start" wrap="wrap" gap={3} mb={3}>
          <Box>
            <Heading as="h1" size="xl" color="#1E2233" fontWeight="800" letterSpacing="-0.02em">Experiments lab</Heading>
            <Text color="#5B6277" mt={1}>Try the adaptive Stress Lab, batch tests, the pipeline inspector and the failure analysis.</Text>
          </Box>
          <Flex gap={2}>
            <Button as={Link} to="/research" size="sm" variant="outline" leftIcon={<FiBarChart2 />}>Results</Button>
            <Button as="a" href={`/research-dashboard?tab=${tab}`} target="_blank" rel="noreferrer" size="sm" variant="ghost" rightIcon={<FiExternalLink />}>Open on its own</Button>
          </Flex>
        </Flex>
        <Box position="relative" bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="18px" overflow="hidden" boxShadow="card">
          {!loaded && <Flex position="absolute" inset={0} align="center" justify="center" gap={3} zIndex={1}><Spinner color="#5B5BF0" /><Text color="#5B6277">Loading the lab...</Text></Flex>}
          <iframe title="Experiments lab" src={`/research-dashboard?embed=1&tab=${tab}`} onLoad={() => setLoaded(true)}
            style={{ width: '100%', height: 'calc(100vh - 190px)', minHeight: '560px', border: 0, display: 'block' }} />
        </Box>
      </Box>
    </WorkspaceLayout>
  );
};

export default LabEmbed;
