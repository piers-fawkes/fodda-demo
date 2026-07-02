
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

// Initial Suggested Questions per vertical — kept concise (4-8 words) like search terms
export const SUGGESTED_QUESTIONS: Record<Exclude<Vertical, Vertical.Baseline>, SuggestedQuestion[]> = {
  [Vertical.Sports]: [
    { text: "Fan engagement tech at live events", terms: ["fan", "engagement", "live", "events", "technology"] },
    { text: "Inclusive sportswear design trends", terms: ["inclusive", "sportswear", "adaptive", "accessibility"] },
    { text: "Athlete-led brands and DTC models", terms: ["athlete", "brands", "DTC", "direct-to-consumer"] }
  ],
  [Vertical.Retail]: [
    { text: "AI-powered personalization in stores", terms: ["AI", "personalization", "stores", "retail"] },
    { text: "Frictionless checkout innovations", terms: ["frictionless", "checkout", "seamless", "payments"] },
    { text: "Small-format retail concepts", terms: ["small-format", "retail", "micro", "neighborhood"] }
  ],
  [Vertical.Beauty]: [
    { text: "Clinical skincare meets retail", terms: ["clinical", "skincare", "retail", "dermatology"] },
    { text: "Wellness and beauty convergence", terms: ["wellness", "beauty", "convergence", "lifestyle"] },
    { text: "Fragrance and scent innovation", terms: ["fragrance", "scent", "innovation", "sensory"] },
    { text: "In-store beauty experiences", terms: ["in-store", "beauty", "experience", "immersive"] }
  ],
  [Vertical.Waldo]: [],
  [Vertical.SIC]: [
    { text: "AI and brand authenticity", terms: ["AI", "brands", "authenticity"] },
    { text: "New status signals beyond luxury", terms: ["status", "signals", "luxury"] },
    { text: "Creator-led commerce models", terms: ["creators", "commerce", "media", "DTC"] }
  ],
  [Vertical.CEDesign]: [
    { text: "Smart home device innovation", terms: ["smart home", "device", "innovation", "IoT"] },
    { text: "Wearable technology trends", terms: ["wearable", "technology", "fitness", "health"] },
    { text: "Sustainable electronics design", terms: ["sustainable", "electronics", "design", "materials"] }
  ],
  [Vertical.MLBSponsorship]: [
    { text: "T-Mobile 5G network MLB beyond advertising", terms: ["T-Mobile", "5G", "MLB", "sponsorship", "advertising"] },
    { text: "Facial authentication stadium fan experience", terms: ["facial", "authentication", "stadium", "fan", "experience"] },
    { text: "Prediction market platforms MLB partnerships", terms: ["prediction", "market", "MLB", "Polymarket", "wagering"] },
    { text: "Automated Ball-Strike Challenge system adoption", terms: ["automated", "ball-strike", "challenge", "ABS", "adoption"] }
  ],
  [Vertical.Edelman_TippingPoints]: [
    { text: "What is driving consumer pushback against the wellness industry?", terms: ["wellness", "pushback", "consumer", "saturation"] },
    { text: "How do fallow periods lead to cultural and business renewal?", terms: ["fallow", "renewal", "culture", "business"] },
    { text: "What evidence exists for people seeking connection away from the Internet?", terms: ["connection", "community", "internet", "quiet"] },
    { text: "How is the end of the rules-based global trading environment reshaping business leadership?", terms: ["trading", "global", "leadership", "growth"] }
  ],
  [Vertical.PwC_SXSW2026]: [
    { text: "What is the leadership trust imperative for AI integration?", terms: ["leadership", "trust", "AI", "integration"] },
    { text: "How are IRL experiences combating isolation from technology?", terms: ["IRL", "experiences", "combating", "isolation", "technology"] },
    { text: "Why is equitable augmentation access a priority?", terms: ["equitable", "augmentation", "access", "priority"] },
    { text: "How can brands maintain authenticity through cultural and algorithmic understanding?", terms: ["brands", "authenticity", "cultural", "algorithmic"] }
  ],
  [Vertical.Delta_ConnectionIndex]: [
    { text: "How is travel helping people rediscover a sense of belonging in a digital world?", terms: ["travel", "belonging", "digital", "connection"] },
    { text: "What are the key drivers behind the shift from digital simulation to real-world sensory experiences in travel?", terms: ["travel", "sensory", "real-world", "experiences"] },
    { text: "How does travel distance contribute to personal clarity and the resetting of priorities?", terms: ["travel", "clarity", "priorities", "distance"] },
    { text: "What role does travel play in self-discovery and cultural exposure for modern travelers?", terms: ["travel", "self-discovery", "cultural", "exposure"] }
  ],
  [Vertical.Tech]: [
    { text: "What technology trends are changing how brands interact with customers?", terms: ["technology", "brands", "interact", "customers"] },
    { text: "How is AI being embedded into physical products and services?", terms: ["AI", "embedded", "physical", "products", "services"] },
    { text: "What's driving the shift from digital platforms to ambient and embedded computing?", terms: ["digital", "platforms", "ambient", "embedded", "computing"] },
    { text: "How are companies using automation and AI agents to transform operations?", terms: ["automation", "AI", "agents", "transform", "operations"] }
  ],
  [Vertical.Food]: [
    { text: "What trends are reshaping how food brands think about ingredients and health?", terms: ["food", "brands", "ingredients", "health"] },
    { text: "How are restaurants and food brands using technology to improve the dining experience?", terms: ["restaurants", "food", "technology", "dining", "experience"] },
    { text: "What's driving innovation in alternative proteins and functional foods?", terms: ["innovation", "alternative", "proteins", "functional", "foods"] },
    { text: "How are food companies responding to changing consumer values around sustainability?", terms: ["food", "sustainability", "consumer", "values"] }
  ],
  [Vertical.Travel]: [
    { text: "What trends are reshaping how hotels and destinations create memorable experiences?", terms: ["hotels", "destinations", "experiences"] },
    { text: "How is technology changing the way people plan and experience travel?", terms: ["technology", "plan", "experience", "travel"] },
    { text: "What's driving the shift toward regenerative and sustainable travel?", terms: ["regenerative", "sustainable", "travel"] },
    { text: "How are airlines and hospitality brands using AI to personalise service?", terms: ["airlines", "hospitality", "AI", "personalise", "service"] }
  ]
};

// Merged Mock Data for fallback and demo grounding
export const MOCK_TRENDS = [
  { id: "5367", vertical: Vertical.Retail, name: "Short-Run Co-Branded Pop-Up Retail Installations", summary: "Brands and retail partners open temporary, co-branded pop-up locations to launch limited product drops and curated experiences aimed at driving immediate foot traffic, email/social captures and PR." },
  { id: "5389", vertical: Vertical.Beauty, name: "Scented Experiences & Fragrance Extensions", summary: "Fragrance and scent experiences expand beyond bottles into wearables, accessories, spirits and place-based narratives to create multisensory brand touchpoints and repeatable rituals." },
  // Edelman Tipping Points
  { id: "edelman/tipping-points-t1", vertical: Vertical.Edelman_TippingPoints, name: "Wellness Saturation", summary: "Pushback against wellness driven by a desire for something new and distrust in profit motives." },
  { id: "edelman/tipping-points-t2", vertical: Vertical.Edelman_TippingPoints, name: "Rot to Renewal", summary: "Fallow periods are essential precursors to renewal." },
  { id: "edelman/tipping-points-t3", vertical: Vertical.Edelman_TippingPoints, name: "Seeking a Quieter Life", summary: "People are seeking connection, community, and fun away from the Internet." },
  { id: "edelman/tipping-points-t4", vertical: Vertical.Edelman_TippingPoints, name: "The Shape of Growth", summary: "The end of the rules-based global trading environment means business leaders must act as statespeople." },
  // PwC SXSW 2026
  { id: "pwc/sxsw-2026-key-insights-t1", vertical: Vertical.PwC_SXSW2026, name: "Leadership Trust Imperative", summary: "Trust is essential for navigating workforce transformation and ensuring successful AI integration." },
  { id: "pwc/sxsw-2026-key-insights-t2", vertical: Vertical.PwC_SXSW2026, name: "IRL Experiences", summary: "Relationships and community can combat isolation from technology." },
  { id: "pwc/sxsw-2026-key-insights-t3", vertical: Vertical.PwC_SXSW2026, name: "Equitable Augmentation Access", summary: "Augmentation shapes how people work; therefore, inclusion needs to be a priority." },
  { id: "pwc/sxsw-2026-key-insights-t4", vertical: Vertical.PwC_SXSW2026, name: "Brand Authenticity", summary: "Brands must leverage culture, creators, and algorithmic understanding to maintain relevance and consumer trust." },
  { id: "pwc/sxsw-2026-key-insights-t5", vertical: Vertical.PwC_SXSW2026, name: "Technology Adoption Lag", summary: "Society struggles to keep pace with rapid technological innovation, outpacing regulation and societal understanding." },
  // --- TECH ---
  { id: "t001", vertical: Vertical.Tech, name: "Embedded Audio as Ambient Infrastructure", summary: "Brands deploy always-on audio environments across physical retail and hospitality spaces, using spatial sound and AI-generated soundscapes as a layered engagement channel." },
  { id: "t002", vertical: Vertical.Tech, name: "Agentic Commerce and Background AI Purchasing", summary: "AI agents execute purchasing decisions autonomously on behalf of users — monitoring prices, negotiating offers and completing transactions without active human involvement." },
  { id: "t003", vertical: Vertical.Tech, name: "On-Device AI and Edge Intelligence", summary: "AI processing moves from cloud to device — enabling real-time, privacy-preserving experiences in wearables, appliances and retail hardware." },
  // --- FOOD ---
  { id: "f001", vertical: Vertical.Food, name: "Barista-Free Espresso Stations", summary: "Closed-loop extraction and integrated milk-texturing units enable fully automated specialty coffee at retail and office locations, eliminating labour dependency while maintaining quality." },
  { id: "f002", vertical: Vertical.Food, name: "Mainstream Performance Nutrition in Meals", summary: "Performance-nutrition ingredients (adaptogens, nootropics, functional proteins) are being embedded into everyday meals and beverages, targeting wellness-oriented mainstream consumers." },
  { id: "f003", vertical: Vertical.Food, name: "The Bar as a Curated Art Experience", summary: "High-end bars and restaurants are positioning themselves as cultural venues, curating ingredient provenance, craft narratives and seasonal menus as premium experiential products." },
  // --- TRAVEL ---
  { id: "tr001", vertical: Vertical.Travel, name: "Vertical and Regional Travel Super-Apps", summary: "Niche travel marketplaces are consolidating booking, discovery, and local experiences into integrated super-app experiences for specific traveller segments." },
  { id: "tr002", vertical: Vertical.Travel, name: "Branded Culinary Destinations", summary: "Hotels and resorts are investing in signature dining as a primary demand driver — positioning food and beverage as a destination in itself rather than a commodity amenity." },
  { id: "tr003", vertical: Vertical.Travel, name: "Regenerative Travel Programmes", summary: "Tour operators and destinations are building structured regenerative itineraries — where traveller participation actively restores local ecosystems, communities and cultural heritage." },
];

export const MOCK_ARTICLES = [
  { id: "7885", vertical: Vertical.Retail, trendIds: ["5367"], title: "Marc Jacobs and Nordstrom NYC: Fashion Meets Art", sourceUrl: "https://www.shopdropdaily.com/post/marc-jacobs-joy-pop-up-at-the-corner-nordstrom-nyc", snippet: "Marc Jacobs and Nordstrom have launched a temporary pop-up store called 'Marc Jacobs at The Corner', integrating fashion, art, and community engagement for this pop up event." },
  { id: "9600", vertical: Vertical.Beauty, trendIds: ["5563"], title: "Cafe-Integrated Beauty Concept Stores", sourceUrl: "https://www.beautytech.com/cafe-retail-beauty-overlap", snippet: "Beauty retailers are launching 'wellness cafes' inside clinics serving mood-boosting coffee and other functional beverages to drive dwell time." },
  { id: "11989", vertical: Vertical.Sports, trendIds: ["5560"], title: "ATHX Games and Adidas Ink Global Deal", sourceUrl: "https://athletechnews.com/athx-games-global-expansion-adidas-partnership/", snippet: "ATHX Games partners with Adidas for a four-year global deal, launching a European tour in 2026 with fitness events and expanding its affiliate gym network." },
  // Edelman Tipping Points
  { id: "rec13xpRf7KX1lTHA", vertical: Vertical.Edelman_TippingPoints, trendIds: ["edelman/tipping-points-t1"], title: "45% of global consumers say they are experiencing wellbeing burnout", sourceUrl: "", snippet: "45% of global consumers say they are experiencing wellbeing burnout." },
  { id: "rec2mRP0g1mAKPBr6", vertical: Vertical.Edelman_TippingPoints, trendIds: ["edelman/tipping-points-t4"], title: "Neo-bank Revolut", sourceUrl: "", snippet: "Neo-bank Revolut integrates crypto-investment, more traditional banking, and lifestyle perks into a single app through a tiered subscription model." },
  { id: "rec5ber5QsJlM1Ujv", vertical: Vertical.Edelman_TippingPoints, trendIds: ["edelman/tipping-points-t3"], title: "Cities population decline", sourceUrl: "", snippet: "17% of cities in developed countries will be in population decline by 2025." },
  { id: "rec6ozbY4DwsXddHS", vertical: Vertical.Edelman_TippingPoints, trendIds: ["edelman/tipping-points-t3"], title: "Running Flan club in Paris", sourceUrl: "", snippet: "In Paris, the Running Flan club brings people together around a shared love of exercise and patisserie." },
  { id: "rec70glbGoqBTZ0fh", vertical: Vertical.Edelman_TippingPoints, trendIds: ["edelman/tipping-points-t3"], title: "Riyadh's greening project", sourceUrl: "", snippet: "Riyadh's citywide greening project will help residents cope with extreme heat by planting 7.5 million trees." },
  // PwC SXSW 2026
  { id: "rec1DL5g8LQXx4jC1", vertical: Vertical.PwC_SXSW2026, trendIds: ["pwc/sxsw-2026-key-insights-t5"], title: "Jorn Van Dijk Case Study", sourceUrl: "https://www.fodda.ai", snippet: "Al can quickly deliver an 80% viable product, but as of right now it offers very little control over the output. The iteration required to address the last 20% often results in things getting worse, n" },
  { id: "rec37gM4enJYHEfqz", vertical: Vertical.PwC_SXSW2026, trendIds: ["pwc/sxsw-2026-key-insights-t5"], title: "Cloud Power Consumption Statistics", sourceUrl: "https://www.fodda.ai", snippet: "Data centers are projected to consume 9% to 17% of total US electricity by 2030." },
  { id: "rec9AfRBTtjux1rbI", vertical: Vertical.PwC_SXSW2026, trendIds: ["pwc/sxsw-2026-key-insights-t1"], title: "Vanessa Tanicien Quote", sourceUrl: "https://www.fodda.ai", snippet: "\"Managers and leaders have to be explicit about behaviors they do want and don't want.\"" },
  { id: "recO3P7Kha3G0Nb4J", vertical: Vertical.PwC_SXSW2026, trendIds: ["pwc/sxsw-2026-key-insights-t2"], title: "Jennifer Wallace Resilience Quote", sourceUrl: "https://www.fodda.ai", snippet: "Resilience is not built in isolation. It “rests on relationships, deep, nourishing relationships that remind us that we are significant, appreciated, invested in." },
  { id: "recO3vmAgmXwWZ9NR", vertical: Vertical.PwC_SXSW2026, trendIds: ["pwc/sxsw-2026-key-insights-t5"], title: "Nataliya Kosmyna Quote", sourceUrl: "https://www.fodda.ai", snippet: "\"Today it finishes your prompt. Tomorrow it will finish your thought.\"" },
  // --- TECH ---
  { id: "t101", vertical: Vertical.Tech, trendIds: ["t001"], title: "Spotify's Ambient Audio Environments for Retail", sourceUrl: "https://newsroom.spotify.com", snippet: "Spotify launched curated in-store audio experiences for retail partners, using AI to match soundscapes to store zones and shopper behaviour." },
  { id: "t102", vertical: Vertical.Tech, trendIds: ["t002"], title: "Amazon Rufus: The Shopping Agent", sourceUrl: "https://www.aboutamazon.com", snippet: "Amazon's Rufus AI agent handles end-to-end product discovery and purchase completion, reducing the steps between intent and transaction." },
  { id: "t103", vertical: Vertical.Tech, trendIds: ["t003"], title: "Apple Intelligence On-Device Processing", sourceUrl: "https://www.apple.com/apple-intelligence", snippet: "Apple's on-device AI suite processes personal data without cloud transmission, setting a new privacy-first standard for consumer AI." },
  // --- FOOD ---
  { id: "f101", vertical: Vertical.Food, trendIds: ["f001"], title: "Brewed Robotics Deploys Barista-Free Coffee Units", sourceUrl: "https://www.brewedrobotics.com", snippet: "Brewed Robotics deployed fully automated espresso units with integrated cleaning cycles and quality monitoring in retail and office environments." },
  { id: "f102", vertical: Vertical.Food, trendIds: ["f002"], title: "AG1 Enters the Meal Kit Category", sourceUrl: "https://drinkag1.com", snippet: "Athletic Greens expanded beyond supplements into functional meal formats, embedding adaptogens and performance nutrition into everyday eating occasions." },
  { id: "f103", vertical: Vertical.Food, trendIds: ["f003"], title: "Noma's Provenance-First Tasting Experience", sourceUrl: "https://www.noma.dk", snippet: "Noma's seasonal menus built around hyperlocal ingredient sourcing became a global template for the bar and restaurant-as-cultural-venue movement." },
  // --- TRAVEL ---
  { id: "tr101", vertical: Vertical.Travel, trendIds: ["tr001"], title: "GetYourGuide Raises $194M for Experiences Platform", sourceUrl: "https://www.getyourguide.com", snippet: "GetYourGuide's latest raise accelerates its pivot from ticket booking to a full-service travel experience platform with curated local activities." },
  { id: "tr102", vertical: Vertical.Travel, trendIds: ["tr002"], title: "Aman's Culinary Residency Programme", sourceUrl: "https://www.aman.com", snippet: "Aman resorts launched rotating chef residencies, positioning their restaurants as destination dining experiences that drive standalone bookings." },
  { id: "tr103", vertical: Vertical.Travel, trendIds: ["tr003"], title: "Regenerative Tourism Certification: B-Corp Travel Brands", sourceUrl: "https://bcorporation.net", snippet: "A growing cohort of B-Corp-certified travel operators is structuring tours where traveller spend directly funds habitat restoration and community employment." },
];
