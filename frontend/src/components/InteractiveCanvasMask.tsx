import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  HStack,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Badge,
  IconButton,
  Tooltip,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { FiEdit2, FiCircle, FiSquare, FiRotateCcw } from 'react-icons/fi';
import { toSameOriginImageUrl } from '../lib/api';

interface InteractiveCanvasMaskProps {
  imageUrl: string;
  onMaskChange?: (hasMask: boolean, maskDataUrl?: string, originalImageDataUrl?: string) => void;
}

export const InteractiveCanvasMask: React.FC<InteractiveCanvasMaskProps> = ({
  imageUrl,
  onMaskChange,
}) => {
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tintCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<'circle' | 'brush' | 'box'>('brush');
  const [brushSize, setBrushSize] = useState(32);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Keep latest onMaskChange callback in ref to prevent infinite re-render / mask-wiping loops
  const onMaskChangeRef = useRef(onMaskChange);
  useEffect(() => {
    onMaskChangeRef.current = onMaskChange;
  }, [onMaskChange]);

  // Fast GPU-accelerated display rendering (base image + lime green mask overlay)
  const renderDisplay = useCallback(() => {
    const displayCanvas = displayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const img = imgRef.current;
    if (!displayCanvas || !maskCanvas || !img) return;

    const ctx = displayCanvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw base image
    ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
    ctx.drawImage(img, 0, 0, displayCanvas.width, displayCanvas.height);

    // 2. Overlay lime green mask if any mask exists
    if (!tintCanvasRef.current) {
      tintCanvasRef.current = document.createElement('canvas');
    }
    const tintCanvas = tintCanvasRef.current;
    if (tintCanvas.width !== maskCanvas.width || tintCanvas.height !== maskCanvas.height) {
      tintCanvas.width = maskCanvas.width;
      tintCanvas.height = maskCanvas.height;
    }
    const tCtx = tintCanvas.getContext('2d');
    if (!tCtx) return;

    // Fill tintCanvas with lime green, keeping only regions where maskCanvas has alpha
    tCtx.clearRect(0, 0, tintCanvas.width, tintCanvas.height);
    tCtx.fillStyle = '#5B5BF0';
    tCtx.fillRect(0, 0, tintCanvas.width, tintCanvas.height);
    tCtx.globalCompositeOperation = 'destination-in';
    tCtx.drawImage(maskCanvas, 0, 0);
    tCtx.globalCompositeOperation = 'source-over';

    // Draw green mask overlay onto display canvas
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.drawImage(tintCanvas, 0, 0);
    ctx.restore();
  }, []);

  // Export binary mask: Black background (0,0,0) for preserved, White (255,255,255) for editable
  const emitMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;

    const imgData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
    let hasEditablePixels = false;

    // Fast alpha scan with stride
    for (let i = 3; i < imgData.length; i += 16) {
      if (imgData[i] > 10) {
        hasEditablePixels = true;
        break;
      }
    }

    setHasMask(hasEditablePixels);

    if (hasEditablePixels) {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = maskCanvas.width;
      exportCanvas.height = maskCanvas.height;
      const expCtx = exportCanvas.getContext('2d');
      if (expCtx) {
        // Solid black background (strictly preserved pixels)
        expCtx.fillStyle = '#000000';
        expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        // Paint editable pixels white
        expCtx.drawImage(maskCanvas, 0, 0);
        const binaryMaskUrl = exportCanvas.toDataURL('image/png');
        onMaskChangeRef.current?.(true, binaryMaskUrl);
      }
    } else {
      onMaskChangeRef.current?.(false, undefined);
    }
  }, []);

  // Load and initialize image ONCE per imageUrl change
  useEffect(() => {
    setLoadError(null);
    setHasMask(false);
    onMaskChangeRef.current?.(false);

    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;

    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    const sameOriginUrl = toSameOriginImageUrl(imageUrl);
    img.src = sameOriginUrl;

    img.onload = () => {
      imgRef.current = img;
      const naturalW = img.naturalWidth || 512;
      const naturalH = img.naturalHeight || 512;

      displayCanvas.width = naturalW;
      displayCanvas.height = naturalH;

      // Transparent offscreen mask canvas
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = naturalW;
      maskCanvas.height = naturalH;
      const maskCtx = maskCanvas.getContext('2d');
      if (maskCtx) {
        maskCtx.clearRect(0, 0, naturalW, naturalH);
      }
      maskCanvasRef.current = maskCanvas;

      renderDisplay();
    };

    img.onerror = () => {
      setLoadError(`Unable to load image for canvas mask editing from: ${sameOriginUrl}. Please check backend connection.`);
    };
  }, [imageUrl, renderDisplay]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (loadError) return;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const coords = getCanvasCoords(e);
    isDrawingRef.current = true;
    setIsDrawing(true);
    startPosRef.current = coords;

    const maskCanvas = maskCanvasRef.current;
    const maskCtx = maskCanvas?.getContext('2d');
    if (!maskCtx) return;

    if (tool === 'brush') {
      maskCtx.save();
      maskCtx.fillStyle = '#FFFFFF';
      maskCtx.beginPath();
      maskCtx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
      maskCtx.fill();
      maskCtx.restore();
      renderDisplay();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !startPosRef.current) return;
    const coords = getCanvasCoords(e);
    const maskCanvas = maskCanvasRef.current;
    const maskCtx = maskCanvas?.getContext('2d');
    if (!maskCtx) return;

    if (tool === 'brush') {
      maskCtx.save();
      maskCtx.strokeStyle = '#FFFFFF';
      maskCtx.fillStyle = '#FFFFFF';
      maskCtx.lineWidth = brushSize;
      maskCtx.lineCap = 'round';
      maskCtx.lineJoin = 'round';
      maskCtx.beginPath();
      maskCtx.moveTo(startPosRef.current.x, startPosRef.current.y);
      maskCtx.lineTo(coords.x, coords.y);
      maskCtx.stroke();
      maskCtx.restore();
      startPosRef.current = coords;
      renderDisplay();
    } else if (tool === 'circle' || tool === 'box') {
      // Live drag preview for circle and box
      renderDisplay();
      const displayCanvas = displayCanvasRef.current;
      const dCtx = displayCanvas?.getContext('2d');
      if (dCtx) {
        dCtx.save();
        dCtx.fillStyle = 'rgba(91,91,240, 0.45)';
        dCtx.strokeStyle = '#5B5BF0';
        dCtx.lineWidth = 3;
        dCtx.setLineDash([6, 4]);

        const start = startPosRef.current;
        if (tool === 'circle') {
          const rx = Math.abs(coords.x - start.x) / 2;
          const ry = Math.abs(coords.y - start.y) / 2;
          const cx = Math.min(start.x, coords.x) + rx;
          const cy = Math.min(start.y, coords.y) + ry;
          dCtx.beginPath();
          dCtx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
          dCtx.fill();
          dCtx.stroke();
        } else {
          const bx = Math.min(start.x, coords.x);
          const by = Math.min(start.y, coords.y);
          const bw = Math.abs(coords.x - start.x);
          const bh = Math.abs(coords.y - start.y);
          dCtx.fillRect(bx, by, bw, bh);
          dCtx.strokeRect(bx, by, bw, bh);
        }
        dCtx.restore();
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const coords = getCanvasCoords(e);
    isDrawingRef.current = false;
    setIsDrawing(false);

    const maskCanvas = maskCanvasRef.current;
    const maskCtx = maskCanvas?.getContext('2d');
    const start = startPosRef.current;

    if (maskCtx && start) {
      maskCtx.save();
      maskCtx.fillStyle = '#FFFFFF';

      if (tool === 'circle') {
        const rx = Math.abs(coords.x - start.x) / 2;
        const ry = Math.abs(coords.y - start.y) / 2;
        const cx = Math.min(start.x, coords.x) + rx;
        const cy = Math.min(start.y, coords.y) + ry;
        if (rx > 2 || ry > 2) {
          maskCtx.beginPath();
          maskCtx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
          maskCtx.fill();
        }
      } else if (tool === 'box') {
        const bx = Math.min(start.x, coords.x);
        const by = Math.min(start.y, coords.y);
        const bw = Math.abs(coords.x - start.x);
        const bh = Math.abs(coords.y - start.y);
        if (bw > 2 || bh > 2) {
          maskCtx.fillRect(bx, by, bw, bh);
        }
      }
      maskCtx.restore();
    }

    startPosRef.current = null;
    renderDisplay();
    emitMask();
  };

  const handleClearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const maskCtx = maskCanvas.getContext('2d');
    if (maskCtx) {
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }
    renderDisplay();
    emitMask();
  };

  const applyPresetMask = (preset: 'center' | 'top' | 'bottom') => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;

    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskCtx.fillStyle = '#FFFFFF';
    const w = maskCanvas.width;
    const h = maskCanvas.height;

    if (preset === 'center') {
      maskCtx.beginPath();
      maskCtx.ellipse(w / 2, h / 2, w * 0.28, h * 0.35, 0, 0, Math.PI * 2);
      maskCtx.fill();
    } else if (preset === 'top') {
      maskCtx.fillRect(0, 0, w, h * 0.45);
    } else if (preset === 'bottom') {
      maskCtx.fillRect(0, h * 0.55, w, h * 0.45);
    }

    renderDisplay();
    emitMask();
  };

  return (
    <Box bg="#FFFFFF" border="1px solid #E3DACF" borderRadius="14px" p={3.5}>
      {loadError && (
        <Alert status="error" borderRadius="8px" mb={3} fontSize="xs" bg="rgba(229,72,77, 0.15)" color="#E5484D">
          <AlertIcon />
          {loadError}
        </Alert>
      )}

      {/* Top Controls Toolbar */}
      <Flex justify="space-between" align="center" mb={3} wrap="wrap" gap={2}>
        <HStack spacing={1.5}>
          <Tooltip label="Brush Mask Tool (Paint editable region directly)">
            <Button
              size="xs"
              bg={tool === 'brush' ? '#5B5BF0' : '#F5F0EA'}
              color={tool === 'brush' ? '#FBF8F4' : '#5B6277'}
              border="1px solid"
              borderColor={tool === 'brush' ? '#5B5BF0' : '#E3DACF'}
              _hover={{ borderColor: '#5B5BF0' }}
              leftIcon={<FiEdit2 size={12} />}
              onClick={() => setTool('brush')}
              fontWeight="bold"
            >
              Brush
            </Button>
          </Tooltip>

          <Tooltip label="Circle / Oval Region Tool">
            <Button
              size="xs"
              bg={tool === 'circle' ? '#5B5BF0' : '#F5F0EA'}
              color={tool === 'circle' ? '#FBF8F4' : '#5B6277'}
              border="1px solid"
              borderColor={tool === 'circle' ? '#5B5BF0' : '#E3DACF'}
              _hover={{ borderColor: '#5B5BF0' }}
              leftIcon={<FiCircle size={12} />}
              onClick={() => setTool('circle')}
              fontWeight="bold"
            >
              Circle
            </Button>
          </Tooltip>

          <Tooltip label="Box Selection Tool">
            <Button
              size="xs"
              bg={tool === 'box' ? '#5B5BF0' : '#F5F0EA'}
              color={tool === 'box' ? '#FBF8F4' : '#5B6277'}
              border="1px solid"
              borderColor={tool === 'box' ? '#5B5BF0' : '#E3DACF'}
              _hover={{ borderColor: '#5B5BF0' }}
              leftIcon={<FiSquare size={12} />}
              onClick={() => setTool('box')}
              fontWeight="bold"
            >
              Box
            </Button>
          </Tooltip>

          <Tooltip label="Clear Mask">
            <IconButton
              aria-label="Clear Mask"
              icon={<FiRotateCcw size={12} />}
              size="xs"
              variant="ghost"
              color="#E5484D"
              _hover={{ bg: '#F5F0EA' }}
              onClick={handleClearMask}
            />
          </Tooltip>
        </HStack>

        {/* Brush Size / Status */}
        <Flex align="center" gap={3}>
          {tool === 'brush' && (
            <Flex align="center" gap={2}>
              <Text fontSize="10px" color="#5B6277">Size: {brushSize}px</Text>
              <Slider
                aria-label="brush-size"
                value={brushSize}
                min={8}
                max={100}
                onChange={(val) => setBrushSize(val)}
                w="60px"
              >
                <SliderTrack bg="#F5F0EA">
                  <SliderFilledTrack bg="#5B5BF0" />
                </SliderTrack>
                <SliderThumb boxSize={3} bg="#5B5BF0" />
              </Slider>
            </Flex>
          )}

          <Badge
            bg={hasMask ? 'rgba(91,91,240,0.2)' : 'rgba(255,255,255,0.06)'}
            color={hasMask ? '#5B5BF0' : '#8A90A2'}
            fontSize="10px"
            px={2}
            py={0.5}
            borderRadius="full"
          >
            {hasMask ? `✓ Region Selected` : `Paint or drag to mask region`}
          </Badge>
        </Flex>
      </Flex>

      {/* Preset quick selection pills */}
      <Flex align="center" gap={2} mb={3}>
        <Text fontSize="10px" color="#8A90A2">Quick Presets:</Text>
        <Button size="xs" variant="ghost" color="#5B6277" fontSize="10px" h="20px" px={2} _hover={{ color: '#5B5BF0', bg: '#F5F0EA' }} onClick={() => applyPresetMask('center')}>
          🎯 Center Subject
        </Button>
        <Button size="xs" variant="ghost" color="#5B6277" fontSize="10px" h="20px" px={2} _hover={{ color: '#5B5BF0', bg: '#F5F0EA' }} onClick={() => applyPresetMask('top')}>
          ☁️ Sky / Background
        </Button>
        <Button size="xs" variant="ghost" color="#5B6277" fontSize="10px" h="20px" px={2} _hover={{ color: '#5B5BF0', bg: '#F5F0EA' }} onClick={() => applyPresetMask('bottom')}>
          🌊 Ground / Foreground
        </Button>
      </Flex>

      {/* Canvas container with touch-action: none for pointer events */}
      <Box
        ref={containerRef}
        position="relative"
        borderRadius="10px"
        overflow="hidden"
        border="1px solid #E3DACF"
        bg="#FBF8F4"
        display="flex"
        alignItems="center"
        justifyContent="center"
        cursor="crosshair"
        userSelect="none"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={displayCanvasRef}
          style={{
            maxWidth: '100%',
            height: 'auto',
            display: 'block',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </Box>

      <Text fontSize="10px" color="#8A90A2" textAlign="center" mt={2}>
        💡 The tinted area will be changed. Everything else stays exactly as it is.
      </Text>
    </Box>
  );
};

export default InteractiveCanvasMask;
