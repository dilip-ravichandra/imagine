import React, { useEffect, useState } from 'react';
import { Box, Button, Flex, Heading, Image, Input, SimpleGrid, Text } from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiBookOpen, FiEdit3, FiGrid, FiImage } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import WorkspaceLayout from '../components/WorkspaceLayout';
import { useAuth } from '../hooks/useAuth';
import { getGalleryItems, getResearchOverview, toSameOriginImageUrl, type GalleryItem, type ResearchOverview } from '../lib/api';

interface Action {
  icon: IconType;
  title: string;
  text: string;
  route: string;
  tint: string;
  ink: string;
}

const ACTIONS: Action[] = [
  { icon: FiImage, title: 'Create an image', text: 'Type an idea, get a picture in seconds.', route: '/create', tint: '#EEF0FF', ink: '#4747DB' },
  { icon: FiEdit3, title: 'Edit a photo', text: 'Select a part of any photo and change only that part.', route: '/edit', tint: '#FFEDEA', ink: '#D9442F' },
  { icon: FiBookOpen, title: 'Make a storybook', text: 'Turn an idea into a comic or manga page.', route: '/storybook', tint: '#FFF4DB', ink: '#B87500' },
  { icon: FiGrid, title: 'My gallery', text: 'Everything you have made, in one place.', route: '/gallery', tint: '#E3F6EC', ink: '#13795B' },
];

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [idea, setIdea] = useState('');
  const [recent, setRecent] = useState<GalleryItem[] | null>(null);
  const [research, setResearch] = useState<ResearchOverview | null>(null);
  const first = (user?.name || '').split(' ')[0];

  useEffect(() => {
    getGalleryItems({})
      .then((r) => setRecent(r.items.slice(0, 8)))
      .catch(() => setRecent([]));
    getResearchOverview().then(setResearch).catch(() => setResearch(null));
  }, []);

  const start = () => navigate(idea.trim() ? `/create?prompt=${encodeURIComponent(idea.trim())}` : '/create');

  return (
    <WorkspaceLayout>
      <Box p={{ base: 4, md: 8 }} minH="100vh">
        <Box maxW="960px" mx="auto">
          <Heading as="h1" size="xl" color="#1E2233" fontWeight="800" letterSpacing="-0.02em">
            {first ? `Hi ${first}, what would you like to make?` : 'What would you like to make?'}
          </Heading>
          <Text color="#5B6277" mt={2} mb={6} fontSize="lg">Pick something below, or just describe an idea.</Text>

          <Flex gap={3} direction={{ base: 'column', sm: 'row' }} mb={8}>
            <Input
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && start()}
              placeholder="For example: a friendly robot reading a book in a library"
              size="lg"
              bg="#FFFFFF"
              aria-label="Describe an image"
            />
            <Button variant="brand" size="lg" px={8} onClick={start} rightIcon={<FiArrowRight />}>Create</Button>
          </Flex>

          <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4}>
            {ACTIONS.map((a) => (
              <Link key={a.route} to={a.route}>
                <Box bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="20px" p={5} h="100%" boxShadow="card"
                  _hover={{ transform: 'translateY(-3px)', boxShadow: 'lifted', borderColor: a.ink }} transition="all 0.18s ease">
                  <Flex w="48px" h="48px" borderRadius="14px" bg={a.tint} color={a.ink} align="center" justify="center" mb={4}>
                    <a.icon size={24} aria-hidden />
                  </Flex>
                  <Text fontWeight="700" color="#1E2233" fontSize="lg">{a.title}</Text>
                  <Text color="#5B6277" fontSize="sm" mt={1}>{a.text}</Text>
                </Box>
              </Link>
            ))}
          </SimpleGrid>

          {research && research.measured && (
            <Link to="/research">
              <Box mt={8} bg="linear-gradient(135deg,#4747DB,#7B5CF0)" borderRadius="22px" p={{ base: 5, md: 6 }} color="#FFFFFF" boxShadow="lifted"
                _hover={{ transform: 'translateY(-2px)' }} transition="all 0.18s ease">
                <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
                  <Box maxW="460px">
                    <Text fontSize="11px" fontWeight={700} letterSpacing="0.08em" textTransform="uppercase" opacity={0.85}>Research results</Text>
                    <Heading as="h2" size="md" mt={1}>How much faster and lighter is it than the baseline?</Heading>
                    <Text fontSize="sm" mt={1} opacity={0.9}>Measured on our own GPU: speed, memory, image quality and prompt accuracy for every model we tried.</Text>
                  </Box>
                  <Flex gap={5} wrap="wrap">
                    {research.headlines.slice(0, 3).map((h) => (
                      <Box key={h.label}><Text fontSize="30px" fontWeight={800} lineHeight="1.1">{h.value}</Text><Text fontSize="11px" opacity={0.85} maxW="110px">{h.label}</Text></Box>
                    ))}
                    <Flex align="center"><FiArrowRight size={22} /></Flex>
                  </Flex>
                </Flex>
              </Box>
            </Link>
          )}

          <Flex justify="space-between" align="center" mt={10} mb={4}>
            <Heading as="h2" size="md" color="#1E2233">Your recent creations</Heading>
            <Button as={Link} to="/gallery" variant="ghost" size="sm" color="#5B5BF0" rightIcon={<FiArrowRight />}>See all</Button>
          </Flex>
          {recent === null && <Text color="#8A90A2">Loading...</Text>}
          {recent !== null && recent.length === 0 && (
            <Box bg="#FFFFFF" border="1px dashed #CFC4B6" borderRadius="20px" p={8} textAlign="center">
              <Text fontWeight="600" color="#1E2233">Nothing here yet</Text>
              <Text color="#5B6277" fontSize="sm" mt={1} mb={4}>Your pictures will show up here as soon as you make one.</Text>
              <Button as={Link} to="/create" variant="brand">Create your first image</Button>
            </Box>
          )}
          {recent !== null && recent.length > 0 && (
            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
              {recent.map((it) => (
                <Link key={it.id} to="/gallery" aria-label={it.prompt}>
                  <Box borderRadius="16px" overflow="hidden" bg="#EFE8DF" aspectRatio={1} boxShadow="card" _hover={{ transform: 'scale(1.02)' }} transition="all 0.15s ease">
                    <Image src={toSameOriginImageUrl(it.image_url)} alt={it.prompt} w="100%" h="100%" objectFit="cover" loading="lazy" />
                  </Box>
                </Link>
              ))}
            </SimpleGrid>
          )}
        </Box>
      </Box>
    </WorkspaceLayout>
  );
};

export default Dashboard;
