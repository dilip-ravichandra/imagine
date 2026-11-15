import React, { useState } from 'react';
import { Box, Collapse, Flex, Text, VStack } from '@chakra-ui/react';
import { Link, useLocation } from 'react-router-dom';
import {
  FiBarChart2,
  FiBookOpen,
  FiChevronDown,
  FiChevronUp,
  FiCpu,
  FiEdit3,
  FiGrid,
  FiHome,
  FiImage,
  FiMessageCircle,
  FiMic,
  FiSettings,
  FiTool,
  FiBook,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { useAuth } from '../hooks/useAuth';

interface Item {
  label: string;
  path: string;
  icon: IconType;
  external?: boolean; // full page load (served by the backend, not the React router)
}

// Five everyday things people actually do. Everything else is one click away under "More".
const MAIN: Item[] = [
  { label: 'Home', path: '/dashboard', icon: FiHome },
  { label: 'Create image', path: '/create', icon: FiImage },
  { label: 'Edit photo', path: '/edit', icon: FiEdit3 },
  { label: 'Storybook', path: '/storybook', icon: FiBookOpen },
  { label: 'My gallery', path: '/gallery', icon: FiGrid },
];
const RESEARCH: Item[] = [
  { label: 'Results', path: '/research', icon: FiBarChart2 },
  { label: 'Experiments lab', path: '/lab', icon: FiTool },
  { label: 'Training and data', path: '/training', icon: FiCpu },
];
const MORE: Item[] = [
  { label: 'Ask about an image', path: '/ask-image', icon: FiMessageCircle },
  { label: 'Learn', path: '/learn', icon: FiBook },
  { label: 'Speak and translate', path: '/voice', icon: FiMic },
  { label: 'System status', path: '/admin', icon: FiSettings },
];
// phone tab bar: the everyday tools plus Research
const PHONE: Item[] = [MAIN[1], MAIN[2], MAIN[3], MAIN[4], { label: 'Research', path: '/research', icon: FiBarChart2 }];

const NavLink: React.FC<{ item: Item; active: boolean; small?: boolean }> = ({ item, active, small }) => {
  const inner = (
    <Flex
      align="center"
      gap={3}
      px={4}
      py={small ? 2 : 2.5}
      borderRadius="12px"
      bg={active ? '#EEF0FF' : 'transparent'}
      color={active ? '#4747DB' : '#5B6277'}
      fontWeight={active ? 700 : 500}
      fontSize={small ? '13px' : '15px'}
      _hover={{ bg: active ? '#EEF0FF' : '#F5F0EA', color: '#1E2233' }}
      transition="all 0.15s ease"
    >
      <item.icon size={small ? 16 : 18} aria-hidden />
      <Text>{item.label}</Text>
    </Flex>
  );
  return item.external ? (
    <a href={item.path}>{inner}</a>
  ) : (
    <Link to={item.path} aria-current={active ? 'page' : undefined}>{inner}</Link>
  );
};

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showMore, setShowMore] = useState(MORE.some((i) => location.pathname === i.path));
  const isActive = (p: string) => location.pathname === p;
  const name = user?.name || 'You';

  return (
    <>
      {/* Desktop: side rail */}
      <Box
        as="nav"
        aria-label="Main"
        display={{ base: 'none', md: 'flex' }}
        flexDirection="column"
        w="232px"
        minH="100vh"
        bg="#FFFFFF"
        borderRight="1px solid #E3DACF"
        py={5}
        px={3}
        position="fixed"
        left={0}
        top={0}
        zIndex={100}
      >
        <Link to="/">
          <Flex align="center" gap={3} px={3} mb={6}>
            <Flex w="36px" h="36px" borderRadius="11px" bg="linear-gradient(135deg,#5B5BF0,#8B6CF6)" align="center" justify="center" color="#FFFFFF" fontWeight={800} fontSize="18px">
              I
            </Flex>
            <Text fontSize="19px" fontWeight={800} color="#1E2233" letterSpacing="-0.02em">
              ImagineAI
            </Text>
          </Flex>
        </Link>

        <VStack spacing={1} align="stretch" flex={1}>
          {MAIN.map((i) => <NavLink key={i.path} item={i} active={isActive(i.path)} />)}

          <Box mt={5}>
            <Text px={4} pb={1} fontSize="11px" color="#8A90A2" fontWeight={700} letterSpacing="0.06em" textTransform="uppercase">Research</Text>
            <VStack spacing={1} align="stretch">
              {RESEARCH.map((i) => <NavLink key={i.path} item={i} active={isActive(i.path)} />)}
            </VStack>
          </Box>

          <Box mt={3}>
            <Flex
              as="button"
              w="100%"
              align="center"
              justify="space-between"
              px={4}
              py={2}
              color="#8A90A2"
              fontSize="12px"
              fontWeight={700}
              letterSpacing="0.06em"
              textTransform="uppercase"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
            >
              <Text>More</Text>
              {showMore ? <FiChevronUp /> : <FiChevronDown />}
            </Flex>
            <Collapse in={showMore} animateOpacity>
              <VStack spacing={1} align="stretch" mt={1}>
                {MORE.map((i) => <NavLink key={i.path} item={i} active={isActive(i.path)} small />)}
              </VStack>
            </Collapse>
          </Box>
        </VStack>

        <Link to="/profile">
          <Flex align="center" gap={3} p={3} borderRadius="14px" _hover={{ bg: '#F5F0EA' }} borderTop="1px solid #EFE8DF" mt={3}>
            <Flex w="34px" h="34px" borderRadius="full" bg="#EEF0FF" color="#4747DB" align="center" justify="center" fontWeight={700} fontSize="14px">
              {name.charAt(0).toUpperCase()}
            </Flex>
            <Box minW={0}>
              <Text fontSize="14px" fontWeight={600} color="#1E2233" isTruncated>{name}</Text>
              <Text fontSize="12px" color="#8A90A2">Settings</Text>
            </Box>
          </Flex>
        </Link>
        <Box as="button" type="button" onClick={() => { void logout(); }} aria-label="Sign out" textAlign="left" px={3} py={2} fontSize="13px" color="#8A90A2" _hover={{ color: '#B3261E' }}>
          Sign out
        </Box>
      </Box>

      {/* Phone: bottom tab bar with the five everyday actions */}
      <Flex
        as="nav"
        aria-label="Main"
        display={{ base: 'flex', md: 'none' }}
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        zIndex={100}
        bg="#FFFFFF"
        borderTop="1px solid #E3DACF"
        justify="space-around"
        pb="env(safe-area-inset-bottom)"
      >
        {PHONE.map((i) => {
          const active = isActive(i.path);
          return (
            <Link key={i.path} to={i.path} style={{ flex: 1 }} aria-current={active ? 'page' : undefined}>
              <Flex direction="column" align="center" py={2} color={active ? '#4747DB' : '#8A90A2'} fontWeight={active ? 700 : 500}>
                <i.icon size={21} aria-hidden />
                <Text fontSize="10.5px" mt={0.5}>{i.label.replace('Create image', 'Create').replace('Edit photo', 'Edit').replace('My gallery', 'Gallery')}</Text>
              </Flex>
            </Link>
          );
        })}
      </Flex>
    </>
  );
};

export default Sidebar;
