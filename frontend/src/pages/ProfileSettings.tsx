import React, { useEffect, useState } from 'react';
import { Box, Flex, Text, Heading, Button, Input, Select, Switch, Alert, AlertIcon, FormControl, FormLabel } from '@chakra-ui/react';
import WorkspaceLayout from '../components/WorkspaceLayout';
import { useAuth } from '../hooks/useAuth';
import { authChangePassword, getLanguages } from '../lib/api';
import { loadPrefs, savePrefs, Prefs } from '../lib/prefs';

type Section = 'account' | 'security' | 'preferences' | 'privacy';
const SECTIONS: { key: Section; label: string }[] = [
  { key: 'account', label: 'Account' }, { key: 'security', label: 'Password' }, { key: 'preferences', label: 'Preferences' }, { key: 'privacy', label: 'Privacy' },
];
const card = { bg: '#FFFFFF', border: '1px solid #E3DACF', borderRadius: '16px', p: 6, mb: 5 } as const;

const ProfileSettings: React.FC = () => {
  const { user, logout } = useAuth();
  const [section, setSection] = useState<Section>('account');
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [langs, setLangs] = useState<{ code: string; name: string }[]>([{ code: 'en', name: 'English' }, { code: 'hi', name: 'Hindi' }]);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { getLanguages().then((r) => setLangs(r.languages)).catch(() => undefined); }, []);
  const update = (patch: Partial<Prefs>) => { const p = { ...prefs, ...patch }; setPrefs(p); savePrefs(p); };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null); setBusy(true);
    try {
      await authChangePassword(cur, next);
      setCur(''); setNext(''); setMsg({ ok: true, text: 'Password changed.' });
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not change the password.' }); }
    finally { setBusy(false); }
  };

  const langSelect = (value: string, label: string, onChange: (v: string) => void) => (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} bg="#FFFFFF" borderColor="#E3DACF" maxW="260px">
      {langs.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
    </Select>
  );
  const row = (title: string, hint: string, control: React.ReactNode) => (
    <Flex justify="space-between" align="center" gap={4} py={3} borderBottom="1px solid #F0EAE0" wrap="wrap">
      <Box maxW="420px"><Text fontWeight={600} color="#1E2233" fontSize="sm">{title}</Text><Text fontSize="xs" color="#8A90A2">{hint}</Text></Box>
      {control}
    </Flex>
  );

  return (
    <WorkspaceLayout>
      <Box px={{ base: 4, md: 8 }} py={8} maxW="900px" mx="auto" bg="#FBF8F4" minH="100vh">
        <Heading size="lg" color="#1E2233" fontWeight={700} mb={5}>Settings</Heading>
        <Flex gap={2} mb={6} wrap="wrap" role="tablist">
          {SECTIONS.map((s) => (
            <Button key={s.key} role="tab" aria-selected={section === s.key} size="sm" onClick={() => { setSection(s.key); setMsg(null); }}
              bg={section === s.key ? '#5B5BF0' : '#FFFFFF'} color={section === s.key ? '#FFFFFF' : '#5B6277'} border="1px solid #E3DACF" _hover={{ bg: section === s.key ? '#4747DB' : '#F5F0EA' }}>{s.label}</Button>
          ))}
        </Flex>

        {section === 'account' && (
          <Box {...card}>
            <Flex gap={4} align="center" mb={5}>
              <Flex w="64px" h="64px" borderRadius="full" bg="linear-gradient(135deg,#5B5BF0,#8B6CF6)" color="#FFFFFF" fontWeight={800} fontSize="26px" align="center" justify="center" aria-hidden="true">
                {(user?.name || 'You').charAt(0).toUpperCase()}
              </Flex>
              <Box><Text fontWeight={700} color="#1E2233">{user?.name}</Text><Text fontSize="sm" color="#5B6277">{user?.email}</Text></Box>
            </Flex>
            {row('Role', 'Administrators can see the team dashboard.', <Text fontSize="sm" color="#1E2233" textTransform="capitalize">{user?.role}</Text>)}
            {row('Sign out', 'Ends your session on this device.', <Button size="sm" variant="outline" borderColor="#E3DACF" onClick={() => { void logout(); }}>Sign out</Button>)}
          </Box>
        )}

        {section === 'security' && (
          <Box {...card} as="form" onSubmit={changePassword}>
            <Heading size="sm" color="#1E2233" mb={4}>Change password</Heading>
            {msg && <Alert status={msg.ok ? 'success' : 'error'} borderRadius="12px" mb={4} role={msg.ok ? 'status' : 'alert'}><AlertIcon />{msg.text}</Alert>}
            <FormControl mb={3} maxW="360px"><FormLabel fontSize="sm">Current password</FormLabel>
              <Input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} bg="#FFFFFF" borderColor="#E3DACF" /></FormControl>
            <FormControl mb={4} maxW="360px"><FormLabel fontSize="sm">New password</FormLabel>
              <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} bg="#FFFFFF" borderColor="#E3DACF" />
              <Text fontSize="xs" color="#8A90A2" mt={1}>At least 10 characters; avoid common passwords.</Text></FormControl>
            <Button type="submit" bg="#5B5BF0" color="#FFFFFF" _hover={{ bg: '#4747DB' }} isLoading={busy} isDisabled={!cur || next.length < 8}>Update password</Button>
          </Box>
        )}

        {section === 'preferences' && (
          <Box {...card}>
            {row('Larger text', 'Makes everything about 18% bigger.', <Switch aria-label="Larger text" isChecked={prefs.largeText} onChange={(e) => update({ largeText: e.target.checked })} colorScheme="purple" />)}
            {row('Reduce motion', 'Turns off animations and pulsing effects.', <Switch aria-label="Reduce motion" isChecked={prefs.reduceMotion} onChange={(e) => update({ reduceMotion: e.target.checked })} colorScheme="purple" />)}
            {row('I usually speak', 'Starting language on the Voice page.', langSelect(prefs.voiceSource, 'Default spoken language', (v) => update({ voiceSource: v })))}
            {row('Translate into', 'Starting translation language.', langSelect(prefs.voiceTarget, 'Default translation language', (v) => update({ voiceTarget: v })))}
            <Text fontSize="xs" color="#8A90A2" mt={3}>Saved in this browser only.</Text>
          </Box>
        )}

        {section === 'privacy' && (
          <Box {...card}>
            <Heading size="sm" color="#1E2233" mb={3}>What happens to your data</Heading>
            <Box as="ul" pl={4} fontSize="sm" color="#1E2233" lineHeight="1.8">
              <li>Your images and prompts are saved to your own gallery, visible only when you are signed in.</li>
              <li>Questions, translations and lessons are sent to our AI providers (Groq, Google Gemini) to produce the answer. Keep personal details out of them.</li>
              <li>Voice recordings are sent for transcription and are not stored.</li>
              <li>Your password is stored only as a salted hash.</li>
            </Box>
          </Box>
        )}
      </Box>
    </WorkspaceLayout>
  );
};

export default ProfileSettings;
