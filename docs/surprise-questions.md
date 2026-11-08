# Surprise question research

Researched on 2026-11-08, then written specifically for Model Table. The 36 prompts in [surpriseQuestions.ts](../src/data/surpriseQuestions.ts) use everyday objects, odd jobs, alien misunderstandings and small absurd scenarios to invite different model voices.

## Sources

- [The AI Prompt Shop: funny questions for ChatGPT](https://theaipromptshop.com/blogs/news/50-funny-questions-to-ask-chatgpt) informed the combination of a familiar situation, an unreasonable detail and a concrete response format.
- [TeamRetro: funny icebreaker questions](https://www.teamretro.com/icebreakers/funny-icebreaker-questions/) informed the light, work-safe tone.
- [xkcd What If?](https://what-if.xkcd.com/) informed treating an absurd premise seriously and following its consequences.

These are conceptual references. The app's question bank uses newly written prompts rather than copying the source lists.

## Behavior

Surprise me shuffles the local bank and draws without repeating until it is exhausted. It avoids the current question when starting another cycle. Every prompt fits the 280-character composer limit. Drawing a question makes no API request; Run sends it to the selected models.
