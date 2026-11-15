import React, { useState, useMemo } from 'react';
import {
  Box,
  Flex,
  Text,
  Heading,
  Button,
  Input,
  InputGroup,
  InputLeftElement,
  HStack,
  Image,
  SimpleGrid,
} from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import ChatBot from '../components/ChatBot';

import { showcaseAt } from '../lib/showcase';
const NAV_LINKS = ['Home', 'Features', 'Explore', 'Pricing'];

const CATEGORIES = [
  'All',
  'Realistic',
  'Cartoon',
  '3D',
  'Anime',
  'Sketch',
  'Fantasy',
  'Education',
];

interface GalleryItem {
  id: number;
  title: string;
  category: string;
  w: number;
  h: number;
}

const GALLERY_ITEMS: GalleryItem[] = [
  { id: 1, title: 'Mountain Sunrise', category: 'Realistic', w: 400, h: 300 },
  { id: 2, title: 'Cyber Samurai', category: 'Anime', w: 300, h: 400 },
  { id: 3, title: 'Abstract Geometry', category: '3D', w: 400, h: 350 },
  { id: 4, title: 'Enchanted Forest', category: 'Fantasy', w: 400, h: 280 },
  { id: 5, title: 'Cartoon Robot', category: 'Cartoon', w: 300, h: 380 },
  { id: 6, title: 'Pencil Portrait', category: 'Sketch', w: 350, h: 450 },
  { id: 7, title: 'Ocean Depths', category: 'Realistic', w: 400, h: 300 },
  { id: 8, title: 'Neural Network Diagram', category: 'Education', w: 400, h: 320 },
  { id: 9, title: 'Dragon Castle', category: 'Fantasy', w: 400, h: 350 },
  { id: 10, title: 'Neon Streets', category: 'Anime', w: 350, h: 400 },
  { id: 11, title: 'Glass Sculpture', category: '3D', w: 300, h: 350 },
  { id: 12, title: 'Comic Hero', category: 'Cartoon', w: 400, h: 300 },
  { id: 13, title: 'Wildlife Safari', category: 'Realistic', w: 400, h: 280 },
  { id: 14, title: 'Charcoal Landscape', category: 'Sketch', w: 400, h: 300 },
  { id: 15, title: 'AI Architecture', category: 'Education', w: 350, h: 380 },
  { id: 16, title: 'Crystal Cavern', category: 'Fantasy', w: 400, h: 340 },
  { id: 17, title: 'Futuristic City', category: '3D', w: 400, h: 300 },
  { id: 18, title: 'Mecha Warrior', category: 'Anime', w: 300, h: 420 },
  { id: 19, title: 'Sunset Valley', category: 'Realistic', w: 400, h: 280 },
  { id: 20, title: 'Cute Animal Squad', category: 'Cartoon', w: 400, h: 350 },
  { id: 21, title: 'Ink Flowers', category: 'Sketch', w: 350, h: 400 },
  { id: 22, title: 'Data Flow Visualization', category: 'Education', w: 400, h: 300 },
  { id: 23, title: 'Floating Islands', category: 'Fantasy', w: 400, h: 360 },
  { id: 24, title: 'Chrome Spheres', category: '3D', w: 350, h: 350 },
];

const ITEMS_PER_PAGE = 12;

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B6277" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

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
      {NAV_LINKS.map((l) => {
        const isActive = l === 'Explore';
        return (
          <Link
            key={l}
            to={l === 'Home' ? '/' : l === 'Explore' ? '/explore' : '#'}
            style={{ textDecoration: 'none' }}
          >
            <Text
              fontSize="sm"
              fontWeight={isActive ? 600 : 500}
              sx={{
                color: isActive ? '#5B5BF0' : '#5B6277',
                transition: 'color 0.2s',
                _hover: { color: '#1E2233' },
              }}
            >
              {l}
            </Text>
          </Link>
        );
      })}
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

const ExplorePage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const filteredItems = useMemo(() => {
    return GALLERY_ITEMS.filter((item) => {
      const matchesCategory =
        activeCategory === 'All' || item.category === activeCategory;
      const matchesSearch =
        search.trim() === '' ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, search]);

  const displayedItems = filteredItems.slice(0, visibleCount);
  const hasMore = visibleCount < filteredItems.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  };

  // Distribute items into columns for masonry layout
  const columnCount = 3;
  const columns: GalleryItem[][] = Array.from({ length: columnCount }, () => []);
  displayedItems.forEach((item, i) => {
    columns[i % columnCount].push(item);
  });

  return (
    <Box minH="100vh" sx={{ bg: '#FBF8F4' }}>
      <Navbar />

      <Box pt="100px" px={{ base: 4, md: 10, lg: 16 }} pb={16}>
        {/* Header */}
        <Box textAlign="center" mb={8}>
          <Heading size="lg" mb={2} sx={{ color: '#1E2233', fontWeight: 700 }}>
            Explore Creations
          </Heading>
          <Text fontSize="md" sx={{ color: '#5B6277' }}>
            Discover stunning AI-generated artwork from our community
          </Text>
        </Box>

        {/* Search */}
        <Flex justify="center" mb={6}>
          <InputGroup maxW="560px">
            <InputLeftElement pointerEvents="none" h="full">
              <SearchIcon />
            </InputLeftElement>
            <Input
              placeholder="Search images, prompts or creations..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(ITEMS_PER_PAGE);
              }}
              size="md"
              borderRadius="12px"
              sx={{
                bg: '#F7F3EE',
                border: '1px solid #E3DACF',
                color: '#1E2233',
                fontSize: 'sm',
                _placeholder: { color: '#9AA0B2' },
                _hover: { borderColor: '#CFC4B6' },
                _focus: {
                  borderColor: '#5B5BF0',
                  boxShadow: '0 0 0 1px rgba(91,91,240,0.14)',
                },
                transition: 'all 0.2s',
              }}
            />
          </InputGroup>
        </Flex>

        {/* Category pills */}
        <Flex
          justify="center"
          mb={10}
          flexWrap="wrap"
          gap={2}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <Button
                key={cat}
                size="sm"
                borderRadius="full"
                onClick={() => {
                  setActiveCategory(cat);
                  setVisibleCount(ITEMS_PER_PAGE);
                }}
                sx={{
                  bg: isActive ? '#5B5BF0' : '#FFFFFF',
                  color: isActive ? '#FBF8F4' : '#5B6277',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 'xs',
                  px: 5,
                  border: isActive ? 'none' : '1px solid #E3DACF',
                  _hover: {
                    bg: isActive ? '#4747DB' : '#EFE8DF',
                    color: isActive ? '#FBF8F4' : '#1E2233',
                  },
                  transition: 'all 0.2s',
                }}
              >
                {cat}
              </Button>
            );
          })}
        </Flex>

        {/* Masonry Grid */}
        {displayedItems.length === 0 ? (
          <Flex
            direction="column"
            align="center"
            justify="center"
            py={20}
          >
            <Text fontSize="4xl" mb={3}>🔍</Text>
            <Text fontSize="lg" fontWeight={600} sx={{ color: '#1E2233' }}>
              No results found
            </Text>
            <Text fontSize="sm" sx={{ color: '#5B6277' }}>
              Try adjusting your search or category filter
            </Text>
          </Flex>
        ) : (
          <Flex
            gap={4}
            justify="center"
            direction={{ base: 'column', md: 'row' }}
            maxW="1200px"
            mx="auto"
          >
            {columns.map((col, colIdx) => (
              <Flex
                key={colIdx}
                direction="column"
                flex={1}
                gap={4}
              >
                {col.map((item) => (
                  <Box
                    key={item.id}
                    position="relative"
                    borderRadius="12px"
                    overflow="hidden"
                    sx={{
                      border: '1px solid #E3DACF',
                      bg: '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.35s ease',
                      _hover: {
                        borderColor: 'rgba(91,91,240,0.3)',
                        boxShadow: '0 12px 40px rgba(30,34,51,0.12)',
                        '& .card-overlay': { opacity: 1 },
                        '& .card-img': { transform: 'scale(1.06)' },
                      },
                    }}
                  >
                    <Box overflow="hidden">
                      <Image
                        className="card-img"
                        src={showcaseAt(item.id)}
                        alt={item.title}
                        w="100%"
                        display="block"
                        loading="lazy"
                        sx={{ transition: 'transform 0.5s ease' }}
                      />
                    </Box>
                    <Flex
                      className="card-overlay"
                      position="absolute"
                      bottom={0}
                      left={0}
                      right={0}
                      p={4}
                      direction="column"
                      justify="flex-end"
                      sx={{
                        opacity: 0,
                        transition: 'opacity 0.3s ease',
                        bgGradient:
                          'linear(to-t, rgba(251,248,244,0.92), rgba(251,248,244,0.4), transparent)',
                      }}
                    >
                      <Text
                        fontWeight={700}
                        fontSize="sm"
                        sx={{ color: '#1E2233' }}
                      >
                        {item.title}
                      </Text>
                      <HStack mt={1} spacing={2}>
                        <Text
                          fontSize="xs"
                          px={2}
                          py={0.5}
                          borderRadius="full"
                          sx={{
                            bg: 'rgba(91,91,240,0.15)',
                            color: '#5B5BF0',
                            fontWeight: 600,
                          }}
                        >
                          {item.category}
                        </Text>
                      </HStack>
                    </Flex>
                  </Box>
                ))}
              </Flex>
            ))}
          </Flex>
        )}

        {/* Load More */}
        {hasMore && (
          <Flex justify="center" mt={10}>
            <Button
              size="md"
              px={10}
              borderRadius="10px"
              onClick={handleLoadMore}
              sx={{
                bg: 'transparent',
                color: '#5B5BF0',
                border: '1px solid #5B5BF0',
                fontWeight: 600,
                _hover: {
                  bg: 'rgba(91,91,240,0.08)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 20px rgba(91,91,240,0.15)',
                },
                transition: 'all 0.25s',
              }}
            >
              Load More
            </Button>
          </Flex>
        )}
      </Box>

      {/* Footer */}
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
      <ChatBot />
    </Box>
  );
};

export default ExplorePage;
