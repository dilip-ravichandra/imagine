import React, { useEffect, useRef, useState } from 'react';
import { Box, Flex, Text, Heading, Button, Input, Image, Alert, AlertIcon, SimpleGrid, Spinner } from '@chakra-ui/react';
import WorkspaceLayout from '../components/WorkspaceLayout';
import { askAboutImage, getGalleryItems, GalleryItem, toSameOriginImageUrl } from '../lib/api';

interface Msg { role: 'user' | 'assistant'; text: string; note?: string }

const SUGGESTIONS = ['What is in this picture?', 'What colours do you see?', 'Describe the mood in simple words', 'What could I change to make it better?'];

/** Downscale to at most 1024px and re-encode as JPEG so uploads stay small and any format (PNG/WebP/HEIC-on-Safari) is accepted. */
function toJpegBase64(src: Blob | string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    img.onload = () => {
      const k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      if (typeof src !== 'string') URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.88).split(',')[1]);
    };
    img.onerror = () => reject(new Error('That file could not be opened as an image.'));
    img.src = url;
  });
}

const AskYourImage: React.FC = () => {
  const [b64, setB64] = useState('');
  const [preview, setPreview] = useState('');
  const [palette, setPalette] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState<GalleryItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { getGalleryItems().then((r) => setRecent(r.items.slice(0, 8))).catch(() => undefined); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [msgs, busy]);

  const load = async (src: Blob | string) => {
    setError('');
    try {
      const data = await toJpegBase64(src);
      setB64(data); setPreview(`data:image/jpeg;base64,${data}`); setMsgs([]); setPalette([]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load that image.'); }
  };

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || !b64 || busy) return;
    setQuestion(''); setError(''); setBusy(true);
    setMsgs((m) => [...m, { role: 'user', text }]);
    try {
      const r = await askAboutImage(b64, text);
      setPalette(r.palette.map((p) => p.hex));
      setMsgs((m) => [...m, { role: 'assistant', text: r.answer, note: (r.source.startsWith('gemini') || r.source.startsWith('groq')) ? 'AI vision' : 'Measured from the pixels (AI vision is busy right now)' }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not answer just now.');
    } finally { setBusy(false); }
  };

  return (
    <WorkspaceLayout>
      <Box px={{ base: 4, md: 8 }} py={8} maxW="1100px" mx="auto" bg="#FBF8F4" minH="100vh">
        <Heading size="lg" color="#1E2233" fontWeight={700}>Ask about an image</Heading>
        <Text color="#5B6277" mt={1} mb={6} fontSize="sm">Upload a picture, or choose one you created, then ask anything about it.</Text>
        {error && <Alert status="error" borderRadius="12px" mb={4} role="alert"><AlertIcon />{error}</Alert>}

        <Flex gap={6} direction={{ base: 'column', lg: 'row' }} align="stretch">
          <Box flex="1" bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="16px" p={4}>
            {preview ? (
              <Image src={preview} alt="The picture you are asking about" borderRadius="12px" maxH="420px" mx="auto" objectFit="contain" />
            ) : (
              <Flex minH="260px" align="center" justify="center" direction="column" gap={2} border="2px dashed #E3DACF" borderRadius="12px" color="#8A90A2"
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void load(f); }}>
                <Text fontSize="sm">Drop an image here</Text>
              </Flex>
            )}
            <Flex gap={2} mt={3} wrap="wrap">
              <Button size="sm" bg="#5B5BF0" color="#FFFFFF" _hover={{ bg: '#4747DB' }} onClick={() => fileRef.current?.click()}>{preview ? 'Change image' : 'Upload image'}</Button>
              <input ref={fileRef} type="file" accept="image/*" hidden aria-label="Upload an image" onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = ''; }} />
            </Flex>
            {palette.length > 0 && (
              <Flex gap={2} mt={3} align="center" aria-label="Main colours">
                <Text fontSize="xs" color="#8A90A2">Main colours</Text>
                {palette.slice(0, 5).map((h) => <Box key={h} title={h} w="22px" h="22px" borderRadius="full" border="1px solid #E3DACF" bg={h} />)}
              </Flex>
            )}
            {recent.length > 0 && (
              <Box mt={4}>
                <Text fontSize="xs" color="#8A90A2" mb={2}>Or pick one you made</Text>
                <SimpleGrid columns={{ base: 4, md: 4 }} spacing={2}>
                  {recent.map((g) => (
                    <Box as="button" type="button" key={g.id} onClick={() => void load(toSameOriginImageUrl(g.image_url))} aria-label={`Use image: ${g.prompt.slice(0, 40)}`}
                      borderRadius="8px" overflow="hidden" border="1px solid #E3DACF" _hover={{ borderColor: '#5B5BF0' }}>
                      <Image src={toSameOriginImageUrl(g.image_url)} alt="" h="64px" w="100%" objectFit="cover" />
                    </Box>
                  ))}
                </SimpleGrid>
              </Box>
            )}
          </Box>

          <Flex flex="1" direction="column" bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="16px" p={4} minH="420px">
            <Box flex="1" overflowY="auto" maxH="420px" aria-live="polite">
              {msgs.length === 0 && (
                <Box color="#8A90A2" fontSize="sm">
                  <Text mb={3}>{b64 ? 'Ask a question, or try one of these:' : 'Add an image first, then ask your question.'}</Text>
                  {b64 && <Flex gap={2} wrap="wrap">{SUGGESTIONS.map((s) => (
                    <Button key={s} size="xs" variant="outline" borderColor="#E3DACF" color="#5B6277" onClick={() => void ask(s)}>{s}</Button>
                  ))}</Flex>}
                </Box>
              )}
              {msgs.map((m, i) => (
                <Box key={i} mb={3} textAlign={m.role === 'user' ? 'right' : 'left'}>
                  <Box display="inline-block" maxW="90%" textAlign="left" px={3} py={2} borderRadius="12px" fontSize="sm" whiteSpace="pre-wrap"
                    bg={m.role === 'user' ? '#5B5BF0' : '#F5F0EA'} color={m.role === 'user' ? '#FFFFFF' : '#1E2233'}>{m.text}</Box>
                  {m.note && <Text fontSize="11px" color="#8A90A2" mt={1}>{m.note}</Text>}
                </Box>
              ))}
              {busy && <Flex align="center" gap={2} color="#8A90A2" fontSize="sm"><Spinner size="sm" /> Looking at the picture…</Flex>}
              <div ref={endRef} />
            </Box>
            <Flex gap={2} mt={3}>
              <Input aria-label="Your question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} isDisabled={!b64}
                placeholder={b64 ? 'Ask about this image…' : 'Add an image first'} bg="#FFFFFF" borderColor="#E3DACF"
                onKeyDown={(e) => { if (e.key === 'Enter') void ask(question); }} />
              <Button bg="#5B5BF0" color="#FFFFFF" _hover={{ bg: '#4747DB' }} isDisabled={!b64 || !question.trim() || busy} onClick={() => void ask(question)}>Ask</Button>
            </Flex>
          </Flex>
        </Flex>
      </Box>
    </WorkspaceLayout>
  );
};

export default AskYourImage;
