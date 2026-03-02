// Footwear component categories and common items
export const COMPONENT_CATEGORIES = {
  upper: [
    "Vamp",
    "Quarter",
    "Tongue",
    "Collar",
    "Eyelet Stay",
    "Mudguard",
    "Toe Cap",
    "Heel Counter",
    "Backstay",
    "Foxing",
    "Overlay",
    "Underlay",
    "Toe Box",
    "Throat",
  ],
  sole: ["Outsole", "Midsole", "Insole", "Shank", "Heel", "Rand"],
  lining: [
    "Sock Liner",
    "Quarter Lining",
    "Vamp Lining",
    "Tongue Lining",
    "Heel Lining",
  ],
  hardware: [
    "Eyelets",
    "Hooks",
    "D-rings",
    "Zippers",
    "Buckles",
    "Lace Tips",
    "Speed Hooks",
    "Rivets",
  ],
  other: [
    "Laces",
    "Pull Tab",
    "Logo/Branding",
    "Reflective Elements",
    "Webbing",
    "Piping",
  ],
} as const;

// Common footwear materials
export const MATERIALS = {
  upper: [
    "Full Grain Leather",
    "Split Leather",
    "Nubuck",
    "Suede",
    "Synthetic Leather (PU)",
    "Engineered Mesh",
    "Knit",
    "Canvas",
    "Nylon",
    "TPU Film",
    "Patent Leather",
    "Woven Textile",
    "Gore-Tex",
    "Cordura",
  ],
  lining: [
    "Pig Skin Leather",
    "Synthetic Leather (PU)",
    "Mesh Lining",
    "Terry Cloth",
    "Neoprene",
    "Foam Backed Textile",
    "Unlined",
  ],
  outsole: [
    "Rubber (Solid)",
    "Rubber (Blown)",
    "EVA",
    "TPU",
    "Leather",
    "Vibram",
    "Crepe",
    "Phylon",
    "PVC",
  ],
  midsole: [
    "EVA (Ethylene Vinyl Acetate)",
    "PU (Polyurethane)",
    "TPU",
    "Phylon",
    "Boost (Adidas)",
    "React (Nike)",
    "Fresh Foam",
    "Cork",
    "None",
  ],
  hardware: [
    "Brass (Antique)",
    "Brass (Polished)",
    "Nickel",
    "Gunmetal",
    "Matte Black",
    "Silver",
    "Gold",
    "Plastic",
  ],
} as const;

// Construction methods
export const CONSTRUCTION_METHODS = [
  { value: "cementing", label: "Cementing (Glued)", description: "Most common. Upper glued to sole with adhesive." },
  { value: "vulcanization", label: "Vulcanization", description: "Rubber sole vulcanized directly onto upper. Used for sneakers." },
  { value: "strobel", label: "Strobel", description: "Upper stitched to a fabric sock, then cemented to sole. Lightweight." },
  { value: "stitchdown", label: "Stitchdown", description: "Upper turned outward and stitched to sole. Durable." },
  { value: "goodyear_welt", label: "Goodyear Welt", description: "Upper stitched to welt, welt stitched to sole. Premium." },
  { value: "blake_stitch", label: "Blake Stitch", description: "Upper stitched directly to sole from inside. Sleek profile." },
  { value: "norwegian_welt", label: "Norwegian Welt", description: "Variant of Goodyear. Water resistant." },
  { value: "injection_molding", label: "Injection Molding", description: "Sole injected directly onto upper in a mold. Mass production." },
  { value: "san_crispino", label: "San Crispino", description: "Italian method. Upper wrapped under insole and cemented." },
  { value: "slip_lasting", label: "Slip Lasting", description: "Upper pulled over last and glued under. Flexible." },
] as const;

// Standard shoe measurements
export const MEASUREMENT_NAMES = [
  "Overall Length",
  "Overall Height",
  "Forefoot Width",
  "Heel Height",
  "Heel Counter Height",
  "Shaft Height",
  "Collar Opening",
  "Toe Spring",
  "Platform Height",
  "Outsole Thickness",
  "Midsole Thickness",
] as const;

// Standard technical views
export const TECHNICAL_VIEWS = [
  "front",
  "back",
  "left",
  "right",
  "top",
  "bottom",
  "three_quarter",
] as const;

export type TechnicalView = (typeof TECHNICAL_VIEWS)[number];
export type ComponentCategory = keyof typeof COMPONENT_CATEGORIES;

// Valid stitch patterns for factory callouts
export const STITCH_PATTERNS = [
  "lockstitch",
  "chainstitch",
  "zigzag",
  "bartack",
  "flatlock",
  "overlock",
] as const;

// Valid thread types
export const THREAD_TYPES = [
  "polyester",
  "nylon",
  "cotton",
  "kevlar",
] as const;

export type StitchPattern = (typeof STITCH_PATTERNS)[number];
export type ThreadType = (typeof THREAD_TYPES)[number];

// Common footwear Pantone TPX/TCX colors for autocomplete
export const PANTONE_COLORS = [
  { code: "19-4052 TCX", name: "Classic Blue", hex: "#0F4C81" },
  { code: "11-0601 TCX", name: "Bright White", hex: "#F2F3F4" },
  { code: "19-0303 TCX", name: "Jet Black", hex: "#2B2B2B" },
  { code: "19-1664 TCX", name: "True Red", hex: "#BF1932" },
  { code: "17-5104 TCX", name: "Ultimate Gray", hex: "#939597" },
  { code: "14-4811 TCX", name: "Aqua Sky", hex: "#7BC4C4" },
  { code: "18-3838 TCX", name: "Ultra Violet", hex: "#5F4B8B" },
  { code: "16-1546 TCX", name: "Living Coral", hex: "#FF6F61" },
  { code: "19-4150 TCX", name: "Snorkel Blue", hex: "#034F84" },
  { code: "15-1040 TCX", name: "Iced Coffee", hex: "#B18F6A" },
  { code: "18-1662 TCX", name: "Flame Scarlet", hex: "#CD212A" },
  { code: "15-0343 TCX", name: "Greenery", hex: "#88B04B" },
  { code: "17-1462 TCX", name: "Tangerine Tango", hex: "#DD4124" },
  { code: "14-3207 TCX", name: "Orchid Hush", hex: "#C6A4CF" },
  { code: "16-1328 TCX", name: "Sandstone", hex: "#C48A69" },
  { code: "19-3950 TCX", name: "Royal Blue", hex: "#4169E1" },
  { code: "17-1558 TCX", name: "Grenadine", hex: "#DC4C46" },
  { code: "12-0752 TCX", name: "Buttercup", hex: "#FAE03C" },
  { code: "18-1438 TCX", name: "Marsala", hex: "#964F4C" },
  { code: "15-5519 TCX", name: "Turquoise", hex: "#45B5AA" },
  { code: "18-3943 TCX", name: "Blue Iris", hex: "#5B5EA6" },
  { code: "14-0848 TCX", name: "Mimosa", hex: "#F0C05A" },
  { code: "19-1557 TCX", name: "Chili Pepper", hex: "#9B1B30" },
  { code: "17-1360 TCX", name: "Celosia Orange", hex: "#E8793A" },
  { code: "18-3224 TCX", name: "Radiant Orchid", hex: "#AD5E99" },
  { code: "15-1247 TCX", name: "Desert Sun", hex: "#D19C6E" },
  { code: "18-4051 TCX", name: "French Blue", hex: "#0072B5" },
  { code: "19-4052 TCX", name: "Classic Navy", hex: "#0D2240" },
  { code: "14-4122 TCX", name: "Cerulean", hex: "#9BB7D4" },
  { code: "17-4041 TCX", name: "Marina", hex: "#4F84C4" },
  { code: "11-4800 TCX", name: "Blanc de Blanc", hex: "#E8E4DA" },
  { code: "13-1520 TCX", name: "Rose Quartz", hex: "#F7CAC9" },
  { code: "15-3919 TCX", name: "Serenity", hex: "#91A8D0" },
  { code: "17-1463 TCX", name: "Tigerlily", hex: "#E2583E" },
  { code: "14-0756 TCX", name: "Minion Yellow", hex: "#F5DF4D" },
  { code: "16-4132 TCX", name: "Little Boy Blue", hex: "#6C8CBF" },
  { code: "16-3310 TCX", name: "Pink Lavender", hex: "#DBA5C1" },
  { code: "17-0145 TCX", name: "Kale", hex: "#5A7247" },
  { code: "18-2120 TCX", name: "Honeysuckle", hex: "#D94F70" },
  { code: "16-1548 TCX", name: "Peach Echo", hex: "#F7786B" },
  { code: "13-1404 TCX", name: "Pale Dogwood", hex: "#EDCDC2" },
  { code: "14-1318 TCX", name: "Toasted Almond", hex: "#D2B49C" },
  { code: "18-1354 TCX", name: "Aurora Red", hex: "#B93A32" },
  { code: "15-0146 TCX", name: "Green Flash", hex: "#79C753" },
  { code: "16-3905 TCX", name: "Lilac Gray", hex: "#9896A4" },
  { code: "17-4540 TCX", name: "Scuba Blue", hex: "#00B2CA" },
  { code: "11-0602 TCX", name: "Snow White", hex: "#F0EDE5" },
  { code: "19-0810 TCX", name: "Chocolate Brown", hex: "#3E2723" },
  { code: "16-0940 TCX", name: "Honey Gold", hex: "#C6893F" },
  { code: "18-1550 TCX", name: "Red Ochre", hex: "#9A3324" },
] as const;
