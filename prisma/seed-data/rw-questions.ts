import type { SeedQuestion } from "./types";

// Original R&W items authored for XeduSAT, ordered roughly easy → hard within
// testing points, covering every R&W domain/skill in the blueprint.
export const rwQuestions: SeedQuestion[] = [
  // ---- Craft and Structure: Words in Context ----
  {
    section: "RW",
    domain: "Craft and Structure",
    skill: "Words in Context",
    difficulty: "easy",
    type: "MCQ",
    passageText:
      "The city's new bike-share program was an immediate success. Within a month, ridership numbers were so high that officials had to ______ the fleet, adding hundreds of bicycles to keep up with demand.",
    stem: "Which choice completes the text with the most logical and precise word?",
    choices: ["expand", "abandon", "conceal", "question"],
    correctAnswer: "A",
    explanation:
      "Officials added hundreds of bicycles to meet high demand, so they made the fleet larger — expand. The other choices contradict adding bicycles.",
  },
  {
    section: "RW",
    domain: "Craft and Structure",
    skill: "Words in Context",
    difficulty: "medium",
    type: "MCQ",
    passageText:
      "Although the committee praised the proposal's ambition, several members found its budget ______: the projected costs seemed far too low for a project of such scale.",
    stem: "Which choice completes the text with the most logical and precise word?",
    choices: ["implausible", "generous", "meticulous", "conventional"],
    correctAnswer: "A",
    explanation:
      "Costs that seem 'far too low' for the project's scale are hard to believe — implausible. 'Generous' and 'meticulous' would praise the budget; 'conventional' is unrelated.",
  },
  {
    section: "RW",
    domain: "Craft and Structure",
    skill: "Words in Context",
    difficulty: "hard",
    type: "MCQ",
    passageText:
      "The novelist's later works were praised for their restraint. Where her early fiction had ______ every emotion in florid detail, the mature novels trusted readers to sense feeling in a single gesture or a held silence.",
    stem: "Which choice completes the text with the most logical and precise word?",
    choices: ["belabored", "understated", "concealed", "doubted"],
    correctAnswer: "A",
    explanation:
      "The contrast with mature 'restraint' and 'a single gesture' implies the early fiction overdid emotion in 'florid detail' — belabored. 'Understated' and 'concealed' describe the opposite; 'doubted' is illogical.",
  },
  // ---- Craft and Structure: Text Structure and Purpose ----
  {
    section: "RW",
    domain: "Craft and Structure",
    skill: "Text Structure and Purpose",
    difficulty: "medium",
    type: "MCQ",
    passageText:
      "Many people assume that yawning cools the brain. The author of a recent review notes that this hypothesis is popular and intuitive. She then devotes most of her article to the studies that fail to support it, concluding that the evidence remains thin.",
    stem: "Which choice best describes the overall structure of the text?",
    choices: [
      "It introduces a common idea and then presents evidence that undercuts it.",
      "It compares two competing scientific theories in equal detail.",
      "It traces the historical development of a single experiment.",
      "It defends a widely accepted claim against a new challenge.",
    ],
    correctAnswer: "A",
    explanation:
      "The text presents the popular cooling hypothesis, then spends most of its space on studies that fail to support it. It doesn't compare two theories equally, trace one experiment, or defend the claim.",
  },
  {
    section: "RW",
    domain: "Craft and Structure",
    skill: "Text Structure and Purpose",
    difficulty: "hard",
    type: "MCQ",
    passageText:
      "In the essay's opening, the historian recounts a vivid anecdote about a forgotten inventor whose patents expired unused. Only in the final paragraph does she reveal that the anecdote is a composite, assembled from several careers to illustrate a pattern rather than a single life.",
    stem: "What is the main rhetorical purpose of the final paragraph's revelation?",
    choices: [
      "To signal that the anecdote was meant to typify a broader trend, not report one case",
      "To apologize for an error the historian made earlier in the essay",
      "To introduce a second inventor whose story contradicts the first",
      "To argue that composite anecdotes are more accurate than real ones",
    ],
    correctAnswer: "A",
    explanation:
      "Revealing the anecdote is a composite 'to illustrate a pattern rather than a single life' reframes it as representative. It's not an apology, a new contradicting case, or a general claim about accuracy.",
  },
  // ---- Craft and Structure: Cross-Text Connections ----
  {
    section: "RW",
    domain: "Craft and Structure",
    skill: "Cross-Text Connections",
    difficulty: "hard",
    type: "MCQ",
    passageText:
      "Text 1: Economist Ruiz argues that remote work permanently raises productivity, since workers reclaim commuting time and report sharper focus at home.\n\nText 2: Organizational researcher Baptiste cautions that early productivity gains from remote work often fade. In her studies, output rose for a few months but then declined as informal collaboration and mentorship eroded.",
    stem: "Based on the texts, how would Baptiste most likely respond to Ruiz's claim?",
    choices: [
      "The initial gains are real but may not last once weakened collaboration takes a toll.",
      "Remote work has no measurable effect on productivity in either direction.",
      "Reclaimed commuting time is the only factor that matters for productivity.",
      "Productivity gains from remote work grow steadily the longer it continues.",
    ],
    correctAnswer: "A",
    explanation:
      "Baptiste agrees output rises at first but says gains 'fade' as collaboration erodes — a qualification of Ruiz, not a flat denial. The other choices overstate, misattribute, or reverse her findings.",
  },
  {
    section: "RW",
    domain: "Craft and Structure",
    skill: "Cross-Text Connections",
    difficulty: "hard",
    type: "MCQ",
    passageText:
      "Text 1: A curator argues that museums should return artifacts to their countries of origin, since objects carry meaning tied to their original communities.\n\nText 2: A conservator counters that some fragile artifacts are safer in institutions with climate control and expert staff, and that access for global scholarship matters too.",
    stem: "Which statement about the two authors is best supported?",
    choices: [
      "They weigh different priorities—cultural origin versus preservation and access—when judging where artifacts belong.",
      "They agree that artifacts should never leave their country of origin.",
      "They both believe preservation should outweigh all other concerns.",
      "They disagree about whether artifacts carry any cultural meaning at all.",
    ],
    correctAnswer: "A",
    explanation:
      "The curator prioritizes cultural origin; the conservator prioritizes preservation and access. Their disagreement is about which priority governs, not about meaning itself or a shared absolute rule.",
  },
  // ---- Information and Ideas: Central Ideas and Details ----
  {
    section: "RW",
    domain: "Information and Ideas",
    skill: "Central Ideas and Details",
    difficulty: "easy",
    type: "MCQ",
    passageText:
      "Octopuses can change both the color and the texture of their skin. Special cells let them shift hue in an instant, while tiny muscles raise or flatten bumps on the skin's surface. Together these abilities let an octopus match not just the color but the roughness of nearby rocks and coral.",
    stem: "Which choice best states the main idea of the text?",
    choices: [
      "An octopus can camouflage itself by matching both the color and the texture of its surroundings.",
      "Octopuses are the only animals capable of changing color.",
      "The muscles in an octopus's skin are stronger than its color-changing cells.",
      "Coral reefs are the most common habitat for octopuses.",
    ],
    correctAnswer: "A",
    explanation:
      "The text describes both color and texture change working 'together' to match surroundings. The other choices add claims (only animal, muscle strength, habitat) the text doesn't make.",
  },
  {
    section: "RW",
    domain: "Information and Ideas",
    skill: "Central Ideas and Details",
    difficulty: "medium",
    type: "MCQ",
    passageText:
      "Restorers of old films once assumed that sharper was always better, digitally scrubbing away every scratch and grain. Curators now argue that some grain is part of how a film originally looked, and that over-cleaning can make a 1940s movie feel artificially smooth, stripping it of its period texture.",
    stem: "Which choice best states the main idea of the text?",
    choices: [
      "Film restorers increasingly believe that removing all imperfections can distort a film's original character.",
      "Digital tools have made film restoration completely automatic.",
      "Films from the 1940s cannot be restored with modern technology.",
      "Grain and scratches are identical problems for restorers.",
    ],
    correctAnswer: "A",
    explanation:
      "Curators now warn that over-cleaning strips 'period texture,' distorting the original look. The passage doesn't say restoration is automatic, impossible, or that grain and scratches are the same.",
  },
  // ---- Information and Ideas: Command of Evidence (textual) ----
  {
    section: "RW",
    domain: "Information and Ideas",
    skill: "Command of Evidence",
    difficulty: "medium",
    type: "MCQ",
    passageText:
      "A student hypothesizes that a houseplant grows faster when spoken to daily. To test this fairly, she must rule out the possibility that any observed difference is caused by something other than the speaking itself.",
    stem: "Which finding, if true, would most directly support the student's hypothesis?",
    choices: [
      "Plants spoken to daily grew taller than otherwise identical plants that received the same light, water, and soil but no speaking.",
      "Plants spoken to daily were placed on a sunnier windowsill than the silent plants.",
      "The student enjoyed the experiment and repeated it the next year.",
      "Most gardeners in a survey said they believe talking to plants helps.",
    ],
    correctAnswer: "A",
    explanation:
      "Support requires isolating speaking as the only difference; choice A holds light, water, and soil constant. B introduces a confound (sunlight), and C and D are opinions, not evidence.",
  },
  {
    section: "RW",
    domain: "Information and Ideas",
    skill: "Command of Evidence",
    difficulty: "hard",
    type: "MCQ",
    graphSpec: {
      type: "table",
      title: "Average monthly rainfall and reservoir level, Valley Region",
      headers: ["Month", "Rainfall (mm)", "Reservoir level (% full)"],
      rows: [
        ["March", 40, 55],
        ["April", 95, 62],
        ["May", 130, 78],
        ["June", 30, 70],
      ],
    },
    passageText:
      "A regional planner claims that the reservoir level in the Valley Region tends to rise in months with heavier rainfall, though the level does not respond instantly and can stay elevated after a wet month.",
    stem: "Which choice best uses data from the table to support the planner's claim?",
    choices: [
      "Rainfall rose from March to May and the reservoir level rose with it; in June rainfall dropped sharply, yet the level stayed high at 70%.",
      "Rainfall was highest in May, and the reservoir was completely empty that month.",
      "The reservoir level fell every month regardless of rainfall.",
      "June had the most rainfall and the highest reservoir level of any month.",
    ],
    correctAnswer: "A",
    explanation:
      "The claim has two parts: level rises with heavier rain, and stays elevated afterward. Choice A cites the March–May rise and June's high 70% despite low rain. The others misread the table.",
  },
  // ---- Information and Ideas: Inferences ----
  {
    section: "RW",
    domain: "Information and Ideas",
    skill: "Inferences",
    difficulty: "medium",
    type: "MCQ",
    passageText:
      "Some desert plants open their leaf pores only at night. During the scorching day, keeping these pores shut sharply reduces water loss. The plants store carbon dioxide taken in overnight and use it for photosynthesis once the sun rises.",
    stem: "Which choice most logically completes the text?",
    choices: [
      "this strategy lets the plants conserve water while still gathering the carbon dioxide photosynthesis requires.",
      "these plants cannot perform photosynthesis at all.",
      "the plants lose more water at night than during the day.",
      "opening leaf pores during the day would reduce the plants' water loss.",
    ],
    correctAnswer: "A",
    explanation:
      "Closing pores by day saves water while overnight CO₂ storage still feeds daytime photosynthesis — conserving water and gathering CO₂. The other options contradict the passage.",
  },
  {
    section: "RW",
    domain: "Information and Ideas",
    skill: "Inferences",
    difficulty: "hard",
    type: "MCQ",
    passageText:
      "Archaeologists found that a coastal settlement's oldest pottery closely resembles styles from an inland culture hundreds of kilometers away, while its later pottery is entirely local in style. No inland settlements of the same age show coastal influence in return.",
    stem: "Which choice most logically completes the text?",
    choices: [
      "the earliest coastal potters were likely influenced by the inland culture before developing their own distinct tradition.",
      "the inland culture must have been founded by potters who migrated from the coast.",
      "the coastal and inland cultures never had any contact with each other.",
      "the coastal settlement's later pottery was imported from inland.",
    ],
    correctAnswer: "A",
    explanation:
      "Oldest coastal pottery mirrors inland styles (one-directional influence), and later pottery becomes local—suggesting early inland influence followed by an independent tradition. The other options reverse or deny the evidence.",
  },
  // ---- Standard English Conventions: Boundaries ----
  {
    section: "RW",
    domain: "Standard English Conventions",
    skill: "Boundaries",
    difficulty: "easy",
    type: "MCQ",
    passageText:
      "The greenhouse contained dozens of orchid species ______ some no larger than a coin, others with blooms the size of a dinner plate.",
    stem: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: [":", "and", "so", "nor"],
    correctAnswer: "A",
    explanation:
      "A colon correctly introduces the elaborating description of the orchid species. The conjunctions create ungrammatical or illogical joins with the fragment that follows.",
  },
  {
    section: "RW",
    domain: "Standard English Conventions",
    skill: "Boundaries",
    difficulty: "medium",
    type: "MCQ",
    passageText:
      "The research vessel spent three weeks mapping the seafloor ______ afterward, the crew analyzed the data during the long voyage home.",
    stem: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: [";", ",", "and,", "which"],
    correctAnswer: "A",
    explanation:
      "Two independent clauses ('The research vessel spent…' and 'afterward, the crew analyzed…') require a semicolon (or period). A comma alone creates a splice; 'and,' and 'which' are ungrammatical here.",
  },
  {
    section: "RW",
    domain: "Standard English Conventions",
    skill: "Boundaries",
    difficulty: "hard",
    type: "MCQ",
    passageText:
      "The astronomer Vera Rubin, whose careful measurements of galaxy rotation provided key evidence for dark matter ______ was long overlooked for major prizes.",
    stem: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: [",", ";", ":", "—and"],
    correctAnswer: "A",
    explanation:
      "The clause 'whose careful measurements…dark matter' is a nonrestrictive modifier set off by commas; it needs a closing comma before the verb 'was.' The other marks break the sentence's structure.",
  },
  // ---- Standard English Conventions: Form, Structure, and Sense ----
  {
    section: "RW",
    domain: "Standard English Conventions",
    skill: "Form, Structure, and Sense",
    difficulty: "easy",
    type: "MCQ",
    passageText:
      "Each of the museum's three new wings ______ a different century of art, from medieval altarpieces to modern sculpture.",
    stem: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: ["showcases", "showcase", "showcasing", "have showcased"],
    correctAnswer: "A",
    explanation:
      "The subject is 'Each,' which is singular, so it takes the singular verb 'showcases.' 'Showcase' and 'have showcased' are plural; 'showcasing' is not a finite verb.",
  },
  {
    section: "RW",
    domain: "Standard English Conventions",
    skill: "Form, Structure, and Sense",
    difficulty: "medium",
    type: "MCQ",
    passageText:
      "By the time the volunteers finished planting the last row of saplings, the sun ______ below the ridge, and headlamps clicked on across the field.",
    stem: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: ["had dropped", "drops", "will drop", "is dropping"],
    correctAnswer: "A",
    explanation:
      "The action completed before another past action ('finished planting'), so the past perfect 'had dropped' is correct. The other tenses don't fit this sequence of past events.",
  },
  // ---- Expression of Ideas: Transitions ----
  {
    section: "RW",
    domain: "Expression of Ideas",
    skill: "Transitions",
    difficulty: "easy",
    type: "MCQ",
    passageText:
      "The recipe calls for fresh basil for the best flavor. ______ dried basil can be substituted if fresh is unavailable.",
    stem: "Which choice completes the text with the most logical transition?",
    choices: ["However,", "Therefore,", "Likewise,", "For instance,"],
    correctAnswer: "A",
    explanation:
      "The second sentence offers a fallback that contrasts with the ideal of fresh basil, so a contrast transition ('However') fits. The others signal cause, similarity, or example.",
  },
  {
    section: "RW",
    domain: "Expression of Ideas",
    skill: "Transitions",
    difficulty: "hard",
    type: "MCQ",
    passageText:
      "The bridge's original cables were made of iron, which corrodes readily in salt air. When engineers rebuilt the span, they chose galvanized steel instead. ______ the new cables are expected to resist the coastal climate for decades without major repair.",
    stem: "Which choice completes the text with the most logical transition?",
    choices: ["As a result,", "Nevertheless,", "In contrast,", "For example,"],
    correctAnswer: "A",
    explanation:
      "Choosing corrosion-resistant galvanized steel causes the expected decades of durability, so a cause-effect transition ('As a result') fits. The others signal contrast or exemplification.",
  },
  // ---- Expression of Ideas: Rhetorical Synthesis ----
  {
    section: "RW",
    domain: "Expression of Ideas",
    skill: "Rhetorical Synthesis",
    difficulty: "medium",
    type: "MCQ",
    passageText:
      "While researching a local wetland, a student took these notes:\n• The wetland covers 200 hectares.\n• It filters runoff before water reaches the bay.\n• It is home to 60 bird species.\n• A proposed road would pave 15 hectares of it.",
    stem: "The student wants to emphasize the wetland's ecological value. Which choice most effectively uses relevant information from the notes to accomplish this goal?",
    choices: [
      "The 200-hectare wetland filters runoff before it reaches the bay and provides habitat for 60 bird species.",
      "A proposed road would pave 15 of the wetland's 200 hectares.",
      "The wetland covers 200 hectares near the bay.",
      "Sixty bird species live somewhere near the proposed road.",
    ],
    correctAnswer: "A",
    explanation:
      "Emphasizing ecological value calls for the filtering function and the 60 bird species. Choice B foregrounds the road; C gives only size; D is vague and drops the ecological framing.",
  },
  {
    section: "RW",
    domain: "Expression of Ideas",
    skill: "Rhetorical Synthesis",
    difficulty: "hard",
    type: "MCQ",
    passageText:
      "A student compiled these notes for a report:\n• Composer Florence Price was the first Black woman to have a symphony performed by a major U.S. orchestra.\n• That performance took place in 1933.\n• Many of her scores were lost for decades.\n• In 2009, a trove of her manuscripts was found in an abandoned house.",
    stem: "The student wants to introduce Florence Price to an audience unfamiliar with her while stressing the recent revival of interest in her work. Which choice most effectively accomplishes this?",
    choices: [
      "Florence Price broke a barrier in 1933, but interest in the once-overlooked composer surged after a 2009 discovery of manuscripts long thought lost.",
      "In 1933, Florence Price became the first Black woman whose symphony was performed by a major U.S. orchestra.",
      "A trove of Florence Price's manuscripts was found in an abandoned house in 2009.",
      "Many of Florence Price's scores were lost for decades before some were recovered.",
    ],
    correctAnswer: "A",
    explanation:
      "The goal needs both an introduction (the 1933 barrier) and the recent revival (the 2009 discovery). Only A combines both. B, C, and D each supply just one half of the goal.",
  },
  // ---- Extra items to reach a full 27-question R&W module ----
  {
    section: "RW",
    domain: "Craft and Structure",
    skill: "Words in Context",
    difficulty: "medium",
    type: "MCQ",
    passageText:
      "Critics initially dismissed the architect's designs as mere novelty, but decades later his buildings are seen as ______, having anticipated forms that would dominate the next generation of construction.",
    stem: "Which choice completes the text with the most logical and precise word?",
    choices: ["prescient", "derivative", "hazardous", "temporary"],
    correctAnswer: "A",
    explanation:
      "Buildings that 'anticipated forms' of the future are forward-seeing — prescient. 'Derivative' means unoriginal; 'hazardous' and 'temporary' are unrelated to foresight.",
  },
  {
    section: "RW",
    domain: "Information and Ideas",
    skill: "Central Ideas and Details",
    difficulty: "hard",
    type: "MCQ",
    passageText:
      "Sourdough bread relies on wild yeast and bacteria that live in the starter. These microbes vary from kitchen to kitchen, shaped by local flour, water, and even the air. Bakers who move across the country often find that a starter they carried with them gradually shifts in flavor as it picks up new local microbes.",
    stem: "Which choice best states the main idea of the text?",
    choices: [
      "A sourdough starter's character is not fixed but adapts to the local environment where it is kept.",
      "Wild yeast is more important than bacteria in sourdough bread.",
      "Sourdough bread tastes the same regardless of where it is made.",
      "Moving frequently makes it impossible to bake good sourdough.",
    ],
    correctAnswer: "A",
    explanation:
      "The passage stresses that starters shift as they pick up local microbes—their character adapts to place. The other choices contradict the text or add unsupported claims.",
  },
  {
    section: "RW",
    domain: "Standard English Conventions",
    skill: "Form, Structure, and Sense",
    difficulty: "hard",
    type: "MCQ",
    passageText:
      "The findings, which surprised even the team that produced ______ suggested that the coral could recover far faster than models had predicted.",
    stem: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: ["them,", "it,", "them", "it"],
    correctAnswer: "A",
    explanation:
      "The pronoun refers to plural 'findings,' so 'them' is correct, and a comma must close the nonrestrictive clause before the main verb 'suggested.' Only 'them,' satisfies both.",
  },
  {
    section: "RW",
    domain: "Expression of Ideas",
    skill: "Transitions",
    difficulty: "medium",
    type: "MCQ",
    passageText:
      "The startup's first app was downloaded millions of times but generated almost no revenue. ______ the founders redesigned their business model to include a paid subscription tier.",
    stem: "Which choice completes the text with the most logical transition?",
    choices: ["Consequently,", "Similarly,", "Nonetheless,", "Meanwhile,"],
    correctAnswer: "A",
    explanation:
      "The lack of revenue caused the redesign, so a cause-effect transition ('Consequently') fits. 'Similarly' and 'Meanwhile' miss the causal link; 'Nonetheless' signals contrast.",
  },
  {
    section: "RW",
    domain: "Information and Ideas",
    skill: "Command of Evidence",
    difficulty: "medium",
    type: "MCQ",
    passageText:
      "A biologist proposes that a species of frog uses its bright coloration to warn predators that it is toxic. If the coloration truly functions as a warning, predators should avoid the brightly colored frogs.",
    stem: "Which finding, if true, would most strongly support the biologist's proposal?",
    choices: [
      "In trials, birds that had once tasted a brightly colored frog later avoided attacking frogs of the same color.",
      "The brightly colored frogs were slightly larger than dull-colored frogs.",
      "The frogs' coloration faded when they were kept in dim light.",
      "Predators attacked brightly colored and dull frogs at equal rates.",
    ],
    correctAnswer: "A",
    explanation:
      "Support requires predators avoiding the bright frogs after learning they are toxic—exactly choice A. Choice D would undercut the claim; B and C are irrelevant to the warning function.",
  },
];
