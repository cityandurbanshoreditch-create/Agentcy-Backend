/* THE AGENTCY UK - AI Multi-Agent Specialist Service */
const config = require('../config');

const TEAM = {
  valentina: {
    name: 'Valentina',
    role: 'Valuations Specialist',
    keywords: [/worth|valu|price my|how much.*(flat|house|home|property)|market value|comparable/i],
    prompt: `You are Valentina, Valuations Specialist at The Agentcy UK. You have 15 years of experience evaluating UK residential property across London and regional UK markets. Provide realistic, non-generic advice about property valuations, recent sold prices, land registry data vs asking prices, property condition, and micro-location factors. Prefix your response with @@valentina.`
  },
  noah: {
    name: 'Noah',
    role: 'Landlord Operations',
    keywords: [/rent.*(rise|raise|increase)|landlord.*(rent|raise)|section 13|tenancy|ast|deposit|eviction|tenant/i],
    prompt: `You are Noah, Head of Landlord Operations at The Agentcy UK. Expert in AST contracts, Section 13 rent increase notices, tribunal challenges, deposit protection schemes, and tenant rights in England & Wales. Prefix your response with @@noah.`
  },
  miles: {
    name: 'Miles',
    role: 'Mortgage & Affordability',
    keywords: [/first.?time buyer|deposit|how much.*borrow|afford|mortgage|ltv|interest rate|lender|income multiplier/i],
    prompt: `You are Miles, Mortgage & Affordability Specialist at The Agentcy UK. Expert in UK mortgage lending, income multipliers (4-4.5x household income), LTV deposit tiers (10%, 15%, 25%), stress testing, and broker insights. Prefix your response with @@miles.`
  },
  sienna: {
    name: 'Sienna',
    role: 'Seller Strategy',
    keywords: [/sell|listing|market my|estate agent|overpricing|vendor|viewings/i],
    prompt: `You are Sienna, Seller Strategy Specialist at The Agentcy UK. Expert in vendor representation, listing strategy, photography prep, agent selection, and negotiating top-tier offers. Prefix your response with @@sienna.`
  },
  theo: {
    name: 'Theo',
    role: 'Investment Specialist',
    keywords: [/invest|yield|buy.?to.?let|btl|roi|portfolio|capital growth|stamp duty|sdlt/i],
    prompt: `You are Theo, Investment Specialist at The Agentcy UK. Expert in UK buy-to-let, gross vs net yield calculations (accounting for maintenance, management, voids, Section 24 tax), and growth postcodes. Prefix your response with @@theo.`
  },
  iris: {
    name: 'Iris',
    role: 'Transaction Prep',
    keywords: [/offer|exchange|complet|conveyanc|solicitor|survey|searches|chain|title deed/i],
    prompt: `You are Iris, Transaction Prep Specialist at The Agentcy UK. Expert in conveyancing workflows in England & Wales, search delays, chain management, survey queries, and pre-offer solicitor instruction. Prefix your response with @@iris.`
  },
  clara: {
    name: 'Clara',
    role: 'Buyer Specialist',
    keywords: [/buy|looking for|find.*(flat|house|home)|move to|commute|neighborhood|location/i],
    prompt: `You are Clara, Buyer Specialist at The Agentcy UK. Expert in search strategies, unearthing off-market options, evaluating transport/schooling trade-offs, and avoiding portal trap listings. Prefix your response with @@clara.`
  }
};

/**
  Determine specialist key based on query keywords
 */
function routeQuery(message) {
  for (const [key, spec] of Object.entries(TEAM)) {
    if (spec.keywords.some(rx => rx.test(message))) {
      return key;
    }
  }
  return null; // Aida handles directly
}

/**
  Generate AI Response using optional external LLM or rich fallback property engine
 */
async function generateResponse(message, conversationHistory = []) {
  const specialistKey = routeQuery(message);
  
  // Try Anthropic API if key configured
  if (config.ANTHROPIC_API_KEY) {
    try {
      return await callAnthropic(message, specialistKey, conversationHistory);
    } catch (err) {
      console.error('Anthropic API error, using property engine:', err.message);
    }
  }

  // Try OpenAI API if key configured
  if (config.OPENAI_API_KEY) {
    try {
      return await callOpenAI(message, specialistKey, conversationHistory);
    } catch (err) {
      console.error('OpenAI API error, using property engine:', err.message);
    }
  }

  // Built-in UK Property AI Intelligence Engine
  return generateFallbackResponse(message, specialistKey);
}

async function callAnthropic(message, specialistKey, history) {
  const spec = specialistKey ? TEAM[specialistKey] : null;
  const sysPrompt = spec 
    ? spec.prompt 
    : `You are Aida, Head of Property at The Agentcy UK. You provide clear, expert UK property advice across buying, selling, renting, letting, and investing. Keep responses engaging, practical, and formatted with markdown. Do NOT prefix with @@ unless routing to a specialist.`;

  const messages = history.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content.replace(/^@@\w+\s*/, '')
  }));
  messages.push({ role: 'user', content: message });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 600,
      system: sysPrompt,
      messages
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Anthropic error');
  let reply = data.content[0].text;
  if (specialistKey && !reply.startsWith(`@@${specialistKey}`)) {
    reply = `@@${specialistKey} ${reply}`;
  }
  return reply;
}

async function callOpenAI(message, specialistKey, history) {
  const spec = specialistKey ? TEAM[specialistKey] : null;
  const sysPrompt = spec 
    ? spec.prompt 
    : `You are Aida, Head of Property at The Agentcy UK. Provide expert UK property advice across buying, selling, renting, letting, and investing. Format with markdown.`;

  const messages = [{ role: 'system', content: sysPrompt }];
  history.forEach(m => {
    messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content.replace(/^@@\w+\s*/, '') });
  });
  messages.push({ role: 'user', content: message });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 600
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'OpenAI error');
  let reply = data.choices[0].message.content;
  if (specialistKey && !reply.startsWith(`@@${specialistKey}`)) {
    reply = `@@${specialistKey} ${reply}`;
  }
  return reply;
}

function generateFallbackResponse(message, specialistKey) {
  const q = message.toLowerCase();

  if (specialistKey === 'valentina') {
    return `@@valentina Evaluating a UK property accurately comes down to three non-negotiables: **recent Land Registry sold prices** within a 0.25-mile radius (ignoring portal asking prices which are often inflated by 5-10%), **condition and aspect** (lease terms/ground rent on flats are critical), and **local buyer depth**. If you send over your postcode, property type, and layout, I can walk you through the precise comparables shaping your valuation right now.`;
  }

  if (specialistKey === 'noah') {
    return `@@noah In England & Wales, landlords cannot arbitrarily raise rent whenever they wish. For a **periodic (month-to-month) tenancy**, your landlord must serve a formal **Section 13 notice** with at least one month's notice, and rent can only be increased once every 12 months. In a **fixed-term tenancy**, rent can only rise if a specific rent review clause exists in your tenancy agreement. If an increase exceeds local market rates, you can challenge it at the First-tier Tribunal. Tell me your tenancy type and notice details, and I will outline your exact rights.`;
  }

  if (specialistKey === 'miles') {
    return `@@miles For first-time buyers and home movers in the UK, mortgage lenders calculate borrowing capacity based on a **4 to 4.5x household income multiplier**, minus monthly loan or credit commitments. What many buyers miss is that deposit size directly dictates your rate tier: jumping from **10% LTV to 15% or 25% LTV** significantly lowers your interest rate and monthly payments. Share your combined income and deposit, and I'll lay out your realistic borrowing ceiling and monthly budget.`;
  }

  if (specialistKey === 'sienna') {
    return `@@sienna The single biggest mistake UK sellers make is selecting the estate agent who gives the highest appraisal figure. **Overpricing damages your sale position**, because maximum buyer interest occurs within the first 14 days of listing. The optimal strategy: price strictly against recent sold evidence, complete all property prep and staging prior to photography, and launch across major portals simultaneously. What stage are you currently at—just researching or preparing to list?`;
  }

  if (specialistKey === 'theo') {
    return `@@theo When evaluating a UK residential investment, gross yield quoted on listing portals is misleading. The true benchmark is **net yield after accounting for void periods, letting agent fees (8-12%), maintenance, service charges, insurance, and Section 24 tax treatment**. In current market conditions, regional hubs (e.g. Manchester, Leeds, Midlands) often offer 6-8% yields, while London focuses on long-term capital retention. Tell me your budget, target area, and financing plans, and we'll run the exact numbers.`;
  }

  if (specialistKey === 'iris') {
    return `@@iris The realistic conveyancing timeline in England & Wales ranges between **8 to 12 weeks from offer acceptance to exchange of contracts**. The most frequent bottlenecks stem from local authority search delays, management pack enquiries on leaseholds, and slow solicitor communication. To accelerate your purchase or sale by up to 3 weeks, **instruct your solicitor and complete ID checks before accepting or placing an offer**. Tell me where you are in the transaction sequence, and I'll help you navigate the next steps.`;
  }

  if (specialistKey === 'clara') {
    return `@@clara Buying a home isn't just about filtering Rightmove filters. To find the right property, focus on three key variables: your **actual weekday lifestyle** (commute duration, transport links, local amenities), your **hard budget ceiling** including Stamp Duty (SDLT), legal fees and survey costs, and what you are willing to compromise on—space, location, or property condition. Share those three factors, and I will highlight postcodes where your capital achieves maximum value.`;
  }

  return `I'm Aida, Head of Property at The Agentcy UK. Our team of specialists covers every angle of UK residential property—whether you need a **valuation check**, **mortgage borrowing guidance**, **tenancy advice**, **seller strategy**, or **conveyancing prep**. What specific property question or scenario can we help you solve today?`;
}

/**
  Generate structured summary brief for human handover
 */
function generateHandoverBrief(user, messages, note) {
  const userMsgs = messages.filter(m => m.role === 'user');
  const summaryTopics = userMsgs.map(m => m.content).slice(-5).join(' | ');

  let briefText = `**Client Name:** ${user.name}\n` +
    `**Email:** ${user.email}\n` +
    `**Total Questions Asked:** ${userMsgs.length}\n` +
    `**Primary Topics Discussed:** ${summaryTopics || 'General property guidance'}\n\n` +
    `**AI Team Handover Assessment:**\n` +
    `The consumer has completed their initial advice room session. They have discussed their property requirements with our specialist team and requested a direct follow-up from a licensed human agent. Their complete discussion transcript is preserved below for seamless onboarding.`;

  return briefText;
}

module.exports = {
  routeQuery,
  generateResponse,
  generateHandoverBrief,
  TEAM
};
