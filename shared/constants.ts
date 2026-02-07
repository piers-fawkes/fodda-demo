
import { Vertical } from './types';

export interface SuggestedQuestion {
  text: string;
  terms: string[];
}

export const BASELINE_QUESTIONS = [
  { id: 'UNITY', label: 'Social Cohesion / Unity' },
  { id: 'CRIMESAFE', label: 'Perception of Crime & Safety' },
  { id: 'GOVPROTCT', label: 'Trust in Govt Protection' },
  { id: 'MOREGUNIMPACT', label: 'Gun Policy Impact Beliefs' },
  { id: 'COMTYPE2', label: 'Community Type (Urban/Rural)' },
  { id: 'ECON1MOD', label: 'Economic Outlook (General)' },
  { id: 'ECON1BMOD', label: 'Economic Outlook (Personal)' },
  { id: 'FIN_SIT', label: 'Current Financial Situation' },
  { id: 'INTFREQ_COLLAPSED', label: 'Internet Usage Frequency' },
  { id: 'INTMOB', label: 'Mobile Internet Access' },
  { id: 'BBHOME', label: 'Home Broadband Access' },
  { id: 'DEVICE1A', label: 'Smartphone Ownership' },
  { id: 'SMUSE_YT', label: 'YouTube Usage' },
  { id: 'SMUSE_IG', label: 'Instagram Usage' },
  { id: 'SMUSE_TT', label: 'TikTok Usage' },
];

// Initial Suggested Questions per vertical - Grounded in actual platform capability
export const SUGGESTED_QUESTIONS: Record<Exclude<Vertical, Vertical.Baseline>, SuggestedQuestion[]> = {
  [Vertical.Sports]: [
    { 
      text: "How are sports brands turning one-off experiences into repeatable formats, and where is that showing up?", 
      terms: ["sports", "brands", "repeatable", "formats", "scaling"] 
    },
    { 
      text: "Where are we seeing sportswear designed for broader bodies and abilities, and which examples suggest this is becoming more common?", 
      terms: ["sportswear", "bodies", "abilities", "inclusive", "accessibility"] 
    }
  ],
  [Vertical.Retail]: [
    { 
      text: "Where are retailers removing friction from the buying journey, and how are they actually doing it?", 
      terms: ["retailers", "friction", "buying", "journey", "seamless"] 
    },
    { 
      text: "How are retailers reorganizing operations around fulfillment, and where is that becoming the default rather than the exception?", 
      terms: ["retailers", "operations", "fulfillment", "default", "supply-chain"] 
    }
  ],
  [Vertical.Beauty]: [
    { 
      text: "How are beauty retailers changing what happens in-store, and where are we seeing that show up in practice?", 
      terms: ["beauty", "retailers", "in-store", "practice", "experience"] 
    },
    { 
      text: "Where are beauty products starting to behave more like performance tools than traditional cosmetics, and what evidence supports that?", 
      terms: ["beauty", "performance", "tools", "cosmetics", "clinical"] 
    }
  ],
  [Vertical.Waldo]: [
    { 
      text: "What are the emerging consumer signals and equipment trends around outdoor grilling and high-end backyard social experiences?", 
      terms: ["outdoor", "grilling", "backyard", "social", "cooking"] 
    },
    { 
      text: "How are fitness gym revenue models shifting toward tiered access and ancillary services, and where is this most visible?", 
      terms: ["fitness", "gym", "revenue", "models", "memberships"] 
    }
  ],
  [Vertical.SIC]: [
    { 
      text: "What kinds of cultural signals are moving from the margins into the mainstream?", 
      terms: ["cultural", "signals", "margins", "mainstream"] 
    },
    { 
      text: "Where are institutions pulling back, narrowing scope, or enforcing boundaries right now?", 
      terms: ["institutions", "narrowing", "boundaries", "scope"] 
    }
  ]
};

// Merged Mock Data for fallback and demo grounding
export const MOCK_TRENDS = [
  { id: "5367", vertical: Vertical.Retail, name: "Short-Run Co-Branded Pop-Up Retail Installations", summary: "Brands and retail partners open temporary, co-branded pop-up locations to launch limited product drops and curated experiences aimed at driving immediate foot traffic, email/social captures and PR." },
  { id: "5389", vertical: Vertical.Beauty, name: "Scented Experiences & Fragrance Extensions", summary: "Fragrance and scent experiences expand beyond bottles into wearables, accessories, spirits and place-based narratives to create multisensory brand touchpoints and repeatable rituals." },
];

export const MOCK_ARTICLES = [
  { id: "7885", vertical: Vertical.Retail, trendIds: ["5367"], title: "Marc Jacobs and Nordstrom NYC: Fashion Meets Art", sourceUrl: "https://www.shopdropdaily.com/post/marc-jacobs-joy-pop-up-at-the-corner-nordstrom-nyc", snippet: "Marc Jacobs and Nordstrom have launched a temporary pop-up store called 'Marc Jacobs at The Corner', integrating fashion, art, and community engagement for this pop up event." },
  { id: "9600", vertical: Vertical.Beauty, trendIds: ["5563"], title: "Cafe-Integrated Beauty Concept Stores", sourceUrl: "https://www.beautytech.com/cafe-retail-beauty-overlap", snippet: "Beauty retailers are launching 'wellness cafes' inside clinics serving mood-boosting coffee and other functional beverages to drive dwell time." },
  { id: "11989", vertical: Vertical.Sports, trendIds: ["5560"], title: "ATHX Games and Adidas Ink Global Deal", sourceUrl: "https://athletechnews.com/athx-games-global-expansion-adidas-partnership/", snippet: "ATHX Games partners with Adidas for a four-year global deal, launching a European tour in 2026 with fitness events and expanding its affiliate gym network." },
];
