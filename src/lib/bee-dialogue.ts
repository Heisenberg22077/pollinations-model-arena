/** Authored local theater. IDs are append-only within a bank; no answer content enters here. */
export type BeeMood = "curious" | "excited" | "content" | "startled" | "sleepy";
export type BeeTrigger =
  | "arrival"
  | "idle"
  | "boop"
  | "boop-repeat"
  | "discover"
  | "approach"
  | "eat"
  | "feed-repeat"
  | "flower"
  | "run"
  | "waiting"
  | "response"
  | "fastest"
  | "cheap"
  | "compare"
  | "error"
  | "cancel"
  | "day"
  | "night"
  | "model"
  | "select"
  | "deselect"
  | "preset-core"
  | "preset-free"
  | "preset-all"
  | "surprise"
  | "starter"
  | "copy"
  | "export"
  | "story";
export interface BeeContext {
  name?: string;
  count?: number;
  family?: string;
}
interface Policy {
  priority: number;
  cooldown: number;
  ttl: number;
  rarity: number;
}
export interface BeeLine extends Policy {
  id: string;
  trigger: BeeTrigger;
  mood: BeeMood;
  text: string;
  requires?: "name" | "repeat";
  callback?: string;
  family?: string;
  source?: { url: string; credit: string; adapted: boolean };
}
const policies: Record<BeeTrigger, Policy> = {
  arrival: { priority: 0, cooldown: 90, ttl: 4, rarity: 1 },
  idle: { priority: 0, cooldown: 7, ttl: 1, rarity: 1 },
  boop: { priority: 2, cooldown: 3, ttl: 6, rarity: 1 },
  "boop-repeat": { priority: 2, cooldown: 5, ttl: 6, rarity: 1 },
  discover: { priority: 1, cooldown: 8, ttl: 2, rarity: 1 },
  approach: { priority: 1, cooldown: 12, ttl: 1, rarity: 0.3 },
  eat: { priority: 1, cooldown: 6, ttl: 6, rarity: 1 },
  "feed-repeat": { priority: 1, cooldown: 8, ttl: 6, rarity: 1 },
  flower: { priority: 0, cooldown: 25, ttl: 2, rarity: 0.4 },
  run: { priority: 2, cooldown: 4, ttl: 8, rarity: 1 },
  waiting: { priority: 0, cooldown: 30, ttl: 2, rarity: 0.25 },
  response: { priority: 1, cooldown: 12, ttl: 6, rarity: 1 },
  fastest: { priority: 2, cooldown: 10, ttl: 8, rarity: 1 },
  cheap: { priority: 1, cooldown: 12, ttl: 8, rarity: 1 },
  compare: { priority: 2, cooldown: 12, ttl: 6, rarity: 1 },
  error: { priority: 3, cooldown: 6, ttl: 8, rarity: 1 },
  cancel: { priority: 3, cooldown: 3, ttl: 8, rarity: 1 },
  day: { priority: 2, cooldown: 25, ttl: 6, rarity: 1 },
  night: { priority: 2, cooldown: 25, ttl: 6, rarity: 1 },
  select: { priority: 2, cooldown: 3, ttl: 6, rarity: 1 },
  deselect: { priority: 2, cooldown: 3, ttl: 6, rarity: 1 },
  "preset-core": { priority: 2, cooldown: 3, ttl: 6, rarity: 1 },
  "preset-free": { priority: 2, cooldown: 3, ttl: 6, rarity: 1 },
  "preset-all": { priority: 2, cooldown: 3, ttl: 6, rarity: 1 },
  surprise: { priority: 2, cooldown: 3, ttl: 6, rarity: 1 },
  starter: { priority: 2, cooldown: 3, ttl: 6, rarity: 1 },
  copy: { priority: 2, cooldown: 3, ttl: 6, rarity: 1 },
  export: { priority: 2, cooldown: 3, ttl: 6, rarity: 1 },
  model: { priority: 0, cooldown: 12, ttl: 1.4, rarity: 1 },
  story: { priority: 2, cooldown: 0, ttl: 0, rarity: 1 },
};
const bank = (
  trigger: BeeTrigger,
  mood: BeeMood,
  texts: readonly string[],
  extra: Partial<BeeLine> = {},
): BeeLine[] =>
  texts.map((text, index) => ({
    ...policies[trigger],
    id: `${trigger}.${index + 1}`,
    trigger,
    mood,
    text,
    ...extra,
  }));

export const BEE_LINES: readonly BeeLine[] = [
  ...bank("arrival", "curious", [
    "Hello. I was told this was a paid position.",
    "I live here. Legally? Don't ask.",
    "Tap the garden. I dispose of the evidence.",
  ]),
  ...bank("idle", "sleepy", [
    "My retirement plan is a windshield.",
    "Six legs. Still can't stand this job.",
    "I do my own stunts. The funeral is prepaid.",
    "Please don't read my browser history at the funeral.",
    "I'd quit, but I already live at work.",
  ]),
  ...bank("idle", "sleepy", ["Fired again. I'm self-employed."], {
    id: "idle.reddit-job",
    source: {
      url: "https://www.reddit.com/r/Jokes/comments/58wjnl/my_boss_told_me_to_have_a_good_day/",
      credit:
        "Adapted from u/african_dwarf_frog's post and u/Afterbirthsoup's comment (2016); original authorship unknown",
      adapted: true,
    },
  }),
  ...bank("boop", "startled", [
    "Ow. That's the employee of the month.",
    "That was load-bearing.",
    "Do I look like a doorbell?",
    "Beep. Wrong insect.",
    "Brain cell disconnected. Business as usual.",
  ]),
  ...bank(
    "boop-repeat",
    "excited",
    [
      "Same spot. The warranty is void.",
      "At this point it's a performance review.",
      "I've survived worse. Briefly.",
      "Again? Put me down as a business expense.",
    ],
    { requires: "repeat", callback: "boop" },
  ),
  ...bank("discover", "curious", [
    "Food? Cancel the funeral.",
    "Finally. Something with fewer opinions.",
    "This better not be an intervention.",
  ]),
  ...bank("approach", "excited", [
    "Please remain edible.",
    "Zero brakes. Six legs. Bad ratio.",
    "Incoming. Tell my accountant.",
  ]),
  ...bank(
    "eat",
    "content",
    [
      "Ate the evidence.",
      "That fruit passed peer review.",
      "Calories: none of my business.",
      "If anyone asks, that was here when I arrived.",
      "No crumbs. No witnesses.",
    ],
    { callback: "discover" },
  ),
  ...bank(
    "feed-repeat",
    "content",
    [
      "Insurance won't cover this habit.",
      "My will now just says 'more of that'.",
      "Same snack. Still no background check.",
      "We're calling this research for tax reasons.",
    ],
    { requires: "repeat", callback: "eat" },
  ),
  ...bank("flower", "content", [
    "This is my safe house.",
    "Perched. Not dead. Yet.",
    "Do not water the employee.",
  ]),
  ...bank("run", "excited", [
    "Release the interns.",
    "I have no idea what I'm supervising.",
    "Everybody act like this was the plan.",
    "Same question. Different suspects.",
    "Opinions incoming. Helmets optional.",
    "I outsourced the thinking. Kept the snacks.",
  ]),
  ...bank("waiting", "sleepy", [
    "If I die waiting, delete my search history.",
    "Still waiting. My skeleton has tenure.",
    "This loading screen outlives my attention span.",
  ]),
  ...bank("response", "curious", [
    "An answer landed. Nobody saw me read it.",
    "Another reply. There goes the lunch break.",
    "Paperwork arrived. I deny everything.",
    "Reply's here. My qualifications are still missing.",
  ]),
  ...bank(
    "fastest",
    "excited",
    [
      "{name}: fastest. No points for parking.",
      "{name} arrived first. My alibi didn't.",
      "Fastest: {name}. The speed camera approves.",
      "{name}: speed badge. Can't outrun paperwork.",
    ],
    { requires: "name" },
  ),
  ...bank(
    "cheap",
    "content",
    [
      "{name}: lowest cost. My accountant lives.",
      "Lowest cost: {name}. Crumbs saved.",
      "{name}: cost badge. The wallet has a pulse.",
      "Cost badge: {name}. Bankruptcy postponed.",
    ],
    { requires: "name" },
  ),
  ...bank("compare", "curious", [
    "Side by side. Cross-examining the suspects.",
    "I don't pick sides. I pick pockets.",
    "More columns. Fewer alibis.",
    "Same question. Everyone has a lawyer.",
  ]),
  ...bank("error", "startled", [
    "Reply hit a snag. I blame my imaginary intern.",
    "One reply failed. The error card has details.",
    "An error. My wrench is decorative.",
    "A reply couldn't land. See its error card.",
  ]),
  ...bank("cancel", "content", [
    "Stopped. The interns have escaped.",
    "Run stopped. Nobody tell the shareholders.",
    "Stopped. I'm calling this paid leave.",
  ]),
  ...bank("day", "content", [
    "Day mode. There goes my alibi.",
    "Day mode. All my crimes are visible.",
    "Sun's out. Witness protection failed.",
  ]),
  ...bank("night", "content", [
    "Night mode. My alibi gets better.",
    "Night mode. Finally, plausible deniability.",
    "Night mode. Now the snacks can't see me coming.",
  ]),
  ...bank(
    "model",
    "curious",
    [
      "{name}. Another suspect.",
      "{name}? Please sign the snack waiver.",
      "{name}. Welcome to the paperwork.",
      "{name}? I hope you brought an alibi.",
    ],
    { requires: "name" },
  ),
  ...bank(
    "select",
    "curious",
    ["Added {name}. Another mouth to feed.", "{name} is in. There goes the lunch budget."],
    { requires: "name" },
  ),
  ...bank(
    "deselect",
    "content",
    ["Removed {name}. Witness protection.", "{name} is out. The chair gets its job back."],
    { requires: "name" },
  ),
  ...bank("preset-core", "curious", [
    "Core lineup. Fewer mouths, same arguments.",
    "Core six. A jury with no lunch budget.",
  ]),
  ...bank("preset-free", "content", [
    "Standard models. No velvet rope.",
    "Standard lineup. The VIP rope was a shoelace.",
  ]),
  ...bank("preset-all", "excited", [
    "All models. This is how committees happen.",
    "Everyone's in. I've lost control of the meeting.",
  ]),
  ...bank("surprise", "startled", [
    "Surprise question. My lawyer said 'no comment'.",
    "New question. I'm updating my alibi.",
  ]),
  ...bank(
    "starter",
    "curious",
    ["{name} question. No pressure. Just witnesses.", "{name}. Opening a fresh can of opinions."],
    { requires: "name" },
  ),
  ...bank("copy", "content", [
    "Copied. Identity theft for answers.",
    "Copied. The original has asked for a lawyer.",
  ]),
  ...bank("export", "content", [
    "Markdown packed. Take the evidence with you.",
    "Exported. This meeting could've been a file.",
  ]),
  ...bank("model", "curious", ["Gemini. Twice the witnesses. Great."], {
    id: "family.gemini",
    requires: "name",
    family: "gemini",
  }),
  ...bank("model", "curious", ["Grok. Please don't give the bee a microphone."], {
    id: "family.grok",
    requires: "name",
    family: "grok",
  }),
  ...bank("model", "curious", ["DeepSeek. Keep digging. My alibi's down there."], {
    id: "family.deepseek",
    requires: "name",
    family: "deepseek",
  }),
  ...bank("model", "curious", ["Qwen. At last, someone else without pockets."], {
    id: "family.qwen",
    requires: "name",
    family: "qwen",
  }),
  ...bank("model", "curious", ["GPT. I also predict words. Usually 'food'."], {
    id: "family.gpt",
    requires: "name",
    family: "gpt",
  }),
  ...bank("model", "curious", ["Claude. Please redact my browser history."], {
    id: "family.claude",
    requires: "name",
    family: "claude",
  }),
  ...bank("model", "curious", ["Llama. Two Ls. Finally, my academic record."], {
    id: "family.llama",
    requires: "name",
    family: "llama",
  }),
  ...bank("model", "curious", ["Mistral. One gust and I'm a missing-person poster."], {
    id: "family.mistral",
    requires: "name",
    family: "mistral",
  }),
  ...bank("model", "curious", ["GLM. Good Luck, Me. That is my entire plan."], {
    id: "family.glm",
    requires: "name",
    family: "glm",
  }),
  ...bank("model", "curious", ["MiniMax. Tiny body, maximum legal fees."], {
    id: "family.minimax",
    requires: "name",
    family: "minimax",
  }),
  ...bank("model", "curious", ["Nemotron. GPU budget. Mine's a bread crumb."], {
    id: "family.nemotron",
    requires: "name",
    family: "nemotron",
  }),
  ...bank("model", "curious", ["FLUX. Draw me like one of your tax deductions."], {
    id: "family.flux",
    requires: "name",
    family: "flux",
  }),
  ...bank("story", "curious", ["I have the heart of a lion."], {
    id: "story.1",
    source: {
      url: "https://www.reddit.com/r/Jokes/comments/ducfaf/i_have_the_heart_of_a_lion/",
      credit: "Adapted from a joke posted by u/dumb-reply (2019); original authorship unknown",
      adapted: true,
    },
  }),
  ...bank("story", "curious", ["And a lifetime zoo ban."], {
    id: "story.2",
    source: {
      url: "https://www.reddit.com/r/Jokes/comments/ducfaf/i_have_the_heart_of_a_lion/",
      credit: "Adapted from a joke posted by u/dumb-reply (2019); original authorship unknown",
      adapted: true,
    },
  }),
  ...bank("story", "curious", ["The lion has requested a refund."], {
    id: "story.3",
    source: {
      url: "https://www.reddit.com/r/Jokes/comments/ducfaf/i_have_the_heart_of_a_lion/",
      credit: "Adapted from a joke posted by u/dumb-reply (2019); original authorship unknown",
      adapted: true,
    },
  }),
  ...bank("story", "curious", ["Bought shoes from a drug dealer."], {
    id: "story.4",
    source: {
      url: "https://www.reddit.com/r/Jokes/comments/27ztug/i_bought_shoes_from_a_drug_dealer_i_dont_know/",
      credit:
        "Adapted from a joke posted by u/motherfuckersantana (2014); original authorship unknown",
      adapted: true,
    },
  }),
  ...bank("story", "curious", ["No idea what he laced them with."], {
    id: "story.5",
    source: {
      url: "https://www.reddit.com/r/Jokes/comments/27ztug/i_bought_shoes_from_a_drug_dealer_i_dont_know/",
      credit:
        "Adapted from a joke posted by u/motherfuckersantana (2014); original authorship unknown",
      adapted: true,
    },
  }),
  ...bank("story", "curious", ["Been tripping all day."], {
    id: "story.6",
    source: {
      url: "https://www.reddit.com/r/Jokes/comments/27ztug/i_bought_shoes_from_a_drug_dealer_i_dont_know/",
      credit:
        "Adapted from a joke posted by u/motherfuckersantana (2014); original authorship unknown",
      adapted: true,
    },
  }),
  ...bank("story", "curious", ["My boss said: have a good day."], {
    id: "story.7",
    source: {
      url: "https://www.reddit.com/r/Jokes/comments/58wjnl/my_boss_told_me_to_have_a_good_day/",
      credit:
        "Adapted from u/african_dwarf_frog's post and u/Afterbirthsoup's comment (2016); original authorship unknown",
      adapted: true,
    },
  }),
  ...bank("story", "curious", ["So I went home."], {
    id: "story.8",
    source: {
      url: "https://www.reddit.com/r/Jokes/comments/58wjnl/my_boss_told_me_to_have_a_good_day/",
      credit:
        "Adapted from u/african_dwarf_frog's post and u/Afterbirthsoup's comment (2016); original authorship unknown",
      adapted: true,
    },
  }),
  ...bank("story", "curious", ["Fired again. I'm self-employed."], {
    id: "story.9",
    source: {
      url: "https://www.reddit.com/r/Jokes/comments/58wjnl/my_boss_told_me_to_have_a_good_day/",
      credit:
        "Adapted from u/african_dwarf_frog's post and u/Afterbirthsoup's comment (2016); original authorship unknown",
      adapted: true,
    },
  }),
  ...bank("story", "curious", ["Asked to be cremated when I go."], {
    id: "story.10",
    source: {
      url: "https://www.reddit.com/r/Jokes/comments/13secaq/i_told_my_wife_i_wanted_to_be_creamated/",
      credit: "Adapted from a joke posted by u/Response-Cheap (2023); original authorship unknown",
      adapted: true,
    },
  }),
  ...bank("story", "curious", ["They booked me in for Tuesday."], {
    id: "story.11",
    source: {
      url: "https://www.reddit.com/r/Jokes/comments/13secaq/i_told_my_wife_i_wanted_to_be_creamated/",
      credit: "Adapted from a joke posted by u/Response-Cheap (2023); original authorship unknown",
      adapted: true,
    },
  }),
  ...bank("story", "curious", ["I said WHEN."], {
    id: "story.12",
    source: {
      url: "https://www.reddit.com/r/Jokes/comments/13secaq/i_told_my_wife_i_wanted_to_be_creamated/",
      credit: "Adapted from a joke posted by u/Response-Cheap (2023); original authorship unknown",
      adapted: true,
    },
  }),
];

export const beeReadTime = (text: string) =>
  Math.min(6, Math.max(3, 0.8 + text.split(/\s+/).length * 0.32 + text.length * 0.025));
export function beeFamily(name: string): string | undefined {
  const match = name
    .toLowerCase()
    .match(
      /^(?:[\w-]+\/)?(gemini|grok|deepseek|qwen|gpt|claude|llama|mistral|glm|minimax|nemotron|flux)(?=\b|\d|[-.])/,
    );
  return match?.[1];
}
interface Request {
  trigger: BeeTrigger;
  context: BeeContext;
  at: number;
  ready: number;
  explicit: boolean;
  key: string;
}
export interface BeeSpeech {
  line: BeeLine;
  text: string;
  at: number;
  until: number;
  explicit: boolean;
}

/** Seconds on the shared app clock. Four pending events, eight recent IDs, fixed-size trigger history. */
export function createBeeDialogue(touch: boolean, random: () => number = Math.random) {
  let queue: Request[] = [];
  const recent: string[] = [];
  const lastByTrigger = new Map<BeeTrigger, number>();
  let current: BeeSpeech | undefined;
  let lastAt = -100;
  const purge = (now: number) => {
    queue = queue.filter((r) => now - r.at <= policies[r.trigger].ttl);
  };
  return {
    request(
      trigger: BeeTrigger,
      context: BeeContext,
      now: number,
      explicit = false,
      key: string = trigger,
      delay = 0.22,
    ) {
      purge(now);
      if (trigger === "story") return;
      const policy = policies[trigger];
      // A deliberate badge inspection may follow an automatic award. It still
      // obeys global reading holds/floors, but does not spend that award's ambient cooldown.
      if (
        !explicit &&
        key !== "hover" &&
        now - (lastByTrigger.get(trigger) ?? -100) < policy.cooldown
      )
        return;
      if (!explicit && random() > policy.rarity) return;
      if (
        ["fastest", "cheap", "model", "select", "deselect", "starter"].includes(trigger) &&
        !context.name
      )
        return;
      const request = {
        trigger,
        context: { ...context, name: context.name?.slice(0, 28) },
        at: now,
        ready: now + delay,
        explicit,
        key,
      };
      const previous = queue.findIndex((r) => r.key === key);
      if (previous >= 0) {
        // Coalesce bursts without indefinitely postponing the first event's expiry or setup.
        const first = queue[previous];
        queue[previous] =
          key === "action" ? request : { ...request, at: first.at, ready: first.ready };
      } else queue.push(request);
      queue.sort(
        (a, b) =>
          policies[b.trigger].priority - policies[a.trigger].priority ||
          Number(b.explicit) - Number(a.explicit) ||
          a.at - b.at,
      );
      queue = queue.slice(0, 4);
    },
    tick(now: number, canSpeak = true): BeeSpeech | undefined {
      purge(now);
      if (current && now >= current.until) current = undefined;
      if (!canSpeak) return undefined;
      const request = queue.find((r) => r.ready <= now);
      if (!request) return undefined;
      const policy = policies[request.trigger];
      const urgent = policy.priority === 3;
      const overtakesAmbient = request.explicit && policy.priority > (current?.line.priority ?? 0);
      if (
        current &&
        ((!urgent && !overtakesAmbient) ||
          current.line.priority === 3 ||
          now - current.at < (touch ? 2.5 : 1.4))
      )
        return undefined;
      if (now - lastAt < (urgent ? (touch ? 2.5 : 1.4) : touch ? 4.5 : 2.8)) return undefined;
      const eligible = BEE_LINES.filter(
        (line) =>
          line.trigger === request.trigger &&
          (!line.family || line.family === request.context.family) &&
          (line.requires !== "repeat" || (request.context.count ?? 0) >= 2),
      );
      const fresh = eligible.filter((line) => !recent.includes(line.id));
      const choices = fresh.length ? fresh : eligible.filter((line) => line.id !== recent.at(-1));
      const line = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
      queue = queue.filter((r) => r !== request);
      if (!line) return undefined;
      lastAt = now;
      lastByTrigger.set(request.trigger, now);
      recent.push(line.id);
      if (recent.length > 8) recent.shift();
      const text = line.text.replaceAll("{name}", request.context.name ?? "This model");
      current = { line, text, at: now, until: now + beeReadTime(text), explicit: request.explicit };
      return current;
    },
    clear(key?: string) {
      if (key) queue = queue.filter((r) => r.key !== key);
      else {
        queue = [];
        current = undefined;
      }
    },
    clearPending() {
      queue = [];
    },
    reset() {
      queue = [];
      recent.length = 0;
      lastByTrigger.clear();
      current = undefined;
      lastAt = -100;
    },
    get current() {
      return current;
    },
    get diagnostics() {
      return { queued: queue.length, recent: recent.length, triggers: lastByTrigger.size };
    },
  };
}
