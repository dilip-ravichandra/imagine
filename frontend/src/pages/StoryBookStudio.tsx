import React, { useState } from 'react';
import {
  Box,
  Flex,
  Text,
  Heading,
  Button,
  Input,
  Select,
  Image,
  HStack,
  IconButton,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Tooltip,
} from '@chakra-ui/react';
import {
  FiBookOpen,
  FiMic,
  FiDownload,
  FiVolume2,
  FiChevronLeft,
  FiChevronRight,
  FiLayers,
  FiArrowRight,
  FiSend,
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import WorkspaceLayout from '../components/WorkspaceLayout';
import InteractiveCanvasMask from '../components/InteractiveCanvasMask';
import { generateWithModel } from '../lib/api';

interface StoryScene {
  id: number;
  title: string;
  imagePrompt: string;
  imageUrl: string;
  narration: string;
  dialogue?: string;
  character: string;
}

const GENRES = [
  'Children Storybook (Ages 4-8)',
  'Youth Adventure (Ages 9-14)',
  'Comic Book / Graphic Novel',
  'Manga & Anime Style',
  'Sci-Fi Fantasy Epic',
];

const ART_STYLES = [
  'Pixar 3D Animation',
  'Classic Watercolor',
  'Modern Comic Strip',
  'Retro Manga Ink',
  'Vintage Children Illustration',
  'Oil Painting Fantasy',
];

const LANGUAGES = [
  { code: 'hi', name: 'Hindi (हिंदी)', sample: 'एक दयालु भालू जो जंगल के सारे जानवरों की मदद करता है और अपनी शहद की दुकान खोलता है' },
  { code: 'es', name: 'Spanish (Español)', sample: 'Un joven astrónomo que descubre un planeta hecho de cristal y música' },
  { code: 'fr', name: 'French (Français)', sample: 'Deux petits chats courageux qui partent à la recherche d\'un trésor secret' },
  { code: 'en', name: 'English', sample: 'A friendly little robot who rescues a lost kitten in a neon city and learns what family means' },
  { code: 'ja', name: 'Japanese (日本語)', sample: '雲の上に住むドラゴンの子どもと空飛ぶクジラの冒険物語' },
];

const INITIAL_SCENES: StoryScene[] = [
  {
    id: 1,
    title: 'Scene 1: The Waking City',
    imagePrompt: 'A friendly little brass robot named Bolt rolling through a gleaming sunlit futuristic city with solar trees, Pixar 3D style',
    imageUrl: 'https://picsum.photos/seed/story-scene1/600/400',
    narration: 'In a city made of sunlight and glass, lived a little robot named Bolt. Every morning, Bolt polished his silver gears and rolled out to explore the bustling avenues.',
    dialogue: 'Bolt: "Another beautiful day for new discoveries!"',
    character: 'Bolt the Robot',
  },
  {
    id: 2,
    title: 'Scene 2: A Tiny Surprise',
    imagePrompt: 'Bolt peering behind a green recycle container and discovering a small shivering orange kitten, soft cinematic lighting',
    imageUrl: 'https://picsum.photos/seed/story-scene2/600/400',
    narration: 'Behind a solar charging post, Bolt heard a soft sound: "Meow!" Cuddled inside an old cardboard box was a tiny calico kitten, looking up with curious emerald eyes.',
    dialogue: 'Bolt: "Beep! You have fur and no batteries... are you lost?"',
    character: 'Bolt & Spark',
  },
  {
    id: 3,
    title: 'Scene 3: The Rain & Shelter',
    imagePrompt: 'Bolt holding an umbrella over the kitten as colorful neon rain falls on the futuristic sidewalk, warm heart-warming lighting',
    imageUrl: 'https://picsum.photos/seed/story-scene3/600/400',
    narration: 'When neon raindrops began to sprinkle from the clouds, Bolt gently scooped the kitten into his arms and popped open his built-in umbrella dome.',
    dialogue: 'Spark: "*Purrrr...*"',
    character: 'Bolt & Spark',
  },
  {
    id: 4,
    title: 'Scene 4: True Friendship',
    imagePrompt: 'Bolt and the kitten sitting together on a high rooftop terrace watching shooting stars and glowing auroras above the city',
    imageUrl: 'https://picsum.photos/seed/story-scene4/600/400',
    narration: 'Together on the high rooftop, Bolt and his new friend Spark watched the stars shimmer. Bolt learned that the greatest circuits in the universe are the ones that feel friendship.',
    dialogue: 'Bolt: "You and me, Spark. Best friends in the whole galaxy."',
    character: 'Bolt & Spark',
  },
];

const StoryBookStudio: React.FC = () => {
  const [genre, setGenre] = useState(GENRES[0]);
  const [artStyle, setArtStyle] = useState(ART_STYLES[0]);
  const [storyIdea, setStoryIdea] = useState(
    'A friendly little brass robot named Bolt discovers a lost kitten in a futuristic eco-city, protecting it from the rain and learning the true meaning of friendship.'
  );

  // ALL SCENES (ARCHIVED IN STORY REEL / GALLERY)
  const [scenes, setScenes] = useState<StoryScene[]>(INITIAL_SCENES);
  // THE ONE ACTIVE SCENE GENERATOR VIEW
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);

  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [storyModel, setStoryModel] = useState<'sd_turbo' | 'sd15_optimized'>('sd_turbo');
  const [storyError, setStoryError] = useState<string | null>(null);

  // Selective Scene Recreator Modal
  const [isRecreating, setIsRecreating] = useState(false);
  const [recreatePromptChange, setRecreatePromptChange] = useState('');
  const [isRegeneratingPanel, setIsRegeneratingPanel] = useState(false);

  // Voice Translation Modal
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [spokenStory, setSpokenStory] = useState(LANGUAGES[0].sample);
  const [translatedStoryPlot, setTranslatedStoryPlot] = useState(
    'A kind-hearted bear who helps all forest creatures with his handmade honey bakery, teaching teamwork and generosity.'
  );

  const [readingSceneId, setReadingSceneId] = useState<number | null>(null);

  const activeScene = scenes[activeSceneIndex] || scenes[0];

  // Handle Full Story Generation
  const handleGenerateStory = async () => {
    if (!storyIdea.trim()) return;
    setIsGeneratingStory(true);
    setStoryError(null);
    try {
      const scenePrompts = [
        `${storyIdea} - Opening scene, ${artStyle}, establish the world and main character`,
        `${storyIdea} - Rising action, ${artStyle}, show the first challenge`,
        `${storyIdea} - Climax, ${artStyle}, emotional turning point and decisive action`,
        `${storyIdea} - Ending, ${artStyle}, warm hopeful resolution`,
      ];
      const sceneText = [
        {
          title: 'Scene 1: The Beginning',
          narration: `Once upon a time in a vibrant world, the story begins: ${storyIdea.slice(0, 90)}...`,
          dialogue: 'Hero: "Our journey starts today!"',
          character: 'Main Character',
        },
        {
          title: 'Scene 2: The Adventure Unfolds',
          narration: 'As obstacles appeared along the path, unexpected companions joined hands to solve the mystery.',
          dialogue: 'Companion: "Look ahead, there is light beyond the misty horizon!"',
          character: 'Companion',
        },
        {
          title: 'Scene 3: The Climax',
          narration: 'Facing the greatest challenge of all, kindness and courage turned darkness into radiant joy.',
          dialogue: 'All: "Together we can accomplish anything!"',
          character: 'Heroes Together',
        },
        {
          title: 'Scene 4: The Happy Ending',
          narration: 'And from that memorable day forward, joy echoed across the kingdom. The end.',
          dialogue: 'Narrator: "A journey remembered for generations."',
          character: 'Happy Ensemble',
        },
      ];
      const generated: StoryScene[] = [];
      for (let index = 0; index < scenePrompts.length; index += 1) {
        const result = await generateWithModel({
          prompt: scenePrompts[index],
          modelChoice: storyModel,
          resolution: 512,
          steps: storyModel === 'sd15_optimized' ? 8 : 2,
        });
        generated.push({
          id: index + 1,
          title: sceneText[index].title,
          imagePrompt: scenePrompts[index],
          imageUrl: result.image_url,
          narration: sceneText[index].narration,
          dialogue: sceneText[index].dialogue,
          character: sceneText[index].character,
        });
      }
      setScenes(generated);
      setActiveSceneIndex(0);
    } catch (error) {
      setStoryError(error instanceof Error ? error.message : 'Unable to generate the storyboard.');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  // Open Selective Recreate
  const handleOpenRecreate = () => {
    setRecreatePromptChange('Make the lighting dramatic golden hour, with playful sparks floating around');
    setIsRecreating(true);
  };

  // Apply Selective Recreation to the active scene
  const handleApplySceneRecreation = async () => {
    setIsRegeneratingPanel(true);
    try {
      const result = await generateWithModel({
        prompt: `${activeScene.imagePrompt}, ${recreatePromptChange}`,
        modelChoice: storyModel,
        resolution: 512,
        steps: storyModel === 'sd15_optimized' ? 8 : 2,
      });
      setScenes((prev) =>
        prev.map((s, idx) =>
          idx === activeSceneIndex
            ? {
                ...s,
                imageUrl: result.image_url,
                imagePrompt: `${s.imagePrompt} [Recreated: ${recreatePromptChange}]`,
              }
            : s
        )
      );
      setIsRegeneratingPanel(false);
      setIsRecreating(false);
    } catch (error) {
      setStoryError(error instanceof Error ? error.message : 'Unable to recreate this scene.');
    } finally {
      setIsRegeneratingPanel(false);
    }
  };

  // Voice Dictation handler
  const handleToggleVoice = () => {
    if (!isRecording) {
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        setSpokenStory(selectedLang.sample);
        setTranslatedStoryPlot(
          `An enchanting illustrated tale about: ${selectedLang.sample}, filled with whimsical wonder, teamwork, and colorful scenes.`
        );
      }, 2000);
    } else {
      setIsRecording(false);
    }
  };

  const handleApplyVoiceStory = () => {
    setStoryIdea(translatedStoryPlot);
    setIsVoiceModalOpen(false);
  };

  const handleReadAloud = (sceneId: number) => {
    setReadingSceneId(sceneId);
    setTimeout(() => {
      setReadingSceneId(null);
    }, 3000);
  };

  return (
    <WorkspaceLayout>
      <Box p={{ base: 4, md: 6 }} minH="100vh" bg="#080B0A">
        {/* Top Header & Presets Bar */}
        <Box bg="#111713" border="1px solid #2A3A2C" borderRadius="16px" p={4} mb={5}>
          <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={3}>
            <Flex align="center" gap={3}>
              <Box
                w="36px"
                h="36px"
                borderRadius="10px"
                bg="#B7FF35"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize="18px"
                color="#080B0A"
              >
                📖
              </Box>
              <Box>
                <Flex align="center" gap={2}>
                  <Heading size="sm" color="#F4F7F0" fontWeight="700">
                    Storybook & Comic Studio
                  </Heading>
                  <Badge bg="rgba(183, 255, 53, 0.15)" color="#B7FF35" px={2} py={0.5} borderRadius="full" fontSize="10px">
                    Scene Generator
                  </Badge>
                </Flex>
                <Text color="#A5B1A7" fontSize="xs">
                  Crafting Scene {activeSceneIndex + 1} of {scenes.length} · All story pages saved to Gallery
                </Text>
                {storyError && (
                  <Text color="#FF8A80" fontSize="xs" mt={1}>
                    {storyError}
                  </Text>
                )}
              </Box>
            </Flex>

            <Flex align="center" gap={2.5}>
              <Select
                size="sm"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                bg="#0F1A11"
                color="#F4F7F0"
                border="1px solid #2A3A2C"
                borderRadius="8px"
                w={{ base: 'full', sm: '190px' }}
              >
                {GENRES.map((g) => (
                  <option key={g} value={g} style={{ background: '#111713' }}>
                    {g}
                  </option>
                ))}
              </Select>

              <Select
                size="sm"
                value={artStyle}
                onChange={(e) => setArtStyle(e.target.value)}
                bg="#0F1A11"
                color="#F4F7F0"
                border="1px solid #2A3A2C"
                borderRadius="8px"
                w={{ base: 'full', sm: '170px' }}
              >
                {ART_STYLES.map((a) => (
                  <option key={a} value={a} style={{ background: '#111713' }}>
                    {a}
                  </option>
                ))}
              </Select>

              <Select
                size="sm"
                value={storyModel}
                onChange={(e) => setStoryModel(e.target.value as 'sd_turbo' | 'sd15_optimized')}
                bg="#0F1A11"
                color="#F4F7F0"
                border="1px solid #2A3A2C"
                borderRadius="8px"
                w={{ base: 'full', sm: '170px' }}
              >
                <option value="sd_turbo" style={{ background: '#111713' }}>SD-Turbo Storyboard</option>
                <option value="sd15_optimized" style={{ background: '#111713' }}>SD 1.5 Optimized</option>
              </Select>

              <Button
                as={Link}
                to="/gallery"
                size="sm"
                variant="outline"
                borderColor="#2A3A2C"
                color="#A5B1A7"
                _hover={{ color: '#B7FF35', borderColor: '#B7FF35' }}
                leftIcon={<FiLayers />}
              >
                Gallery ({scenes.length} Scenes)
              </Button>
            </Flex>
          </Flex>
        </Box>

        {/* MAIN STAGE: THE ONE ACTIVE SCENE GENERATOR */}
        <Box maxW="960px" mx="auto" mb={4}>
          <Box
            bg="#111713"
            border="1px solid #2A3A2C"
            borderRadius="18px"
            p={5}
            boxShadow="0 12px 40px rgba(0,0,0,0.6)"
          >
            {/* Active Scene Header */}
            <Flex justify="space-between" align="center" mb={3} pb={2} borderBottom="1px solid #1A2A1C">
              <Flex align="center" gap={2.5}>
                <Badge bg="rgba(183, 255, 53, 0.15)" color="#B7FF35" px={2.5} py={1} borderRadius="6px" fontSize="11px">
                  Active Scene {activeSceneIndex + 1}
                </Badge>
                <Heading size="xs" color="#F4F7F0">
                  {activeScene.title}
                </Heading>
              </Flex>

              <HStack spacing={2}>
                {/* Selective Inpaint Recreate button */}
                <Button
                  size="xs"
                  bg="rgba(183, 255, 53, 0.15)"
                  color="#B7FF35"
                  border="1px solid rgba(183, 255, 53, 0.35)"
                  _hover={{ bg: '#B7FF35', color: '#080B0A' }}
                  leftIcon={<Text>⭕</Text>}
                  onClick={handleOpenRecreate}
                  fontWeight="bold"
                >
                  Selective Recreate (Circle Area)
                </Button>

                {/* Read aloud */}
                <Tooltip label="Read narration aloud">
                  <IconButton
                    aria-label="Read aloud"
                    icon={<FiVolume2 size={13} />}
                    size="xs"
                    bg="#182019"
                    color={readingSceneId === activeScene.id ? '#B7FF35' : '#A5B1A7'}
                    _hover={{ color: '#F4F7F0' }}
                    onClick={() => handleReadAloud(activeScene.id)}
                  />
                </Tooltip>

                {/* Download */}
                <Button
                  as="a"
                  href={activeScene.imageUrl}
                  download={`scene-${activeScene.id}.png`}
                  target="_blank"
                  size="xs"
                  variant="ghost"
                  color="#A5B1A7"
                  leftIcon={<FiDownload />}
                >
                  Save
                </Button>
              </HStack>
            </Flex>

            {/* Active Scene Artwork View */}
            <Box
              position="relative"
              borderRadius="12px"
              overflow="hidden"
              border="1px solid #2A3A2C"
              bg="#080B0A"
              maxH="440px"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {isGeneratingStory ? (
                <Flex direction="column" align="center" justify="center" p={12} gap={2}>
                  <Text fontSize="24px" animation="spin 1.5s linear infinite">✦</Text>
                  <Text fontSize="xs" color="#B7FF35">Generating Scene Illustrations...</Text>
                </Flex>
              ) : (
                <Image
                  src={activeScene.imageUrl}
                  alt={activeScene.title}
                  w="100%"
                  maxH="440px"
                  objectFit="contain"
                />
              )}

              {/* Comic Dialogue Balloon */}
              {activeScene.dialogue && (
                <Box
                  position="absolute"
                  bottom={3}
                  left={3}
                  right={3}
                  bg="rgba(17, 23, 19, 0.9)"
                  border="1px solid #B7FF35"
                  borderRadius="10px"
                  p={2.5}
                  backdropFilter="blur(8px)"
                >
                  <Text fontSize="xs" color="#F4F7F0" fontWeight="600" fontStyle="italic">
                    💬 {activeScene.dialogue}
                  </Text>
                </Box>
              )}
            </Box>

            {/* Active Scene Narration Card */}
            <Box p={3.5} mt={3} bg="#0D120E" border="1px solid #2A3A2C" borderRadius="10px">
              <Text fontSize="xs" color="#A5B1A7" lineHeight="1.7">
                {activeScene.narration}
              </Text>
            </Box>

            {/* Scene Stepper Buttons */}
            <Flex justify="space-between" align="center" mt={3} pt={2}>
              <Button
                size="xs"
                variant="ghost"
                color="#A5B1A7"
                isDisabled={activeSceneIndex === 0}
                onClick={() => setActiveSceneIndex((prev) => Math.max(0, prev - 1))}
                leftIcon={<FiChevronLeft />}
              >
                Previous Scene
              </Button>

              <Text fontSize="11px" color="#6B7B6D">
                Character: <span style={{ color: '#F4F7F0' }}>{activeScene.character}</span> · Consistent Style
              </Text>

              <Button
                size="xs"
                variant="ghost"
                color="#A5B1A7"
                isDisabled={activeSceneIndex === scenes.length - 1}
                onClick={() => setActiveSceneIndex((prev) => Math.min(scenes.length - 1, prev + 1))}
                rightIcon={<FiChevronRight />}
              >
                Next Scene
              </Button>
            </Flex>
          </Box>

          {/* STORYBOARD FILMSTRIP (REST ARCHIVED IN GALLERY) */}
          <Box mt={4} p={3.5} bg="#111713" border="1px solid #2A3A2C" borderRadius="14px">
            <Flex justify="space-between" align="center" mb={2}>
              <Flex align="center" gap={2}>
                <Text fontSize="xs" color="#A5B1A7" fontWeight="bold" textTransform="uppercase" letterSpacing="0.05em">
                  Storybook Scenes in Gallery
                </Text>
                <Badge bg="#182019" color="#8DDB39" fontSize="10px">
                  {scenes.length} Panels
                </Badge>
              </Flex>

              <Button
                as={Link}
                to="/gallery"
                size="xs"
                variant="ghost"
                color="#B7FF35"
                rightIcon={<FiArrowRight />}
              >
                Open Gallery
              </Button>
            </Flex>

            {/* Thumbnails row */}
            <Flex gap={3} overflowX="auto" pb={1}>
              {scenes.map((scene, idx) => {
                const isSelected = idx === activeSceneIndex;
                return (
                  <Box
                    key={scene.id}
                    position="relative"
                    w="96px"
                    h="68px"
                    flexShrink={0}
                    borderRadius="8px"
                    overflow="hidden"
                    border="2px solid"
                    borderColor={isSelected ? '#B7FF35' : '#2A3A2C'}
                    cursor="pointer"
                    _hover={{ borderColor: '#B7FF35', transform: 'scale(1.04)' }}
                    transition="all 0.2s ease"
                    onClick={() => setActiveSceneIndex(idx)}
                  >
                    <Image src={scene.imageUrl} alt={scene.title} w="100%" h="100%" objectFit="cover" />
                    <Box
                      position="absolute"
                      top={1}
                      left={1}
                      bg="rgba(0,0,0,0.75)"
                      color={isSelected ? '#B7FF35' : '#F4F7F0'}
                      fontSize="9px"
                      px={1}
                      borderRadius="3px"
                      fontWeight="bold"
                    >
                      P{idx + 1}
                    </Box>
                  </Box>
                );
              })}
            </Flex>
          </Box>
        </Box>

        {/* BOTTOM STORY PROMPT DOCK */}
        <Box
          position="fixed"
          bottom="20px"
          left={{ base: '20px', md: '240px' }}
          right="96px"
          zIndex={90}
          bg="#0D120E"
          border="1px solid #3A4A3C"
          borderRadius="18px"
          p={3}
          boxShadow="0 12px 48px rgba(0,0,0,0.8), 0 0 30px rgba(183,255,53,0.15)"
        >
          <Flex align="center" gap={2}>
            {/* Voice Dictation button */}
            <Tooltip label="Dictate story in any language (Hindi, Spanish, French, etc.)">
              <IconButton
                aria-label="Voice input"
                icon={<FiMic size={18} />}
                variant="ghost"
                color="#A5B1A7"
                _hover={{ color: '#B7FF35', bg: '#182019' }}
                borderRadius="10px"
                onClick={() => setIsVoiceModalOpen(true)}
              />
            </Tooltip>

            {/* Story Plot input */}
            <Input
              value={storyIdea}
              onChange={(e) => setStoryIdea(e.target.value)}
              placeholder="Describe your story idea or dictation... (Press Enter to generate scenes)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleGenerateStory();
                }
              }}
              variant="unstyled"
              color="#F4F7F0"
              fontSize="sm"
              _placeholder={{ color: '#6B7B6D' }}
              px={2}
              flex={1}
            />

            <Button
              bg="#B7FF35"
              color="#080B0A"
              fontWeight="700"
              fontSize="sm"
              borderRadius="12px"
              px={5}
              h="40px"
              _hover={{ bg: '#8DDB39' }}
              onClick={handleGenerateStory}
              isLoading={isGeneratingStory}
              rightIcon={<FiSend size={13} />}
            >
              Generate Scenes
            </Button>
          </Flex>
        </Box>

        {/* SELECTIVE PANEL RECREATOR MODAL WITH CANVAS CIRCLING */}
        <Modal isOpen={isRecreating} onClose={() => setIsRecreating(false)} isCentered size="2xl">
          <ModalOverlay bg="rgba(0,0,0,0.88)" backdropFilter="blur(8px)" />
          <ModalContent bg="#111713" border="1px solid #2A3A2C" borderRadius="20px" color="#F4F7F0" maxW="700px">
            <ModalHeader borderBottom="1px solid #1A2A1C" py={4}>
              <Flex align="center" gap={2}>
                <Box w="28px" h="28px" borderRadius="full" bg="#B7FF35" display="flex" alignItems="center" justifyContent="center" color="#080B0A" fontSize="14px">
                  ⭕
                </Box>
                <Box>
                  <Text fontSize="md" fontWeight="bold">
                    Selective Panel Recreate — Circle Region
                  </Text>
                  <Text fontSize="xs" color="#A5B1A7" fontWeight="normal">
                    Circle or brush the exact part of the comic panel you want to alter
                  </Text>
                </Box>
              </Flex>
            </ModalHeader>
            <ModalCloseButton color="#A5B1A7" />

            <ModalBody py={4}>
              <Box mb={4}>
                <InteractiveCanvasMask imageUrl={activeScene.imageUrl} />
              </Box>

              <Box mb={3}>
                <Text fontSize="xs" color="#A5B1A7" fontWeight="600" mb={1.5} textTransform="uppercase">
                  What should appear in the circled area?
                </Text>
                <Input
                  value={recreatePromptChange}
                  onChange={(e) => setRecreatePromptChange(e.target.value)}
                  placeholder="e.g. Change expression to joyful laughter, add rainbow sparkles"
                  bg="#0F1A11"
                  color="#F4F7F0"
                  border="1px solid #2A3A2C"
                  borderRadius="10px"
                  size="sm"
                  _focus={{ borderColor: '#B7FF35' }}
                />
              </Box>
            </ModalBody>

            <ModalFooter borderTop="1px solid #1A2A1C" py={3}>
              <Button size="sm" variant="ghost" color="#A5B1A7" mr={3} onClick={() => setIsRecreating(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                bg="#B7FF35"
                color="#080B0A"
                fontWeight="bold"
                onClick={handleApplySceneRecreation}
                isLoading={isRegeneratingPanel}
                leftIcon={<Text>✨</Text>}
              >
                Recreate Circled Area
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* VOICE DICTATION & TRANSLATION MODAL */}
        <Modal isOpen={isVoiceModalOpen} onClose={() => setIsVoiceModalOpen(false)} isCentered size="lg">
          <ModalOverlay bg="rgba(0,0,0,0.85)" backdropFilter="blur(6px)" />
          <ModalContent bg="#111713" border="1px solid #2A3A2C" borderRadius="18px" color="#F4F7F0">
            <ModalHeader borderBottom="1px solid #1A2A1C" py={4}>
              <Flex align="center" gap={2}>
                <Box w="28px" h="28px" borderRadius="full" bg="#B7FF35" display="flex" alignItems="center" justifyContent="center" color="#080B0A" fontSize="14px">
                  🎤
                </Box>
                <Text fontSize="md" fontWeight="bold">
                  Story Voice Dictator & Translator
                </Text>
              </Flex>
            </ModalHeader>
            <ModalCloseButton color="#A5B1A7" />

            <ModalBody py={5}>
              <Text fontSize="xs" color="#A5B1A7" mb={4}>
                Tell your story verbally in your mother tongue! The voice translator converts it into a multi-scene plotline ready for generation.
              </Text>

              <Box mb={4}>
                <Text fontSize="xs" color="#6B7B6D" mb={1.5} textTransform="uppercase">
                  Select Speaking Language
                </Text>
                <Select
                  value={selectedLang.code}
                  onChange={(e) => {
                    const l = LANGUAGES.find((item) => item.code === e.target.value) || LANGUAGES[0];
                    setSelectedLang(l);
                    setSpokenStory(l.sample);
                  }}
                  bg="#0F1A11"
                  color="#F4F7F0"
                  border="1px solid #2A3A2C"
                  borderRadius="10px"
                  size="sm"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} style={{ background: '#111713' }}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Box>

              <Flex direction="column" align="center" py={4}>
                <Box
                  w="70px"
                  h="70px"
                  borderRadius="full"
                  bg={isRecording ? '#FF4444' : '#182019'}
                  border="2px solid"
                  borderColor={isRecording ? '#FF4444' : '#B7FF35'}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  cursor="pointer"
                  onClick={handleToggleVoice}
                  boxShadow={isRecording ? '0 0 25px rgba(255,68,68,0.5)' : '0 0 20px rgba(183,255,53,0.3)'}
                >
                  <FiMic size={28} color={isRecording ? '#F4F7F0' : '#B7FF35'} />
                </Box>
                <Text fontSize="xs" color={isRecording ? '#FF4444' : '#B7FF35'} fontWeight="600" mt={2}>
                  {isRecording ? 'Recording your voice...' : 'Tap to narrate your story'}
                </Text>
              </Flex>

              <Box bg="#0D120E" p={4} borderRadius="12px" border="1px solid #2A3A2C">
                <Text fontSize="10px" color="#6B7B6D" textTransform="uppercase" fontWeight="bold">
                  Transcribed ({selectedLang.name})
                </Text>
                <Text fontSize="xs" color="#F4F7F0" mt={1}>
                  "{spokenStory}"
                </Text>
                <Box h="1px" bg="#1A2A1C" my={2.5} />
                <Text fontSize="10px" color="#8DDB39" textTransform="uppercase" fontWeight="bold">
                  ✨ Translated Story Concept
                </Text>
                <Text fontSize="xs" color="#B7FF35" mt={1}>
                  {translatedStoryPlot}
                </Text>
              </Box>
            </ModalBody>

            <ModalFooter borderTop="1px solid #1A2A1C" py={3}>
              <Button size="sm" variant="ghost" color="#A5B1A7" mr={3} onClick={() => setIsVoiceModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" bg="#B7FF35" color="#080B0A" fontWeight="bold" onClick={handleApplyVoiceStory}>
                Use As Story Plot
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
    </WorkspaceLayout>
  );
};

export default StoryBookStudio;
