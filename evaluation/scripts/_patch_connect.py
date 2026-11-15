import re

def edit(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs:
        assert a in s, (path, a[:70])
        s = s.replace(a, b, 1)
    open(path, 'w', encoding='utf-8').write(s)

# ------------------------------------------------------------------ dashboard HTML: same brand as the main app + links back
p = 'backend/app/static/index.html'
s = open(p, encoding='utf-8').read()
a = s.index('      <div class="sidebar-brand">')
b = s.index('      <!-- Navigation Menu Items -->')
s = s[:a] + '''      <a class="sidebar-brand" href="/dashboard" style="text-decoration:none" aria-label="ImagineAI home">
        <div class="brand-icon-box" style="font-weight:800;font-size:18px;color:#fff">I</div>
        <div class="brand-info">
          <span class="brand-name">ImagineAI</span>
          <span class="brand-subtext">Research lab</span>
        </div>
      </a>

      <!-- Links back to the main app (shown on the hosted site; hidden when embedded) -->
      <nav class="app-links" aria-label="ImagineAI app" id="app-links" hidden>
        <a href="/dashboard">Home</a><a href="/create">Create</a><a href="/edit">Edit</a><a href="/storybook">Storybook</a><a href="/research">Results</a>
      </nav>

''' + s[b:]
s = s.replace('<script src="/static/app.js?v=p3-research-v7"></script>', '<script src="/static/app.js?v=p3-research-v8"></script>')
s = s.replace('<title>', '<title>', 1)
open(p, 'w', encoding='utf-8').write(s)

# ------------------------------------------------------------------ dashboard CSS: embed mode + app-links
open('backend/app/static/styles.css', 'a', encoding='utf-8').write('''

/* ---- brand + links back to the main app (match the React sidebar) ---- */
.brand-icon-box { background: linear-gradient(135deg, #5B5BF0, #8B6CF6); }
.app-links { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 6px 12px; }
.app-links[hidden] { display: none; }
.app-links a { font-size: 0.78rem; font-weight: 600; color: var(--text-muted); text-decoration: none; padding: 5px 10px; border-radius: 999px; border: 1px solid var(--border-card); background: #fff; }
.app-links a:hover { color: var(--accent-indigo); border-color: var(--accent-indigo); }

/* ---- embedded inside the main app (?embed=1): tabs become a compact pill bar, no second sidebar/header ---- */
html.embed body, html.embed .app-container { background: transparent !important; }
html.embed .app-container { flex-direction: column; min-height: 0; }
html.embed .sidebar { position: static; width: 100%; height: auto; flex-direction: row; padding: 10px 4px 12px; background: transparent; border-right: 0; border-bottom: 1px solid var(--border-card); }
html.embed .sidebar-brand, html.embed .sidebar-footer, html.embed .app-links, html.embed .top-header { display: none !important; }
html.embed .sidebar-nav { flex-direction: row; flex-wrap: wrap; gap: 6px; overflow: visible; padding: 0; margin: 0; }
html.embed .nav-tab { width: auto; padding: 7px 14px; border-radius: 999px; border: 1px solid var(--border-card); background: #fff; font-size: 0.85rem; }
html.embed .nav-tab .tab-icon { display: none; }
html.embed .nav-tab.active { background: var(--accent-indigo); color: #fff; border-color: var(--accent-indigo); box-shadow: none; }
html.embed .main-wrapper { padding: 0; }
''')

# ------------------------------------------------------------------ dashboard JS: embed flag, hosted links, ?tab= deep link
edit('backend/app/static/app.js', [
    ("function initTabs() {", """// ---- connection with the main app: embed mode (?embed=1), hosted links and ?tab=<name> deep links
(function connectToMainApp() {
  const q = new URLSearchParams(location.search);
  if (q.has('embed')) document.documentElement.classList.add('embed');
  document.addEventListener('DOMContentLoaded', () => {
    const links = document.getElementById('app-links');
    if (links && window.__IMAGINEAI_HOSTED__) links.hidden = false;
    const want = q.get('tab');
    if (want) {
      const btn = document.querySelector('.nav-tab[data-tab="' + want.replace(/[^a-z-]/gi, '') + '"]');
      if (btn) setTimeout(() => btn.click(), 0);
    }
  });
})();

function initTabs() {"""),
])

# ------------------------------------------------------------------ backend: tell the dashboard it is on the hosted site
edit('backend/app/main.py', [
    ("""            html = index_file.read_text(encoding="utf-8")
            if hosted_auth:""", """            html = index_file.read_text(encoding="utf-8")
            if hosted_variants:
                html = html.replace("</head>", "<script>window.__IMAGINEAI_HOSTED__=true</script></head>", 1)
            if hosted_auth:"""),
])

# ------------------------------------------------------------------ React: embedded lab page, route, nav
open('frontend/src/pages/LabEmbed.tsx', 'w', encoding='utf-8').write('''import React, { useState } from 'react';
import { Box, Button, Flex, Heading, Spinner, Text } from '@chakra-ui/react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiBarChart2, FiExternalLink } from 'react-icons/fi';
import WorkspaceLayout from '../components/WorkspaceLayout';

const TAB_NAMES = ['generate', 'batch', 'stress', 'pipeline', 'comparison', 'robustness', 'failures', 'catalogue', 'about'];

/** The research dashboard (Stress Lab, batch tests, pipeline, failure analysis...) shown inside the main app,
 *  so there is one sidebar, one look and one place to go. Deep link with /lab?tab=stress. */
const LabEmbed: React.FC = () => {
  const [params] = useSearchParams();
  const raw = params.get('tab') || 'generate';
  const tab = TAB_NAMES.includes(raw) ? raw : 'generate';
  const [loaded, setLoaded] = useState(false);
  return (
    <WorkspaceLayout>
      <Box p={{ base: 3, md: 6 }} minH="100vh">
        <Flex justify="space-between" align="flex-start" wrap="wrap" gap={3} mb={3}>
          <Box>
            <Heading as="h1" size="xl" color="#1E2233" fontWeight="800" letterSpacing="-0.02em">Experiments lab</Heading>
            <Text color="#5B6277" mt={1}>Try the adaptive Stress Lab, batch tests, the pipeline inspector and the failure analysis.</Text>
          </Box>
          <Flex gap={2}>
            <Button as={Link} to="/research" size="sm" variant="outline" leftIcon={<FiBarChart2 />}>Results</Button>
            <Button as="a" href={`/research-dashboard?tab=${tab}`} target="_blank" rel="noreferrer" size="sm" variant="ghost" rightIcon={<FiExternalLink />}>Open on its own</Button>
          </Flex>
        </Flex>
        <Box position="relative" bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="18px" overflow="hidden" boxShadow="card">
          {!loaded && <Flex position="absolute" inset={0} align="center" justify="center" gap={3} zIndex={1}><Spinner color="#5B5BF0" /><Text color="#5B6277">Loading the lab...</Text></Flex>}
          <iframe title="Experiments lab" src={`/research-dashboard?embed=1&tab=${tab}`} onLoad={() => setLoaded(true)}
            style={{ width: '100%', height: 'calc(100vh - 190px)', minHeight: '560px', border: 0, display: 'block' }} />
        </Box>
      </Box>
    </WorkspaceLayout>
  );
};

export default LabEmbed;
''')
edit('frontend/src/App.tsx', [
    ('      <Route path="/research" element={<ProtectedRoute><ModelPerformance /></ProtectedRoute>} />',
     '      <Route path="/research" element={<ProtectedRoute><ModelPerformance /></ProtectedRoute>} />\n      <Route path="/lab" element={<ProtectedRoute><LabEmbed /></ProtectedRoute>} />'),
])
s = open('frontend/src/App.tsx', encoding='utf-8').read()
idx = [m.end() for m in re.finditer(r"^import .*ModelPerformance.*$", s, flags=re.M)][0]
s = s[:idx] + "\nimport LabEmbed from './pages/LabEmbed';" + s[idx:]
open('frontend/src/App.tsx', 'w', encoding='utf-8').write(s)
edit('frontend/src/components/Sidebar.tsx', [
    ("{ label: 'Experiments lab', path: '/research-dashboard', icon: FiTool, external: true },", "{ label: 'Experiments lab', path: '/lab', icon: FiTool },"),
])
edit('frontend/src/pages/ModelPerformance.tsx', [
    ('<Button as="a" href="/research-dashboard" size="sm" variant="outline" rightIcon={<FiExternalLink />}>Experiments lab</Button>',
     '<Button as={Link} to="/lab" size="sm" variant="outline" rightIcon={<FiExternalLink />}>Experiments lab</Button>'),
    ("import WorkspaceLayout from '../components/WorkspaceLayout';", "import { Link } from 'react-router-dom';\nimport WorkspaceLayout from '../components/WorkspaceLayout';"),
])
print('ok')
