import React, { useState, useEffect } from 'react';
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
  Progress,
  Alert,
  AlertIcon,
  CloseButton,
  Textarea,
  Collapse,
} from '@chakra-ui/react';
import {
  FiMic,
  FiDownload,
  FiVolume2,
  FiVolumeX,
  FiChevronLeft,
  FiChevronRight,
  FiLayers,
  FiArrowRight,
  FiSend,
  FiShuffle,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import WorkspaceLayout from '../components/WorkspaceLayout';
import InteractiveCanvasMask from '../components/InteractiveCanvasMask';
import {
  generateWithModel,
  generateInpaint,
  getGalleryItems,
  createGalleryItem,
  toSameOriginImageUrl,
  createStoryOutline,
  composeStoryPage,
  downloadStoryPdf,
  type StoryOutline,
  type StoryPanelIn,
  type StoryDialogue,
} from '../lib/api';

interface StoryScene {
  id: number;
  title: string;
  imagePrompt: string;
  imageUrl: string;
  narration: string;
  dialogue?: string;
  character: string;
  dialogueLines?: StoryDialogue[];
  sfx?: string | null;
  shot?: string;
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

// Story art styles -> server style ids (prompt recipe + negative prompt + classical-CV finisher)
const STYLE_FOR_ART: Record<string, string> = {
  'Pixar 3D Animation': 'Cinematic 3D',
  'Classic Watercolor': 'Watercolor',
  'Modern Comic Strip': 'Comic Book',
  'Retro Manga Ink': 'Anime & Manga',
  'Vintage Children Illustration': 'Vintage film',
  'Oil Painting Fantasy': 'Oil painting',
};

const LANGUAGES = [
  { code: 'en', name: 'English', sample: 'A friendly little robot who rescues a lost kitten in a neon city and learns what family means' },
  { code: 'hi', name: 'Hindi (हिंदी)', sample: 'एक दयालु भालू जो जंगल के सारे जानवरों की मदद करता है और अपनी शहद की दुकान खोलता है' },
  { code: 'es', name: 'Spanish (Español)', sample: 'Un joven astrónomo que descubre un planeta hecho de cristal y música' },
  { code: 'fr', name: 'French (Français)', sample: 'Deux petits chats courageux qui partent à la recherche d\'un trésor secret' },
  { code: 'ja', name: 'Japanese (日本語)', sample: '雲の上に住むドラゴンの子どもと空飛ぶクジラの冒険物語' },
];

const handleDownloadImage = async (imgUrl: string, filename = 'storybook-scene.png') => {
  try {
    const res = await fetch(toSameOriginImageUrl(imgUrl));
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(imgUrl, '_blank');
  }
};

const SAMPLE_IDEAS = [
  'A shy girl and her robot friend search a flooded city for the last working lighthouse',
  'A little fox who is afraid of the dark learns to follow the fireflies home',
  'Two rival bakers in a floating village must work together to save the harvest festival',
  'A young astronaut finds a garden growing on the far side of the moon',
  'A lonely dragon opens a tea shop and slowly makes friends with the whole town',
];

const DEFAULT_IDEA = 'A brave little brass robot named Bolt discovers a lost calico kitten in a futuristic eco-city, protecting it under neon rain and building a lifelong friendship.';

const StoryBookStudio: React.FC = () => {
  const [genre, setGenre] = useState(GENRES[0]);
  const [artStyle, setArtStyle] = useState(ART_STYLES[0]);
  const [storyIdea, setStoryIdea] = useState(DEFAULT_IDEA);

  const [scenes, setScenes] = useState<StoryScene[]>([]);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);

  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [storyModel, setStoryModel] = useState<'sd_turbo' | 'sd15_optimized'>('sd_turbo');
  const [storyError, setStoryError] = useState<string | null>(null);
  const [outline, setOutline] = useState<StoryOutline | null>(null);
  const [panelCount, setPanelCount] = useState(6);
  const [pageMode, setPageMode] = useState<'colour' | 'bw'>('colour');
  const [panelData, setPanelData] = useState<StoryPanelIn[]>([]);
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Selective Scene Recreator Modal
  const [isRecreating, setIsRecreating] = useState(false);
  const [recreatePromptChange, setRecreatePromptChange] = useState('');
  const [isRegeneratingPanel, setIsRegeneratingPanel] = useState(false);

  // Voice Translation Modal
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [spokenStory, setSpokenStory] = useState(LANGUAGES[0].sample);
  const [translatedStoryPlot, setTranslatedStoryPlot] = useState(DEFAULT_IDEA);

  const [readingSceneId, setReadingSceneId] = useState<number | null>(null);

  // Load persistent storybook scenes from gallery on mount
  useEffect(() => {
    getGalleryItems({ category: 'storybook' })
      .then((res) => {
        if (res.items && res.items.length > 0) {
          const loaded: StoryScene[] = res.items.slice(0, 12).map((it, idx) => ({
            id: idx + 1,
            title: `Scene ${idx + 1}: ${it.recreation_note || 'Storybook Panel'}`,
            imagePrompt: it.prompt,
            imageUrl: it.image_url,
            narration: it.prompt,
            dialogue: it.recreation_note ? `Dialogue: "${it.recreation_note}"` : undefined,
            character: 'Protagonist',
          }));
          setScenes(loaded);
        }
      })
      .catch(() => {});
  }, []);

  const activeScene = scenes[activeSceneIndex] || scenes[0];

  // Helper to extract a character description from the story idea
  const extractCharacterAndTheme = (idea: string) => {
    const words = idea.split(' ');
    const charSnippet = words.slice(0, 6).join(' ');
    return {
      characterDesc: charSnippet,
      themeSnippet: idea.slice(0, 100),
    };
  };

  const makeSafePrompt = (text: string, maxLen = 450): string => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen).replace(/,\s*[^,]*$/, '');
  };

  // Compose generated panels into finished manga/comic pages (server-side classical CV: layout, saliency crop, balloons, screentone)
  const composePages = async (title: string, panels: StoryPanelIn[], mode: 'colour' | 'bw') => {
    setIsComposing(true);
    try {
      const perPage = panels.length <= 6 ? panels.length : 4;
      const urls: string[] = [];
      for (let i = 0, pg = 1; i < panels.length; i += perPage, pg++) {
        const res = await composeStoryPage({ title: pg === 1 ? title : '', panels: panels.slice(i, i + perPage), mode, pageNo: pg });
        urls.push(res.image_url);
      }
      setPageUrls(urls);
    } finally {
      setIsComposing(false);
    }
  };

  const handleChangePageMode = async (mode: 'colour' | 'bw') => {
    setPageMode(mode);
    if (outline && panelData.length > 0) {
      try {
        await composePages(outline.title, panelData, mode);
      } catch (error) {
        setStoryError(error instanceof Error ? error.message : 'Unable to re-compose the page.');
      }
    }
  };

  // Handle Full Story Generation: LLM comic script -> one image per scene (character looks repeated in every prompt) -> composed pages
  const handleGenerateStory = async () => {
    const idea = storyIdea.trim();
    if (!idea) return;

    setIsGeneratingStory(true);
    setStoryError(null);
    setProgressPercent(5);
    setGenerationProgress('Writing the story (characters, scenes, dialogue)...');
    setActiveSceneIndex(0);
    setPageUrls([]);
    setPanelData([]);

    try {
      const story = await createStoryOutline({ idea, nScenes: panelCount, genre, artStyle });
      setOutline(story);
      const serverStyle = STYLE_FOR_ART[artStyle] || 'Anime & Manga';
      const baseSeed = Math.floor(Math.random() * 1_000_000);
      const generated: StoryScene[] = [];
      const panels: StoryPanelIn[] = [];
      for (let i = 0; i < story.scenes.length; i++) {
        const sc = story.scenes[i];
        setGenerationProgress(`Drawing scene ${i + 1}/${story.scenes.length}: ${sc.title}`);
        setProgressPercent(15 + Math.round((70 * i) / story.scenes.length));
        const result = await generateWithModel({
          prompt: sc.image_prompt,
          modelChoice: storyModel,
          resolution: 512,
          steps: storyModel === 'sd15_optimized' ? 4 : 2,
          seed: baseSeed + i,
          category: 'storybook',
          style: serverStyle,
        });
        const lines = sc.dialogue.map((d) => `${d.speaker}: "${d.text}"`).join('  ');
        generated.push({
          id: i + 1,
          title: `Scene ${sc.n}: ${sc.title}`,
          imagePrompt: sc.image_prompt,
          imageUrl: result.image_url,
          narration: sc.narration,
          dialogue: lines || undefined,
          character: sc.characters.join(', '),
          dialogueLines: sc.dialogue,
          sfx: sc.sfx,
          shot: sc.shot,
        });
        panels.push({ image_url: result.image_url, narration: sc.narration, dialogue: sc.dialogue, sfx: sc.sfx });
        setScenes([...generated]);
        try {
          await createGalleryItem({
            image_url: result.image_url,
            prompt: sc.image_prompt,
            category: 'storybook',
            style: artStyle,
            model: result.model_choice || storyModel,
            width: 512,
            height: 512,
            recreation_note: sc.title,
          });
        } catch {
          // Non-blocking
        }
      }
      setPanelData(panels);
      setGenerationProgress('Composing the manga pages (layout, balloons, screentone)...');
      setProgressPercent(92);
      await composePages(story.title, panels, pageMode);
      setProgressPercent(100);
      setGenerationProgress(`Done: "${story.title}" - ${generated.length} scenes. Story written by ${story.source.startsWith('llm') ? 'the language model' : 'the offline fallback'}.`);
      setActiveSceneIndex(0);
      setTimeout(() => setGenerationProgress(null), 4000);
    } catch (error) {
      setStoryError(error instanceof Error ? error.message : 'Unable to generate the story.');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  // Open Change this scene
  const handleOpenRecreate = () => {
    setRecreatePromptChange('Add golden glowing evening sunset lighting with magical floating sparkles');
    setIsRecreating(true);
  };

  // Apply Selective Recreation to the active scene
  const handleApplySceneRecreation = async () => {
    if (!activeScene) return;
    setIsRegeneratingPanel(true);
    setStoryError(null);
    try {
      const updatedPrompt = makeSafePrompt(
        recreatePromptChange.trim()
          ? `${activeScene.imagePrompt}, [Recreated: ${recreatePromptChange}]`
          : activeScene.imagePrompt
      );
      const result = await generateWithModel({
        prompt: updatedPrompt,
        modelChoice: storyModel,
        resolution: 512,
        steps: storyModel === 'sd15_optimized' ? 4 : 1,
        category: 'storybook',
        style: artStyle,
      });

      setScenes((prev) =>
        prev.map((s, idx) =>
          idx === activeSceneIndex
            ? {
                ...s,
                imageUrl: result.image_url,
                imagePrompt: updatedPrompt,
              }
            : s
        )
      );

      // Save new version to persistent gallery
      await createGalleryItem({
        image_url: result.image_url,
        prompt: updatedPrompt,
        category: 'storybook',
        style: artStyle,
        model: result.model_choice || storyModel,
        width: 512,
        height: 512,
        recreation_note: `Recreated Scene ${activeScene.id}: ${recreatePromptChange}`,
      });

      setIsRecreating(false);
    } catch (error) {
      setStoryError(error instanceof Error ? error.message : 'Unable to recreate this scene.');
    } finally {
      setIsRegeneratingPanel(false);
    }
  };

  // Voice Dictation handler using Web Speech API
  const handleToggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported by your current browser. Please type your story idea.');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = selectedLang.code === 'hi' ? 'hi-IN' : selectedLang.code === 'es' ? 'es-ES' : selectedLang.code === 'fr' ? 'fr-FR' : selectedLang.code === 'ja' ? 'ja-JP' : 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsRecording(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSpokenStory(transcript);
        setTranslatedStoryPlot(transcript);
        setIsRecording(false);
      };
      recognition.onerror = (err: any) => {
        setIsRecording(false);
        setStoryError(`Speech recognition: ${err.error || 'Microphone error'}`);
      };
      recognition.onend = () => {
        setIsRecording(false);
      };
      recognition.start();
    } catch {
      setIsRecording(false);
      setStoryError('Failed to access microphone.');
    }
  };

  const handleApplyVoiceStory = () => {
    setStoryIdea(translatedStoryPlot);
    setIsVoiceModalOpen(false);
  };

  // Real Browser Speech Synthesis
  const handleReadAloud = (scene: StoryScene) => {
    if (!('speechSynthesis' in window)) {
      setStoryError('Speech Synthesis is not supported in this browser.');
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setReadingSceneId(null);
      if (readingSceneId === scene.id) return;
    }

    setReadingSceneId(scene.id);
    const textToRead = `${scene.title}. ${scene.narration} ${scene.dialogue || ''}`;
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.rate = 0.92;
    utterance.pitch = 1.05;
    utterance.onend = () => setReadingSceneId(null);
    utterance.onerror = () => setReadingSceneId(null);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <WorkspaceLayout>
      <Box p={{ base: 4, md: 6 }} minH="100vh" bg="#FBF8F4">
        <Box maxW="960px" mx="auto" mb={6}>
          <Heading as="h1" size="lg" color="#1E2233" fontWeight="800" letterSpacing="-0.02em">Make a storybook</Heading>
          <Text color="#5B6277" mt={1} mb={5}>
            Tell us your story idea. We write it, draw every scene and lay it out like a comic page.
          </Text>

          {storyError && (
            <Alert status="error" borderRadius="12px" mb={4} bg="#FEECEC" border="1px solid #F5C2C4" color="#B42318">
              <AlertIcon />
              <Text fontSize="sm" flex={1}>{storyError}</Text>
              <CloseButton onClick={() => setStoryError(null)} size="sm" />
            </Alert>
          )}

          <Box bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="20px" p={{ base: 4, md: 5 }} boxShadow="card">
            <Text fontSize="sm" fontWeight="700" color="#1E2233" mb={2}>1. What is your story about?</Text>
            <Textarea
              value={storyIdea}
              onChange={(e) => setStoryIdea(e.target.value)}
              placeholder="For example: a little fox who is afraid of the dark learns to follow the fireflies home"
              minH="90px"
              fontSize="md"
              aria-label="Your story idea"
            />
            <Flex mt={3} align="center" justify="space-between" wrap="wrap" gap={3}>
              <HStack spacing={1}>
                <Button size="sm" variant="ghost" leftIcon={<FiMic />} color="#5B6277" onClick={() => setIsVoiceModalOpen(true)}>Speak it</Button>
                <Button size="sm" variant="ghost" leftIcon={<FiShuffle />} color="#5B6277"
                  onClick={() => setStoryIdea(SAMPLE_IDEAS[Math.floor(Math.random() * SAMPLE_IDEAS.length)])}>Surprise me</Button>
              </HStack>
            </Flex>

          </Box>

          <Text fontSize="sm" fontWeight="700" color="#1E2233" mt={6} mb={2}>2. Choose a look</Text>
          <Flex wrap="wrap" gap={2} role="radiogroup" aria-label="Choose a look">
            {ART_STYLES.map((a2) => (
              <Button key={a2} size="sm" borderRadius="full" role="radio" aria-checked={artStyle === a2}
                bg={artStyle === a2 ? '#5B5BF0' : '#FFFFFF'} color={artStyle === a2 ? '#FFFFFF' : '#1E2233'}
                border="1px solid" borderColor={artStyle === a2 ? '#5B5BF0' : '#E3DACF'} fontWeight={artStyle === a2 ? 700 : 500}
                _hover={{ borderColor: '#5B5BF0', bg: artStyle === a2 ? '#4747DB' : '#EEF0FF' }} onClick={() => setArtStyle(a2)}>
                {a2}
              </Button>
            ))}
          </Flex>

          <Flex mt={6} gap={6} wrap="wrap">
            <Box>
              <Text fontSize="sm" fontWeight="700" color="#1E2233" mb={2}>3. How long?</Text>
              <HStack spacing={2} role="radiogroup" aria-label="Number of scenes">
                {[4, 6, 8].map((n) => (
                  <Button key={n} size="sm" borderRadius="full" role="radio" aria-checked={panelCount === n}
                    bg={panelCount === n ? '#5B5BF0' : '#FFFFFF'} color={panelCount === n ? '#FFFFFF' : '#1E2233'}
                    border="1px solid" borderColor={panelCount === n ? '#5B5BF0' : '#E3DACF'} onClick={() => setPanelCount(n)}>
                    {n} scenes
                  </Button>
                ))}
              </HStack>
            </Box>
            <Box>
              <Text fontSize="sm" fontWeight="700" color="#1E2233" mb={2}>4. Page style</Text>
              <HStack spacing={2} role="radiogroup" aria-label="Page style">
                {([['colour', 'Full colour'], ['bw', 'Black and white manga']] as const).map(([v, label]) => (
                  <Button key={v} size="sm" borderRadius="full" role="radio" aria-checked={pageMode === v}
                    bg={pageMode === v ? '#5B5BF0' : '#FFFFFF'} color={pageMode === v ? '#FFFFFF' : '#1E2233'}
                    border="1px solid" borderColor={pageMode === v ? '#5B5BF0' : '#E3DACF'} onClick={() => handleChangePageMode(v)}>
                    {label}
                  </Button>
                ))}
              </HStack>
            </Box>
          </Flex>

          <Button mt={4} variant="link" color="#5B6277" size="sm" onClick={() => setShowMore((v) => !v)}
            rightIcon={showMore ? <FiChevronUp /> : <FiChevronDown />} aria-expanded={showMore}>
            More options (story type, engine)
          </Button>
          <Collapse in={showMore} animateOpacity>
            <Flex gap={4} mt={3} p={4} bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="16px" wrap="wrap">
              <Box>
                <Text fontSize="xs" fontWeight="700" color="#5B6277" mb={1}>Story type</Text>
                <Select size="sm" value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Story type" w="260px">
                  {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                </Select>
              </Box>
              <Box>
                <Text fontSize="xs" fontWeight="700" color="#5B6277" mb={1}>Drawing engine</Text>
                <Select size="sm" value={storyModel} onChange={(e) => setStoryModel(e.target.value as 'sd_turbo' | 'sd15_optimized')} aria-label="Drawing engine" w="260px">
                  <option value="sd_turbo">Fastest (SD-Turbo)</option>
                  <option value="sd15_optimized">Fast and detailed</option>
                </Select>
              </Box>
            </Flex>
          </Collapse>

          <Box mt={6} bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="20px" p={{ base: 4, md: 5 }} boxShadow="card">
            <Flex align="center" justify="space-between" wrap="wrap" gap={3}>
              <Text color="#5B6277" fontSize="sm">Ready? It takes about a minute.</Text>
              <Button variant="brand" size="lg" px={10} onClick={handleGenerateStory} isLoading={isGeneratingStory} loadingText="Creating..."
                rightIcon={<FiSend />} isDisabled={!storyIdea.trim()}>
                Create my storybook
              </Button>
            </Flex>
            {isGeneratingStory && (
              <Box mt={4} role="status">
                <Flex justify="space-between" align="center" mb={1}>
                  <Text fontSize="sm" color="#4747DB" fontWeight="600">{generationProgress || 'Working on your story...'}</Text>
                  <Text fontSize="sm" color="#8A90A2">{progressPercent}%</Text>
                </Flex>
                <Progress value={progressPercent} size="sm" colorScheme="purple" borderRadius="full" />
              </Box>
            )}
            {!isGeneratingStory && generationProgress && (
              <Text mt={3} fontSize="sm" color="#13795B" role="status">{generationProgress}</Text>
            )}
          </Box>
        </Box>

        {/* COMPOSED MANGA PAGES */}
        {(pageUrls.length > 0 || isComposing) && (
          <Box maxW="960px" mx="auto" mb={4} bg="#FFFFFF" border="1px solid #E9E1D6" borderRadius="14px" p={{ base: 3, md: 4 }}>
            <Flex justify="space-between" align="center" mb={3} wrap="wrap" gap={2}>
              <Box>
                <Heading size="sm" color="#1E2233">{outline?.title || 'Your story'}</Heading>
                {outline?.logline && <Text fontSize="xs" color="#5B6277" mt={1}>{outline.logline}</Text>}
              </Box>
              <HStack spacing={2}>
                <Button size="xs" variant="outline" borderColor="#E3DACF" color="#5B6277" leftIcon={<FiDownload />}
                  isDisabled={!pageUrls.length}
                  onClick={() => pageUrls.forEach((u, i) => handleDownloadImage(u, `storybook-page-${i + 1}.png`))}>
                  PNG
                </Button>
                <Button size="xs" colorScheme="green" leftIcon={<FiDownload />} isDisabled={!pageUrls.length}
                  onClick={() => downloadStoryPdf(pageUrls, outline?.title || 'storybook').catch((e) => setStoryError(e.message))}>
                  PDF
                </Button>
              </HStack>
            </Flex>
            {isComposing && <Progress size="xs" isIndeterminate colorScheme="green" mb={3} />}
            <Flex gap={4} wrap="wrap" justify="center">
              {pageUrls.map((u, i) => (
                <Image key={u} src={toSameOriginImageUrl(u)} alt={`Page ${i + 1} of ${outline?.title || 'the story'}`}
                  maxW={{ base: '100%', md: '440px' }} borderRadius="6px" boxShadow="0 8px 30px rgba(30,34,51,0.12)" />
              ))}
            </Flex>
            {outline && outline.characters.length > 0 && (
              <Flex mt={3} gap={2} wrap="wrap">
                {outline.characters.map((c) => (
                  <Badge key={c.name} colorScheme="green" variant="subtle" textTransform="none" px={2} py={1} borderRadius="6px" whiteSpace="normal">
                    <b>{c.name}</b>: {c.look}
                  </Badge>
                ))}
              </Flex>
            )}
          </Box>
        )}

        {/* MAIN STAGE: ACTIVE SCENE OR EMPTY STATE */}
        <Box maxW="960px" mx="auto" mb={4}>
          {scenes.length > 0 && activeScene ? (
            <Box
              bg="#FFFFFF"
              border="1px solid #E3DACF"
              borderRadius="18px"
              p={5}
              boxShadow="0 12px 40px rgba(30,34,51,0.12)"
            >
              {/* Active Scene Header */}
              <Flex justify="space-between" align="center" mb={3} pb={2} borderBottom="1px solid #EFE8DF" wrap="wrap" gap={2}>
                <Flex align="center" gap={2.5}>
                  <Badge bg="rgba(91,91,240, 0.15)" color="#5B5BF0" px={2.5} py={1} borderRadius="6px" fontSize="11px">
                    Scene {activeSceneIndex + 1}
                  </Badge>
                  <Heading size="xs" color="#1E2233">
                    {activeScene.title}
                  </Heading>
                </Flex>

                <HStack spacing={2}>
                  {/* Selective Inpaint Recreate button */}
                  <Button
                    size="xs"
                    bg="rgba(91,91,240, 0.15)"
                    color="#5B5BF0"
                    border="1px solid rgba(91,91,240, 0.35)"
                    _hover={{ bg: '#5B5BF0', color: '#FFFFFF' }}
                    leftIcon={<Text>⭕</Text>}
                    onClick={handleOpenRecreate}
                    fontWeight="bold"
                  >
                    Change this scene
                  </Button>

                  {/* Read aloud via real Web Speech API */}
                  <Tooltip label={readingSceneId === activeScene.id ? "Stop voice narration" : "Read scene aloud"}>
                    <IconButton
                      aria-label="Read aloud"
                      icon={readingSceneId === activeScene.id ? <FiVolumeX size={13} /> : <FiVolume2 size={13} />}
                      size="xs"
                      bg={readingSceneId === activeScene.id ? '#5B5BF0' : '#F5F0EA'}
                      color={readingSceneId === activeScene.id ? '#FBF8F4' : '#5B6277'}
                      _hover={{ color: '#1E2233' }}
                      onClick={() => handleReadAloud(activeScene)}
                    />
                  </Tooltip>

                  {/* Download */}
                  <Button
                    size="xs"
                    variant="ghost"
                    color="#5B6277"
                    _hover={{ color: '#5B5BF0' }}
                    leftIcon={<FiDownload />}
                    onClick={() => handleDownloadImage(activeScene.imageUrl, `storybook-scene-${activeScene.id}.png`)}
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
                border="1px solid #E3DACF"
                bg="#FBF8F4"
                maxH="440px"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Image
                  src={toSameOriginImageUrl(activeScene.imageUrl)}
                  alt={activeScene.title}
                  w="100%"
                  maxH="440px"
                  objectFit="contain"
                />

                {/* Comic Dialogue Balloon */}
                {activeScene.dialogue && (
                  <Box
                    position="absolute"
                    bottom={3}
                    left={3}
                    right={3}
                    bg="rgba(17, 23, 19, 0.9)"
                    border="1px solid #5B5BF0"
                    borderRadius="10px"
                    p={2.5}
                    backdropFilter="blur(8px)"
                  >
                    <Text fontSize="xs" color="#1E2233" fontWeight="600" fontStyle="italic">
                      💬 {activeScene.dialogue}
                    </Text>
                  </Box>
                )}
              </Box>

              {/* Active Scene Narration Card */}
              <Box p={3.5} mt={3} bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="10px">
                <Text fontSize="xs" color="#5B6277" lineHeight="1.7">
                  {activeScene.narration}
                </Text>
              </Box>

              {/* Scene Stepper Buttons */}
              <Flex justify="space-between" align="center" mt={3} pt={2}>
                <Button
                  size="xs"
                  variant="ghost"
                  color="#5B6277"
                  isDisabled={activeSceneIndex === 0}
                  onClick={() => setActiveSceneIndex((prev) => Math.max(0, prev - 1))}
                  leftIcon={<FiChevronLeft />}
                >
                  Previous Scene
                </Button>

                <Text fontSize="11px" color="#8A90A2">
                  Character: <span style={{ color: '#1E2233' }}>{activeScene.character}</span> · Style: <span style={{ color: '#5B5BF0' }}>{artStyle}</span>
                </Text>

                <Button
                  size="xs"
                  variant="ghost"
                  color="#5B6277"
                  isDisabled={activeSceneIndex === scenes.length - 1}
                  onClick={() => setActiveSceneIndex((prev) => Math.min(scenes.length - 1, prev + 1))}
                  rightIcon={<FiChevronRight />}
                >
                  Next Scene
                </Button>
              </Flex>
            </Box>
          ) : (
            <Box bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="18px" p={12} textAlign="center">
              <Text fontSize="48px" mb={3}>📖</Text>
              <Heading size="md" color="#1E2233" mb={2}>Ready to Illustrate Your Storybook</Heading>
              <Text fontSize="sm" color="#5B6277" maxW="560px" mx="auto" mb={6}>
                Type or dictate any story idea in the prompt bar below. ImagineAI will generate 4 coherent story scenes with consistent characters, narrations, and dialogs.
              </Text>
              <Button
                bg="#5B5BF0"
                color="#FFFFFF"
                fontWeight="bold"
                onClick={handleGenerateStory}
                isLoading={isGeneratingStory}
                leftIcon={<Text>✨</Text>}
              >
                Generate Story from Idea
              </Button>
            </Box>
          )}

          {/* STORYBOARD FILMSTRIP */}
          {scenes.length > 0 && (
            <Box mt={4} p={3.5} bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="14px">
              <Flex justify="space-between" align="center" mb={2}>
                <Flex align="center" gap={2}>
                  <Text fontSize="xs" color="#5B6277" fontWeight="bold" textTransform="uppercase" letterSpacing="0.05em">
                    Storybook Panels
                  </Text>
                  <Badge bg="#F5F0EA" color="#4747DB" fontSize="10px">
                    {scenes.length} Panels Saved in Gallery
                  </Badge>
                </Flex>

                <Button
                  as={Link}
                  to="/gallery"
                  size="xs"
                  variant="ghost"
                  color="#5B5BF0"
                  rightIcon={<FiArrowRight />}
                >
                  Open Gallery
                </Button>
              </Flex>

              <Flex gap={3} overflowX="auto" py={2}>
                {scenes.map((scene, idx) => (
                  <Box
                    key={scene.id}
                    minW="140px"
                    maxW="140px"
                    borderRadius="10px"
                    overflow="hidden"
                    border="2px solid"
                    borderColor={idx === activeSceneIndex ? '#5B5BF0' : '#E3DACF'}
                    cursor="pointer"
                    onClick={() => setActiveSceneIndex(idx)}
                    bg="#FBF8F4"
                    transition="all 0.2s"
                    _hover={{ borderColor: '#5B5BF0' }}
                  >
                    <Image
                      src={toSameOriginImageUrl(scene.imageUrl)}
                      alt={scene.title}
                      h="85px"
                      w="100%"
                      objectFit="cover"
                    />
                    <Box p={1.5} bg="#FFFFFF">
                      <Text fontSize="10px" color="#1E2233" fontWeight="bold" noOfLines={1}>
                        Panel {idx + 1}
                      </Text>
                    </Box>
                  </Box>
                ))}
              </Flex>
            </Box>
          )}
        </Box>

        {/* SELECTIVE PANEL RECREATOR MODAL */}
        <Modal isOpen={isRecreating} onClose={() => setIsRecreating(false)} isCentered size="2xl">
          <ModalOverlay bg="rgba(30,34,51,0.55)" backdropFilter="blur(8px)" />
          <ModalContent bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="20px" color="#1E2233" maxW="700px">
            <ModalHeader borderBottom="1px solid #EFE8DF" py={4}>
              <Flex align="center" gap={2}>
                <Box w="28px" h="28px" borderRadius="full" bg="#5B5BF0" display="flex" alignItems="center" justifyContent="center" color="#FFFFFF" fontSize="14px">
                  ⭕
                </Box>
                <Box>
                  <Text fontSize="md" fontWeight="bold">
                    Recreate Story Scene Panel
                  </Text>
                  <Text fontSize="xs" color="#5B6277" fontWeight="normal">
                    Adjust prompt, lighting, or details to regenerate this scene
                  </Text>
                </Box>
              </Flex>
            </ModalHeader>
            <ModalCloseButton color="#5B6277" />

            <ModalBody py={4}>
              {activeScene && (
                <Box mb={4} borderRadius="10px" overflow="hidden" border="1px solid #E3DACF" maxH="320px">
                  <Image src={toSameOriginImageUrl(activeScene.imageUrl)} w="100%" maxH="320px" objectFit="contain" />
                </Box>
              )}

              <Box mb={3}>
                <Text fontSize="xs" color="#5B6277" fontWeight="600" mb={1.5} textTransform="uppercase">
                  What should change in this scene?
                </Text>
                <Input
                  value={recreatePromptChange}
                  onChange={(e) => setRecreatePromptChange(e.target.value)}
                  placeholder="e.g. Change expression to joyful laughter, add rainbow sparkles"
                  bg="#F7F3EE"
                  color="#1E2233"
                  border="1px solid #E3DACF"
                  borderRadius="10px"
                  size="sm"
                  _focus={{ borderColor: '#5B5BF0' }}
                />
              </Box>
            </ModalBody>

            <ModalFooter borderTop="1px solid #EFE8DF" py={3}>
              <Button size="sm" variant="ghost" color="#5B6277" mr={3} onClick={() => setIsRecreating(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                bg="#5B5BF0"
                color="#FFFFFF"
                fontWeight="bold"
                onClick={handleApplySceneRecreation}
                isLoading={isRegeneratingPanel}
                leftIcon={<Text>✨</Text>}
              >
                Recreate Scene & Save New Version
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* VOICE DICTATION & TRANSLATION MODAL */}
        <Modal isOpen={isVoiceModalOpen} onClose={() => setIsVoiceModalOpen(false)} isCentered size="lg">
          <ModalOverlay bg="rgba(30,34,51,0.55)" backdropFilter="blur(6px)" />
          <ModalContent bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="18px" color="#1E2233">
            <ModalHeader borderBottom="1px solid #EFE8DF" py={4}>
              <Flex align="center" gap={2}>
                <Box w="28px" h="28px" borderRadius="full" bg="#5B5BF0" display="flex" alignItems="center" justifyContent="center" color="#FFFFFF" fontSize="14px">
                  🎤
                </Box>
                <Text fontSize="md" fontWeight="bold">
                  Story Voice Dictator & Translator
                </Text>
              </Flex>
            </ModalHeader>
            <ModalCloseButton color="#5B6277" />

            <ModalBody py={5}>
              <Text fontSize="xs" color="#5B6277" mb={4}>
                Speak your story idea in your preferred language! The browser speech recognition will capture your words directly into the plotline.
              </Text>

              <Box mb={4}>
                <Text fontSize="xs" color="#8A90A2" mb={1.5} textTransform="uppercase">
                  Select Speaking Language
                </Text>
                <Select
                  value={selectedLang.code}
                  onChange={(e) => {
                    const l = LANGUAGES.find((item) => item.code === e.target.value) || LANGUAGES[0];
                    setSelectedLang(l);
                    setSpokenStory(l.sample);
                    setTranslatedStoryPlot(l.sample);
                  }}
                  bg="#F7F3EE"
                  color="#1E2233"
                  border="1px solid #E3DACF"
                  borderRadius="10px"
                  size="sm"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} style={{ background: '#FFFFFF' }}>
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
                  bg={isRecording ? '#E5484D' : '#F5F0EA'}
                  border="2px solid"
                  borderColor={isRecording ? '#E5484D' : '#5B5BF0'}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  cursor="pointer"
                  onClick={handleToggleVoice}
                  boxShadow={isRecording ? '0 0 25px rgba(229,72,77,0.5)' : '0 0 20px rgba(91,91,240,0.14)'}
                >
                  <FiMic size={28} color={isRecording ? '#1E2233' : '#5B5BF0'} />
                </Box>
                <Text fontSize="xs" color={isRecording ? '#E5484D' : '#5B5BF0'} fontWeight="600" mt={2}>
                  {isRecording ? 'Listening... Speak into your microphone' : 'Tap to start voice recognition'}
                </Text>
              </Flex>

              <Box bg="#FFFFFF" p={4} borderRadius="12px" border="1px solid #E3DACF">
                <Text fontSize="10px" color="#8A90A2" textTransform="uppercase" fontWeight="bold">
                  Captured Voice Plot
                </Text>
                <Text fontSize="xs" color="#5B5BF0" mt={1}>
                  "{spokenStory}"
                </Text>
              </Box>
            </ModalBody>

            <ModalFooter borderTop="1px solid #EFE8DF" py={3}>
              <Button size="sm" variant="ghost" color="#5B6277" mr={3} onClick={() => setIsVoiceModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" bg="#5B5BF0" color="#FFFFFF" fontWeight="bold" onClick={handleApplyVoiceStory}>
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
