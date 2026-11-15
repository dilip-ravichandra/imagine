p = 'frontend/src/components/Sidebar.tsx'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


# groups: Research is its own always-visible section
rep("""const MORE: Item[] = [
  { label: 'Ask about an image', path: '/ask-image', icon: FiMessageCircle },
  { label: 'Learn', path: '/learn', icon: FiBook },
  { label: 'Speak and translate', path: '/voice', icon: FiMic },
];
const TEAM: Item[] = [
  { label: 'Model results', path: '/research', icon: FiBarChart2 },
  { label: 'Training', path: '/training', icon: FiCpu },
  { label: 'System status', path: '/admin', icon: FiSettings },
  { label: 'Engineering dashboard', path: '/research-dashboard', icon: FiTool, external: true },
];""", """const RESEARCH: Item[] = [
  { label: 'Results', path: '/research', icon: FiBarChart2 },
  { label: 'Experiments lab', path: '/research-dashboard', icon: FiTool, external: true },
  { label: 'Training and data', path: '/training', icon: FiCpu },
];
const MORE: Item[] = [
  { label: 'Ask about an image', path: '/ask-image', icon: FiMessageCircle },
  { label: 'Learn', path: '/learn', icon: FiBook },
  { label: 'Speak and translate', path: '/voice', icon: FiMic },
  { label: 'System status', path: '/admin', icon: FiSettings },
];
// phone tab bar: the everyday tools plus Research
const PHONE: Item[] = [MAIN[1], MAIN[2], MAIN[3], MAIN[4], { label: 'Research', path: '/research', icon: FiBarChart2 }];""")

rep("""  const [showMore, setShowMore] = useState(
    [...MORE, ...TEAM].some((i) => location.pathname === i.path)
  );""", """  const [showMore, setShowMore] = useState(MORE.some((i) => location.pathname === i.path));""")

rep("""          <Box mt={4}>
            <Flex
              as="button\"""", """          <Box mt={5}>
            <Text px={4} pb={1} fontSize="11px" color="#8A90A2" fontWeight={700} letterSpacing="0.06em" textTransform="uppercase">Research</Text>
            <VStack spacing={1} align="stretch">
              {RESEARCH.map((i) => <NavLink key={i.path} item={i} active={isActive(i.path)} />)}
            </VStack>
          </Box>

          <Box mt={3}>
            <Flex
              as="button\"""")

rep("""                {MORE.map((i) => <NavLink key={i.path} item={i} active={isActive(i.path)} small />)}
                <Text px={4} pt={3} pb={1} fontSize="11px" color="#8A90A2" fontWeight={700} letterSpacing="0.06em" textTransform="uppercase">
                  For the team
                </Text>
                {TEAM.map((i) => <NavLink key={i.path} item={i} active={isActive(i.path)} small />)}""",
    """                {MORE.map((i) => <NavLink key={i.path} item={i} active={isActive(i.path)} small />)}""")

rep("        {MAIN.map((i) => {\n          const active = isActive(i.path);", "        {PHONE.map((i) => {\n          const active = isActive(i.path);")
rep(".replace('My gallery', 'Gallery')}", ".replace('My gallery', 'Gallery')}")
open(p, 'w', encoding='utf-8').write(s)

# home: a research banner with the headline numbers
p = 'frontend/src/pages/Dashboard.tsx'
s = open(p, encoding='utf-8').read()
rep("import { getGalleryItems, toSameOriginImageUrl, type GalleryItem } from '../lib/api';",
    "import { getGalleryItems, getResearchOverview, toSameOriginImageUrl, type GalleryItem, type ResearchOverview } from '../lib/api';")
rep("  const [recent, setRecent] = useState<GalleryItem[] | null>(null);",
    "  const [recent, setRecent] = useState<GalleryItem[] | null>(null);\n  const [research, setResearch] = useState<ResearchOverview | null>(null);")
rep("      .catch(() => setRecent([]));\n  }, []);", "      .catch(() => setRecent([]));\n    getResearchOverview().then(setResearch).catch(() => setResearch(null));\n  }, []);")
rep("          <Flex justify=\"space-between\" align=\"center\" mt={10} mb={4}>\n            <Heading as=\"h2\" size=\"md\" color=\"#1E2233\">Your recent creations</Heading>",
    """          {research && research.measured && (
            <Link to="/research">
              <Box mt={8} bg="linear-gradient(135deg,#4747DB,#7B5CF0)" borderRadius="22px" p={{ base: 5, md: 6 }} color="#FFFFFF" boxShadow="lifted"
                _hover={{ transform: 'translateY(-2px)' }} transition="all 0.18s ease">
                <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
                  <Box maxW="460px">
                    <Text fontSize="11px" fontWeight={700} letterSpacing="0.08em" textTransform="uppercase" opacity={0.85}>Research results</Text>
                    <Heading as="h2" size="md" mt={1}>How much faster and lighter is it than the baseline?</Heading>
                    <Text fontSize="sm" mt={1} opacity={0.9}>Measured on our own GPU: speed, memory, image quality and prompt accuracy for every model we tried.</Text>
                  </Box>
                  <Flex gap={5} wrap="wrap">
                    {research.headlines.slice(0, 3).map((h) => (
                      <Box key={h.label}><Text fontSize="30px" fontWeight={800} lineHeight="1.1">{h.value}</Text><Text fontSize="11px" opacity={0.85} maxW="110px">{h.label}</Text></Box>
                    ))}
                    <Flex align="center"><FiArrowRight size={22} /></Flex>
                  </Flex>
                </Flex>
              </Box>
            </Link>
          )}

          <Flex justify="space-between" align="center" mt={10} mb={4}>
            <Heading as="h2" size="md" color="#1E2233">Your recent creations</Heading>""")
open(p, 'w', encoding='utf-8').write(s)
print('ok')
