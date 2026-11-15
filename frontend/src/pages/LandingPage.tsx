import React from 'react';
import {
  Box,
  Flex,
  Text,
  Heading,
  Button,
  Grid,
  Image,
  HStack,
  Icon,
  SimpleGrid,
} from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import ChatBot from '../components/ChatBot';

import { SHOWCASE } from '../lib/showcase';
const NAV_LINKS = ['Home', 'Features', 'Explore', 'Pricing'];

const FEATURES = [
  {
    icon: '🎨',
    title: 'AI Generation',
    desc: 'Create breathtaking visuals from simple text prompts using state-of-the-art diffusion models.',
  },
  {
    icon: '📚',
    title: 'Education',
    desc: 'Explore interactive lessons on AI concepts, prompt engineering, and creative techniques.',
  },
  {
    icon: '✏️',
    title: 'Smart Editing',
    desc: 'Refine, upscale, and transform your images with intelligent AI-powered editing tools.',
  },
  {
    icon: '💬',
    title: 'Chat Assistant',
    desc: 'Collaborate with an AI assistant that helps brainstorm ideas and refine your creative vision.',
  },
];

const SHOWCASE_IMAGES = [
  { src: SHOWCASE.cabin.src, label: 'Mountain lake cabin', prompt: SHOWCASE.cabin.prompt },
  { src: SHOWCASE.neon.src, label: 'Neon city street', prompt: SHOWCASE.neon.prompt },
  { src: SHOWCASE.dragon.src, label: 'Fantasy dragon', prompt: SHOWCASE.dragon.prompt },
  { src: SHOWCASE.reef.src, label: 'Coral reef', prompt: SHOWCASE.reef.prompt },
  { src: SHOWCASE.space.src, label: 'Space nebula', prompt: SHOWCASE.space.prompt },
  { src: SHOWCASE.abstract.src, label: 'Abstract fluid art', prompt: SHOWCASE.abstract.prompt },
];

const Navbar: React.FC = () => (
  <Flex
    as="nav"
    position="fixed"
    top={0}
    left={0}
    right={0}
    zIndex={100}
    align="center"
    justify="space-between"
    px={{ base: 4, md: 10 }}
    py={3}
    sx={{
      bg: 'rgba(251,248,244,0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid #E3DACF',
    }}
  >
    <Link to="/" style={{ textDecoration: 'none' }}>
      <Heading
        size="md"
        sx={{
          bgGradient: 'linear(to-r, #5B5BF0, #4747DB)',
          bgClip: 'text',
          fontWeight: 800,
          letterSpacing: '-0.5px',
        }}
      >
        ImagineAI
      </Heading>
    </Link>

    <HStack spacing={8} display={{ base: 'none', md: 'flex' }}>
      {NAV_LINKS.map((l) => (
        <Link
          key={l}
          to={l === 'Explore' ? '/explore' : '#'}
          style={{ textDecoration: 'none' }}
        >
          <Text
            fontSize="sm"
            fontWeight={500}
            sx={{
              color: '#5B6277',
              transition: 'color 0.2s',
              _hover: { color: '#1E2233' },
            }}
          >
            {l}
          </Text>
        </Link>
      ))}
    </HStack>

    <HStack spacing={3}>
      <Link to="/auth">
        <Button
          variant="ghost"
          size="sm"
          sx={{
            color: '#5B6277',
            _hover: { bg: '#EFE8DF', color: '#1E2233' },
          }}
        >
          Sign In
        </Button>
      </Link>
      <Link to="/auth">
        <Button
          size="sm"
          sx={{
            bg: '#5B5BF0',
            color: '#FFFFFF',
            fontWeight: 700,
            _hover: { bg: '#4747DB', transform: 'translateY(-1px)' },
            transition: 'all 0.2s',
          }}
        >
          Get Started
        </Button>
      </Link>
    </HStack>
  </Flex>
);

const HeroSection: React.FC = () => (
  <Box
    position="relative"
    pt={{ base: '120px', md: '140px' }}
    pb={{ base: 12, md: 20 }}
    px={{ base: 4, md: 10, lg: 16 }}
    overflow="hidden"
  >
    {/* Ambient radial glow */}
    <Box
      position="absolute"
      top="-150px"
      right="10%"
      w="600px"
      h="600px"
      borderRadius="50%"
      sx={{
        bg: 'radial-gradient(circle, rgba(91,91,240,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }}
    />

    <Flex
      direction={{ base: 'column', lg: 'row' }}
      align="center"
      justify="space-between"
      gap={10}
      maxW="1400px"
      mx="auto"
    >
      {/* Left content */}
      <Box flex={1} maxW="680px">
        <Text
          fontSize="xs"
          fontWeight={700}
          display="inline-block"
          mb={4}
          px={3.5}
          py={1.5}
          borderRadius="full"
          letterSpacing="0.05em"
          textTransform="uppercase"
          sx={{
            bg: 'rgba(91,91,240,0.1)',
            color: '#5B5BF0',
            border: '1px solid rgba(91,91,240,0.25)',
          }}
        >
          ✦ Powered by SD-Turbo & Next-Gen AI
        </Text>

        <Heading
          size={{ base: 'xl', md: '2xl' }}
          lineHeight={1.12}
          mb={5}
          sx={{ color: '#1E2233', fontWeight: 800, letterSpacing: '-1.5px' }}
        >
          Turn Your Ideas Into{' '}
          <Box
            as="span"
            sx={{
              bgGradient: 'linear(to-r, #5B5BF0, #4747DB)',
              bgClip: 'text',
            }}
          >
            Stunning Visuals
          </Box>{' '}
          with AI
        </Heading>

        <Text
          fontSize={{ base: 'md', md: 'lg' }}
          mb={8}
          sx={{ color: '#5B6277', lineHeight: 1.7 }}
        >
          Create images, learn concepts, edit scenes and explore infinite possibilities — all inside a cohesive, lightning-fast creative studio.
        </Text>

        <HStack spacing={4} mb={10}>
          <Link to="/auth">
            <Button
              size="lg"
              px={8}
              sx={{
                bg: '#5B5BF0',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 'md',
                _hover: {
                  bg: '#4747DB',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 30px rgba(91,91,240,0.14)',
                },
                transition: 'all 0.25s',
              }}
            >
              Get Started
            </Button>
          </Link>
          <Link to="/explore">
            <Button
              size="lg"
              variant="outline"
              px={8}
              sx={{
                color: '#5B5BF0',
                borderColor: '#E3DACF',
                fontWeight: 600,
                fontSize: 'md',
                _hover: {
                  bg: 'rgba(91,91,240,0.08)',
                  borderColor: '#5B5BF0',
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.25s',
              }}
            >
              Explore
            </Button>
          </Link>
        </HStack>

        {/* Feature Pills */}
        <Flex wrap="wrap" gap={3}>
          {[
            { icon: '✨', label: 'AI Generation' },
            { icon: '📚', label: 'Education' },
            { icon: '✏️', label: 'Smart Editing' },
            { icon: '💬', label: 'Chat Assistant' },
          ].map((item) => (
            <Flex
              key={item.label}
              align="center"
              gap={2}
              bg="#FFFFFF"
              border="1px solid #E3DACF"
              px={3.5}
              py={2}
              borderRadius="10px"
              fontSize="xs"
              fontWeight={600}
              color="#1E2233"
              _hover={{ borderColor: '#5B5BF0', bg: '#F5F0EA' }}
              transition="all 0.2s ease"
              cursor="pointer"
            >
              <Text>{item.icon}</Text>
              <Text>{item.label}</Text>
            </Flex>
          ))}
        </Flex>
      </Box>

      {/* Right Hero Image Card */}
      <Box
        flex={1}
        maxW="520px"
        w="100%"
        position="relative"
        borderRadius="20px"
        overflow="hidden"
        border="1px solid #E3DACF"
        bg="#FFFFFF"
        boxShadow="0 24px 64px rgba(30,34,51,0.12), 0 0 40px rgba(91,91,240,0.15)"
        transition="all 0.35s ease"
        _hover={{
          transform: 'translateY(-4px)',
          borderColor: '#5B5BF0',
          boxShadow: '0 30px 80px rgba(30,34,51,0.16), 0 0 60px rgba(91,91,240,0.14)',
        }}
      >
        <Image
          src={SHOWCASE.hero.src}
          alt={`Image made with ImagineAI: ${SHOWCASE.hero.prompt}`}
          w="100%"
          h="400px"
          objectFit="cover"
        />
        <Box
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          p={5}
          bgGradient="linear(to-t, #FBF8F4 30%, transparent)"
        >
          <Flex justify="space-between" align="center">
            <Box>
              <Text fontSize="xs" color="#5B5BF0" fontWeight={700} textTransform="uppercase">
                Prompt of the Day
              </Text>
              <Text fontSize="sm" color="#1E2233" fontWeight={600} mt={0.5}>
                "{SHOWCASE.hero.prompt}"
              </Text>
            </Box>
            <Box
              bg="rgba(91,91,240,0.15)"
              color="#5B5BF0"
              fontSize="xs"
              px={2.5}
              py={1}
              borderRadius="6px"
              fontWeight="bold"
            >
              Made here · SD 1.5
            </Box>
          </Flex>
        </Box>
      </Box>
    </Flex>
  </Box>
);

const FeatureCards: React.FC = () => (
  <Box px={{ base: 4, md: 12, lg: 20 }} pb={{ base: 16, md: 24 }}>
    <Heading
      size="lg"
      textAlign="center"
      mb={3}
      sx={{ color: '#1E2233', fontWeight: 700 }}
    >
      Everything You Need to Create
    </Heading>
    <Text
      textAlign="center"
      mb={10}
      fontSize="md"
      sx={{ color: '#5B6277' }}
    >
      One platform, infinite creative possibilities
    </Text>

    <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={5}>
      {FEATURES.map((f) => (
        <Box
          key={f.title}
          p={6}
          borderRadius="12px"
          sx={{
            bg: '#FFFFFF',
            border: '1px solid #E3DACF',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            _hover: {
              transform: 'translateY(-6px)',
              boxShadow: '0 12px 40px rgba(91,91,240,0.08)',
              borderColor: 'rgba(91,91,240,0.3)',
            },
          }}
        >
          <Text fontSize="3xl" mb={3}>
            {f.icon}
          </Text>
          <Text
            fontSize="md"
            fontWeight={700}
            mb={2}
            sx={{ color: '#1E2233' }}
          >
            {f.title}
          </Text>
          <Text fontSize="sm" sx={{ color: '#5B6277', lineHeight: 1.6 }}>
            {f.desc}
          </Text>
        </Box>
      ))}
    </SimpleGrid>
  </Box>
);

const ShowcaseGallery: React.FC = () => (
  <Box px={{ base: 4, md: 12, lg: 20 }} pb={{ base: 16, md: 24 }}>
    <Heading
      size="lg"
      textAlign="center"
      mb={3}
      sx={{ color: '#1E2233', fontWeight: 700 }}
    >
      Community Showcase
    </Heading>
    <Text
      textAlign="center"
      mb={10}
      fontSize="md"
      sx={{ color: '#5B6277' }}
    >
      See what creators are building with ImagineAI
    </Text>

    <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={5}>
      {SHOWCASE_IMAGES.map((img) => (
        <Box
          key={img.src}
          position="relative"
          borderRadius="12px"
          overflow="hidden"
          sx={{
            border: '1px solid #E3DACF',
            transition: 'all 0.35s ease',
            cursor: 'pointer',
            _hover: {
              transform: 'scale(1.02)',
              boxShadow: '0 16px 50px rgba(30,34,51,0.12)',
              '& .overlay': { opacity: 1 },
              '& img': { transform: 'scale(1.08)' },
            },
          }}
        >
          <Image
            src={img.src}
            alt={img.label}
            w="100%"
            h="240px"
            objectFit="cover"
            sx={{ transition: 'transform 0.5s ease' }}
          />
          <Flex
            className="overlay"
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            p={4}
            align="flex-end"
            sx={{
              opacity: 0,
              transition: 'opacity 0.3s ease',
              bgGradient:
                'linear(to-t, rgba(251,248,244,0.9), transparent)',
            }}
          >
            <Text fontWeight={600} fontSize="sm" sx={{ color: '#1E2233' }}>
              {img.label}
            </Text>
          </Flex>
        </Box>
      ))}
    </SimpleGrid>
  </Box>
);

const Footer: React.FC = () => (
  <Flex
    direction={{ base: 'column', md: 'row' }}
    align="center"
    justify="space-between"
    px={{ base: 4, md: 12 }}
    py={6}
    sx={{ borderTop: '1px solid #E3DACF' }}
    gap={4}
  >
    <Text fontSize="sm" sx={{ color: '#5B6277' }}>
      © 2024 ImagineAI. All rights reserved.
    </Text>
    <HStack spacing={6}>
      {['Help', 'Privacy', 'Terms', 'About'].map((l) => (
        <Text
          key={l}
          as="a"
          href="#"
          fontSize="sm"
          sx={{
            color: '#5B6277',
            _hover: { color: '#5B5BF0' },
            transition: 'color 0.2s',
          }}
        >
          {l}
        </Text>
      ))}
    </HStack>
  </Flex>
);

const LandingPage: React.FC = () => {
  return (
    <Box minH="100vh" sx={{ bg: '#FBF8F4' }}>
      <Navbar />
      <HeroSection />
      <FeatureCards />
      <ShowcaseGallery />
      <Footer />
      <ChatBot />
    </Box>
  );
};

export default LandingPage;
