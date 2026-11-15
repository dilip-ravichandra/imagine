import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  CloseButton,
  Flex,
  Grid,
  Heading,
  HStack,
  IconButton,
  Image,
  Input,
  Select,
  SimpleGrid,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import { FiCornerUpLeft, FiCornerUpRight, FiDownload, FiEye, FiImage, FiSave, FiUpload } from 'react-icons/fi';
import WorkspaceLayout from '../components/WorkspaceLayout';
import InteractiveCanvasMask from '../components/InteractiveCanvasMask';
import {
  createGalleryItem,
  cvAdjust,
  cvStylize,
  cvUpscale,
  generateInpaint,
  getGalleryItems,
  getStyles,
  toSameOriginImageUrl,
  type AdjustParams,
  type GalleryItem,
  type StyleInfo,
} from '../lib/api';

interface Version {
  url: string; // data URL or same-origin image URL
  label: string;
}

const FALLBACK_STYLES: StyleInfo[] = ['Watercolor', 'Oil painting', 'Pencil sketch', 'Comic Book', 'Anime', 'Cinematic', 'Vintage film', 'Cyberpunk', 'Retro Pixel']
  .map((s) => ({ id: s, label: s, description: '', cv_finisher: true }));

const NEUTRAL: AdjustParams = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, sharpness: 0, denoise: 0, auto: false };
const INPAINT_STEPS: Record<string, number> = { Quick: 12, Balanced: 24, Best: 36 };

async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const blob = await (await fetch(toSameOriginImageUrl(url))).blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read the image.'));
    r.readAsDataURL(blob);
  });
}

const ImageEditor: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<Version[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [tab, setTab] = useState(0);
  const [recent, setRecent] = useState<GalleryItem[]>([]);

  // edit-region state
  const [maskUrl, setMaskUrl] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [snapToEdges, setSnapToEdges] = useState(false);
  const [blend, setBlend] = useState(true);
  const [quality, setQuality] = useState('Balanced');
  // style / adjust / upscale state
  const [styles, setStyles] = useState<StyleInfo[]>(FALLBACK_STYLES);
  const [styleStrength, setStyleStrength] = useState(100);
  const [adj, setAdj] = useState<AdjustParams>(NEUTRAL);
  const [scale, setScale] = useState(2);

  const current = history[cursor];
  const original = history[0];

  useEffect(() => {
    getStyles().then((r) => r.styles.length && setStyles(r.styles)).catch(() => undefined);
    getGalleryItems({}).then((r) => setRecent(r.items.slice(0, 12))).catch(() => undefined);
  }, []);

  const push = useCallback((v: Version) => {
    setHistory((h) => [...h.slice(0, cursor + 1), v]);
    setCursor((c) => c + 1);
    setMaskUrl(null);
    setAdj(NEUTRAL);
  }, [cursor]);

  const load = async (src: string, label: string) => {
    setError(null);
    setNotice(null);
    try {
      const url = await toDataUrl(src);
      setHistory([{ url, label }]);
      setCursor(0);
      setMaskUrl(null);
      setAdj(NEUTRAL);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the image.');
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPEG or WebP).');
      return;
    }
    const r = new FileReader();
    r.onload = () => load(String(r.result), f.name);
    r.readAsDataURL(f);
    e.target.value = '';
  };

  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const url = await toDataUrl(await fn());
      push({ url, label });
    } catch (e) {
      setError(e instanceof Error ? e.message : `${label} failed.`);
    } finally {
      setBusy(null);
    }
  };

  const applyRegionEdit = () => {
    if (!current || !maskUrl) return;
    run(`Edit: ${instruction.trim().slice(0, 28)}`, async () => {
      const res = await generateInpaint({
        prompt: instruction.trim(),
        imageBase64: current.url,
        maskBase64: maskUrl,
        steps: INPAINT_STEPS[quality],
        smartSelect: snapToEdges,
        harmonise: blend,
        style: 'Photorealistic',
      });
      return res.image_url;
    });
  };

  const download = () => {
    if (!current) return;
    const a = document.createElement('a');
    a.href = current.url;
    a.download = 'imagineai-edit.png';
    a.click();
  };

  const saveToGallery = async () => {
    if (!current) return;
    setBusy('Saving');
    try {
      // the gallery stores server URLs: re-upload the current pixels through the (free) CV adjust endpoint with neutral settings
      const res = await cvAdjust(current.url, NEUTRAL);
      await createGalleryItem({ image_url: res.image_url, prompt: current.label || 'Edited image', category: 'single', style: 'Edited', model: 'editor', width: res.width, height: res.height });
      setNotice('Saved to your gallery.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save to the gallery.');
    } finally {
      setBusy(null);
    }
  };

  const preview = `brightness(${1 + adj.brightness / 100}) contrast(${1 + adj.contrast / 100}) saturate(${1 + adj.saturation / 100})`;
  const slider = (key: keyof AdjustParams, label: string, min = -100) => (
    <Box key={key}>
      <Flex justify="space-between"><Text fontSize="xs" color="#5B6277">{label}</Text><Text fontSize="xs" color="#8A90A2">{Number(adj[key])}</Text></Flex>
      <Slider min={min} max={100} value={Number(adj[key])} onChange={(v) => setAdj((a) => ({ ...a, [key]: v }))} aria-label={label}>
        <SliderTrack bg="#EFE8DF"><SliderFilledTrack bg="#5B5BF0" /></SliderTrack>
        <SliderThumb />
      </Slider>
    </Box>
  );

  const panelBtn = { size: 'sm' as const, bg: '#5B5BF0', color: '#FFFFFF', fontWeight: 'bold', _hover: { bg: '#4747DB' }, isLoading: !!busy };

  return (
    <WorkspaceLayout>
      <Box p={{ base: 3, md: 6 }} minH="100vh" bg="#FBF8F4">
        <Flex align="center" justify="space-between" mb={4} wrap="wrap" gap={3}>
          <Flex align="center" gap={3}>
            <Heading size="lg" color="#1E2233" fontWeight="700">Image Editor</Heading>
            <Badge bg="rgba(91,91,240, 0.15)" color="#5B5BF0" px={3} py={1} borderRadius="full" fontSize="xs" textTransform="none">AI + computer vision</Badge>
          </Flex>
          <HStack spacing={2}>
            <Tooltip label="Undo"><IconButton aria-label="Undo" size="sm" variant="outline" borderColor="#E3DACF" color="#5B6277" icon={<FiCornerUpLeft />} isDisabled={cursor <= 0 || !!busy} onClick={() => setCursor((c) => c - 1)} /></Tooltip>
            <Tooltip label="Redo"><IconButton aria-label="Redo" size="sm" variant="outline" borderColor="#E3DACF" color="#5B6277" icon={<FiCornerUpRight />} isDisabled={cursor >= history.length - 1 || !!busy} onClick={() => setCursor((c) => c + 1)} /></Tooltip>
            <Button size="sm" variant="outline" borderColor="#E3DACF" color="#5B6277" leftIcon={<FiEye />} isDisabled={history.length < 2}
              onMouseDown={() => setShowOriginal(true)} onMouseUp={() => setShowOriginal(false)} onMouseLeave={() => setShowOriginal(false)}
              onTouchStart={() => setShowOriginal(true)} onTouchEnd={() => setShowOriginal(false)}>
              Hold to compare
            </Button>
            <Button size="sm" variant="outline" borderColor="#E3DACF" color="#5B6277" leftIcon={<FiDownload />} isDisabled={!current} onClick={download}>Download</Button>
            <Button size="sm" variant="outline" borderColor="#E3DACF" color="#5B6277" leftIcon={<FiSave />} isDisabled={!current || !!busy} onClick={saveToGallery}>Save</Button>
          </HStack>
        </Flex>

        {error && (
          <Alert status="error" bg="#FEECEC" color="#B42318" borderRadius="10px" mb={3}>
            <AlertIcon /><Text fontSize="sm" flex={1}>{error}</Text><CloseButton onClick={() => setError(null)} />
          </Alert>
        )}
        {notice && (
          <Alert status="success" bg="#E7F8EE" color="#5B5BF0" borderRadius="10px" mb={3}>
            <AlertIcon /><Text fontSize="sm" flex={1}>{notice}</Text><CloseButton onClick={() => setNotice(null)} />
          </Alert>
        )}

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} data-testid="editor-file-input" />

        <Flex gap={5} direction={{ base: 'column', lg: 'row' }}>
          {/* canvas */}
          <Box flex={1} minW={0}>
            {!current ? (
              <Box bg="#FFFFFF" border="2px dashed #E3DACF" borderRadius="xl" p={{ base: 6, md: 10 }} textAlign="center">
                <VStack spacing={4}>
                  <Box color="#5B5BF0"><FiImage size={36} /></Box>
                  <Text color="#1E2233" fontWeight="600">Open an image to start editing</Text>
                  <Text color="#5B6277" fontSize="sm">Select any part of it and describe the change, apply an art style, adjust colours or upscale.</Text>
                  <Button {...panelBtn} leftIcon={<FiUpload />} onClick={() => fileRef.current?.click()}>Upload image</Button>
                  {recent.length > 0 && (
                    <Box w="full">
                      <Text fontSize="xs" color="#8A90A2" mb={2} textTransform="uppercase" letterSpacing="0.05em">Or pick from your gallery</Text>
                      <SimpleGrid columns={{ base: 3, md: 6 }} spacing={2}>
                        {recent.map((it) => (
                          <Image key={it.id} src={toSameOriginImageUrl(it.image_url)} alt={it.prompt} borderRadius="8px" cursor="pointer" border="1px solid #E3DACF"
                            _hover={{ borderColor: '#5B5BF0' }} onClick={() => load(it.image_url, it.prompt)} />
                        ))}
                      </SimpleGrid>
                    </Box>
                  )}
                </VStack>
              </Box>
            ) : (
              <Box bg="#FFFFFF" borderRadius="xl" border="1px solid #E3DACF" p={3} position="relative">
                {busy && (
                  <Flex position="absolute" inset={0} zIndex={5} bg="rgba(251,248,244,0.72)" align="center" justify="center" direction="column" gap={3} borderRadius="xl">
                    <Spinner color="#5B5BF0" size="lg" /><Text color="#1E2233" fontSize="sm">{busy}...</Text>
                  </Flex>
                )}
                {showOriginal ? (
                  <Image src={original.url} alt="Original" maxH="70vh" mx="auto" objectFit="contain" />
                ) : tab === 0 ? (
                  <InteractiveCanvasMask key={current.url.length + ':' + cursor} imageUrl={current.url}
                    onMaskChange={(has, m) => setMaskUrl(has && m ? m : null)} />
                ) : (
                  <Image src={current.url} alt="Current edit" maxH="70vh" mx="auto" objectFit="contain" style={tab === 2 ? { filter: preview } : undefined} />
                )}
                <Flex justify="space-between" mt={2}>
                  <Text fontSize="xs" color="#8A90A2">Version {cursor + 1} of {history.length}: {current.label}</Text>
                  <Button size="xs" variant="link" color="#5B6277" onClick={() => fileRef.current?.click()}>Open another image</Button>
                </Flex>
              </Box>
            )}
          </Box>

          {/* tools */}
          <Box w={{ base: 'full', lg: '340px' }} flexShrink={0} bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="xl" p={3}>
            <Tabs index={tab} onChange={setTab} variant="soft-rounded" colorScheme="green" isLazy={false}>
              <TabList flexWrap="wrap" gap={1}>
                {['Edit region', 'Styles', 'Adjust', 'Upscale'].map((t) => <Tab key={t} fontSize="xs" color="#5B6277" _selected={{ color: '#FFFFFF', bg: '#5B5BF0' }}>{t}</Tab>)}
              </TabList>
              <TabPanels>
                <TabPanel px={1}>
                  <VStack align="stretch" spacing={3}>
                    <Text fontSize="xs" color="#5B6277">Paint, circle or box the part you want to change, then say what it should become. Everything outside your selection stays exactly as it is.</Text>
                    <Input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="e.g. a red umbrella" size="sm" bg="#F7F3EE" color="#1E2233" border="1px solid #E3DACF" _focus={{ borderColor: '#5B5BF0' }} aria-label="What should appear in the selection" />
                    <Select size="sm" value={quality} onChange={(e) => setQuality(e.target.value)} bg="#F7F3EE" color="#1E2233" border="1px solid #E3DACF" aria-label="Edit quality">
                      {Object.keys(INPAINT_STEPS).map((q) => <option key={q} value={q} style={{ background: '#FFFFFF' }}>{q} ({INPAINT_STEPS[q]} steps)</option>)}
                    </Select>
                    <Checkbox size="sm" colorScheme="green" isChecked={snapToEdges} onChange={(e) => setSnapToEdges(e.target.checked)}><Text fontSize="xs" color="#5B6277">Snap selection to object edges (GrabCut)</Text></Checkbox>
                    <Checkbox size="sm" colorScheme="green" isChecked={blend} onChange={(e) => setBlend(e.target.checked)}><Text fontSize="xs" color="#5B6277">Blend seamlessly (colour match + multiband)</Text></Checkbox>
                    <Text fontSize="11px" color={maskUrl ? '#5B5BF0' : '#C77700'}>{maskUrl ? 'Selection ready' : 'No area selected yet'}</Text>
                    <Button {...panelBtn} isDisabled={!current || !maskUrl || !instruction.trim()} onClick={applyRegionEdit}>Apply to selection</Button>
                  </VStack>
                </TabPanel>

                <TabPanel px={1}>
                  <VStack align="stretch" spacing={3}>
                    <Text fontSize="xs" color="#5B6277">Re-style the whole image with classical computer-vision filters (instant, no AI model needed).</Text>
                    <Box><Flex justify="space-between"><Text fontSize="xs" color="#5B6277">Strength</Text><Text fontSize="xs" color="#8A90A2">{styleStrength}%</Text></Flex>
                      <Slider min={20} max={100} value={styleStrength} onChange={setStyleStrength} aria-label="Style strength"><SliderTrack bg="#EFE8DF"><SliderFilledTrack bg="#5B5BF0" /></SliderTrack><SliderThumb /></Slider></Box>
                    <Grid templateColumns="1fr 1fr" gap={2}>
                      {styles.filter((s) => s.cv_finisher).map((s) => (
                        <Tooltip key={s.id} label={s.description} hasArrow isDisabled={!s.description}>
                          <Button size="xs" variant="outline" borderColor="#E3DACF" color="#1E2233" _hover={{ borderColor: '#5B5BF0' }} isDisabled={!current || !!busy}
                            onClick={() => run(`Style: ${s.label}`, async () => (await cvStylize({ imageBase64: current!.url, style: s.label, strength: styleStrength / 100 })).image_url)}>
                            {s.label}
                          </Button>
                        </Tooltip>
                      ))}
                    </Grid>
                  </VStack>
                </TabPanel>

                <TabPanel px={1}>
                  <VStack align="stretch" spacing={3}>
                    {slider('brightness', 'Brightness')}
                    {slider('contrast', 'Contrast')}
                    {slider('saturation', 'Saturation')}
                    {slider('warmth', 'Warmth')}
                    {slider('sharpness', 'Sharpness (edge-aware)', 0)}
                    {slider('denoise', 'Denoise', 0)}
                    <Checkbox size="sm" colorScheme="green" isChecked={adj.auto} onChange={(e) => setAdj((a) => ({ ...a, auto: e.target.checked }))}><Text fontSize="xs" color="#5B6277">Auto enhance (white balance + CLAHE)</Text></Checkbox>
                    <HStack>
                      <Button {...panelBtn} flex={1} isDisabled={!current} onClick={() => run('Adjust', async () => (await cvAdjust(current!.url, adj)).image_url)}>Apply</Button>
                      <Button size="sm" variant="ghost" color="#5B6277" onClick={() => setAdj(NEUTRAL)}>Reset</Button>
                    </HStack>
                  </VStack>
                </TabPanel>

                <TabPanel px={1}>
                  <VStack align="stretch" spacing={3}>
                    <Text fontSize="xs" color="#5B6277">Enlarge with Lanczos resampling plus an edge-aware detail boost (no halos).</Text>
                    <Select size="sm" value={scale} onChange={(e) => setScale(Number(e.target.value))} bg="#F7F3EE" color="#1E2233" border="1px solid #E3DACF" aria-label="Upscale factor">
                      {[1.5, 2, 3, 4].map((s) => <option key={s} value={s} style={{ background: '#FFFFFF' }}>{s}x</option>)}
                    </Select>
                    <Button {...panelBtn} isDisabled={!current} onClick={() => run(`Upscale ${scale}x`, async () => (await cvUpscale(current!.url, scale)).image_url)}>Upscale</Button>
                  </VStack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Box>
        </Flex>
      </Box>
    </WorkspaceLayout>
  );
};

export default ImageEditor;
