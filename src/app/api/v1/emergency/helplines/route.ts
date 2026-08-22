/**
 * CyberShield India — Emergency Helplines API
 * GET /api/v1/emergency/helplines
 *
 * Returns verified official India emergency helpline numbers.
 * Public endpoint — no authentication required.
 * 
 * IMPORTANT: These numbers are verified official GOI helplines.
 * Do not add unverified numbers without official authorization.
 */

import { PRODUCT } from '@/lib/config';

const HELPLINES = [
  {
    number: '112',
    label: 'National Emergency',
    description: 'Police, Fire, Ambulance — single unified emergency number',
    category: 'emergency',
    available: '24/7',
  },
  {
    number: '1930',
    label: 'Cyber Crime Helpline',
    description: 'National Cybercrime Reporting Portal helpline. Report online fraud, phishing, and cybercrime.',
    category: 'cybercrime',
    available: '24/7',
    website: 'https://cybercrime.gov.in',
  },
  {
    number: '181',
    label: 'Women Helpline',
    description: 'Women in distress — domestic violence, harassment, stalking, cybercrime against women.',
    category: 'women_safety',
    available: '24/7',
  },
  {
    number: '1098',
    label: 'Childline',
    description: 'Child protection helpline — abuse, exploitation, missing children, child labour.',
    category: 'child_safety',
    available: '24/7',
    website: 'https://www.childlineindia.org',
  },
  {
    number: '14448',
    label: 'Senior Citizen Helpline',
    description: 'Elderly assistance — abuse, fraud, medical help, legal aid for senior citizens.',
    category: 'elderly',
    available: '24/7',
  },
  {
    number: '100',
    label: 'Police',
    description: 'Police emergency line.',
    category: 'emergency',
    available: '24/7',
  },
  {
    number: '108',
    label: 'Ambulance',
    description: 'Medical emergency ambulance service.',
    category: 'emergency',
    available: '24/7',
  },
  {
    number: '1091',
    label: 'Women Helpline (Police)',
    description: 'Police women helpline for immediate safety assistance.',
    category: 'women_safety',
    available: '24/7',
  },
];

const REPORTING_PORTALS = [
  {
    name: 'National Cybercrime Reporting Portal',
    url: 'https://cybercrime.gov.in',
    description: 'File cybercrime complaints online. Available for financial fraud, social media crime, and other cyber offences.',
  },
  {
    name: 'I4C — Indian Cyber Crime Coordination Centre',
    url: 'https://i4c.mha.gov.in',
    description: 'Ministry of Home Affairs initiative for cybercrime coordination.',
  },
];

export async function GET() {
  return Response.json({
    success: true,
    data: {
      helplines: HELPLINES,
      reportingPortals: REPORTING_PORTALS,
      disclaimer: 'CyberShield is an independent cybersecurity platform. We are not affiliated with any government organization. These are publicly available emergency numbers. For official complaints, please use the government portals listed above.',
      lastVerified: '2026-08-01',
      source: PRODUCT.name,
    },
  }, {
    headers: {
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800', // Cache for 24h
    },
  });
}
