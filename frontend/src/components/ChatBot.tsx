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
      const result = await sendChat([{ role: 'user', content: userText }]);
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
          bottom="24px"
          right="24px"
          zIndex={1000}
        >
          <Tooltip label="Imagine Assistant (Powered by Groq)" placement="left" hasArrow bg="#111713" color="#F4F7F0" border="1px solid #2A3A2C">
            <Box
              position="relative"
              w="58px"
              h="58px"
              borderRadius="full"
              bg="#111713"
              border="2px solid #B7FF35"
              display="flex"
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              boxShadow="0 8px 32px rgba(0,0,0,0.8), 0 0 24px rgba(183,255,53,0.35)"
              transition="all 0.25s ease"
              _hover={{
                transform: 'scale(1.1) translateY(-2px)',
                boxShadow: '0 12px 36px rgba(0,0,0,0.9), 0 0 35px rgba(183,255,53,0.5)',
                bg: '#182019',
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
                bg="#B7FF35"
                border="2px solid #080B0A"
                boxShadow="0 0 8px #B7FF35"
              />
            </Box>
          </Tooltip>
        </Box>
      )}

      {/* COMPACT FLOATING CHAT PANEL IN CORNER */}
      {isOpen && (
        <Box
          position="fixed"
          bottom="24px"
          right="24px"
          w={{ base: 'calc(100% - 32px)', sm: '380px' }}
          h="520px"
          bg="#111713"
          border="1px solid #3A4A3C"
          borderRadius="20px"
          zIndex={1001}
          display="flex"
          flexDirection="column"
          boxShadow="0 24px 64px rgba(0,0,0,0.9), 0 0 30px rgba(183,255,53,0.2)"
          overflow="hidden"
          animation="fadeIn 0.2s ease"
        >
          {/* Header */}
          <Flex
            bg="#0D120E"
            px={4}
            py={3.5}
            align="center"
            justify="space-between"
            borderBottom="1px solid #2A3A2C"
          >
            <Flex align="center" gap={2.5}>
              <Box
                w="28px"
                h="28px"
                borderRadius="full"
                bg="#B7FF35"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize="14px"
                fontWeight="bold"
                color="#080B0A"
              >
                ✦
              </Box>
              <Box>
                <Text fontWeight="700" color="#F4F7F0" fontSize="13px" lineHeight="1.2">
                  Imagine Assistant
                </Text>
                <Flex align="center" gap={1.5}>
                  <Box w="6px" h="6px" borderRadius="full" bg="#B7FF35" />
                  <Text fontSize="10px" color="#8DDB39" fontWeight="600">
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
              color="#A5B1A7"
              _hover={{ color: '#F4F7F0', bg: '#182019' }}
              borderRadius="full"
              onClick={() => setIsOpen(false)}
            />
          </Flex>

          {/* Messages Feed */}
          <Box flex={1} overflowY="auto" p={3.5} bg="#080B0A">
            {messages.map((msg, i) => (
              <Flex key={i} justify={msg.role === 'user' ? 'flex-end' : 'flex-start'} mb={3}>
                <Box
                  maxW="86%"
                  px={3.5}
                  py={2.5}
                  borderRadius={msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px'}
                  bg={msg.role === 'user' ? '#B7FF35' : '#111713'}
                  color={msg.role === 'user' ? '#080B0A' : '#F4F7F0'}
                  border="1px solid"
                  borderColor={msg.role === 'user' ? '#B7FF35' : '#2A3A2C'}
                  fontSize="12.5px"
                  lineHeight="1.5"
                  boxShadow="0 2px 8px rgba(0,0,0,0.3)"
                >
                  <Text>{msg.text}</Text>
                  <Text
                    fontSize="9px"
                    color={msg.role === 'user' ? 'rgba(0,0,0,0.6)' : '#6B7B6D'}
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
          <Box p={3} bg="#0D120E" borderTop="1px solid #2A3A2C">
            <Flex gap={2} align="center">
              <Input
                placeholder="Ask about prompts, models, stories..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                bg="#0F1A11"
                border="1px solid #2A3A2C"
                borderRadius="12px"
                color="#F4F7F0"
                fontSize="13px"
                _placeholder={{ color: '#6B7B6D' }}
                _focus={{ borderColor: '#B7FF35' }}
                size="sm"
                h="38px"
              />
              <IconButton
                aria-label="Send message"
                icon={<FiSend size={14} />}
                size="sm"
                bg="#B7FF35"
                color="#080B0A"
                borderRadius="10px"
                _hover={{ bg: '#8DDB39' }}
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
