p = 'frontend/src/pages/CreateStudio.tsx'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, 1)


# ---- imports
rep("  Checkbox,\n} from '@chakra-ui/react';", "  Checkbox,\n  Collapse,\n  SimpleGrid,\n  Spinner,\n} from '@chakra-ui/react';")
rep("  FiSliders,\n} from 'react-icons/fi';", "  FiSliders,\n  FiChevronDown,\n  FiChevronUp,\n  FiEdit3,\n  FiInfo,\n} from 'react-icons/fi';")
rep("  getModelCatalogue,\n  ModelCatalogueEntry,\n} from '../lib/api';", "  getModelCatalogue,\n  ModelCatalogueEntry,\n  cvAnalyze,\n  type ImageAnalysis,\n} from '../lib/api';")

# ---- plain-language model names
rep("""const MODEL_UI_NAMES: Record<string, string> = {
  sd15_optimized: 'SD 1.5 + LCM-LoRA (public, 4 steps)',
  imagineai_lcm: 'ImagineAI LCM-LoRA (ours, 4 steps)',
  sd15_adapted: 'SD 1.5 + COCO LoRA (weight 0.25)',
};""", """// Plain-language engine names (the technical model id stays in the tooltip/details).
const MODEL_UI_NAMES: Record<string, string> = {
  sd_turbo: 'Fastest (SD-Turbo)',
  sd15: 'Highest detail (slower)',
  sd15_optimized: 'Fast and detailed',
  imagineai_lcm: 'Our own model (ImagineAI)',
  sd15_adapted: 'Everyday photos (tuned)',
};""")
rep("useState('SD 1.5 + COCO LoRA (weight 0.25)')", "useState('Fastest (SD-Turbo)')")
rep("const ASPECT_OPTIONS = ['1:1 Square', '16:9 Landscape', '9:16 Portrait', '4:3 Standard'];",
    "const ASPECT_OPTIONS = ['1:1 Square', '16:9 Landscape', '9:16 Portrait', '4:3 Standard'];\nconst aspectLabel = (a: string) => a.split(' ').slice(1).join(' ') || a;\nconst QUALITY_HINT: Record<string, string> = { Quick: 'fastest', Balanced: 'recommended', Best: 'most detail' };")
rep("  const [showVisionAnalysis, setShowVisionAnalysis] = useState(false);",
    "  const [showVisionAnalysis, setShowVisionAnalysis] = useState(false);\n  const [showMore, setShowMore] = useState(false);\n  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);\n  const [analysing, setAnalysing] = useState(false);")

# ---- analysis toggle handler (real measured stats, not canned text)
rep("  const handleOpenSelectiveRecreate = () => {", """  const toggleDetails = async () => {
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

  const handleOpenSelectiveRecreate = () => {""")

# ---- new main layout: replaces everything from the inner container to just before the voice modal
start = s.index('        <Box maxW="1100px" mx="auto" w="100%" flex={1} display="flex" flexDir="column">')
end = s.index('        {/* VOICE ASSISTANT & TRANSLATION MODAL */}')

new = r"""        <Box maxW="860px" mx="auto" w="100%">
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

"""
s = s[:start] + new + s[end:]
open(p, 'w', encoding='utf-8').write(s)
print('ok')
