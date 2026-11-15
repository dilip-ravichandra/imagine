p = 'frontend/src/pages/StoryBookStudio.tsx'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


rep("""  createGalleryItem,
  toSameOriginImageUrl,
} from '../lib/api';""", """  createGalleryItem,
  toSameOriginImageUrl,
  createStoryOutline,
  composeStoryPage,
  downloadStoryPdf,
  type StoryOutline,
  type StoryPanelIn,
  type StoryDialogue,
} from '../lib/api';""")

rep("""  dialogue?: string;
  character: string;
}""", """  dialogue?: string;
  character: string;
  dialogueLines?: StoryDialogue[];
  sfx?: string | null;
  shot?: string;
}""")

rep("""const LANGUAGES = [
  { code: 'en',""", """// Story art styles -> server style ids (prompt recipe + negative prompt + classical-CV finisher)
const STYLE_FOR_ART: Record<string, string> = {
  'Pixar 3D Animation': 'Cinematic 3D',
  'Classic Watercolor': 'Watercolor',
  'Modern Comic Strip': 'Comic Book',
  'Retro Manga Ink': 'Anime & Manga',
  'Vintage Children Illustration': 'Vintage film',
  'Oil Painting Fantasy': 'Oil painting',
};

const LANGUAGES = [
  { code: 'en',""")

rep("""  const [storyError, setStoryError] = useState<string | null>(null);
""", """  const [storyError, setStoryError] = useState<string | null>(null);
  const [outline, setOutline] = useState<StoryOutline | null>(null);
  const [panelCount, setPanelCount] = useState(6);
  const [pageMode, setPageMode] = useState<'colour' | 'bw'>('colour');
  const [panelData, setPanelData] = useState<StoryPanelIn[]>([]);
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [isComposing, setIsComposing] = useState(false);
""")

start = s.index("  // Handle Full Story Generation")
end = s.index("  // Open Selective Recreate")
new = """  // Compose generated panels into finished manga/comic pages (server-side classical CV: layout, saliency crop, balloons, screentone)
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

"""
s = s[:start] + new + s[end:]

rep("""              <Button
                as={Link}
                to="/gallery"
                size="sm"
                variant="outline\"""", """              <Select
                size="sm"
                value={panelCount}
                onChange={(e) => setPanelCount(Number(e.target.value))}
                bg="#0F1A11"
                color="#F4F7F0"
                border="1px solid #2A3A2C"
                borderRadius="8px"
                w={{ base: 'full', sm: '120px' }}
                aria-label="Number of scenes"
              >
                {[4, 5, 6, 8].map((n) => (
                  <option key={n} value={n} style={{ background: '#111713' }}>{n} scenes</option>
                ))}
              </Select>

              <Select
                size="sm"
                value={pageMode}
                onChange={(e) => handleChangePageMode(e.target.value as 'colour' | 'bw')}
                bg="#0F1A11"
                color="#F4F7F0"
                border="1px solid #2A3A2C"
                borderRadius="8px"
                w={{ base: 'full', sm: '150px' }}
                aria-label="Page style"
              >
                <option value="colour" style={{ background: '#111713' }}>Colour page</option>
                <option value="bw" style={{ background: '#111713' }}>Black &amp; white manga</option>
              </Select>

              <Button
                as={Link}
                to="/gallery"
                size="sm"
                variant="outline\"""")

rep("""        {/* MAIN STAGE: ACTIVE SCENE OR EMPTY STATE */}""", """        {/* COMPOSED MANGA PAGES */}
        {(pageUrls.length > 0 || isComposing) && (
          <Box maxW="960px" mx="auto" mb={4} bg="#111713" border="1px solid #1F2F22" borderRadius="14px" p={{ base: 3, md: 4 }}>
            <Flex justify="space-between" align="center" mb={3} wrap="wrap" gap={2}>
              <Box>
                <Heading size="sm" color="#F4F7F0">{outline?.title || 'Your story'}</Heading>
                {outline?.logline && <Text fontSize="xs" color="#A5B1A7" mt={1}>{outline.logline}</Text>}
              </Box>
              <HStack spacing={2}>
                <Button size="xs" variant="outline" borderColor="#2A3A2C" color="#A5B1A7" leftIcon={<FiDownload />}
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
                  maxW={{ base: '100%', md: '440px' }} borderRadius="6px" boxShadow="0 8px 30px rgba(0,0,0,0.45)" />
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

        {/* MAIN STAGE: ACTIVE SCENE OR EMPTY STATE */}""")

open(p, 'w', encoding='utf-8').write(s)
print('patched')
