p = 'frontend/src/pages/CreateStudio.tsx'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


rep("  Tooltip,\n} from '@chakra-ui/react';", "  Tooltip,\n  Checkbox,\n} from '@chakra-ui/react';")

rep("""  'Watercolor',
  'Retro Pixel',
];""", """  'Watercolor',
  'Retro Pixel',
  'Oil Painting',
  'Pencil Sketch',
  'Vintage Film',
];""")

# text-to-image: the server composes the style prompt + negative prompt and runs the CV finisher
rep("""        const res = await generateWithModel({
          prompt: styledPrompt,
          modelChoice,
          width: dims.width,""", """        const res = await generateWithModel({
          prompt: newPrompt,
          modelChoice,
          width: dims.width,""")

rep("  const [recreationInstruction, setRecreationInstruction] = useState('');",
    "  const [recreationInstruction, setRecreationInstruction] = useState('');\n  const [snapToEdges, setSnapToEdges] = useState(false);\n  const [blendSeamless, setBlendSeamless] = useState(true);")

# inpaint: the dedicated inpainting model needs far more steps than the few-step text-to-image models
rep("""        steps: getQualitySteps('sd_turbo', getQualityPreset(quality)),
        sourceId: activeImage.id,
        style: activeImage.style,
        recreationNote: recreationInstruction,
      });""", """        steps: INPAINT_STEPS[getQualityPreset(quality)],
        sourceId: activeImage.id,
        style: activeImage.style,
        recreationNote: recreationInstruction,
        smartSelect: snapToEdges,
        harmonise: blendSeamless,
      });""")

rep("const getQualityPreset = (quality: string) =>", """// The dedicated SD inpainting model is a normal (multi-step) diffusion model, unlike the 1-4 step text-to-image presets.
const INPAINT_STEPS: Record<string, number> = { quick: 12, balanced: 24, best: 36 };

const getQualityPreset = (quality: string) =>""")

rep("""              <Flex justify="space-between" align="center" bg="#0D120E" p={2.5} borderRadius="8px" border="1px solid #1A2A1C">
                <Text fontSize="11px" color="#6B7B6D">""", """              <Flex gap={5} mb={3} wrap="wrap">
                <Tooltip label="GrabCut (classical computer vision) snaps your rough stroke to the object's boundary" hasArrow>
                  <Checkbox size="sm" colorScheme="green" isChecked={snapToEdges} onChange={(e) => setSnapToEdges(e.target.checked)}>
                    <Text fontSize="xs" color="#A5B1A7">Snap selection to object edges</Text>
                  </Checkbox>
                </Tooltip>
                <Tooltip label="LAB colour matching + multiband (Laplacian pyramid) blending so the edit has no visible seam" hasArrow>
                  <Checkbox size="sm" colorScheme="green" isChecked={blendSeamless} onChange={(e) => setBlendSeamless(e.target.checked)}>
                    <Text fontSize="xs" color="#A5B1A7">Blend seamlessly</Text>
                  </Checkbox>
                </Tooltip>
              </Flex>

              <Flex justify="space-between" align="center" bg="#0D120E" p={2.5} borderRadius="8px" border="1px solid #1A2A1C">
                <Text fontSize="11px" color="#6B7B6D">""")

rep("'Inpaint Engine Ready (SD-Turbo)'", "'Inpaint Engine Ready (SD inpainting + CV blend)'")
open(p, 'w', encoding='utf-8').write(s)
print('ok')
