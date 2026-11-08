// Static game data: species, plants, hardscape, places, shop, milestones.
// Body shape fields: len = body length factor, h = body height / length,
// tail fan|fork|round|veil|lyre|none, dorsal none|low|tall|sail,
// pattern solid|stripeV|stripeH|spots|gradient|band|calico|wedge.
// behaviour school|mid|bottom|surface|solo|cleaner. temp = comfortable range in C.
// bio = waste load per adult. rar 1 common .. 5 legendary.

export const RARITY = ["", "common", "uncommon", "rare", "epic", "legendary"];
export const RARITY_WEIGHT = [0, 60, 26, 10, 3.4, 0.9];

export const SPOTS = [
  { id: "pond", water: "fresh", level: 1, sky: "#cfe3e8", far: "#9fbf9a", near: "#6e9a62", water1: "#5f9c8f", water2: "#2f6f66", weather: { sun: 4, cloud: 3, rain: 2, fog: 1 } },
  { id: "sawah", water: "fresh", level: 1, sky: "#d9e6dc", far: "#a9c47e", near: "#7ea64c", water1: "#86a97a", water2: "#4f7a52", weather: { sun: 4, cloud: 3, rain: 3, fog: 1 } },
  { id: "stream", water: "fresh", level: 2, sky: "#d4e2ea", far: "#7f9b8a", near: "#55745f", water1: "#6fb3b8", water2: "#2d6f7a", weather: { sun: 3, cloud: 3, rain: 2, fog: 2 } },
  { id: "mangrove", water: "brackish", level: 3, sky: "#dfe6d8", far: "#6d8c5a", near: "#3f5f3a", water1: "#7f9c7a", water2: "#3f5d4a", weather: { sun: 3, cloud: 3, rain: 4, fog: 1 } },
  { id: "blackwater", water: "fresh", level: 4, sky: "#d8dccf", far: "#5d7350", near: "#3b4d35", water1: "#8a6a3f", water2: "#3d2c1a", weather: { sun: 2, cloud: 3, rain: 4, fog: 2 } },
  { id: "lagoon", water: "salt", level: 4, sky: "#cfe9ef", far: "#e9dcb8", near: "#d9c48f", water1: "#4fc0c4", water2: "#1b7f94", weather: { sun: 6, cloud: 2, rain: 1, fog: 0 } },
  { id: "glacier", water: "fresh", level: 5, sky: "#e3ebef", far: "#b9c9d3", near: "#8ea3ae", water1: "#7fb6c9", water2: "#2f6a84", weather: { sun: 2, cloud: 3, rain: 0, fog: 2, snow: 3 } },
  { id: "ocean", water: "salt", level: 6, sky: "#d3e4ee", far: "#9cb8c8", near: "#5f86a0", water1: "#2f7fa8", water2: "#0f3f63", weather: { sun: 3, cloud: 3, rain: 2, fog: 1 } },
  { id: "harbor", water: "salt", level: 7, sky: "#c9d3d8", far: "#7c8b93", near: "#4e5b62", water1: "#3f6f7f", water2: "#152f3c", weather: { sun: 2, cloud: 3, rain: 2, fog: 3 } },
];

export const FISH = [
  // Freshwater
  { id: "guppy", sci: "Poecilia reticulata", water: "fresh", rar: 1, spots: ["pond", "sawah"], size: [3, 6], len: 1, h: 0.32, tail: "fan", dorsal: "low", pattern: "gradient", colors: ["#f0a04b", "#2fa7a0", "#e36b3c"], beh: "mid", temp: [22, 28], bio: 0.1, school: 0, price: 6, time: "any", weather: "any" },
  { id: "neon", sci: "Paracheirodon innesi", water: "fresh", rar: 1, spots: ["blackwater"], size: [2.5, 4], len: 0.9, h: 0.27, tail: "fork", dorsal: "low", pattern: "stripeH", colors: ["#c9d6d3", "#2bb3d6", "#d8473a"], beh: "school", temp: [21, 27], bio: 0.08, school: 6, price: 5, time: "any", weather: "any" },
  { id: "cardinal", sci: "Paracheirodon axelrodi", water: "fresh", rar: 2, spots: ["blackwater"], size: [3, 5], len: 0.95, h: 0.27, tail: "fork", dorsal: "low", pattern: "stripeH", colors: ["#d8473a", "#29b7d9", "#d8473a"], beh: "school", temp: [23, 29], bio: 0.08, school: 6, price: 12, time: "any", weather: "rain" },
  { id: "ember", sci: "Hyphessobrycon amandae", water: "fresh", rar: 1, spots: ["blackwater"], size: [1.8, 2.8], len: 0.8, h: 0.3, tail: "fork", dorsal: "low", pattern: "solid", colors: ["#ef7a35", "#f2a65a", "#e8622c"], beh: "school", temp: [23, 29], bio: 0.06, school: 6, price: 5, time: "day", weather: "any" },
  { id: "cherrybarb", sci: "Puntius titteya", water: "fresh", rar: 1, spots: ["stream"], size: [3.5, 5], len: 1, h: 0.36, tail: "fork", dorsal: "low", pattern: "stripeH", colors: ["#d8503f", "#7a2b22", "#d8503f"], beh: "mid", temp: [23, 27], bio: 0.12, school: 4, price: 6, time: "day", weather: "any" },
  { id: "harlequin", sci: "Trigonostigma heteromorpha", water: "fresh", rar: 1, spots: ["blackwater"], size: [3.5, 5], len: 1, h: 0.36, tail: "fork", dorsal: "low", pattern: "wedge", colors: ["#e8925a", "#1f2a2a", "#e07b48"], beh: "school", temp: [22, 28], bio: 0.1, school: 6, price: 6, time: "any", weather: "any" },
  { id: "chili", sci: "Boraras brigittae", water: "fresh", rar: 2, spots: ["blackwater"], size: [1.5, 2.2], len: 0.75, h: 0.28, tail: "fork", dorsal: "low", pattern: "stripeH", colors: ["#e8473a", "#2a1c1a", "#e8473a"], beh: "school", temp: [24, 30], bio: 0.04, school: 8, price: 10, time: "day", weather: "rain" },
  { id: "cory", sci: "Corydoras aeneus", water: "fresh", rar: 1, spots: ["pond", "stream"], size: [5, 7], len: 1, h: 0.42, tail: "fork", dorsal: "tall", pattern: "gradient", colors: ["#a8875a", "#3e7d6a", "#c9b08a"], beh: "bottom", temp: [22, 27], bio: 0.15, school: 3, price: 8, time: "any", weather: "any" },
  { id: "pandacory", sci: "Corydoras panda", water: "fresh", rar: 2, spots: ["stream"], size: [4, 5.5], len: 0.95, h: 0.42, tail: "fork", dorsal: "tall", pattern: "band", colors: ["#efe8dc", "#1d1d1d", "#efe8dc"], beh: "bottom", temp: [20, 25], bio: 0.13, school: 3, price: 14, time: "day", weather: "cloud" },
  { id: "oto", sci: "Otocinclus vittatus", water: "fresh", rar: 2, spots: ["stream"], size: [3, 4.5], len: 0.9, h: 0.26, tail: "fork", dorsal: "low", pattern: "stripeH", colors: ["#b8aa86", "#3b3a2e", "#b8aa86"], beh: "cleaner", temp: [21, 27], bio: 0.06, school: 3, price: 12, time: "any", weather: "any", cleaner: 1 },
  { id: "kuhli", sci: "Pangio kuhlii", water: "fresh", rar: 2, spots: ["blackwater"], size: [7, 10], len: 1.6, h: 0.14, tail: "round", dorsal: "none", pattern: "stripeV", colors: ["#e3a24a", "#2b231c", "#e3a24a"], beh: "bottom", temp: [24, 30], bio: 0.1, school: 3, price: 12, time: "night", weather: "any" },
  { id: "betta", sci: "Betta splendens", water: "fresh", rar: 2, spots: ["sawah"], size: [5, 7], len: 1, h: 0.33, tail: "veil", dorsal: "sail", pattern: "gradient", colors: ["#c8323a", "#1f5fa8", "#c8323a"], beh: "solo", temp: [24, 30], bio: 0.15, school: 0, price: 18, time: "any", weather: "sun" },
  { id: "channoides", sci: "Betta channoides", water: "fresh", rar: 4, spots: ["blackwater"], size: [4, 5.5], len: 1, h: 0.3, tail: "round", dorsal: "low", pattern: "gradient", colors: ["#c9482b", "#efe6d8", "#1d1a18"], beh: "solo", temp: [24, 29], bio: 0.12, school: 0, price: 70, time: "dusk", weather: "rain" },
  { id: "dwarfgourami", sci: "Trichogaster lalius", water: "fresh", rar: 1, spots: ["sawah"], size: [5, 8], len: 1, h: 0.5, tail: "round", dorsal: "tall", pattern: "stripeV", colors: ["#e2553d", "#3a8fb0", "#e2553d"], beh: "surface", temp: [24, 28], bio: 0.2, school: 0, price: 10, time: "day", weather: "any" },
  { id: "pearlgourami", sci: "Trichopodus leerii", water: "fresh", rar: 2, spots: ["blackwater"], size: [9, 12], len: 1.1, h: 0.45, tail: "fork", dorsal: "tall", pattern: "spots", colors: ["#c9b9a0", "#f2efe6", "#d9733f"], beh: "surface", temp: [24, 28], bio: 0.3, school: 0, price: 20, time: "any", weather: "cloud" },
  { id: "honeygourami", sci: "Trichogaster chuna", water: "fresh", rar: 1, spots: ["sawah"], size: [4, 5.5], len: 0.95, h: 0.45, tail: "round", dorsal: "tall", pattern: "solid", colors: ["#f0a63a", "#d9781f", "#f0a63a"], beh: "surface", temp: [22, 28], bio: 0.12, school: 0, price: 8, time: "day", weather: "sun" },
  { id: "medaka", sci: "Oryzias latipes", water: "fresh", rar: 1, spots: ["sawah", "pond"], size: [3, 4], len: 1, h: 0.25, tail: "round", dorsal: "low", pattern: "solid", colors: ["#f0c870", "#e8b250", "#f6dfa0"], beh: "surface", temp: [18, 28], bio: 0.08, school: 4, price: 5, time: "day", weather: "any" },
  { id: "whitecloud", sci: "Tanichthys albonubes", water: "fresh", rar: 1, spots: ["stream"], size: [3, 4], len: 1, h: 0.26, tail: "fork", dorsal: "low", pattern: "stripeH", colors: ["#a9a38a", "#d9473a", "#d9473a"], beh: "school", temp: [16, 24], bio: 0.08, school: 5, price: 5, time: "any", weather: "fog" },
  { id: "zebra", sci: "Danio rerio", water: "fresh", rar: 1, spots: ["stream"], size: [4, 5], len: 1.05, h: 0.26, tail: "fork", dorsal: "low", pattern: "stripeH", colors: ["#e9dfc4", "#2f5f9a", "#e9dfc4"], beh: "school", temp: [18, 26], bio: 0.1, school: 5, price: 5, time: "day", weather: "sun" },
  { id: "cpd", sci: "Danio margaritatus", water: "fresh", rar: 3, spots: ["stream"], size: [1.8, 2.5], len: 0.8, h: 0.3, tail: "fork", dorsal: "low", pattern: "spots", colors: ["#3d6b74", "#f1dfb0", "#e2603a"], beh: "school", temp: [20, 26], bio: 0.04, school: 6, price: 26, time: "dawn", weather: "fog" },
  { id: "rainbow", sci: "Marosatherina ladigesi", water: "fresh", rar: 3, spots: ["stream"], size: [5, 7], len: 1.1, h: 0.3, tail: "fork", dorsal: "tall", pattern: "gradient", colors: ["#e8d48a", "#3fa7c7", "#f0d040"], beh: "school", temp: [22, 28], bio: 0.15, school: 5, price: 30, time: "day", weather: "sun" },
  { id: "angel", sci: "Pterophyllum scalare", water: "fresh", rar: 3, spots: ["blackwater"], size: [10, 15], len: 1, h: 0.9, tail: "lyre", dorsal: "sail", pattern: "stripeV", colors: ["#e7e2d4", "#2c2a26", "#e7e2d4"], beh: "mid", temp: [24, 30], bio: 0.45, school: 0, price: 40, time: "any", weather: "any" },
  { id: "discus", sci: "Symphysodon aequifasciatus", water: "fresh", rar: 4, spots: ["blackwater"], size: [12, 18], len: 1, h: 0.95, tail: "round", dorsal: "low", pattern: "stripeV", colors: ["#d9733f", "#2d8a9a", "#d9733f"], beh: "mid", temp: [27, 31], bio: 0.6, school: 0, price: 120, time: "day", weather: "cloud" },
  { id: "goldfish", sci: "Carassius auratus", water: "fresh", rar: 1, spots: ["pond"], size: [8, 14], len: 1, h: 0.5, tail: "veil", dorsal: "tall", pattern: "solid", colors: ["#ef8a2f", "#f4b24a", "#ef8a2f"], beh: "mid", temp: [16, 24], bio: 0.5, school: 0, price: 8, time: "any", weather: "any" },
  { id: "koi", sci: "Cyprinus rubrofuscus", water: "fresh", rar: 3, spots: ["pond"], size: [20, 40], len: 1.25, h: 0.32, tail: "fork", dorsal: "low", pattern: "calico", colors: ["#f2ece0", "#d9452f", "#f2ece0"], beh: "mid", temp: [15, 25], bio: 0.8, school: 0, price: 60, time: "dawn", weather: "rain" },
  { id: "char", sci: "Salvelinus alpinus", water: "fresh", rar: 2, spots: ["glacier"], size: [25, 45], len: 1.25, h: 0.28, tail: "fork", dorsal: "low", pattern: "spots", colors: ["#5d7883", "#e4683d", "#e4683d"], beh: "mid", temp: [4, 14], bio: 0.8, school: 0, price: 34, time: "any", weather: "snow" },
  { id: "brooktrout", sci: "Salvelinus fontinalis", water: "fresh", rar: 2, spots: ["glacier", "stream"], size: [20, 35], len: 1.2, h: 0.28, tail: "fork", dorsal: "low", pattern: "spots", colors: ["#56705a", "#e9c86a", "#d9563a"], beh: "mid", temp: [6, 16], bio: 0.8, school: 0, price: 30, time: "dawn", weather: "cloud" },
  { id: "grayling", sci: "Thymallus arcticus", water: "fresh", rar: 3, spots: ["glacier"], size: [25, 40], len: 1.2, h: 0.27, tail: "fork", dorsal: "sail", pattern: "spots", colors: ["#7d8a8f", "#2f8f9a", "#c96a4a"], beh: "mid", temp: [4, 14], bio: 0.8, school: 0, price: 50, time: "dusk", weather: "fog" },
  { id: "arowana", sci: "Scleropages formosus", water: "fresh", rar: 5, spots: ["blackwater"], size: [45, 80], len: 1.5, h: 0.25, tail: "round", dorsal: "low", pattern: "gradient", colors: ["#c8423a", "#e8c86a", "#c8423a"], beh: "surface", temp: [24, 30], bio: 1.4, school: 0, price: 400, time: "dawn", weather: "rain" },
  { id: "archer", sci: "Toxotes jaculatrix", water: "brackish", rar: 2, spots: ["mangrove"], size: [12, 20], len: 1.05, h: 0.45, tail: "round", dorsal: "low", pattern: "band", colors: ["#d9d6c2", "#1f2422", "#e0d080"], beh: "surface", temp: [24, 30], bio: 0.5, school: 0, price: 24, time: "day", weather: "sun" },
  { id: "bumblebee", sci: "Brachygobius doriae", water: "brackish", rar: 1, spots: ["mangrove"], size: [2.5, 3.5], len: 0.9, h: 0.3, tail: "round", dorsal: "low", pattern: "band", colors: ["#f0c43a", "#1f1d18", "#f0c43a"], beh: "bottom", temp: [24, 30], bio: 0.06, school: 0, price: 8, time: "any", weather: "any" },
  { id: "mono", sci: "Monodactylus argenteus", water: "brackish", rar: 2, spots: ["mangrove"], size: [10, 18], len: 0.95, h: 0.8, tail: "fork", dorsal: "tall", pattern: "band", colors: ["#d9dedf", "#e8c43a", "#e8c43a"], beh: "school", temp: [24, 28], bio: 0.4, school: 3, price: 22, time: "any", weather: "cloud" },
  { id: "puffer", sci: "Dichotomyctere ocellatus", water: "brackish", rar: 3, spots: ["mangrove"], size: [6, 9], len: 0.9, h: 0.55, tail: "round", dorsal: "low", pattern: "spots", colors: ["#e3d58a", "#3a4a3a", "#e3d58a"], beh: "solo", temp: [24, 28], bio: 0.3, school: 0, price: 44, time: "night", weather: "rain" },
  { id: "shrimp", sci: "Neocaridina davidi", water: "fresh", rar: 1, spots: ["pond", "sawah"], size: [2, 3], body: "shrimp", len: 0.8, h: 0.3, tail: "fan", dorsal: "none", pattern: "solid", colors: ["#d8392f", "#f07a5a", "#d8392f"], beh: "cleaner", temp: [18, 28], bio: 0.02, school: 0, price: 4, time: "any", weather: "any", cleaner: 1 },
  { id: "nerite", sci: "Vittina natalensis", water: "brackish", rar: 1, spots: ["mangrove"], size: [2, 3], body: "snail", len: 0.7, h: 0.6, tail: "none", dorsal: "none", pattern: "stripeV", colors: ["#c9a24a", "#2b2418", "#8a7a5a"], beh: "cleaner", temp: [20, 28], bio: 0.03, school: 0, price: 5, time: "any", weather: "any", cleaner: 2 },
  // Saltwater
  { id: "clown", sci: "Amphiprion ocellaris", water: "salt", rar: 1, spots: ["lagoon"], size: [6, 9], len: 1, h: 0.42, tail: "round", dorsal: "low", pattern: "band", colors: ["#ef7a2f", "#f7f3ea", "#ef7a2f"], beh: "mid", temp: [24, 28], bio: 0.25, school: 0, price: 14, time: "any", weather: "any" },
  { id: "anthias", sci: "Pseudanthias squamipinnis", water: "salt", rar: 1, spots: ["lagoon"], size: [7, 12], len: 1, h: 0.38, tail: "lyre", dorsal: "low", pattern: "gradient", colors: ["#f08a3a", "#f4c24a", "#f08a3a"], beh: "school", temp: [23, 28], bio: 0.25, school: 5, price: 12, time: "day", weather: "sun" },
  { id: "damsel", sci: "Chrysiptera parasema", water: "salt", rar: 1, spots: ["lagoon"], size: [5, 7], len: 0.95, h: 0.42, tail: "fork", dorsal: "low", pattern: "gradient", colors: ["#2f7fd0", "#f2c43a", "#f2c43a"], beh: "mid", temp: [24, 28], bio: 0.2, school: 0, price: 10, time: "any", weather: "any" },
  { id: "bluetang", sci: "Paracanthurus hepatus", water: "salt", rar: 2, spots: ["lagoon", "ocean"], size: [15, 25], len: 1.05, h: 0.55, tail: "fork", dorsal: "low", pattern: "wedge", colors: ["#2f78c8", "#152a44", "#f0c43a"], beh: "mid", temp: [24, 28], bio: 0.6, school: 0, price: 40, time: "day", weather: "sun" },
  { id: "yellowtang", sci: "Zebrasoma flavescens", water: "salt", rar: 2, spots: ["lagoon"], size: [12, 18], len: 1, h: 0.75, tail: "round", dorsal: "tall", pattern: "solid", colors: ["#f2cf2f", "#e8b81f", "#f2cf2f"], beh: "mid", temp: [24, 28], bio: 0.5, school: 0, price: 36, time: "day", weather: "any", cleaner: 1 },
  { id: "firefish", sci: "Nemateleotris magnifica", water: "salt", rar: 2, spots: ["lagoon"], size: [6, 9], len: 1.1, h: 0.25, tail: "fork", dorsal: "sail", pattern: "gradient", colors: ["#f1ede2", "#e2533a", "#e2533a"], beh: "bottom", temp: [24, 28], bio: 0.15, school: 0, price: 22, time: "dusk", weather: "any" },
  { id: "banggai", sci: "Pterapogon kauderni", water: "salt", rar: 3, spots: ["lagoon"], size: [6, 8], len: 0.95, h: 0.55, tail: "fork", dorsal: "tall", pattern: "band", colors: ["#d9dcd6", "#1d2120", "#d9dcd6"], beh: "mid", temp: [24, 28], bio: 0.2, school: 3, price: 48, time: "dusk", weather: "cloud" },
  { id: "flyingfish", sci: "Cheilopogon pinnatibarbatus", water: "salt", rar: 2, spots: ["ocean"], size: [20, 35], len: 1.25, h: 0.22, tail: "fork", dorsal: "sail", pattern: "gradient", colors: ["#2f5f8a", "#d9e2e6", "#7fb0c9"], beh: "surface", temp: [22, 28], bio: 0.6, school: 3, price: 32, time: "day", weather: "sun" },
  { id: "idol", sci: "Zanclus cornutus", water: "salt", rar: 3, spots: ["ocean"], size: [15, 22], len: 0.9, h: 0.85, tail: "fork", dorsal: "sail", pattern: "band", colors: ["#f1e9c9", "#1e1d1a", "#f0c43a"], beh: "mid", temp: [24, 28], bio: 0.6, school: 0, price: 70, time: "day", weather: "any" },
  { id: "lionfish", sci: "Pterois volitans", water: "salt", rar: 3, spots: ["harbor"], size: [20, 35], len: 1.05, h: 0.45, tail: "round", dorsal: "sail", pattern: "stripeV", colors: ["#efe2d0", "#a8322a", "#c9563a"], beh: "solo", temp: [23, 28], bio: 0.7, school: 0, price: 80, time: "night", weather: "any" },
  { id: "mandarin", sci: "Synchiropus splendidus", water: "salt", rar: 4, spots: ["harbor"], size: [5, 7], len: 1, h: 0.4, tail: "round", dorsal: "tall", pattern: "calico", colors: ["#2f9a8a", "#ef8a2f", "#2f6fa8"], beh: "bottom", temp: [24, 27], bio: 0.15, school: 0, price: 140, time: "dusk", weather: "fog" },
  { id: "coelacanth", sci: "Latimeria menadoensis", water: "salt", rar: 5, spots: ["harbor", "ocean"], size: [110, 160], len: 1.4, h: 0.3, tail: "lyre", dorsal: "tall", pattern: "spots", colors: ["#3c4f5a", "#d9dcd6", "#3c4f5a"], beh: "bottom", temp: [14, 22], bio: 2, school: 0, price: 600, time: "night", weather: "fog" },
];

// Plants for tanks. kind: stem|rosette|sword|grass|carpet|moss|floater|ball|epiphyte
export const PLANTS = [
  { id: "javafern", kind: "epiphyte", leaf: "#3f7a3a", leaf2: "#2f5f2c", rate: 0.012, mass: 0.6, light: "low", price: 12, rar: 1 },
  { id: "anubias", kind: "epiphyte", leaf: "#2f6a35", leaf2: "#1f4f28", rate: 0.008, mass: 0.5, light: "low", price: 14, broad: 1, rar: 1 },
  { id: "buce", kind: "epiphyte", leaf: "#3a5f4a", leaf2: "#5f3f3a", rate: 0.007, mass: 0.3, light: "low", price: 40, broad: 1, small: 1, rar: 3 },
  { id: "sword", kind: "sword", leaf: "#4f8a3a", leaf2: "#3a6f2c", rate: 0.02, mass: 1.2, light: "mid", price: 14, rar: 1 },
  { id: "crypt", kind: "rosette", leaf: "#6f6a3a", leaf2: "#8a4f3a", rate: 0.012, mass: 0.6, light: "low", price: 12, rar: 1 },
  { id: "rotala", kind: "stem", leaf: "#d9733f", leaf2: "#8fae4a", rate: 0.05, mass: 1, light: "high", price: 10, rar: 1 },
  { id: "ludwigia", kind: "stem", leaf: "#c9483a", leaf2: "#7a8a3a", rate: 0.04, mass: 1, light: "high", price: 10, broad: 1, rar: 2 },
  { id: "bacopa", kind: "stem", leaf: "#6fa53a", leaf2: "#4f8a2c", rate: 0.035, mass: 0.9, light: "mid", price: 8, broad: 1, rar: 1 },
  { id: "hygro", kind: "stem", leaf: "#5f9a3a", leaf2: "#3f7a2c", rate: 0.045, mass: 1.1, light: "mid", price: 8, rar: 1 },
  { id: "val", kind: "grass", leaf: "#6f9f45", leaf2: "#4f7f35", rate: 0.03, mass: 1, light: "low", price: 8, tall: 1, rar: 1 },
  { id: "hairgrass", kind: "grass", leaf: "#7fb04a", leaf2: "#5f9038", rate: 0.025, mass: 0.6, light: "mid", price: 10, rar: 1 },
  { id: "montecarlo", kind: "carpet", leaf: "#8fc24f", leaf2: "#6fa23f", rate: 0.02, mass: 0.6, light: "high", price: 14, rar: 2 },
  { id: "javamoss", kind: "moss", leaf: "#4f7a32", leaf2: "#3a5f28", rate: 0.015, mass: 0.4, light: "low", price: 8, rar: 1 },
  { id: "lettuce", kind: "floater", leaf: "#9fc66a", leaf2: "#7fa64f", rate: 0.03, mass: 0.8, light: "mid", price: 8, rar: 1 },
  { id: "redroot", kind: "floater", leaf: "#b8603f", leaf2: "#7f9a4a", rate: 0.03, mass: 0.6, light: "high", price: 12, small: 1, rar: 2 },
  { id: "marimo", kind: "ball", leaf: "#3f6f2f", leaf2: "#2f5523", rate: 0.004, mass: 0.3, light: "low", price: 20, rar: 2 },
];

// Houseplants: greenhouse only, sold for shells.
export const HOUSEPLANTS = [
  { id: "pothos", leaf: "#4f8a3a", leaf2: "#d9cf8a", growMin: 30, value: 18, rar: 1 },
  { id: "monstera", leaf: "#2f6a35", leaf2: "#1f4f28", growMin: 60, value: 40, rar: 2 },
  { id: "calathea", leaf: "#3f6f4a", leaf2: "#b8484a", growMin: 45, value: 30, rar: 2 },
  { id: "fern", leaf: "#6fa53a", leaf2: "#4f8a2c", growMin: 25, value: 14, rar: 1 },
  { id: "fiddle", leaf: "#3a6a2c", leaf2: "#2a4f20", growMin: 90, value: 70, rar: 3 },
];

export const HARDSCAPE = [
  { id: "seiryu", kind: "stone", color: "#8a8f8c", color2: "#5f6663", price: 10 },
  { id: "dragon", kind: "stone", color: "#9a7a5a", color2: "#6a4f3a", price: 14, rough: 1 },
  { id: "pebble", kind: "stone", color: "#b9b2a2", color2: "#8a8475", price: 6, round: 1 },
  { id: "lava", kind: "stone", color: "#5a4a44", color2: "#3a2f2c", price: 12, rough: 1 },
  { id: "spider", kind: "wood", color: "#8a6a4a", color2: "#5f4630", price: 16 },
  { id: "manzanita", kind: "wood", color: "#a0603a", color2: "#6a3f28", price: 20 },
  { id: "root", kind: "wood", color: "#6f5238", color2: "#4a3624", price: 18, low: 1 },
  { id: "liverock", kind: "stone", color: "#c9a88a", color2: "#9a7a62", price: 16, rough: 1, salt: 1 },
];

export const SUBSTRATES = [
  { id: "aquasoil", color: "#3a2f28", color2: "#56463a", grain: "#6f5f50" },
  { id: "sand", color: "#d9c9a8", color2: "#c4b08a", grain: "#a8946e" },
  { id: "gravel", color: "#8a847a", color2: "#6a645a", grain: "#b0a898" },
];

export const TANK_SIZES = [
  { id: "nano", litres: 30, capacity: 2.2, price: 0 },
  { id: "medium", litres: 90, capacity: 4.5, price: 400 },
  { id: "large", litres: 240, capacity: 9, price: 1400 },
];

// Bait is used up on every cast (bought in packs of 5); lures are kept and only lost when the line snaps.
export const BAITS = [
  { id: "worm", price: 0, level: 1 },
  { id: "cricket", price: 4, level: 1 },
  { id: "shrimpbait", price: 6, level: 1 },
  { id: "minnow", price: 10, level: 2 },
  { id: "glowlure", price: 18, level: 3 },
  { id: "spinner", price: 40, level: 1, lure: true },
  { id: "fly", price: 45, level: 2, lure: true },
  { id: "crankbait", price: 55, level: 2, lure: true },
  { id: "popper", price: 60, level: 3, lure: true },
  { id: "jig", price: 70, level: 4, lure: true },
];

export const FOODS = [
  { id: "flakes", price: 0, mood: 0 },
  { id: "bloodworm", price: 3, mood: 6 },
];

export const CORAL_FORMS = ["branch", "brain", "mushroom", "zoa", "torch", "leather"];
// Allowed coral hues (no purple / violet band).
export const CORAL_HUES = [4, 14, 24, 36, 48, 62, 90, 140, 165, 178, 190, 205, 220, 350];
export const CORAL_PATTERNS = ["solid", "tips", "rings", "speckle"];

export const MILESTONES = [
  { id: "firstcatch", goal: 1, stat: "caught" },
  { id: "angler25", goal: 25, stat: "caught" },
  { id: "angler100", goal: 100, stat: "caught" },
  { id: "species10", goal: 10, stat: "species" },
  { id: "species30", goal: 30, stat: "species" },
  { id: "golden", goal: 1, stat: "golden" },
  { id: "breeder", goal: 1, stat: "bred" },
  { id: "breeder20", goal: 20, stat: "bred" },
  { id: "gardener", goal: 10, stat: "harvested" },
  { id: "sport", goal: 1, stat: "sports" },
  { id: "trimmer", goal: 10, stat: "trims" },
  { id: "clearwater", goal: 5, stat: "waterChanges" },
  { id: "focus60", goal: 60, stat: "focusMin" },
  { id: "focus600", goal: 600, stat: "focusMin" },
  { id: "streak7", goal: 7, stat: "streak" },
  { id: "strains5", goal: 5, stat: "strains" },
  { id: "kind10", goal: 10, stat: "released" },
  { id: "orders10", goal: 10, stat: "orders" },
];

export const FISH_NAMES = [
  "Mika", "Bayu", "Sari", "Tomo", "Lumi", "Nori", "Pip", "Kiko", "Arin", "Bima", "Ceri", "Dara", "Eko", "Fern",
  "Gita", "Hana", "Indi", "Juno", "Kai", "Lin", "Maru", "Nala", "Oki", "Pala", "Rio", "Sora", "Tika", "Udin",
  "Vero", "Wulan", "Yuki", "Zaza", "Biscuit", "Pepper", "Mochi", "Tofu", "Kopi", "Teh", "Sambal", "Kerupuk",
  "Pebble", "Ripple", "Drift", "Moss", "Ember", "Clove", "Ginger", "Nutmeg", "Sage", "Tide", "Coral", "Reed",
];

export const PERSONALITIES = ["curious", "shy", "playful", "lazy", "social", "greedy"];
