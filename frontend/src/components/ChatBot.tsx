import React, { useState } from 'react';
import {
  Box,
  Flex,
  Input,
  Text,
  IconButton,
  Tooltip,
} from '@chakra-ui/react';
import { FiMessageSquare, FiX, FiSend, FiMic } from 'react-icons/fi';
import { sendChat } from '../lib/api';

interface ChatBotProps {
  isOpen?: boolean;
}

const ChatBot: React.FC<ChatBotProps> = ({ isOpen: initialOpen = false }) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string; time: string }[]>([
    {
      role: 'assistant',
      text: "Hi! I'm your Imagine AI Assistant powered by Groq. Ask me anything about creating prompts, learning science, storytelling, or editing images!",
      time: 'Just now',
    },
  ]);

  const sendMessage = async () => {
    if (!message.trim()) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userText = message.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userText, time }]);
    setMessage('');
    try {
      const history = [...messages.filter((m, i) => i > 0), { role: 'user' as const, text: userText, time }]
        .slice(-12).map((m) => ({ role: m.role, content: m.text }));
      const result = await sendChat(history);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: result.message,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: error instanceof Error ? error.message : 'The assistant request failed.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  return (
    <>
      {/* FLOATING CORNER CIRCLE LAUNCHER (Non-intrusive) */}
      {!isOpen && (
        <Box
          position="fixed"
          bottom={{ base: "88px", md: "24px" }}
          right={{ base: "16px", md: "24px" }}
          zIndex={1000}
        >
          <Tooltip label="Imagine Assistant (Powered by Groq)" placement="left" hasArrow bg="#FFFFFF" color="#1E2233" border="1px solid #E3DACF">
            <Box
              position="relative"
              w="58px"
              h="58px"
              borderRadius="full"
              bg="#FFFFFF"
              border="2px solid #5B5BF0"
              display="flex"
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              boxShadow="0 8px 32px rgba(30,34,51,0.16), 0 0 24px rgba(91,91,240,0.14)"
              transition="all 0.25s ease"
              _hover={{
                transform: 'scale(1.1) translateY(-2px)',
                boxShadow: '0 12px 36px rgba(30,34,51,0.16), 0 0 35px rgba(91,91,240,0.5)',
                bg: '#F5F0EA',
              }}
              onClick={() => setIsOpen(true)}
            >
              {/* Center Glowing Icon */}
              <Text fontSize="22px" lineHeight="1">
                ✦
              </Text>

              {/* Online indicator green dot */}
              <Box
                position="absolute"
                top="2px"
                right="2px"
                w="12px"
                h="12px"
                borderRadius="full"
                bg="#5B5BF0"
                border="2px solid #FBF8F4"
                boxShadow="0 0 8px #5B5BF0"
              />
            </Box>
          </Tooltip>
        </Box>
      )}

      {/* COMPACT FLOATING CHAT PANEL IN CORNER */}
      {isOpen && (
        <Box
          position="fixed"
          bottom={{ base: "88px", md: "24px" }}
          right={{ base: "16px", md: "24px" }}
          w={{ base: 'calc(100% - 32px)', sm: '380px' }}
          h={{ base: 'min(520px, calc(100vh - 110px))', md: '520px' }}
          bg="#FFFFFF"
          border="1px solid #CFC4B6"
          borderRadius="20px"
          zIndex={1001}
          display="flex"
          flexDirection="column"
          boxShadow="0 24px 64px rgba(30,34,51,0.16), 0 0 30px rgba(91,91,240,0.14)"
          overflow="hidden"
          animation="fadeIn 0.2s ease"
        >
          {/* Header */}
          <Flex
            bg="#FFFFFF"
            px={4}
            py={3.5}
            align="center"
            justify="space-between"
            borderBottom="1px solid #E3DACF"
          >
            <Flex align="center" gap={2.5}>
              <Box
                w="28px"
                h="28px"
                borderRadius="full"
                bg="#5B5BF0"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize="14px"
                fontWeight="bold"
                color="#FFFFFF"
              >
                ✦
              </Box>
              <Box>
                <Text fontWeight="700" color="#1E2233" fontSize="13px" lineHeight="1.2">
                  Imagine Assistant
                </Text>
                <Flex align="center" gap={1.5}>
                  <Box w="6px" h="6px" borderRadius="full" bg="#5B5BF0" />
                  <Text fontSize="10px" color="#4747DB" fontWeight="600">
                    Groq Fast Inference
                  </Text>
                </Flex>
              </Box>
            </Flex>

            <IconButton
              aria-label="Close assistant"
              icon={<FiX size={16} />}
              size="xs"
              variant="ghost"
              color="#5B6277"
              _hover={{ color: '#1E2233', bg: '#F5F0EA' }}
              borderRadius="full"
              onClick={() => setIsOpen(false)}
            />
          </Flex>

          {/* Messages Feed */}
          <Box flex={1} overflowY="auto" p={3.5} bg="#FBF8F4">
            {messages.map((msg, i) => (
              <Flex key={i} justify={msg.role === 'user' ? 'flex-end' : 'flex-start'} mb={3}>
                <Box
                  maxW="86%"
                  px={3.5}
                  py={2.5}
                  borderRadius={msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px'}
                  bg={msg.role === 'user' ? '#5B5BF0' : '#FFFFFF'}
                  color={msg.role === 'user' ? '#FBF8F4' : '#1E2233'}
                  border="1px solid"
                  borderColor={msg.role === 'user' ? '#5B5BF0' : '#E3DACF'}
                  fontSize="12.5px"
                  lineHeight="1.5"
                  boxShadow="0 2px 8px rgba(30,34,51,0.12)"
                >
                  <Text>{msg.text}</Text>
                  <Text
                    fontSize="9px"
                    color={msg.role === 'user' ? 'rgba(0,0,0,0.6)' : '#8A90A2'}
                    textAlign="right"
                    mt={1}
                  >
                    {msg.time}
                  </Text>
                </Box>
              </Flex>
            ))}
          </Box>

          {/* Input Bar */}
          <Box p={3} bg="#FFFFFF" borderTop="1px solid #E3DACF">
            <Flex gap={2} align="center">
              <Input
                placeholder="Ask about prompts, models, stories..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                bg="#F7F3EE"
                border="1px solid #E3DACF"
                borderRadius="12px"
                color="#1E2233"
                fontSize="13px"
                _placeholder={{ color: '#8A90A2' }}
                _focus={{ borderColor: '#5B5BF0' }}
                size="sm"
                h="38px"
              />
              <IconButton
                aria-label="Send message"
                icon={<FiSend size={14} />}
                size="sm"
                bg="#5B5BF0"
                color="#FFFFFF"
                borderRadius="10px"
                _hover={{ bg: '#4747DB' }}
                onClick={sendMessage}
                flexShrink={0}
              />
            </Flex>
          </Box>
        </Box>
      )}
    </>
  );
};

export default ChatBot;
