import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  Checkbox,
  Collapse,
  SimpleGrid,
  Spinner,
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
  FiChevronDown,
  FiChevronUp,
  FiEdit3,
  FiInfo,
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { SHOWCASE } from '../lib/showcase';
import WorkspaceLayout from '../components/WorkspaceLayout';
import InteractiveCanvasMask from '../components/InteractiveCanvasMask';
import {
  enhancePrompt,
  generateImage,
  generateWithModel,
  generateInpaint,
  generateImg2Img,
  getCapabilities,
  getGalleryItems,
  toSameOriginImageUrl,
  getModelCatalogue,
  ModelCatalogueEntry,
  cvAnalyze,
  type ImageAnalysis,
} from '../lib/api';

interface GenerationItem {
  id: string;
  timestamp: string;
  prompt: string;
  enhancedPrompt?: string;
  style: string;
  model: string;
  steps?: number;
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
  'Oil Painting',
  'Pencil Sketch',
  'Vintage Film',
];

const ASPECT_OPTIONS = ['1:1 Square', '16:9 Landscape', '9:16 Portrait', '4:3 Standard'];
const aspectLabel = (a: string) => a.split(' ').slice(1).join(' ') || a;
const QUALITY_HINT: Record<string, string> = { Quick: 'fastest', Balanced: 'recommended', Best: 'most detail' };
const QUALITY_OPTIONS = ['Quick', 'Balanced', 'Best'];

const QUALITY_STEPS: Record<string, Record<string, number>> = {
  sd_turbo: { quick: 1, balanced: 2, best: 4 },
  sd15_optimized: { quick: 2, balanced: 4, best: 8 },
  imagineai_lcm: { quick: 2, balanced: 4, best: 8 },
  sd15_adapted: { quick: 8, balanced: 15, best: 30 },
  sd15_baseline: { quick: 8, balanced: 15, best: 30 },
};

// The dedicated SD inpainting model is a normal (multi-step) diffusion model, unlike the 1-4 step text-to-image presets.
const INPAINT_STEPS: Record<string, number> = { quick: 12, balanced: 24, best: 36 };

const getQualityPreset = (quality: string) =>
  quality.toLowerCase().startsWith('quick') ? 'quick' : quality.toLowerCase().startsWith('best') ? 'best' : 'balanced';

const getQualitySteps = (modelChoice: string, preset: string) =>
  QUALITY_STEPS[modelChoice]?.[preset] ?? QUALITY_STEPS.sd_turbo[preset];

// Plain-language engine names (the technical model id stays in the tooltip/details).
const MODEL_UI_NAMES: Record<string, string> = {
  sd_turbo: 'Fastest (SD-Turbo)',
  sd15: 'Highest detail (slower)',
  sd15_optimized: 'Fast and detailed',
  imagineai_lcm: 'Our own model (ImagineAI)',
  sd15_adapted: 'Everyday photos (tuned)',
};

const modelUiName = (entry: ModelCatalogueEntry) => MODEL_UI_NAMES[entry.id] || entry.display_name;

const ASPECT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1 Square': { width: 512, height: 512 },
  '16:9 Landscape': { width: 768, height: 432 },
  '9:16 Portrait': { width: 432, height: 768 },
  '4:3 Standard': { width: 640, height: 480 },
};

async function imageUrlToDataUrl(url: string): Promise<string> {
  const sameOrigin = toSameOriginImageUrl(url);
  const res = await fetch(sameOrigin);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const handleDownloadImage = async (imgUrl: string, filename = 'imagineai-creation.png') => {
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

const STYLE_PROMPTS: Record<string, string> = {
  Photorealistic: 'photorealistic, natural lighting, realistic materials, high detail, 8k resolution',
  'Cinematic 3D': 'cinematic 3D render, physically based materials, dramatic lighting, depth of field',
  'Anime & Manga': 'anime and manga illustration, clean linework, expressive composition, cel shading',
  'Comic Book': 'comic book art, bold ink lines, dynamic composition, rich colors, halftone detail',
  'Fantasy Art': 'fantasy concept art, imaginative worldbuilding, atmospheric lighting, intricate detail',
  Cyberpunk: 'cyberpunk concept art, neon lighting, futuristic technology, rain-slick atmosphere',
  Watercolor: 'watercolor painting, visible brush texture, soft washes, paper grain, artistic',
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
  id: 'demo-cabin',
  timestamp: 'Ready',
  prompt: 'A cozy modern wooden cabin nestled in pine forest beside a calm mountain lake at golden hour',
  enhancedPrompt: 'A cozy architectural wooden cabin beside a reflective mountain lake surrounded by autumn pines at sunset, 8k resolution.',
  style: 'Photorealistic',
  model: 'SD 1.5 (example made with ImagineAI)',
  aspect: '16:9 Landscape',
  imageUrl: SHOWCASE.cabin.src,
};

const INITIAL_GALLERY: GenerationItem[] = [INITIAL_IMAGE];

const CreateStudio: React.FC = () => {
  const [activeImage, setActiveImage] = useState<GenerationItem>(INITIAL_IMAGE);
  const [galleryItems, setGalleryItems] = useState<GenerationItem[]>(INITIAL_GALLERY);

  const [prompt, setPrompt] = useState(() => new URLSearchParams(window.location.search).get('prompt') || '');
  const [style, setStyle] = useState('Photorealistic');
  const [model, setModel] = useState('Fastest (SD-Turbo)');
  const [aspect, setAspect] = useState('16:9 Landscape');
  const [quality, setQuality] = useState('Balanced');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
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
  const [snapToEdges, setSnapToEdges] = useState(false);
  const [blendSeamless, setBlendSeamless] = useState(true);
  const [hasMaskSelected, setHasMaskSelected] = useState(false);
  const [currentMaskDataUrl, setCurrentMaskDataUrl] = useState<string | null>(null);
  const [inpaintAvailable, setInpaintAvailable] = useState(true);

  // Vision inspection
  const [showVisionAnalysis, setShowVisionAnalysis] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);
  const [analysing, setAnalysing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    getModelCatalogue()
      .then((result) => setModelCatalogue(result.models))
      .catch((error) => setGenerationError(error instanceof Error ? error.message : 'Unable to load model catalogue.'));

    getCapabilities()
      .then((caps) => {
        setInpaintAvailable(Boolean(caps.generation_available && caps.inpainting_available !== false));
      })
      .catch(() => {});

    getGalleryItems()
      .then((res) => {
        if (res.items && res.items.length > 0) {
          const mapped: GenerationItem[] = res.items.map((it) => ({
            id: it.id,
            timestamp: new Date(it.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            prompt: it.prompt,
            style: it.style || 'Photorealistic',
            model: it.model || 'SD-Turbo',
            aspect: it.width > it.height ? '16:9 Landscape' : it.height > it.width ? '9:16 Portrait' : '1:1 Square',
            imageUrl: it.image_url,
            isRecreation: it.category === 'inpaint',
            recreationNote: it.recreation_note,
          }));
          setActiveImage(mapped[0]);
          setGalleryItems(mapped);
        }
      })
      .catch(() => {});
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

  const handleEnhancePrompt = async () => {
    const sourcePrompt = prompt.trim();
    if (!sourcePrompt) {
      setGenerationError('Enter a word or idea before enhancing the prompt.');
      return;
    }

    setIsEnhancing(true);
    setGenerationError(null);
    try {
      const result = await enhancePrompt(sourcePrompt);
      setPrompt(result.prompt);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'AI prompt enhancement failed.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
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
      const styleText = STYLE_PROMPTS[style] || STYLE_PROMPTS.Photorealistic;
      let styledPrompt = `${newPrompt}, ${styleText}`;
      if (styledPrompt.length > 500) {
        const maxLen = 500 - styleText.length - 2;
        styledPrompt = `${newPrompt.slice(0, Math.max(10, maxLen)).trim()}, ${styleText}`;
      }

      const dims = ASPECT_DIMENSIONS[aspect] || { width: 512, height: 512 };
      const selectedModelId = modelCatalogue.find((entry) => modelUiName(entry) === model)?.id;
      const modelChoice = selectedModelId === 'sd15'
        ? 'sd15_baseline'
        : selectedModelId === 'sd15_optimized'
          ? 'sd15_optimized'
          : selectedModelId === 'imagineai_lcm'
            ? 'imagineai_lcm'
          : selectedModelId === 'sd15_adapted'
            ? 'sd15_adapted'
            : 'sd_turbo';
      const qualityPreset = getQualityPreset(quality);
      const steps = getQualitySteps(modelChoice, qualityPreset);

      let resultUrl = '';
      let requestId = '';
      let usedModel = model;
      let usedSteps = steps;

      if (attachedImage) {
        // True Image-to-Image reference conditioning
        const res = await generateImg2Img({
          prompt: styledPrompt,
          imageBase64: attachedImage,
          modelChoice,
          steps,
          style,
        });
        resultUrl = res.image_url;
        requestId = res.request_id;
        usedSteps = res.steps;
        usedModel = `${model} (Img2Img)`;
      } else {
        const res = await generateWithModel({
          prompt: newPrompt,
          modelChoice,
          width: dims.width,
          height: dims.height,
          resolution: Math.max(dims.width, dims.height),
          steps,
          category: 'single',
          style,
        });
        resultUrl = res.image_url;
        requestId = res.request_id;
        usedSteps = res.steps;
      }

      const newGen: GenerationItem = {
        id: requestId,
        timestamp: 'Just now',
        prompt: newPrompt,
        style,
        model: usedModel,
        steps: usedSteps,
        aspect,
        imageUrl: resultUrl,
        referenceImage: attachedImage || undefined,
        voiceLanguage: spokenText && prompt.includes(translatedPrompt) ? voiceLang.name : undefined,
        originalVoiceText: spokenText && prompt.includes(translatedPrompt) ? spokenText : undefined,
      };

      setActiveImage(newGen);
      setGalleryItems((prev) => [newGen, ...prev]);
      setPrompt('');
      setAttachedImage(null);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Image generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Selective Recreation Handler
  const toggleDetails = async () => {
    const next = !showVisionAnalysis;
    setShowVisionAnalysis(next);
    if (!next) return;
    setAnalysis(null);
    setAnalysing(true);
    try {
      setAnalysis(await cvAnalyze(await imageUrlToDataUrl(activeImage.imageUrl)));
    } catch {
      setAnalysis(null);
    } finally {
      setAnalysing(false);
    }
  };

  useEffect(() => {
    setShowVisionAnalysis(false);
    setAnalysis(null);
  }, [activeImage.id]);

  const handleOpenSelectiveRecreate = () => {
    setRecreationInstruction('Change the sky to deep violet with shooting stars and neon aurora');
    setIsRecreationOpen(true);
  };

  const handleMaskChange = useCallback((hasMask: boolean, maskUrl?: string) => {
    setHasMaskSelected(hasMask);
    setCurrentMaskDataUrl(maskUrl || null);
  }, []);

  const handleApplySelectiveRecreation = async () => {
    if (!currentMaskDataUrl) {
      setGenerationError('Please circle or brush an area on the canvas first.');
      return;
    }
    if (!inpaintAvailable) {
      setGenerationError('Inpainting is currently unavailable on the backend runtime.');
      return;
    }

    setIsGenerating(true);
    setIsRecreationOpen(false);
    setGenerationError(null);

    try {
      const originalBase64 = await imageUrlToDataUrl(activeImage.imageUrl);
      const inpaintRes = await generateInpaint({
        prompt: recreationInstruction.trim() || activeImage.prompt,
        imageBase64: originalBase64,
        maskBase64: currentMaskDataUrl,
        steps: INPAINT_STEPS[getQualityPreset(quality)],
        sourceId: activeImage.id,
        style: activeImage.style,
        recreationNote: recreationInstruction,
        smartSelect: snapToEdges,
        harmonise: blendSeamless,
      });

      const recreated: GenerationItem = {
        id: inpaintRes.request_id,
        timestamp: 'Just now (Inpainted)',
        prompt: `${activeImage.prompt} [Inpaint: ${recreationInstruction}]`,
        style: activeImage.style,
        model: inpaintRes.model_choice,
        steps: inpaintRes.steps,
        aspect: activeImage.aspect,
        imageUrl: inpaintRes.image_url,
        isRecreation: true,
        recreationNote: `Inpaint: "${recreationInstruction}"`,
      };

      setActiveImage(recreated);
      setGalleryItems((prev) => [recreated, ...prev]);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Inpainting failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <WorkspaceLayout>
      <Box p={{ base: 3, md: 5 }} minH="100vh" bg="#FBF8F4" display="flex" flexDir="column">
        <Box maxW="860px" mx="auto" w="100%">
          <Heading as="h1" size="lg" color="#1E2233" fontWeight="800" letterSpacing="-0.02em">
            Create an image
          </Heading>
          <Text color="#5B6277" mt={1} mb={6}>
            Describe what you imagine in your own words, and we will draw it for you.
          </Text>

          {generationError && (
            <Box mb={4} px={4} py={3} borderRadius="12px" bg="#FEECEC" border="1px solid #F5C2C4" color="#B42318" fontSize="sm" role="alert">
              {generationError}
            </Box>
          )}

          {/* STEP 1: DESCRIBE */}
          <Box bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="20px" p={{ base: 4, md: 5 }}
            boxShadow="0 1px 2px rgba(30,34,51,0.05), 0 8px 24px rgba(30,34,51,0.06)">
            <Text fontSize="sm" fontWeight="700" color="#1E2233" mb={2}>1. What do you want to see?</Text>
            {attachedImage && (
              <Flex align="center" gap={2} mb={2} bg="#F7F3EE" px={3} py={2} borderRadius="10px" w="fit-content">
                <Image src={attachedImage} w="28px" h="28px" borderRadius="6px" objectFit="cover" alt="Your reference photo" />
                <Text fontSize="xs" color="#5B6277">We will use your photo as a starting point</Text>
                <IconButton aria-label="Remove photo" icon={<FiX size={14} />} size="xs" variant="ghost" color="#E5484D" onClick={() => setAttachedImage(null)} />
              </Flex>
            )}
            <Textarea
              placeholder="For example: a cozy cabin in a snowy forest at sunset"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              minH="96px"
              fontSize="md"
              resize="vertical"
              aria-label="Describe your image"
            />
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload} />
            <Flex mt={3} align="center" justify="space-between" wrap="wrap" gap={3}>
              <HStack spacing={1} wrap="wrap">
                <Button size="sm" variant="ghost" leftIcon={<FiPaperclip />} onClick={() => fileInputRef.current?.click()}
                  color={attachedImage ? '#5B5BF0' : '#5B6277'}>Add a photo</Button>
                <Button size="sm" variant="ghost" leftIcon={<FiMic />} onClick={() => setIsVoiceOpen(true)} color="#5B6277">Speak it</Button>
                <Tooltip label="Rewrites your idea with richer detail" hasArrow>
                  <Button size="sm" variant="ghost" leftIcon={<FiZap />} onClick={handleEnhancePrompt} isLoading={isEnhancing}
                    isDisabled={isEnhancing || isGenerating || !prompt.trim()} color="#5B6277">Improve my words</Button>
                </Tooltip>
              </HStack>
              <Button variant="brand" size="lg" px={8} onClick={handleGenerate} isLoading={isGenerating} loadingText="Creating..."
                rightIcon={<FiSend />} isDisabled={!prompt.trim() && !attachedImage}>
                Create image
              </Button>
            </Flex>
          </Box>

          {/* STEP 2: LOOK */}
          <Box mt={6}>
            <Text fontSize="sm" fontWeight="700" color="#1E2233" mb={2}>2. Choose a look</Text>
            <Flex wrap="wrap" gap={2} role="radiogroup" aria-label="Choose a look">
              {STYLE_OPTIONS.map((s2) => (
                <Button key={s2} size="sm" borderRadius="full" role="radio" aria-checked={style === s2}
                  bg={style === s2 ? '#5B5BF0' : '#FFFFFF'} color={style === s2 ? '#FFFFFF' : '#1E2233'}
                  border="1px solid" borderColor={style === s2 ? '#5B5BF0' : '#E3DACF'} fontWeight={style === s2 ? 700 : 500}
                  _hover={{ borderColor: '#5B5BF0', bg: style === s2 ? '#4747DB' : '#EEF0FF' }} onClick={() => setStyle(s2)}>
                  {s2}
                </Button>
              ))}
            </Flex>
          </Box>

          {/* MORE OPTIONS (hidden by default) */}
          <Button mt={4} variant="link" color="#5B6277" size="sm" onClick={() => setShowMore((v) => !v)}
            rightIcon={showMore ? <FiChevronUp /> : <FiChevronDown />} aria-expanded={showMore}>
            More options (engine, quality, shape)
          </Button>
          <Collapse in={showMore} animateOpacity>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mt={3} p={4} bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="16px">
              <Box>
                <Text fontSize="xs" fontWeight="700" color="#5B6277" mb={1}>Engine</Text>
                <Select size="sm" value={model} onChange={(e) => setModel(e.target.value)} aria-label="Engine">
                  {(modelCatalogue.length > 0 ? modelCatalogue : [{
                    id: 'sd_turbo', display_name: 'SD-Turbo', task: 'text-to-image', role: 'Quick generation', checkpoint: 'stabilityai/sd-turbo',
                    license_reference: '', quality_modes: ['quick', 'balanced', 'best'], available: true, availability_reason: '', configured: true,
                  }]).map((entry) => (
                    <option key={entry.id} value={modelUiName(entry)} disabled={!entry.available}>
                      {modelUiName(entry)}{entry.available ? '' : ' (not installed)'}
                    </option>
                  ))}
                </Select>
              </Box>
              <Box>
                <Text fontSize="xs" fontWeight="700" color="#5B6277" mb={1}>Quality</Text>
                <Select size="sm" value={quality} onChange={(e) => setQuality(e.target.value)} aria-label="Quality">
                  {QUALITY_OPTIONS.map((q) => <option key={q} value={q}>{q} ({QUALITY_HINT[q]})</option>)}
                </Select>
              </Box>
              <Box>
                <Text fontSize="xs" fontWeight="700" color="#5B6277" mb={1}>Shape</Text>
                <Select size="sm" value={aspect} onChange={(e) => setAspect(e.target.value)} aria-label="Shape">
                  {ASPECT_OPTIONS.map((a) => <option key={a} value={a}>{aspectLabel(a)}</option>)}
                </Select>
              </Box>
            </SimpleGrid>
          </Collapse>

          {/* RESULT */}
          <Box mt={8} bg="#FFFFFF" border="1px solid" borderColor={activeImage.isRecreation ? '#5B5BF0' : '#E3DACF'} borderRadius="20px" p={{ base: 3, md: 5 }}
            boxShadow="0 1px 2px rgba(30,34,51,0.05), 0 8px 24px rgba(30,34,51,0.06)">
            <Flex justify="space-between" align="center" mb={3} wrap="wrap" gap={2}>
              <Box minW={0} flex={1}>
                <Text fontSize="sm" fontWeight="700" color="#1E2233">Your image</Text>
                <Text fontSize="sm" color="#5B6277" noOfLines={2}>{activeImage.prompt}</Text>
              </Box>
              {activeImage.isRecreation && <Badge bg="#EEF0FF" color="#4747DB" borderRadius="full" px={3} py={1} textTransform="none">{activeImage.recreationNote}</Badge>}
            </Flex>

            <Flex align="center" justify="center" bg="#FBF8F4" borderRadius="14px" border="1px solid #EFE8DF" minH={{ base: '260px', md: '380px' }} overflow="hidden">
              {isGenerating ? (
                <Flex direction="column" align="center" gap={3} p={10} role="status">
                  <Spinner size="xl" color="#5B5BF0" thickness="4px" />
                  <Text fontWeight="600" color="#1E2233">Drawing your image...</Text>
                  <Text fontSize="sm" color="#5B6277">This usually takes a few seconds.</Text>
                </Flex>
              ) : (
                <Image src={activeImage.imageUrl} alt={activeImage.prompt} maxW="100%" maxH={{ base: '360px', md: '520px' }} objectFit="contain" />
              )}
            </Flex>

            <Flex mt={4} gap={2} wrap="wrap">
              <Button leftIcon={<FiEdit3 />} variant="brand" onClick={handleOpenSelectiveRecreate} isDisabled={!inpaintAvailable || isGenerating}>
                Change part of this image
              </Button>
              <Button leftIcon={<FiDownload />} variant="outline" isDisabled={isGenerating}
                onClick={() => handleDownloadImage(activeImage.imageUrl, `imagineai-${activeImage.id || Date.now()}.png`)}>
                Download
              </Button>
              <Button leftIcon={<FiRefreshCw />} variant="ghost" isDisabled={isGenerating}
                onClick={() => { setPrompt(activeImage.prompt); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                Use this idea again
              </Button>
              <Button leftIcon={<FiInfo />} variant="ghost" onClick={toggleDetails} aria-expanded={showVisionAnalysis}>
                {showVisionAnalysis ? 'Hide details' : 'About this image'}
              </Button>
            </Flex>

            <Collapse in={showVisionAnalysis} animateOpacity>
              <Box mt={4} p={4} bg="#F7F3EE" borderRadius="14px">
                {analysing && <Flex align="center" gap={2}><Spinner size="sm" color="#5B5BF0" /><Text fontSize="sm" color="#5B6277">Measuring the image...</Text></Flex>}
                {!analysing && !analysis && <Text fontSize="sm" color="#5B6277">Could not measure this image.</Text>}
                {analysis && (
                  <>
                    <SimpleGrid columns={{ base: 2, md: 5 }} spacing={3}>
                      {([['Sharpness', analysis.sharpness], ['Brightness', analysis.brightness], ['Contrast', analysis.contrast], ['Colour', analysis.colourfulness], ['Grain', analysis.noise]] as const).map(([k, v]) => (
                        <Box key={k} bg="#FFFFFF" borderRadius="12px" p={3} border="1px solid #EFE8DF">
                          <Text fontSize="11px" color="#8A90A2" fontWeight="700" textTransform="uppercase">{k}</Text>
                          <Text fontWeight="700" color="#1E2233">{v.label}</Text>
                        </Box>
                      ))}
                    </SimpleGrid>
                    <Flex mt={3} align="center" gap={2} wrap="wrap">
                      <Text fontSize="xs" color="#5B6277">Main colours:</Text>
                      {analysis.palette.map((c) => (
                        <Tooltip key={c.hex} label={`${c.hex} (${Math.round(c.share * 100)}%)`} hasArrow>
                          <Box w="28px" h="28px" borderRadius="full" bg={c.hex} border="2px solid #FFFFFF" boxShadow="0 0 0 1px #E3DACF" />
                        </Tooltip>
                      ))}
                      <Text fontSize="xs" color="#8A90A2" ml="auto">{activeImage.model} · {activeImage.steps ? `${activeImage.steps} steps · ` : ''}{analysis.width}x{analysis.height}px · measured with computer vision</Text>
                    </Flex>
                  </>
                )}
              </Box>
            </Collapse>
          </Box>

          {/* RECENT */}
          <Box mt={8}>
            <Flex justify="space-between" align="center" mb={3}>
              <Text fontSize="sm" fontWeight="700" color="#1E2233">Your recent creations</Text>
              <Button as={Link} to="/gallery" size="sm" variant="ghost" color="#5B5BF0" rightIcon={<FiArrowRight />}>See all</Button>
            </Flex>
            <Flex gap={3} overflowX="auto" pb={2}>
              {galleryItems.slice(0, 24).map((item) => {
                const isSelected = item.id === activeImage.id;
                return (
                  <Box key={item.id} as="button" w="104px" h="104px" flexShrink={0} borderRadius="14px" overflow="hidden" border="3px solid"
                    borderColor={isSelected ? '#5B5BF0' : 'transparent'} boxShadow="0 1px 4px rgba(30,34,51,0.12)"
                    _hover={{ transform: 'scale(1.04)' }} transition="all 0.15s ease" onClick={() => setActiveImage(item)} aria-label={`Open: ${item.prompt}`}>
                    <Image src={item.imageUrl} alt="" w="100%" h="100%" objectFit="cover" />
                  </Box>
                );
              })}
            </Flex>
          </Box>
        </Box>

        {/* VOICE ASSISTANT & TRANSLATION MODAL */}
        <Modal isOpen={isVoiceOpen} onClose={() => setIsVoiceOpen(false)} isCentered size="lg">
          <ModalOverlay bg="rgba(30,34,51,0.55)" backdropFilter="blur(6px)" />
          <ModalContent bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="18px" color="#1E2233">
            <ModalHeader borderBottom="1px solid #EFE8DF" py={4}>
              <Flex align="center" gap={2}>
                <Box w="28px" h="28px" borderRadius="full" bg="#5B5BF0" display="flex" alignItems="center" justifyContent="center" color="#FFFFFF" fontSize="14px">
                  🎤
                </Box>
                <Text fontSize="md" fontWeight="bold">
                  Voice Assistant & Prompt Translator
                </Text>
              </Flex>
            </ModalHeader>
            <ModalCloseButton color="#5B6277" />

            <ModalBody py={5}>
              <Text fontSize="xs" color="#5B6277" mb={4}>
                Speak your idea naturally in your preferred language. Imagine AI automatically transcribes and translates it into an optimized English image generation prompt!
              </Text>

              <Box mb={4}>
                <Text fontSize="xs" color="#8A90A2" mb={1.5} textTransform="uppercase" letterSpacing="0.05em">
                  Select Speaking Language
                </Text>
                <Select
                  value={voiceLang.code}
                  onChange={(e) => {
                    const l = LANGUAGES.find((item) => item.code === e.target.value) || LANGUAGES[0];
                    setVoiceLang(l);
                    setSpokenText(l.sample);
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

              <Flex direction="column" align="center" justify="center" py={4}>
                <Box
                  w="72px"
                  h="72px"
                  borderRadius="full"
                  bg={isRecording ? '#E5484D' : '#F5F0EA'}
                  border="2px solid"
                  borderColor={isRecording ? '#E5484D' : '#5B5BF0'}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  cursor="pointer"
                  onClick={handleToggleRecord}
                  boxShadow={isRecording ? '0 0 25px rgba(229,72,77,0.5)' : '0 0 20px rgba(91,91,240,0.14)'}
                >
                  <FiMic size={30} color={isRecording ? '#1E2233' : '#5B5BF0'} />
                </Box>
                <Text fontSize="xs" color={isRecording ? '#E5484D' : '#5B5BF0'} fontWeight="600" mt={2.5}>
                  {isRecording ? 'Listening... Speak now' : 'Tap microphone to speak'}
                </Text>
              </Flex>

              <Box bg="#FFFFFF" p={4} borderRadius="12px" border="1px solid #E3DACF" mt={2}>
                <Text fontSize="10px" color="#8A90A2" textTransform="uppercase" fontWeight="bold">
                  Transcribed ({voiceLang.name})
                </Text>
                <Text fontSize="sm" color="#1E2233" my={1}>
                  "{spokenText}"
                </Text>
                <Box h="1px" bg="#EFE8DF" my={2} />
                <Text fontSize="10px" color="#4747DB" textTransform="uppercase" fontWeight="bold">
                  ✨ Translated & Enhanced Generation Prompt
                </Text>
                <Text fontSize="sm" color="#5B5BF0" fontWeight="500">
                  {translatedPrompt}
                </Text>
              </Box>
            </ModalBody>

            <ModalFooter borderTop="1px solid #EFE8DF" py={3}>
              <Button size="sm" variant="ghost" color="#5B6277" mr={3} onClick={() => setIsVoiceOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" bg="#5B5BF0" color="#FFFFFF" fontWeight="bold" onClick={handleApplyVoicePrompt}>
                Use This Prompt
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* SELECTIVE RECREATION CANVAS CIRCLING MODAL */}
        <Modal isOpen={isRecreationOpen} onClose={() => setIsRecreationOpen(false)} isCentered size="2xl">
          <ModalOverlay bg="rgba(30,34,51,0.55)" backdropFilter="blur(8px)" />
          <ModalContent bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="20px" color="#1E2233" maxW="720px">
            <ModalHeader borderBottom="1px solid #EFE8DF" py={4}>
              <Flex align="center" justify="space-between">
                <Flex align="center" gap={2.5}>
                  <Box w="30px" h="30px" borderRadius="full" bg="#5B5BF0" display="flex" alignItems="center" justifyContent="center" color="#FFFFFF" fontSize="15px">
                    ⭕
                  </Box>
                  <Box>
                    <Text fontSize="md" fontWeight="bold">
                      Selective Recreate — Circle & Inpaint Region
                    </Text>
                    <Text fontSize="xs" color="#5B6277" fontWeight="normal">
                      Click and drag on the image to circle the exact area you want recreated
                    </Text>
                  </Box>
                </Flex>
                <ModalCloseButton position="static" color="#5B6277" />
              </Flex>
            </ModalHeader>

            <ModalBody py={4}>
              <Box mb={4}>
                <InteractiveCanvasMask
                  imageUrl={activeImage.imageUrl}
                  onMaskChange={handleMaskChange}
                />
              </Box>

              <Box mb={3}>
                <Text fontSize="xs" color="#5B6277" fontWeight="600" mb={1.5} textTransform="uppercase" letterSpacing="0.05em">
                  What should appear in the circled region?
                </Text>
                <Input
                  value={recreationInstruction}
                  onChange={(e) => setRecreationInstruction(e.target.value)}
                  placeholder="e.g. Add a glowing golden visor with cyber reflections, or make flowers bloom"
                  bg="#F7F3EE"
                  color="#1E2233"
                  border="1px solid #E3DACF"
                  borderRadius="10px"
                  size="sm"
                  _focus={{ borderColor: '#5B5BF0' }}
                />
              </Box>

              <Flex gap={5} mb={3} wrap="wrap">
                <Tooltip label="GrabCut (classical computer vision) snaps your rough stroke to the object's boundary" hasArrow>
                  <Checkbox size="sm" colorScheme="green" isChecked={snapToEdges} onChange={(e) => setSnapToEdges(e.target.checked)}>
                    <Text fontSize="xs" color="#5B6277">Snap selection to object edges</Text>
                  </Checkbox>
                </Tooltip>
                <Tooltip label="LAB colour matching + multiband (Laplacian pyramid) blending so the edit has no visible seam" hasArrow>
                  <Checkbox size="sm" colorScheme="green" isChecked={blendSeamless} onChange={(e) => setBlendSeamless(e.target.checked)}>
                    <Text fontSize="xs" color="#5B6277">Blend seamlessly</Text>
                  </Checkbox>
                </Tooltip>
              </Flex>

              <Flex justify="space-between" align="center" bg="#FFFFFF" p={2.5} borderRadius="8px" border="1px solid #EFE8DF">
                <Text fontSize="11px" color="#8A90A2">
                  Region targeted: <span style={{ color: hasMaskSelected ? '#5B5BF0' : '#C77700', fontWeight: 'bold' }}>{hasMaskSelected ? '✓ Active Canvas Circle / Mask' : '⚠️ No area circled yet (Please circle an area)'}</span>
                </Text>
                <Badge
                  bg={inpaintAvailable ? "rgba(91,91,240, 0.15)" : "rgba(229,72,77, 0.15)"}
                  color={inpaintAvailable ? "#5B5BF0" : "#E5484D"}
                  fontSize="10px"
                >
                  {inpaintAvailable ? 'Inpaint Engine Ready (SD inpainting + CV blend)' : 'Inpainting Model Unavailable'}
                </Badge>
              </Flex>
            </ModalBody>

            <ModalFooter borderTop="1px solid #EFE8DF" py={3}>
              <Button size="sm" variant="ghost" color="#5B6277" mr={3} onClick={() => setIsRecreationOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                bg="#5B5BF0"
                color="#FFFFFF"
                fontWeight="bold"
                onClick={handleApplySelectiveRecreation}
                isDisabled={!inpaintAvailable || !hasMaskSelected}
                leftIcon={<Text>✨</Text>}
                _hover={{ bg: '#4747DB' }}
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
