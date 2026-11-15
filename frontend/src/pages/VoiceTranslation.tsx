import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Flex, Text, Heading, Button, Textarea, Select, Alert, AlertIcon } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import WorkspaceLayout from '../components/WorkspaceLayout';
import { loadPrefs } from '../lib/prefs';
import { getLanguages, transcribeAudio, translateText } from '../lib/api';

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(91,91,240,0.5); }
  70% { box-shadow: 0 0 0 20px rgba(91,91,240,0); }
  100% { box-shadow: 0 0 0 0 rgba(91,91,240,0); }
`;

const FALLBACK = [
  { code: 'en', name: 'English' }, { code: 'hi', name: 'Hindi' }, { code: 'es', name: 'Spanish' }, { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' }, { code: 'ja', name: 'Japanese' },
];
// Browser speech voices use BCP-47 tags
const VOICE_TAG: Record<string, string> = {
  en: 'en-US', hi: 'hi-IN', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN', ar: 'ar-SA', pt: 'pt-BR', ru: 'ru-RU',
  it: 'it-IT', tr: 'tr-TR', bn: 'bn-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN', mr: 'mr-IN', gu: 'gu-IN', ur: 'ur-PK', nl: 'nl-NL',
  pl: 'pl-PL', id: 'id-ID',
};

type TabKey = 'voice' | 'translate' | 'speech';

const MicIcon: React.FC<{ size?: number; color?: string }> = ({ size = 40, color = '#5B5BF0' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

function speak(text: string, code: string): string | null {
  if (!('speechSynthesis' in window)) return 'This browser cannot read text aloud.';
  const tag = VOICE_TAG[code] || code;
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang.toLowerCase() === tag.toLowerCase()) || voices.find((v) => v.lang.toLowerCase().startsWith(code));
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = tag;
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
  return voice || voices.length === 0 ? null : `No ${tag} voice is installed on this device, so it may sound off.`;
}

const blobToBase64 = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('Could not read the recording.'));
    r.readAsDataURL(b);
  });

const VoiceTranslation: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('voice');
  const [langs, setLangs] = useState(FALLBACK);
  const [sourceLang, setSourceLang] = useState(() => loadPrefs().voiceSource);
  const [targetLang, setTargetLang] = useState(() => loadPrefs().voiceTarget);
  const [sourceText, setSourceText] = useState('');
  const [translated, setTranslated] = useState('');
  const [readText, setReadText] = useState('');
  const [readLang, setReadLang] = useState('en');
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState<'' | 'transcribe' | 'translate'>('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stopTimer = useRef<number | undefined>(undefined);

  useEffect(() => { getLanguages().then((r) => setLangs(r.languages)).catch(() => undefined); }, []);
  useEffect(() => () => { window.speechSynthesis?.cancel(); recRef.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  const nameOf = (c: string) => langs.find((l) => l.code === c)?.name || c;

  const doTranslate = useCallback(async (text: string) => {
    if (!text.trim()) return '';
    setBusy('translate');
    try {
      const r = await translateText(text.trim(), targetLang);
      setTranslated(r.translation);
      return r.translation;
    } finally { setBusy(''); }
  }, [targetLang]);

  const handleTranslate = async () => {
    setError(''); setNote('');
    try { await doTranslate(sourceText); } catch (e) { setError(e instanceof Error ? e.message : 'Translation failed.'); }
  };

  const stopRecording = () => {
    window.clearTimeout(stopTimer.current);
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
  };

  const toggleRecording = async () => {
    setError(''); setNote('');
    if (recording) { stopRecording(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('This browser cannot record audio. Try Chrome, Edge or Safari, and open the site over https.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (ev) => { if (ev.data.size) chunks.current.push(ev.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const type = (rec.mimeType || mime || 'audio/webm').split(';')[0];
        const blob = new Blob(chunks.current, { type });
        if (blob.size < 1500) { setError('That was too short. Tap the microphone, speak, then tap again.'); return; }
        try {
          setBusy('transcribe');
          const heard = await transcribeAudio(await blobToBase64(blob), type, sourceLang);
          setSourceText(heard.text);
          setBusy('');
          if (!heard.text) { setError('I could not hear any speech. Try again closer to the microphone.'); return; }
          const out = await doTranslate(heard.text);
          if (out) { const warn = speak(out, targetLang); if (warn) setNote(warn); }
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Something went wrong with the recording.');
        } finally { setBusy(''); }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      stopTimer.current = window.setTimeout(stopRecording, 45000); // keep clips short
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      setError(denied ? 'Microphone access is blocked. Allow it in your browser’s site settings and try again.' : 'No microphone was found.');
    }
  };

  const swap = () => { setSourceLang(targetLang); setTargetLang(sourceLang); setSourceText(translated); setTranslated(sourceText); };
  const copy = (t: string) => { void navigator.clipboard?.writeText(t); setNote('Copied.'); };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'voice', label: 'Tap to speak' }, { key: 'translate', label: 'Translate text' }, { key: 'speech', label: 'Read aloud' },
  ];
  const langSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} bg="#FFFFFF" borderColor="#E3DACF" color="#1E2233">
      {langs.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
    </Select>
  );
  const card = { bg: '#FFFFFF', border: '1px solid #E3DACF', borderRadius: '16px', p: 5 } as const;
  const primary = { bg: '#5B5BF0', color: '#FFFFFF', _hover: { bg: '#4747DB' } } as const;

  return (
    <WorkspaceLayout>
      <Box px={{ base: 4, md: 8 }} py={8} minH="100vh" bg="#FBF8F4" maxW="1000px" mx="auto">
        <Heading size="lg" color="#1E2233" fontWeight={700}>Voice & Translation</Heading>
        <Text color="#5B6277" mt={1} mb={6} fontSize="sm">Speak, translate and listen, in {langs.length} languages.</Text>

        <Flex gap={2} mb={6} wrap="wrap" role="tablist">
          {tabs.map((t) => (
            <Button key={t.key} role="tab" aria-selected={tab === t.key} size="sm" onClick={() => { setTab(t.key); setError(''); setNote(''); }}
              bg={tab === t.key ? '#5B5BF0' : '#FFFFFF'} color={tab === t.key ? '#FFFFFF' : '#5B6277'} border="1px solid #E3DACF" _hover={{ bg: tab === t.key ? '#4747DB' : '#F5F0EA' }}>
              {t.label}
            </Button>
          ))}
        </Flex>

        {error && <Alert status="error" borderRadius="12px" mb={4} role="alert"><AlertIcon />{error}</Alert>}
        {note && !error && <Alert status="info" borderRadius="12px" mb={4}><AlertIcon />{note}</Alert>}

        {tab === 'voice' && (
          <Box {...card}>
            <Flex gap={3} align="center" wrap="wrap" mb={6}>
              <Box flex="1" minW="150px"><Text fontSize="xs" color="#8A90A2" mb={1}>I will speak</Text>{langSelect(sourceLang, setSourceLang, 'Language you speak')}</Box>
              <Box flex="1" minW="150px"><Text fontSize="xs" color="#8A90A2" mb={1}>Translate to</Text>{langSelect(targetLang, setTargetLang, 'Language to translate into')}</Box>
            </Flex>
            <Flex direction="column" align="center" gap={3} mb={6}>
              <Box as="button" type="button" onClick={toggleRecording} aria-label={recording ? 'Stop recording' : 'Tap to speak'} aria-pressed={recording}
                disabled={busy !== ''} w="96px" h="96px" borderRadius="full" display="flex" alignItems="center" justifyContent="center"
                bg={recording ? '#5B5BF0' : '#EEF0FF'} border="2px solid #5B5BF0" cursor="pointer" opacity={busy ? 0.6 : 1}
                animation={recording ? `${pulse} 1.4s infinite` : undefined}>
                <MicIcon size={40} color={recording ? '#FFFFFF' : '#5B5BF0'} />
              </Box>
              <Text fontSize="sm" color="#5B6277" aria-live="polite">
                {recording ? 'Listening… tap again when you finish' : busy === 'transcribe' ? 'Understanding what you said…' : busy === 'translate' ? 'Translating…' : 'Tap the microphone and speak'}
              </Text>
            </Flex>
            <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
              <Box flex="1"><Text fontSize="xs" color="#8A90A2" mb={1}>You said ({nameOf(sourceLang)})</Text>
                <Box minH="90px" p={3} bg="#FBF8F4" borderRadius="12px" color="#1E2233" fontSize="sm">{sourceText || '—'}</Box></Box>
              <Box flex="1"><Text fontSize="xs" color="#8A90A2" mb={1}>Translation ({nameOf(targetLang)})</Text>
                <Box minH="90px" p={3} bg="#EEF0FF" borderRadius="12px" color="#1E2233" fontSize="sm">{translated || '—'}</Box>
                {translated && <Button size="sm" mt={2} {...primary} onClick={() => { const w = speak(translated, targetLang); if (w) setNote(w); }}>Listen again</Button>}</Box>
            </Flex>
          </Box>
        )}

        {tab === 'translate' && (
          <Box {...card}>
            <Flex gap={3} align="end" wrap="wrap" mb={4}>
              <Box flex="1" minW="140px"><Text fontSize="xs" color="#8A90A2" mb={1}>From</Text>{langSelect(sourceLang, setSourceLang, 'Translate from')}</Box>
              <Button onClick={swap} variant="outline" borderColor="#E3DACF" aria-label="Swap languages">⇄</Button>
              <Box flex="1" minW="140px"><Text fontSize="xs" color="#8A90A2" mb={1}>To</Text>{langSelect(targetLang, setTargetLang, 'Translate to')}</Box>
            </Flex>
            <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
              <Box flex="1">
                <Textarea aria-label="Text to translate" value={sourceText} onChange={(e) => setSourceText(e.target.value)} maxLength={2000} minH="160px" placeholder="Type or paste text…" bg="#FFFFFF" borderColor="#E3DACF" />
                <Text fontSize="xs" color="#8A90A2" mt={1}>{sourceText.length}/2000</Text>
              </Box>
              <Box flex="1">
                <Box minH="160px" p={3} bg="#EEF0FF" borderRadius="12px" color="#1E2233" fontSize="sm" whiteSpace="pre-wrap" aria-live="polite">{translated || 'Your translation appears here.'}</Box>
                {translated && (
                  <Flex gap={2} mt={2}>
                    <Button size="sm" variant="outline" borderColor="#E3DACF" onClick={() => { const w = speak(translated, targetLang); if (w) setNote(w); }}>Listen</Button>
                    <Button size="sm" variant="outline" borderColor="#E3DACF" onClick={() => copy(translated)}>Copy</Button>
                  </Flex>
                )}
              </Box>
            </Flex>
            <Button mt={4} {...primary} onClick={handleTranslate} isLoading={busy === 'translate'} loadingText="Translating" isDisabled={!sourceText.trim()}>Translate</Button>
          </Box>
        )}

        {tab === 'speech' && (
          <Box {...card}>
            <Box maxW="260px" mb={4}><Text fontSize="xs" color="#8A90A2" mb={1}>Language</Text>{langSelect(readLang, setReadLang, 'Reading language')}</Box>
            <Textarea aria-label="Text to read aloud" value={readText} onChange={(e) => setReadText(e.target.value)} maxLength={2000} minH="160px" placeholder="Type something for me to read aloud…" bg="#FFFFFF" borderColor="#E3DACF" />
            <Flex gap={2} mt={4}>
              <Button {...primary} isDisabled={!readText.trim()} onClick={() => { const w = speak(readText, readLang); setNote(w || ''); }}>Read aloud</Button>
              <Button variant="outline" borderColor="#E3DACF" onClick={() => window.speechSynthesis?.cancel()}>Stop</Button>
            </Flex>
          </Box>
        )}
      </Box>
    </WorkspaceLayout>
  );
};

export default VoiceTranslation;
