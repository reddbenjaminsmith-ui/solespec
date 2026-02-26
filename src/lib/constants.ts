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
