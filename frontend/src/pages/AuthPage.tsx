import React, { useState } from 'react';
import {
  Box,
  Flex,
  Text,
  Heading,
  Button,
  Input,
  HStack,
  VStack,
  Divider,
  IconButton,
  FormControl,
  FormLabel,
  InputGroup,
  InputLeftElement,
  InputRightElement,
} from '@chakra-ui/react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6277" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6277" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B6277" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M22 7l-10 7L2 7" />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B6277" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B6277" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const GitHubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1E2233">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const inputStyles = {
  bg: '#F7F3EE',
  border: '1px solid #E3DACF',
  color: '#1E2233',
  fontSize: 'sm',
  _placeholder: { color: '#9AA0B2' },
  _hover: { borderColor: '#CFC4B6' },
  _focus: {
    borderColor: '#5B5BF0',
    boxShadow: '0 0 0 1px rgba(91,91,240,0.14)',
  },
  transition: 'all 0.2s',
};

const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login, signup, user: signedIn } = useAuth();
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signin') {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { if (signedIn) navigate('/dashboard', { replace: true }); }, [signedIn, navigate]);

  return (
    <Flex
      minH="100vh"
      align="center"
      justify="center"
      sx={{ bg: '#FBF8F4' }}
      px={4}
      py={10}
    >
      {/* Ambient glow */}
      <Box
        position="fixed"
        top="-200px"
        left="50%"
        transform="translateX(-50%)"
        w="600px"
        h="500px"
        borderRadius="50%"
        sx={{
          bg: 'radial-gradient(circle, rgba(91,91,240,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <Box
        w="100%"
        maxW="440px"
        position="relative"
        borderRadius="16px"
        overflow="hidden"
        sx={{
          bg: '#FFFFFF',
          border: '1px solid #E3DACF',
          boxShadow: '0 25px 60px rgba(30,34,51,0.12)',
        }}
      >
        <Box p={{ base: 6, md: 8 }}>
          {/* Logo */}
          <Flex justify="center" mb={6}>
            <Link to="/" style={{ textDecoration: 'none' }}>
              <Heading
                size="lg"
                sx={{
                  bgGradient: 'linear(to-r, #5B5BF0, #4747DB)',
                  bgClip: 'text',
                  fontWeight: 800,
                  letterSpacing: '-0.5px',
                }}
              >
                ImagineAI
              </Heading>
            </Link>
          </Flex>

          {/* Heading */}
          <Box textAlign="center" mb={6}>
            <Heading size="md" mb={2} sx={{ color: '#1E2233', fontWeight: 700 }}>
              {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
            </Heading>
            <Text fontSize="sm" sx={{ color: '#5B6277' }}>
              {mode === 'signin'
                ? 'Sign in to continue your creative journey'
                : 'Start your creative journey with ImagineAI'}
            </Text>
            <Text fontSize="xs" mt={2} sx={{ color: '#8A90A2' }}>
              Demo sign-in: this build does not verify passwords or store accounts. Any email opens the studio.
            </Text>
          </Box>

          {/* Tab Toggle */}
          <Flex
            mb={6}
            borderRadius="10px"
            p="3px"
            sx={{ bg: '#F7F3EE', border: '1px solid #E3DACF' }}
          >
            {(['signin', 'signup'] as const).map((m) => (
              <Button
                key={m}
                flex={1}
                size="sm"
                borderRadius="8px"
                onClick={() => setMode(m)}
                sx={{
                  bg: mode === m ? '#EFE8DF' : 'transparent',
                  color: mode === m ? '#1E2233' : '#5B6277',
                  fontWeight: 600,
                  fontSize: 'sm',
                  _hover: { bg: mode === m ? '#EFE8DF' : 'rgba(255,255,255,0.03)' },
                  transition: 'all 0.2s',
                }}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </Button>
            ))}
          </Flex>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <VStack spacing={4}>
              {mode === 'signup' && (
                <FormControl>
                  <FormLabel fontSize="xs" fontWeight={600} sx={{ color: '#5B6277' }}>
                    Full Name
                  </FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none" h="full">
                      <UserIcon />
                    </InputLeftElement>
                    <Input
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      sx={inputStyles}
                      required
                    />
                  </InputGroup>
                </FormControl>
              )}

              <FormControl>
                <FormLabel fontSize="xs" fontWeight={600} sx={{ color: '#5B6277' }}>
                  Email
                </FormLabel>
                <InputGroup>
                  <InputLeftElement pointerEvents="none" h="full">
                    <MailIcon />
                  </InputLeftElement>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    sx={inputStyles}
                    required
                  />
                </InputGroup>
              </FormControl>

              <FormControl>
                <Flex justify="space-between" align="center" mb={1}>
                  <FormLabel fontSize="xs" fontWeight={600} mb={0} sx={{ color: '#5B6277' }}>
                    Password
                  </FormLabel>
                  {mode === 'signin' && (
                    <Text
                      as="a"
                      href="#"
                      fontSize="xs"
                      sx={{
                        color: '#5B5BF0',
                        _hover: { textDecoration: 'underline' },
                      }}
                    >
                      Forgot password?
                    </Text>
                  )}
                </Flex>
                <InputGroup>
                  <InputLeftElement pointerEvents="none" h="full">
                    <LockIcon />
                  </InputLeftElement>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    sx={inputStyles}
                    required
                  />
                  <InputRightElement h="full">
                    <Box
                      as="button"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      sx={{ cursor: 'pointer', bg: 'transparent', border: 'none' }}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </Box>
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              {error && (
                <Text role="alert" fontSize="sm" w="100%" sx={{ color: '#B3261E', bg: '#FDECEA', border: '1px solid #F5C6C2', borderRadius: '8px', px: 3, py: 2 }}>
                  {error}
                </Text>
              )}
              {mode === 'signup' && (
                <Text fontSize="xs" w="100%" sx={{ color: '#9AA0B2' }}>Use at least 10 characters and avoid common passwords.</Text>
              )}

              <Button
                type="submit"
                w="100%"
                size="md"
                isLoading={loading}
                loadingText={mode === 'signin' ? 'Signing in...' : 'Creating account...'}
                sx={{
                  bg: '#5B5BF0',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: 'sm',
                  mt: 2,
                  _hover: {
                    bg: '#4747DB',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 6px 20px rgba(91,91,240,0.14)',
                  },
                  _active: { transform: 'translateY(0)' },
                  transition: 'all 0.2s',
                }}
              >
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </Button>
            </VStack>
          </form>

        </Box>
      </Box>
    </Flex>
  );
};

export default AuthPage;
