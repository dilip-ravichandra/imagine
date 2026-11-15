p = 'frontend/src/pages/StoryBookStudio.tsx'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, 1)


rep("  CloseButton,\n} from '@chakra-ui/react';", "  CloseButton,\n  Textarea,\n  Collapse,\n} from '@chakra-ui/react';")
rep("  FiSend,\n} from 'react-icons/fi';", "  FiSend,\n  FiShuffle,\n  FiChevronDown,\n  FiChevronUp,\n} from 'react-icons/fi';")
rep("const DEFAULT_IDEA =", """const SAMPLE_IDEAS = [
  'A shy girl and her robot friend search a flooded city for the last working lighthouse',
  'A little fox who is afraid of the dark learns to follow the fireflies home',
  'Two rival bakers in a floating village must work together to save the harvest festival',
  'A young astronaut finds a garden growing on the far side of the moon',
  'A lonely dragon opens a tea shop and slowly makes friends with the whole town',
];

const DEFAULT_IDEA =""")
rep("  const [isComposing, setIsComposing] = useState(false);\n", "  const [isComposing, setIsComposing] = useState(false);\n  const [showMore, setShowMore] = useState(false);\n")

# ---- new simple header + create card (replaces error banner, header bar, progress)
a = s.index('        {/* Story Error Banner */}')
b = s.index('        {/* COMPOSED MANGA PAGES */}')
new_top = r"""        <Box maxW="960px" mx="auto" mb={6}>
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
              <Button variant="brand" size="lg" px={8} onClick={handleGenerateStory} isLoading={isGeneratingStory} loadingText="Creating..."
                rightIcon={<FiSend />} isDisabled={!storyIdea.trim()}>
                Create my storybook
              </Button>
            </Flex>

            {isGeneratingStory && (
              <Box mt={4} pt={3} borderTop="1px solid #EFE8DF" role="status">
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
        </Box>

"""
s = s[:a] + new_top + s[b:]

# ---- remove the fixed bottom prompt bar
a = s.index('        {/* BOTTOM FIXED STORY PROMPT BAR */}')
b = s.index('        {/* SELECTIVE PANEL RECREATOR MODAL */}')
s = s[:a] + s[b:]

# ---- plain wording in what remains
for old, new in [("Active Scene {activeSceneIndex + 1}", "Scene {activeSceneIndex + 1}"),
                 ("Selective Recreate", "Change this scene")]:
    s = s.replace(old, new)
open(p, 'w', encoding='utf-8').write(s)
print('ok')
