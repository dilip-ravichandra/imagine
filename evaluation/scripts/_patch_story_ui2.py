p = 'frontend/src/pages/StoryBookStudio.tsx'
s = open(p, encoding='utf-8').read()

# cut the create button + progress out of step 1 ...
a = s.index("              <Button variant=\"brand\" size=\"lg\" px={8} onClick={handleGenerateStory}")
b = s.index("            </Flex>\n\n            {isGeneratingStory && (")
create_btn = s[a:b]
s = s[:a] + s[b:]

a = s.index("            {isGeneratingStory && (\n              <Box mt={4} pt={3}")
b = s.index("          </Box>\n\n          <Text fontSize=\"sm\" fontWeight=\"700\" color=\"#1E2233\" mt={6} mb={2}>2. Choose a look</Text>")
progress = s[a:b]
s = s[:a] + s[b:]

# ... and place them after the options
marker = "          </Collapse>\n        </Box>\n\n        {/* COMPOSED MANGA PAGES */}"
assert marker in s
block = ("          </Collapse>\n\n          <Box mt={6} bg=\"#FFFFFF\" border=\"1px solid #E3DACF\" borderRadius=\"20px\" p={{ base: 4, md: 5 }} boxShadow=\"card\">\n"
         "            <Flex align=\"center\" justify=\"space-between\" wrap=\"wrap\" gap={3}>\n"
         "              <Text color=\"#5B6277\" fontSize=\"sm\">Ready? It takes about a minute.</Text>\n"
         + create_btn.replace('size="lg" px={8}', 'size="lg" px={10}') +
         "            </Flex>\n" + progress.replace('mt={4} pt={3} borderTop="1px solid #EFE8DF" ', 'mt={4} ') +
         "          </Box>\n        </Box>\n\n        {/* COMPOSED MANGA PAGES */}")
s = s.replace(marker, block, 1)
open(p, 'w', encoding='utf-8').write(s)
print('ok')
