import React from 'react';
import { Box, Flex } from '@chakra-ui/react';
import Sidebar from './Sidebar';
import ChatBot from './ChatBot';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
}

const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({ children }) => {
  return (
    <Flex minH="100vh" bg="#FBF8F4" overflowX="hidden">
      <Sidebar />
      <Box
        flex={1}
        ml={{ base: 0, md: '232px' }}
        minH="100vh"
        maxW={{ base: '100%', md: 'calc(100vw - 232px)' }}
        pb={{ base: '76px', md: 0 }}
        overflowX="hidden"
        transition="margin-left 0.2s ease"
      >
        {children}
      </Box>
      <ChatBot />
    </Flex>
  );
};

export default WorkspaceLayout;
