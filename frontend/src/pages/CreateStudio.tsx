import React, { useState, useRef } from 'react';
import {
  Box,
  Flex,
  Text,
  Heading,
  Textarea,
  Input,
  Button,
  Select,
  Image,
  Badge,
  HStack,
  IconButton,
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
  FiMic,
  FiPaperclip,
  FiSend,
  FiRefreshCw,
  FiDownload,
  FiZap,
  FiX,
  FiLayers,
  FiArrowRight,
  FiSliders,
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import WorkspaceLayout from '../components/WorkspaceLayout';
import InteractiveCanvasMask from '../components/InteractiveCanvasMask';
import { generateImage, generateWithModel } from '../lib/api';
import { getModelCatalogue, ModelCatalogueEntry } from '../lib/api';

interface GenerationItem {
  id: string;
  timestamp: string;
  prompt: string;
  enhancedPrompt?: string;
  style: string;
  model: string;
  aspect: string;
  imageUrl: string;
  referenceImage?: string;
  voiceLanguage?: string;
  originalVoiceText?: string;
  isRecreation?: boolean;
  recreationNote?: string;
}

const STYLE_OPTIONS = [
  'Photorealistic',
  'Cinematic 3D',
  'Anime & Manga',
  'Comic Book',
  'Fantasy Art',
  'Cyberpunk',
  'Watercolor',
  'Retro Pixel',
];

const ASPECT_OPTIONS = ['1:1 Square', '16:9 Landscape', '9:16 Portrait', '4:3 Standard'];
const QUALITY_OPTIONS = ['Quick (1-step)', 'Balanced (4-step)', 'Best (High Res)'];

const STYLE_PROMPTS: Record<string, string> = {
  Photorealistic: 'photorealistic, natural lighting, realistic materials, high detail',
  'Cinematic 3D': 'cinematic 3D render, physically based materials, dramatic lighting, depth of field',
  'Anime & Manga': 'anime and manga illustration, clean linework, expressive composition, cel shading',
  'Comic Book': 'comic book art, bold ink lines, dynamic composition, rich colors, halftone detail',
  'Fantasy Art': 'fantasy concept art, imaginative worldbuilding, atmospheric lighting, intricate detail',
  Cyberpunk: 'cyberpunk concept art, neon lighting, futuristic technology, rain-slick atmosphere',
  Watercolor: 'watercolor painting, visible brush texture, soft washes, paper grain',
  'Retro Pixel': 'retro pixel art, crisp pixel clusters, limited color palette, readable silhouette',
};

const LANGUAGES = [
  { code: 'hi', name: 'Hindi (हिंदी)', sample: 'एक जादुई जंगल जिसमें चमकते हुए पेड़ और नीले फूल हैं' },
  { code: 'es', name: 'Spanish (Español)', sample: 'Una ciudad futurista con rascacielos flotantes al atardecer' },
  { code: 'fr', name: 'French (Français)', sample: 'Un petit robot mignon qui lit un livre sous les étoiles' },
  { code: 'de', name: 'German (Deutsch)', sample: 'Ein alter Drache der auf einer Bergspitze im Schnee schläft' },
  { code: 'ja', name: 'Japanese (日本語)', sample: '桜の花びらが舞うサイバーパンクの夜の通り' },
  { code: 'ta', name: 'Tamil (தமிழ்)', sample: 'வானத்தில் பறக்கும் தங்க ரதம் மற்றும் மேகங்கள்' },
  { code: 'en', name: 'English (Voice Prompt)', sample: 'A friendly dragon making pastries in a rustic bakery' },
];

const INITIAL_IMAGE: GenerationItem = {
  id: 'gen-active',
  timestamp: 'Just now',
  prompt: 'A futuristic city with green energy, at sunset, cinematic, ultra realistic',
  enhancedPrompt: 'A breathtaking futuristic metropolis powered by glowing emerald bioluminescent energy towers, majestic crystalline skybridges, golden sunset reflections, 8k resolution, volumetric fog, octane render.',
  style: 'Photorealistic',
  model: 'SD-Turbo (Realtime 0.8s)',
  aspect: '16:9 Landscape',
  imageUrl: 'https://picsum.photos/seed/futurecity99/900/500',
  voiceLanguage: 'Hindi (हिंदी)',
  originalVoiceText: 'एक भविष्य का शहर जिसमें हरी ऊर्जा और सूर्यास्त का दृश्य हो',
};

const INITIAL_GALLERY: GenerationItem[] = [
  INITIAL_IMAGE,
  {
    id: 'gen-2',
    timestamp: '5 mins ago',
    prompt: 'A cute metallic steampunk robot petting a curious fluffy kitten in a flower garden',
    style: 'Cinematic 3D',
    model: 'SD-Turbo (Realtime 0.8s)',
    aspect: '1:1 Square',
    imageUrl: 'https://picsum.photos/seed/robotcat77/600/600',
  },
  {
    id: 'gen-3',
    timestamp: '20 mins ago',
    prompt: 'Majestic celestial dragon flying above snow-covered mountain peaks with aurora borealis',
    style: 'Fantasy Art',
    model: 'Stable Diffusion 1.5',
    aspect: '16:9 Landscape',
    imageUrl: 'https://picsum.photos/seed/dragonice55/900/500',
  },
  {
    id: 'gen-4',
    timestamp: '1 hour ago',
    prompt: 'Cyberpunk street food vendor in rainy Tokyo with neon signs and steam',
    style: 'Cyberpunk',
    model: 'SD-Turbo (Realtime 0.8s)',
    aspect: '1:1 Square',
    imageUrl: 'https://picsum.photos/seed/cyberstreet33/600/600',
  },
  {
    id: 'gen-5',
    timestamp: '2 hours ago',
    prompt: 'Enchanted underwater coral palace with bioluminescent sea turtles',
    style: 'Photorealistic',
    model: 'SD-Turbo (Realtime 0.8s)',
    aspect: '16:9 Landscape',
    imageUrl: 'https://picsum.photos/seed/oceanpalace88/900/500',
  },
];

const CreateStudio: React.FC = () => {
  // THE ONE ACTIVE GENERATION DISPLAYED IN THE PROFESSIONAL GENERATOR
  const [activeImage, setActiveImage] = useState<GenerationItem>(INITIAL_IMAGE);
  // THE REST STORED CLEANLY IN GALLERY
  const [galleryItems, setGalleryItems] = useState<GenerationItem[]>(INITIAL_GALLERY);

  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('Photorealistic');
  const [model, setModel] = useState('SD 1.5 Adaptive LoRA');
  const [aspect, setAspect] = useState('16:9 Landscape');
  const [quality, setQuality] = useState('Balanced (4-step)');
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [modelCatalogue, setModelCatalogue] = useState<ModelCatalogueEntry[]>([]);

  // Voice Translation Modal State
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [voiceLang, setVoiceLang] = useState(LANGUAGES[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [spokenText, setSpokenText] = useState(LANGUAGES[0].sample);
  const [translatedPrompt, setTranslatedPrompt] = useState(
    'A magical forest with glowing bioluminescent trees, mystical floating blue orchids, ethereal moonlight rays, ultra detailed'
  );

  // Selective Recreation Modal State
  const [isRecreationOpen, setIsRecreationOpen] = useState(false);
  const [recreationInstruction, setRecreationInstruction] = useState('');
  const [hasMaskSelected, setHasMaskSelected] = useState(false);

  // Vision inspection
  const [showVisionAnalysis, setShowVisionAnalysis] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    getModelCatalogue()
      .then((result) => setModelCatalogue(result.models))
      .catch((error) => setGenerationError(error instanceof Error ? error.message : 'Unable to load model catalogue.'));
  }, []);

  // Voice Recording Simulation
  const handleToggleRecord = () => {
    if (!isRecording) {
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        setSpokenText(voiceLang.sample);
        const translations: Record<string, string> = {
          hi: 'A mystical ancient enchanted forest with towering glowing green trees and luminescent blue blossoms, cinematic volumetric lighting, 8k masterpiece',
          es: 'A sprawling futuristic skyline with floating iridescent skyscrapers during a crimson sunset, hyper-detailed architectural render',
          fr: 'An adorable miniature robot with vintage brass gears reading an ancient leather book under starry cosmos, soft warm storybook illustration',
          de: 'A colossal primordial dragon slumbering peacefully upon a snowy mountain crest during an aurora borealis, dark fantasy oil painting',
          ja: 'A nocturnal cyberpunk alley drenched in neon reflections with floating pink sakura cherry blossom petals, anime cinematic still',
          ta: 'A majestic celestial golden chariot soaring through celestial clouds with lightning trails, epic mythological digital concept art',
          en: 'A warm, whimsical friendly dragon delicately baking croissants inside an old French village bakery, charming 3D storybook character',
        };
        setTranslatedPrompt(translations[voiceLang.code] || `A stunning rendition of: ${spokenText}, 8k cinematic masterpiece`);
      }, 2000);
    } else {
      setIsRecording(false);
    }
  };

  const handleApplyVoicePrompt = () => {
    setPrompt(translatedPrompt);
    setIsVoiceOpen(false);
  };

  const handleEnhancePrompt = () => {
    if (!prompt.trim()) {
      setPrompt('A futuristic eco-friendly floating city with waterfalls, solar sail architecture, golden hour cinematic lighting, 8k octane render, masterpiece');
      return;
    }
    setPrompt(
      (prev) =>
        `${prev}, cinematic composition, hyper-detailed textures, volumetric atmospheric lighting, 8k resolution, ray-traced reflections, trending on ArtStation, masterpiece.`
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAttachedImage(url);
    }
  };

  // Generate new image
  const handleGenerate = async () => {
    if (!prompt.trim() && !attachedImage) {
      setGenerationError('Enter a prompt or attach a reference image before generating.');
      return;
    }

    setIsGenerating(true);
    const newPrompt = prompt.trim() || 'Visual remix from uploaded reference image';
    setGenerationError(null);
    try {
      const qualityMode = quality.startsWith('Quick')
        ? 'quick'
        : quality.startsWith('Best')
          ? 'best'
          : 'balanced';
      const styledPrompt = `${newPrompt}, ${STYLE_PROMPTS[style] || STYLE_PROMPTS.Photorealistic}`;
      const selectedModelId = modelCatalogue.find((entry) => entry.display_name === model)?.id;
      const modelChoice = selectedModelId === 'sd15'
        ? 'sd15_baseline'
        : selectedModelId === 'sd15_optimized'
          ? 'sd15_optimized'
          : selectedModelId === 'sd15_adapted'
            ? 'sd15_adapted'
            : null;
      const result = modelChoice
        ? await generateWithModel({
            prompt: styledPrompt,
            modelChoice,
            resolution: 512,
            steps: modelChoice === 'sd15_optimized' ? 8 : 30,
          })
        : await generateImage({
            prompt: styledPrompt,
            qualityMode,
            resolution: 512,
          });
      const newGen: GenerationItem = {
        id: result.request_id,
        timestamp: 'Just now',
        prompt: newPrompt,
        style,
        model,
        aspect,
        imageUrl: result.image_url,
        referenceImage: attachedImage || undefined,
        voiceLanguage: spokenText && prompt.includes(translatedPrompt) ? voiceLang.name : undefined,
        originalVoiceText: spokenText && prompt.includes(translatedPrompt) ? spokenText : undefined,
      };

      // Set as THE active generation
      setActiveImage(newGen);
      // Store into gallery collection
      setGalleryItems((prev) => [newGen, ...prev]);
      setIsGenerating(false);
      setPrompt('');
      setAttachedImage(null);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Image generation failed.');
      setIsGenerating(false);
    }
  };

  // Selective Recreation Handler
  const handleOpenSelectiveRecreate = () => {
    setRecreationInstruction('Change the sky to deep violet with shooting stars and neon aurora');
    setIsRecreationOpen(true);
  };

  const handleApplySelectiveRecreation = () => {
    setIsGenerating(true);
    setIsRecreationOpen(false);

    setTimeout(() => {
      const recreated: GenerationItem = {
        id: `recreate-${Date.now()}`,
        timestamp: 'Just now (Inpainted)',
        prompt: `${activeImage.prompt} [Circled Inpaint: ${recreationInstruction}]`,
        style: activeImage.style,
        model: activeImage.model,
        aspect: activeImage.aspect,
        imageUrl: `https://picsum.photos/seed/recreate${Date.now()}/900/500`,
        isRecreation: true,
        recreationNote: `Circled Area: "${recreationInstruction}"`,
      };

      // Set the recreated image as active
      setActiveImage(recreated);
      // Save it into the gallery
      setGalleryItems((prev) => [recreated, ...prev]);
      setIsGenerating(false);
    }, 1500);
  };

  return (
    <WorkspaceLayout>
      <Box p={{ base: 4, md: 6 }} minH="100vh" bg="#080B0A" display="flex" flexDir="column">
        {/* Top Professional Toolbar */}
        {generationError && (
          <Box
            mb={3}
            px={4}
            py={3}
            borderRadius="10px"
            bg="rgba(255,68,68,0.12)"
            border="1px solid rgba(255,68,68,0.4)"
            color="#FFB3B3"
            fontSize="sm"
            role="alert"
          >
            {generationError}
          </Box>
        )}
        <Box
          bg="#111713"
          border="1px solid #2A3A2C"
          borderRadius="16px"
          px={5}
          py={3.5}
          mb={5}
          boxShadow="0 4px 20px rgba(0,0,0,0.5)"
        >
          <Flex
            direction={{ base: 'column', md: 'row' }}
            justify="space-between"
            align={{ base: 'flex-start', md: 'center' }}
            gap={3}
          >
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
                fontWeight="bold"
                color="#080B0A"
              >
                🎨
              </Box>
              <Box>
                <Flex align="center" gap={2}>
                  <Heading size="sm" color="#F4F7F0" fontWeight="700">
                    Image Generator
                  </Heading>
                  <Badge bg="rgba(183, 255, 53, 0.15)" color="#B7FF35" px={2} py={0.5} borderRadius="full" fontSize="10px">
                    Professional Studio
                  </Badge>
                </Flex>
                <Text color="#A5B1A7" fontSize="xs">
                  Active generation workspace · All outputs automatically archived to Gallery
                </Text>
              </Box>
            </Flex>

            {/* Presets and Model Selectors */}
            <Flex wrap="wrap" align="center" gap={2}>
              <Select
                size="sm"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                bg="#0F1A11"
                color="#F4F7F0"
                border="1px solid #2A3A2C"
                borderRadius="8px"
                w={{ base: 'full', sm: '190px' }}
                _hover={{ borderColor: '#B7FF35' }}
              >
                {(modelCatalogue.length > 0 ? modelCatalogue : [{
                  id: 'sd_turbo',
                  display_name: 'SD-Turbo',
                  task: 'text-to-image',
                  role: 'Quick generation',
                  checkpoint: 'stabilityai/sd-turbo',
                  license_reference: 'Hugging Face model card',
                  quality_modes: ['quick', 'balanced', 'best'],
                  available: true,
                  availability_reason: 'Configured and available.',
                  configured: true,
                }]).map((entry) => (
                  <option
                    key={entry.id}
                    value={entry.display_name}
                    disabled={!entry.available}
                    style={{ background: '#111713' }}
                  >
                    {entry.display_name}{entry.available ? '' : ' (Unavailable)'}
                  </option>
                ))}
              </Select>

              <Select
                size="sm"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                bg="#0F1A11"
                color="#F4F7F0"
                border="1px solid #2A3A2C"
                borderRadius="8px"
                w={{ base: 'full', sm: '135px' }}
                _hover={{ borderColor: '#B7FF35' }}
              >
                {STYLE_OPTIONS.map((s) => (
                  <option key={s} value={s} style={{ background: '#111713' }}>
                    {s}
                  </option>
                ))}
              </Select>

              <Select
                size="sm"
                value={aspect}
                onChange={(e) => setAspect(e.target.value)}
                bg="#0F1A11"
                color="#F4F7F0"
                border="1px solid #2A3A2C"
                borderRadius="8px"
                w="125px"
                _hover={{ borderColor: '#B7FF35' }}
              >
                {ASPECT_OPTIONS.map((a) => (
                  <option key={a} value={a} style={{ background: '#111713' }}>
                    {a}
                  </option>
                ))}
              </Select>

              <Select
                size="sm"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                bg="#0F1A11"
                color="#F4F7F0"
                border="1px solid #2A3A2C"
                borderRadius="8px"
                w="125px"
                _hover={{ borderColor: '#B7FF35' }}
              >
                {QUALITY_OPTIONS.map((q) => (
                  <option key={q} value={q} style={{ background: '#111713' }}>
                    {q}
                  </option>
                ))}
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
                Gallery ({galleryItems.length})
              </Button>
            </Flex>
          </Flex>
        </Box>

        {/* MAIN STAGE: THE ONE ACTIVE GENERATION */}
        <Box flex={1} display="flex" flexDir="column" pb="150px">
          <Box
            bg="#111713"
            border="1px solid"
            borderColor={activeImage.isRecreation ? '#B7FF35' : '#2A3A2C'}
            borderRadius="18px"
            p={5}
            boxShadow="0 12px 40px rgba(0,0,0,0.6)"
            position="relative"
          >
            {/* Active Generation Header Info */}
            <Flex justify="space-between" align="center" mb={3} pb={2.5} borderBottom="1px solid #1A2A1C">
              <Box flex={1}>
                <Flex align="center" gap={2} mb={1}>
                  <Badge bg="rgba(183,255,53,0.15)" color="#B7FF35" fontSize="10px" px={2} py={0.5} borderRadius="4px">
                    Active Output
                  </Badge>
                  <Text fontSize="11px" color="#6B7B6D">
                    {activeImage.timestamp} · Generated with {activeImage.model}
                  </Text>
                  {activeImage.isRecreation && (
                    <Badge bg="#182019" color="#8DDB39" fontSize="10px">
                      {activeImage.recreationNote}
                    </Badge>
                  )}
                </Flex>
                <Text fontSize="sm" color="#F4F7F0" fontWeight="600" noOfLines={2}>
                  {activeImage.prompt}
                </Text>
              </Box>

              <HStack spacing={2}>
                {/* Selective Inpaint Recreate button */}
                <Button
                  size="sm"
                  bg="rgba(183, 255, 53, 0.15)"
                  color="#B7FF35"
                  border="1px solid rgba(183, 255, 53, 0.35)"
                  _hover={{ bg: '#B7FF35', color: '#080B0A' }}
                  leftIcon={<Text>⭕</Text>}
                  onClick={handleOpenSelectiveRecreate}
                  fontWeight="bold"
                >
                  Selective Recreate (Circle Region)
                </Button>

                {/* Download */}
                <Button
                  as="a"
                  href={activeImage.imageUrl}
                  download="imagineai-creation.png"
                  target="_blank"
                  size="sm"
                  variant="ghost"
                  color="#A5B1A7"
                  _hover={{ color: '#B7FF35', bg: '#182019' }}
                  leftIcon={<FiDownload />}
                >
                  Save
                </Button>
              </HStack>
            </Flex>

            {/* Main Stage Image Display */}
            <Box
              position="relative"
              borderRadius="14px"
              overflow="hidden"
              border="1px solid #2A3A2C"
              bg="#080B0A"
              display="flex"
              alignItems="center"
              justifyContent="center"
              minH="360px"
              maxH="520px"
            >
              {isGenerating ? (
                <Flex direction="column" align="center" justify="center" p={12} gap={3}>
                  <Text fontSize="28px" animation="spin 1.5s linear infinite">
                    ✦
                  </Text>
                  <Text fontSize="sm" color="#B7FF35" fontWeight="600">
                    Generating high-resolution artwork with {model}...
                  </Text>
                </Flex>
              ) : (
                <Image
                  src={activeImage.imageUrl}
                  alt={activeImage.prompt}
                  w="100%"
                  maxH="520px"
                  objectFit="contain"
                  transition="transform 0.3s ease"
                />
              )}

              {/* Tag Overlays */}
              <Flex position="absolute" top={3} left={3} gap={2}>
                <Badge bg="rgba(8,11,10,0.85)" color="#F4F7F0" backdropFilter="blur(8px)" fontSize="10px" px={2.5} py={1} borderRadius="6px">
                  {activeImage.style}
                </Badge>
                <Badge bg="rgba(183,255,53,0.2)" color="#B7FF35" backdropFilter="blur(8px)" fontSize="10px" px={2.5} py={1} borderRadius="6px">
                  {activeImage.aspect}
                </Badge>
              </Flex>
            </Box>

            {/* Quick Actions & Vision inspector */}
            <Flex justify="space-between" align="center" mt={3} pt={2}>
              <HStack spacing={3}>
                <Button
                  size="xs"
                  variant="ghost"
                  color="#A5B1A7"
                  _hover={{ color: '#F4F7F0', bg: '#182019' }}
                  leftIcon={<FiSliders />}
                  onClick={() => setPrompt(activeImage.prompt)}
                >
                  Load Prompt into Composer
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  color="#A5B1A7"
                  _hover={{ color: '#B7FF35', bg: '#182019' }}
                  onClick={() => setShowVisionAnalysis(!showVisionAnalysis)}
                >
                  {showVisionAnalysis ? 'Hide Vision Inspection' : '👁️ Vision Analysis'}
                </Button>
              </HStack>
              <Text fontSize="11px" color="#6B7B6D">
                Saved in Gallery · Ready for Export or Remix
              </Text>
            </Flex>

            {showVisionAnalysis && (
              <Box mt={3} p={3.5} bg="#0D120E" border="1px solid #2A3A2C" borderRadius="10px">
                <Text fontSize="11px" color="#B7FF35" fontWeight="bold" mb={1}>
                  👁️ Imagine Vision Assistant
                </Text>
                <Text fontSize="xs" color="#A5B1A7">
                  The generation demonstrates well-balanced focal hierarchy with volumetric atmospheric depth. High-frequency contrast accents the architectural details, with soft warm glow in the specular highlights.
                </Text>
              </Box>
            )}
          </Box>

          {/* RECENT OUTPUTS FILMSTRIP (REST INSIDE GALLERY) */}
          <Box mt={4} p={3.5} bg="#111713" border="1px solid #2A3A2C" borderRadius="14px">
            <Flex justify="space-between" align="center" mb={2.5}>
              <Flex align="center" gap={2}>
                <Text fontSize="xs" color="#A5B1A7" fontWeight="bold" textTransform="uppercase" letterSpacing="0.05em">
                  Recent Outputs in Gallery
                </Text>
                <Badge bg="#182019" color="#8DDB39" fontSize="10px">
                  {galleryItems.length} Saved
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
                Open Full Gallery
              </Button>
            </Flex>

            {/* Thumbnails row */}
            <Flex gap={3} overflowX="auto" pb={1}>
              {galleryItems.map((item) => {
                const isSelected = item.id === activeImage.id;
                return (
                  <Box
                    key={item.id}
                    position="relative"
                    w="90px"
                    h="65px"
                    flexShrink={0}
                    borderRadius="8px"
                    overflow="hidden"
                    border="2px solid"
                    borderColor={isSelected ? '#B7FF35' : '#2A3A2C'}
                    cursor="pointer"
                    _hover={{ borderColor: '#B7FF35', transform: 'scale(1.04)' }}
                    transition="all 0.2s ease"
                    onClick={() => setActiveImage(item)}
                  >
                    <Image src={item.imageUrl} alt={item.prompt} w="100%" h="100%" objectFit="cover" />
                    {isSelected && (
                      <Box
                        position="absolute"
                        bottom={1}
                        right={1}
                        w="8px"
                        h="8px"
                        borderRadius="full"
                        bg="#B7FF35"
                      />
                    )}
                  </Box>
                );
              })}
            </Flex>
          </Box>
        </Box>

        {/* BOTTOM MULTIMODAL PROMPT DOCK */}
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
          {attachedImage && (
            <Flex gap={2} mb={2} px={1} align="center">
              <Flex align="center" gap={1.5} bg="#182019" px={2.5} py={1} borderRadius="8px" border="1px solid #2A3A2C">
                <Image src={attachedImage} w="20px" h="20px" borderRadius="4px" objectFit="cover" />
                <Text fontSize="xs" color="#A5B1A7">Image Reference</Text>
                <IconButton
                  aria-label="Remove image"
                  icon={<FiX size={12} />}
                  size="xs"
                  variant="ghost"
                  color="#FF4444"
                  onClick={() => setAttachedImage(null)}
                />
              </Flex>
            </Flex>
          )}

          <Flex align="flex-end" gap={2}>
            {/* Attachment input */}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={handleImageUpload}
            />
            <Tooltip label="Upload image reference (Image-to-Image)">
              <IconButton
                aria-label="Upload reference"
                icon={<FiPaperclip size={18} />}
                variant="ghost"
                color={attachedImage ? '#B7FF35' : '#A5B1A7'}
                bg={attachedImage ? '#182019' : 'transparent'}
                _hover={{ color: '#F4F7F0', bg: '#182019' }}
                borderRadius="10px"
                onClick={() => fileInputRef.current?.click()}
              />
            </Tooltip>

            {/* Voice Assistant & Translation Button */}
            <Tooltip label="Speak in any language (Voice Translator & Prompter)">
              <IconButton
                aria-label="Voice input"
                icon={<FiMic size={18} />}
                variant="ghost"
                color="#A5B1A7"
                _hover={{ color: '#B7FF35', bg: '#182019' }}
                borderRadius="10px"
                onClick={() => setIsVoiceOpen(true)}
              />
            </Tooltip>

            {/* Enhance prompt button */}
            <Tooltip label="✨ Enhance prompt with AI detail">
              <Button
                size="sm"
                variant="outline"
                borderColor="#2A3A2C"
                color="#B7FF35"
                _hover={{ bg: '#1A2A1C', borderColor: '#B7FF35' }}
                borderRadius="10px"
                px={3}
                onClick={handleEnhancePrompt}
                leftIcon={<FiZap size={14} />}
                fontSize="xs"
              >
                Enhance
              </Button>
            </Tooltip>

            {/* Main Textarea */}
            <Textarea
              placeholder="Describe what you want to generate, or use the mic to speak... (Press Enter to generate)"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              minH="44px"
              maxH="120px"
              py={2.5}
              px={3}
              variant="unstyled"
              color="#F4F7F0"
              fontSize="sm"
              _placeholder={{ color: '#6B7B6D' }}
              resize="none"
              flex={1}
            />

            {/* Generate Button */}
            <Button
              bg="#B7FF35"
              color="#080B0A"
              fontWeight="700"
              fontSize="sm"
              borderRadius="12px"
              px={5}
              h="42px"
              _hover={{ bg: '#8DDB39', transform: 'translateY(-1px)' }}
              _active={{ bg: '#6FBB20' }}
              onClick={handleGenerate}
              isLoading={isGenerating}
              rightIcon={<FiSend size={14} />}
            >
              Generate
            </Button>
          </Flex>
        </Box>

        {/* VOICE ASSISTANT & TRANSLATION MODAL */}
        <Modal isOpen={isVoiceOpen} onClose={() => setIsVoiceOpen(false)} isCentered size="lg">
          <ModalOverlay bg="rgba(0,0,0,0.85)" backdropFilter="blur(6px)" />
          <ModalContent bg="#111713" border="1px solid #2A3A2C" borderRadius="18px" color="#F4F7F0">
            <ModalHeader borderBottom="1px solid #1A2A1C" py={4}>
              <Flex align="center" gap={2}>
                <Box w="28px" h="28px" borderRadius="full" bg="#B7FF35" display="flex" alignItems="center" justifyContent="center" color="#080B0A" fontSize="14px">
                  🎤
                </Box>
                <Text fontSize="md" fontWeight="bold">
                  Voice Assistant & Prompt Translator
                </Text>
              </Flex>
            </ModalHeader>
            <ModalCloseButton color="#A5B1A7" />

            <ModalBody py={5}>
              <Text fontSize="xs" color="#A5B1A7" mb={4}>
                Speak your idea naturally in your preferred language. Imagine AI automatically transcribes and translates it into an optimized English image generation prompt!
              </Text>

              <Box mb={4}>
                <Text fontSize="xs" color="#6B7B6D" mb={1.5} textTransform="uppercase" letterSpacing="0.05em">
                  Select Speaking Language
                </Text>
                <Select
                  value={voiceLang.code}
                  onChange={(e) => {
                    const l = LANGUAGES.find((item) => item.code === e.target.value) || LANGUAGES[0];
                    setVoiceLang(l);
                    setSpokenText(l.sample);
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

              <Flex direction="column" align="center" justify="center" py={4}>
                <Box
                  w="72px"
                  h="72px"
                  borderRadius="full"
                  bg={isRecording ? '#FF4444' : '#182019'}
                  border="2px solid"
                  borderColor={isRecording ? '#FF4444' : '#B7FF35'}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  cursor="pointer"
                  onClick={handleToggleRecord}
                  boxShadow={isRecording ? '0 0 25px rgba(255,68,68,0.5)' : '0 0 20px rgba(183,255,53,0.3)'}
                >
                  <FiMic size={30} color={isRecording ? '#F4F7F0' : '#B7FF35'} />
                </Box>
                <Text fontSize="xs" color={isRecording ? '#FF4444' : '#B7FF35'} fontWeight="600" mt={2.5}>
                  {isRecording ? 'Listening... Speak now' : 'Tap microphone to speak'}
                </Text>
              </Flex>

              <Box bg="#0D120E" p={4} borderRadius="12px" border="1px solid #2A3A2C" mt={2}>
                <Text fontSize="10px" color="#6B7B6D" textTransform="uppercase" fontWeight="bold">
                  Transcribed ({voiceLang.name})
                </Text>
                <Text fontSize="sm" color="#F4F7F0" my={1}>
                  "{spokenText}"
                </Text>
                <Box h="1px" bg="#1A2A1C" my={2} />
                <Text fontSize="10px" color="#8DDB39" textTransform="uppercase" fontWeight="bold">
                  ✨ Translated & Enhanced Generation Prompt
                </Text>
                <Text fontSize="sm" color="#B7FF35" fontWeight="500">
                  {translatedPrompt}
                </Text>
              </Box>
            </ModalBody>

            <ModalFooter borderTop="1px solid #1A2A1C" py={3}>
              <Button size="sm" variant="ghost" color="#A5B1A7" mr={3} onClick={() => setIsVoiceOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" bg="#B7FF35" color="#080B0A" fontWeight="bold" onClick={handleApplyVoicePrompt}>
                Use This Prompt
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* SELECTIVE RECREATION CANVAS CIRCLING MODAL */}
        <Modal isOpen={isRecreationOpen} onClose={() => setIsRecreationOpen(false)} isCentered size="2xl">
          <ModalOverlay bg="rgba(0,0,0,0.88)" backdropFilter="blur(8px)" />
          <ModalContent bg="#111713" border="1px solid #2A3A2C" borderRadius="20px" color="#F4F7F0" maxW="720px">
            <ModalHeader borderBottom="1px solid #1A2A1C" py={4}>
              <Flex align="center" justify="space-between">
                <Flex align="center" gap={2.5}>
                  <Box w="30px" h="30px" borderRadius="full" bg="#B7FF35" display="flex" alignItems="center" justifyContent="center" color="#080B0A" fontSize="15px">
                    ⭕
                  </Box>
                  <Box>
                    <Text fontSize="md" fontWeight="bold">
                      Selective Recreate — Circle & Inpaint Region
                    </Text>
                    <Text fontSize="xs" color="#A5B1A7" fontWeight="normal">
                      Click and drag on the image to circle the exact area you want recreated
                    </Text>
                  </Box>
                </Flex>
                <ModalCloseButton position="static" color="#A5B1A7" />
              </Flex>
            </ModalHeader>

            <ModalBody py={4}>
              <Box mb={4}>
                <InteractiveCanvasMask
                  imageUrl={activeImage.imageUrl}
                  onMaskChange={(hasMask) => setHasMaskSelected(hasMask)}
                />
              </Box>

              <Box mb={3}>
                <Text fontSize="xs" color="#A5B1A7" fontWeight="600" mb={1.5} textTransform="uppercase" letterSpacing="0.05em">
                  What should appear in the circled region?
                </Text>
                <Input
                  value={recreationInstruction}
                  onChange={(e) => setRecreationInstruction(e.target.value)}
                  placeholder="e.g. Add a glowing golden visor with cyber reflections, or make flowers bloom"
                  bg="#0F1A11"
                  color="#F4F7F0"
                  border="1px solid #2A3A2C"
                  borderRadius="10px"
                  size="sm"
                  _focus={{ borderColor: '#B7FF35' }}
                />
              </Box>

              <Flex justify="space-between" align="center" bg="#0D120E" p={2.5} borderRadius="8px" border="1px solid #1A2A1C">
                <Text fontSize="11px" color="#6B7B6D">
                  Region targeted: <span style={{ color: hasMaskSelected ? '#B7FF35' : '#FFB800', fontWeight: 'bold' }}>{hasMaskSelected ? '✓ Active Canvas Circle / Mask' : '⚠️ No area circled yet (Full image will be varied)'}</span>
                </Text>
                <Badge bg="rgba(183, 255, 53, 0.15)" color="#B7FF35" fontSize="10px">
                  Inpaint Engine Ready
                </Badge>
              </Flex>
            </ModalBody>

            <ModalFooter borderTop="1px solid #1A2A1C" py={3}>
              <Button size="sm" variant="ghost" color="#A5B1A7" mr={3} onClick={() => setIsRecreationOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                bg="#B7FF35"
                color="#080B0A"
                fontWeight="bold"
                onClick={handleApplySelectiveRecreation}
                leftIcon={<Text>✨</Text>}
                _hover={{ bg: '#8DDB39' }}
              >
                Recreate Circled Region
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
    </WorkspaceLayout>
  );
};

export default CreateStudio;
