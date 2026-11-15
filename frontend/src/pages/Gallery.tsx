import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Flex,
  Text,
  Heading,
  Button,
  Input,
  Grid,
  GridItem,
  InputGroup,
  InputLeftElement,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  HStack,
  IconButton,
  Spinner,
  Tooltip,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { FiTrash2 } from 'react-icons/fi';
import WorkspaceLayout from '../components/WorkspaceLayout';
import {
  getGalleryItems,
  updateGalleryItem,
  deleteGalleryItem,
  GalleryItem,
  toSameOriginImageUrl,
} from '../lib/api';

const SearchIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B6277" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const HeartIcon: React.FC<{ filled?: boolean }> = ({ filled }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? '#E5484D' : 'none'} stroke={filled ? '#E5484D' : '#1E2233'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const DownloadIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E2233" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const TABS = ['Everything', 'Images', 'Storybook', 'Edited', 'Favorites'];

const FRIENDLY_MODEL: Record<string, string> = {
  sd_turbo: 'Fastest', sd15_optimized: 'Fast and detailed', imagineai_lcm: 'ImagineAI model', sd15_baseline: 'Highest detail',
  sd15_adapted: 'Everyday photos', editor: 'Photo editor',
};
const friendlyModel = (m: string) => FRIENDLY_MODEL[m] || m;

const Gallery: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Everything');
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspectImage, setInspectImage] = useState<GalleryItem | null>(null);

  const navigate = useNavigate();

  const loadGallery = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let category: string | undefined = undefined;
      let favoritesOnly = false;

      if (activeTab === 'Images') category = 'single';
      else if (activeTab === 'Storybook') category = 'storybook';
      else if (activeTab === 'Edited') category = 'inpaint';
      else if (activeTab === 'Favorites') favoritesOnly = true;

      const res = await getGalleryItems({
        category,
        favoritesOnly,
        search: searchQuery.trim() || undefined,
      });
      setItems(res.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gallery items.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  const toggleLike = async (item: GalleryItem) => {
    const newLiked = !item.liked;
    // Optimistic UI update
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, liked: newLiked } : it))
    );
    if (inspectImage && inspectImage.id === item.id) {
      setInspectImage({ ...inspectImage, liked: newLiked });
    }
    try {
      await updateGalleryItem(item.id, { liked: newLiked });
    } catch (err) {
      // Revert on error
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, liked: item.liked } : it))
      );
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      await deleteGalleryItem(itemId);
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      if (inspectImage && inspectImage.id === itemId) {
        setInspectImage(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  const handleDownload = async (item: GalleryItem) => {
    try {
      const sameOriginUrl = toSameOriginImageUrl(item.image_url);
      const res = await fetch(sameOriginUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `imagineai-${item.category}-${item.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(item.image_url, '_blank');
    }
  };

  const getCategoryLabel = (category: string) => {
    if (category === 'inpaint') return 'Edited';
    if (category === 'storybook') return 'Storybook';
    return 'Image';
  };

  return (
    <WorkspaceLayout>
      <Box p={{ base: 4, md: 8 }} minH="100vh" bg="#FBF8F4">
        <Box maxW="1360px" mx="auto" w="100%">
        {/* Header */}
        <Flex align="center" justify="space-between" mb={6} wrap="wrap" gap={3}>
          <Box>
            <Flex align="center" gap={2.5}>
              <Heading size="lg" color="#1E2233" fontWeight={700}>
                My gallery
              </Heading>
              <Badge bg="rgba(91,91,240, 0.15)" color="#5B5BF0" px={2.5} py={0.5} borderRadius="full" fontSize="11px">
                {items.length} saved
              </Badge>
            </Flex>
            <Text color="#5B6277" mt={1} fontSize="sm">
              Everything you have made: images, storybook pages and edited photos.
            </Text>
          </Box>

          <Button
            bg="#5B5BF0"
            color="#FFFFFF"
            fontWeight="bold"
            size="sm"
            onClick={() => navigate('/create')}
            leftIcon={<Text>🎨</Text>}
          >
            Create new
          </Button>
        </Flex>

        {/* Tabs */}
        <Flex gap={2} mb={6} overflowX="auto" pb={1}>
          {TABS.map((tab) => (
            <Button
              key={tab}
              onClick={() => setActiveTab(tab)}
              bg={activeTab === tab ? '#5B5BF0' : '#FFFFFF'}
              color={activeTab === tab ? '#FBF8F4' : '#5B6277'}
              border="1px solid"
              borderColor={activeTab === tab ? '#5B5BF0' : '#E3DACF'}
              borderRadius="10px"
              px={5}
              py={2}
              fontWeight={600}
              fontSize="sm"
              _hover={{
                bg: activeTab === tab ? '#4747DB' : '#EFE8DF',
                color: activeTab === tab ? '#FBF8F4' : '#1E2233',
              }}
              transition="all 0.2s"
              flexShrink={0}
            >
              {tab}
            </Button>
          ))}
        </Flex>

        {/* Search Bar */}
        <Flex gap={3} mb={8}>
          <InputGroup maxW="450px">
            <InputLeftElement pointerEvents="none" pt={1}>
              <SearchIcon />
            </InputLeftElement>
            <Input
              placeholder="Search prompts, styles, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              bg="#F7F3EE"
              color="#1E2233"
              border="1px solid #E3DACF"
              borderRadius="10px"
              pl={10}
              _placeholder={{ color: '#8A90A2' }}
              _focus={{ borderColor: '#5B5BF0' }}
            />
          </InputGroup>
        </Flex>

        {error && (
          <Box mb={6} p={4} borderRadius="10px" bg="rgba(229,72,77, 0.15)" border="1px solid #E5484D" color="#E5484D" fontSize="sm">
            {error}
          </Box>
        )}

        {/* Image Grid */}
        {loading ? (
          <Flex justify="center" align="center" py={20}>
            <Spinner color="#5B5BF0" size="xl" />
          </Flex>
        ) : items.length > 0 ? (
          <Grid templateColumns="repeat(auto-fill, minmax(280px, 1fr))" gap={5} mb={8}>
            {items.map((img) => (
              <GridItem key={img.id}>
                <Box
                  bg="#FFFFFF"
                  borderRadius="14px"
                  border="1px solid #E3DACF"
                  overflow="hidden"
                  transition="all 0.25s ease"
                  _hover={{
                    borderColor: '#5B5BF0',
                    transform: 'translateY(-3px)',
                    boxShadow: '0 12px 40px rgba(30,34,51,0.12)',
                  }}
                  cursor="pointer"
                  onClick={() => setInspectImage(img)}
                >
                  {/* Image Container */}
                  <Box position="relative" overflow="hidden" bg="#FBF8F4">
                    <Box
                      as="img"
                      src={toSameOriginImageUrl(img.image_url)}
                      alt={img.prompt}
                      w="100%"
                      h="220px"
                      objectFit="cover"
                      transition="transform 0.4s ease"
                    />

                    {/* Category Tag */}
                    <Box position="absolute" top={2.5} left={2.5}>
                      <Badge bg="rgba(251,248,244,0.85)" color={img.category === 'inpaint' ? '#5B5BF0' : '#1E2233'} fontSize="10px" px={2} py={0.5} borderRadius="4px">
                        {getCategoryLabel(img.category)}
                      </Badge>
                    </Box>

                    {/* Action buttons top right */}
                    <HStack position="absolute" top={2.5} right={2.5} spacing={1.5}>
                      <Box
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(img);
                        }}
                        p={1.5}
                        borderRadius="full"
                        bg="rgba(0,0,0,0.6)"
                        _hover={{ bg: 'rgba(30,34,51,0.55)' }}
                      >
                        <HeartIcon filled={img.liked} />
                      </Box>
                      <Tooltip label="Delete image">
                        <IconButton
                          aria-label="Delete"
                          icon={<FiTrash2 size={13} />}
                          size="xs"
                          variant="ghost"
                          color="#E5484D"
                          bg="rgba(0,0,0,0.6)"
                          _hover={{ bg: 'rgba(255,0,0,0.3)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Delete this image from gallery?')) {
                              handleDelete(img.id);
                            }
                          }}
                        />
                      </Tooltip>
                    </HStack>
                  </Box>

                  {/* Card Content */}
                  <Box p={3.5}>
                    <Text color="#1E2233" fontSize="xs" fontWeight="500" noOfLines={2} mb={2}>
                      {img.prompt}
                    </Text>
                    {img.recreation_note && (
                      <Text fontSize="10px" color="#4747DB" mb={2} noOfLines={1}>
                        ✨ {img.recreation_note}
                      </Text>
                    )}
                    <Flex justify="space-between" align="center" pt={2} borderTop="1px solid #EFE8DF">
                      <Text fontSize="10px" color="#8A90A2">{friendlyModel(img.model)} · {img.style}</Text>
                      <Text fontSize="10px" color="#5B6277">
                        {new Date(img.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </Text>
                    </Flex>
                  </Box>
                </Box>
              </GridItem>
            ))}
          </Grid>
        ) : (
          <Box textAlign="center" py={16}>
            <Text fontSize="36px" mb={2}>🖼️</Text>
            <Text color="#5B6277" fontSize="sm">No creations found in gallery</Text>
          </Box>
        )}

        {/* LIGHTBOX / IMAGE DETAIL INSPECTOR MODAL */}
        <Modal isOpen={!!inspectImage} onClose={() => setInspectImage(null)} isCentered size="xl">
          <ModalOverlay bg="rgba(30,34,51,0.55)" backdropFilter="blur(8px)" />
          <ModalContent bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="18px" color="#1E2233">
            <ModalHeader borderBottom="1px solid #EFE8DF" py={3.5}>
              <Flex align="center" justify="space-between">
                <HStack spacing={2}>
                  <Badge bg="rgba(91,91,240,0.15)" color="#5B5BF0" fontSize="10px" px={2} py={0.5} borderRadius="4px">
                    {inspectImage ? getCategoryLabel(inspectImage.category) : ''}
                  </Badge>
                  <Badge bg="#F5F0EA" color="#5B6277" fontSize="10px">
                    {inspectImage?.width} × {inspectImage?.height}
                  </Badge>
                  <Badge bg="#F5F0EA" color="#4747DB" fontSize="10px">
                    {inspectImage?.style}
                  </Badge>
                </HStack>
                <ModalCloseButton position="static" color="#5B6277" />
              </Flex>
            </ModalHeader>

            <ModalBody py={4}>
              {inspectImage && (
                <>
                  <Box borderRadius="12px" overflow="hidden" border="1px solid #E3DACF" mb={4} bg="#FBF8F4">
                    <Box
                      as="img"
                      src={toSameOriginImageUrl(inspectImage.image_url)}
                      alt={inspectImage.prompt}
                      w="100%"
                      maxH="420px"
                      objectFit="contain"
                    />
                  </Box>

                  <Text fontSize="10px" color="#8A90A2" textTransform="uppercase" fontWeight="bold" mb={1}>
                    Generation Prompt
                  </Text>
                  <Text fontSize="sm" color="#1E2233" mb={3} lineHeight="1.6">
                    {inspectImage.prompt}
                  </Text>

                  {inspectImage.recreation_note && (
                    <Box bg="#FFFFFF" p={2.5} borderRadius="8px" border="1px solid #EFE8DF" mb={3}>
                      <Text fontSize="10px" color="#4747DB" textTransform="uppercase" fontWeight="bold">
                        Recreation / Inpaint Note
                      </Text>
                      <Text fontSize="xs" color="#1E2233" mt={0.5}>
                        {inspectImage.recreation_note}
                      </Text>
                      {inspectImage.source_id && (
                        <Text fontSize="10px" color="#8A90A2" mt={1}>
                          Linked Source: {inspectImage.source_id}
                        </Text>
                      )}
                    </Box>
                  )}

                  <Flex justify="space-between" align="center" bg="#FFFFFF" p={2.5} borderRadius="8px" border="1px solid #EFE8DF">
                    <Text fontSize="xs" color="#5B6277">Model: <span style={{ color: '#1E2233' }}>{friendlyModel(inspectImage.model)}</span></Text>
                    <Text fontSize="xs" color="#5B6277">
                      Created: <span style={{ color: '#1E2233' }}>{new Date(inspectImage.timestamp).toLocaleString()}</span>
                    </Text>
                  </Flex>
                </>
              )}
            </ModalBody>

            <ModalFooter borderTop="1px solid #EFE8DF" py={3} justify="space-between">
              <HStack spacing={2}>
                <Button
                  size="sm"
                  bg="#5B5BF0"
                  color="#FFFFFF"
                  fontWeight="bold"
                  leftIcon={<Text>🎨</Text>}
                  onClick={() => {
                    navigate('/create');
                    setInspectImage(null);
                  }}
                >
                  Remix in Generator
                </Button>
                {inspectImage && (
                  <Button
                    size="sm"
                    variant="outline"
                    borderColor="#E3DACF"
                    color="#1E2233"
                    leftIcon={<DownloadIcon />}
                    onClick={() => handleDownload(inspectImage)}
                  >
                    Download Image
                  </Button>
                )}
              </HStack>

              <Button size="sm" variant="ghost" color="#5B6277" onClick={() => setInspectImage(null)}>
                Close
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
        </Box>
      </Box>
    </WorkspaceLayout>
  );
};

export default Gallery;
