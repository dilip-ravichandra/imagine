# Compositional failures (auto-extracted)

Prompts whose generated image failed the automatic check. The checker is imperfect: open the image to confirm before citing a case.

## T1: SD-Turbo fp16, 1 step (33 failures)

- **two_objects**: "a photo of a book and a bicycle" -> `T1/0029.jpg`
- **two_objects**: "a photo of a bird and a bicycle" -> `T1/0034.jpg`
- **two_objects**: "a photo of a pizza and a book" -> `T1/0038.jpg`
- **counting**: "a photo of 4 bananas" -> `T1/0040.jpg`
- **counting**: "a photo of 3 bananas" -> `T1/0041.jpg`
- **counting**: "a photo of 3 backpacks" -> `T1/0045.jpg`
- **counting**: "a photo of 4 benches" -> `T1/0047.jpg`
- **colour**: "a photo of a blue banana" -> `T1/0060.jpg`
- **colour**: "a photo of a white apple" -> `T1/0078.jpg`
- **position**: "a photo of a chair right of a car" -> `T1/0080.jpg`
- **position**: "a photo of a chair right of a laptop" -> `T1/0081.jpg`
- **position**: "a photo of a clock left of an umbrella" -> `T1/0083.jpg`
- **position**: "a photo of a television above a backpack" -> `T1/0085.jpg`

## T2: SD-Turbo fp16, 2 steps (37 failures)

- **two_objects**: "a photo of a book and a bicycle" -> `T2/0029.jpg`
- **two_objects**: "a photo of a backpack and a cup" -> `T2/0033.jpg`
- **two_objects**: "a photo of a book and a car" -> `T2/0035.jpg`
- **two_objects**: "a photo of a television and a cup" -> `T2/0037.jpg`
- **counting**: "a photo of 4 bananas" -> `T2/0040.jpg`
- **counting**: "a photo of 3 bananas" -> `T2/0041.jpg`
- **counting**: "a photo of 3 backpacks" -> `T2/0045.jpg`
- **counting**: "a photo of 4 benches" -> `T2/0047.jpg`
- **colour**: "a photo of a blue banana" -> `T2/0060.jpg`
- **colour**: "a photo of a white apple" -> `T2/0078.jpg`
- **position**: "a photo of a chair right of a car" -> `T2/0080.jpg`
- **position**: "a photo of a chair right of a laptop" -> `T2/0081.jpg`
- **position**: "a photo of a clock left of an umbrella" -> `T2/0083.jpg`
- **position**: "a photo of a television above a backpack" -> `T2/0085.jpg`

## O4: + LCM-LoRA, fp16, 4 steps (50 failures)

- **two_objects**: "a photo of a laptop and a backpack" -> `O4/0022.jpg`
- **two_objects**: "a photo of a cat and a backpack" -> `O4/0023.jpg`
- **two_objects**: "a photo of a book and a bicycle" -> `O4/0029.jpg`
- **two_objects**: "a photo of a backpack and an umbrella" -> `O4/0030.jpg`
- **counting**: "a photo of 4 bananas" -> `O4/0040.jpg`
- **counting**: "a photo of 3 bananas" -> `O4/0041.jpg`
- **counting**: "a photo of 2 umbrellas" -> `O4/0042.jpg`
- **counting**: "a photo of 2 laptops" -> `O4/0044.jpg`
- **colour**: "a photo of a black car" -> `O4/0061.jpg`
- **colour**: "a photo of a blue pizza" -> `O4/0062.jpg`
- **colour**: "a photo of a white banana" -> `O4/0067.jpg`
- **colour**: "a photo of a blue pizza" -> `O4/0073.jpg`
- **position**: "a photo of a chair right of a car" -> `O4/0080.jpg`
- **position**: "a photo of a chair right of a laptop" -> `O4/0081.jpg`
- **position**: "a photo of a dog right of a pizza" -> `O4/0082.jpg`
- **position**: "a photo of a clock left of an umbrella" -> `O4/0083.jpg`

## Q4: + LCM-LoRA, fp16, 4 steps, int8 weight-only UNet (48 failures)

- **two_objects**: "a photo of a laptop and a backpack" -> `Q4/0022.jpg`
- **two_objects**: "a photo of a cat and a backpack" -> `Q4/0023.jpg`
- **two_objects**: "a photo of a book and a bicycle" -> `Q4/0029.jpg`
- **two_objects**: "a photo of a backpack and a cup" -> `Q4/0033.jpg`
- **counting**: "a photo of 4 bananas" -> `Q4/0040.jpg`
- **counting**: "a photo of 3 bananas" -> `Q4/0041.jpg`
- **counting**: "a photo of 2 umbrellas" -> `Q4/0042.jpg`
- **counting**: "a photo of 2 laptops" -> `Q4/0044.jpg`
- **colour**: "a photo of a blue pizza" -> `Q4/0062.jpg`
- **colour**: "a photo of a white banana" -> `Q4/0067.jpg`
- **colour**: "a photo of a blue pizza" -> `Q4/0073.jpg`
- **colour**: "a photo of a black book" -> `Q4/0077.jpg`
- **position**: "a photo of a chair right of a car" -> `Q4/0080.jpg`
- **position**: "a photo of a chair right of a laptop" -> `Q4/0081.jpg`
- **position**: "a photo of a dog right of a pizza" -> `Q4/0082.jpg`
- **position**: "a photo of a clock left of an umbrella" -> `Q4/0083.jpg`

## B0: Baseline: SD1.5 fp32, 30 steps (PNDM, CFG 7.5) (43 failures)

- **two_objects**: "a photo of an apple and a cat" -> `B0/0020.jpg`
- **two_objects**: "a photo of a laptop and a backpack" -> `B0/0022.jpg`
- **two_objects**: "a photo of an apple and a chair" -> `B0/0028.jpg`
- **two_objects**: "a photo of a backpack and an umbrella" -> `B0/0030.jpg`
- **counting**: "a photo of 4 bananas" -> `B0/0040.jpg`
- **counting**: "a photo of 4 bottles" -> `B0/0043.jpg`
- **counting**: "a photo of 3 backpacks" -> `B0/0045.jpg`
- **counting**: "a photo of 3 vases" -> `B0/0046.jpg`
- **colour**: "a photo of a blue pizza" -> `B0/0062.jpg`
- **colour**: "a photo of a white banana" -> `B0/0067.jpg`
- **colour**: "a photo of a red pizza" -> `B0/0069.jpg`
- **colour**: "a photo of a black book" -> `B0/0077.jpg`
- **position**: "a photo of a chair right of a car" -> `B0/0080.jpg`
- **position**: "a photo of a chair right of a laptop" -> `B0/0081.jpg`
- **position**: "a photo of a dog right of a pizza" -> `B0/0082.jpg`
- **position**: "a photo of a clock left of an umbrella" -> `B0/0083.jpg`

## D4: ImagineAI-Distilled: SD1.5 + OUR COCO-warm-started LCM-LoRA, fp16, 4 steps (49 failures)

- **two_objects**: "a photo of a backpack and a bicycle" -> `D4/0021.jpg`
- **two_objects**: "a photo of a laptop and a backpack" -> `D4/0022.jpg`
- **two_objects**: "a photo of a cat and a backpack" -> `D4/0023.jpg`
- **two_objects**: "a photo of a book and a bicycle" -> `D4/0029.jpg`
- **counting**: "a photo of 4 bananas" -> `D4/0040.jpg`
- **counting**: "a photo of 4 bottles" -> `D4/0043.jpg`
- **counting**: "a photo of 2 laptops" -> `D4/0044.jpg`
- **counting**: "a photo of 3 bananas" -> `D4/0048.jpg`
- **colour**: "a photo of a blue banana" -> `D4/0060.jpg`
- **colour**: "a photo of a blue pizza" -> `D4/0062.jpg`
- **colour**: "a photo of a white banana" -> `D4/0067.jpg`
- **colour**: "a photo of a blue pizza" -> `D4/0073.jpg`
- **position**: "a photo of a chair right of a car" -> `D4/0080.jpg`
- **position**: "a photo of a chair right of a laptop" -> `D4/0081.jpg`
- **position**: "a photo of a dog right of a pizza" -> `D4/0082.jpg`
- **position**: "a photo of a clock left of an umbrella" -> `D4/0083.jpg`
