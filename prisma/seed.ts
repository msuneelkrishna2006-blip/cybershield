import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Database...');

  // 1. Seed Threat Categories
  const categories = [
    {
      slug: 'FINANCIAL_FRAUD',
      nameEn: 'Financial Fraud',
      nameHi: 'वित्तीय धोखाधड़ी',
      severity: 'MEDIUM',
      description: 'Scams aimed at extracting money through deception.',
      children: [
        { slug: 'UPI_FRAUD', nameEn: 'UPI Fraud', nameHi: 'यूपीआई धोखाधड़ी', severity: 'MEDIUM' },
        { slug: 'OTP_FRAUD', nameEn: 'OTP Fraud', nameHi: 'ओटीपी धोखाधड़ी', severity: 'MEDIUM' },
        { slug: 'KYC_FRAUD', nameEn: 'KYC Fraud', nameHi: 'केवाईसी धोखाधड़ी', severity: 'MEDIUM' },
        { slug: 'BANK_IMPERSONATION', nameEn: 'Bank Impersonation', nameHi: 'बैंक प्रतिरूपण', severity: 'MEDIUM' },
        { slug: 'INVESTMENT_SCAM', nameEn: 'Investment Scam', nameHi: 'निवेश घोटाला', severity: 'MEDIUM' },
        { slug: 'LOAN_APP_FRAUD', nameEn: 'Loan App Fraud', nameHi: 'ऋण ऐप धोखाधड़ी', severity: 'HIGH' },
        { slug: 'INSURANCE_FRAUD', nameEn: 'Insurance Fraud', nameHi: 'बीमा धोखाधड़ी', severity: 'MEDIUM' },
      ]
    },
    {
      slug: 'IMPERSONATION',
      nameEn: 'Impersonation',
      nameHi: 'प्रतिरूपण',
      severity: 'HIGH',
      description: 'Scams involving impersonating officials or trusted entities.',
      children: [
        { slug: 'DIGITAL_ARREST', nameEn: 'Digital Arrest', nameHi: 'डिजिटल अरेस्ट', severity: 'CRITICAL' },
        { slug: 'GOVERNMENT_IMPERSONATION', nameEn: 'Government Impersonation', nameHi: 'सरकारी प्रतिरूपण', severity: 'HIGH' },
        { slug: 'COURIER_SCAM', nameEn: 'Courier Scam', nameHi: 'कूरियर घोटाला', severity: 'MEDIUM' },
        { slug: 'CUSTOMER_CARE_FRAUD', nameEn: 'Customer Care Fraud', nameHi: 'ग्राहक सेवा धोखाधड़ी', severity: 'MEDIUM' },
        { slug: 'SOCIAL_MEDIA_IMPERSONATION', nameEn: 'Social Media Impersonation', nameHi: 'सोशल मीडिया प्रतिरूपण', severity: 'MEDIUM' },
        { slug: 'DEEPFAKE_AI_IMPERSONATION', nameEn: 'Deepfake/AI Impersonation', nameHi: 'डीपफेक/एआई प्रतिरूपण', severity: 'HIGH' },
      ]
    },
    {
      slug: 'EMPLOYMENT',
      nameEn: 'Employment Scams',
      nameHi: 'रोजगार घोटाले',
      severity: 'MEDIUM',
      description: 'Scams offering fake jobs or task-based rewards.',
      children: [
        { slug: 'FAKE_JOB', nameEn: 'Fake Job Offer', nameHi: 'फर्जी नौकरी का प्रस्ताव', severity: 'MEDIUM' },
        { slug: 'TASK_FRAUD', nameEn: 'Task Fraud', nameHi: 'टास्क धोखाधड़ी', severity: 'MEDIUM' },
      ]
    },
    {
      slug: 'SOCIAL_ENGINEERING',
      nameEn: 'Social Engineering',
      nameHi: 'सोशल इंजीनियरिंग',
      severity: 'MEDIUM',
      description: 'Manipulating individuals into compromising security.',
      children: [
        { slug: 'PHISHING', nameEn: 'Phishing', nameHi: 'फिशिंग', severity: 'MEDIUM' },
        { slug: 'SMISHING', nameEn: 'Smishing', nameHi: 'स्मिशिंग', severity: 'MEDIUM' },
        { slug: 'VISHING', nameEn: 'Vishing', nameHi: 'विशिंग', severity: 'MEDIUM' },
        { slug: 'ROMANCE_SCAM', nameEn: 'Romance Scam', nameHi: 'रोमांस घोटाला', severity: 'MEDIUM' },
        { slug: 'MATRIMONIAL_FRAUD', nameEn: 'Matrimonial Fraud', nameHi: 'वैवाहिक धोखाधड़ी', severity: 'MEDIUM' },
        { slug: 'DELIVERY_SCAM', nameEn: 'Delivery Scam', nameHi: 'डिलीवरी घोटाला', severity: 'MEDIUM' },
      ]
    },
    {
      slug: 'MALWARE',
      nameEn: 'Malware & Tech Threats',
      nameHi: 'मैलवेयर',
      severity: 'HIGH',
      description: 'Threats involving malicious software or illicit access.',
      children: [
        { slug: 'MALICIOUS_APK', nameEn: 'Malicious APK', nameHi: 'हानिकारक एपीके', severity: 'HIGH' },
        { slug: 'RANSOMWARE', nameEn: 'Ransomware', nameHi: 'रैनसमवेयर', severity: 'CRITICAL' },
        { slug: 'REMOTE_ACCESS_SCAM', nameEn: 'Remote Access Scam', nameHi: 'रिमोट एक्सेस घोटाला', severity: 'HIGH' },
        { slug: 'SCREEN_SHARING_FRAUD', nameEn: 'Screen Sharing Fraud', nameHi: 'स्क्रीन शेयरिंग धोखाधड़ी', severity: 'HIGH' },
      ]
    },
    {
      slug: 'CHILD_SAFETY',
      nameEn: 'Child Safety',
      nameHi: 'बाल सुरक्षा',
      severity: 'HIGH',
      description: 'Threats directed at children or minors.',
      children: [
        { slug: 'GROOMING', nameEn: 'Grooming', nameHi: 'ग्रूमिंग', severity: 'CRITICAL' },
        { slug: 'COERCION', nameEn: 'Coercion', nameHi: 'दबाव/जबरदस्ती', severity: 'HIGH' },
        { slug: 'EXPLOITATION', nameEn: 'Exploitation', nameHi: 'शोषण', severity: 'CRITICAL' },
        { slug: 'CYBERBULLYING', nameEn: 'Cyberbullying', nameHi: 'साइबर बुलिंग', severity: 'HIGH' },
      ]
    },
    {
      slug: 'HARASSMENT',
      nameEn: 'Harassment & Privacy',
      nameHi: 'उत्पीड़न और गोपनीयता',
      severity: 'HIGH',
      description: 'Online harassment, stalking, or privacy violations.',
      children: [
        { slug: 'CYBERSTALKING', nameEn: 'Cyberstalking', nameHi: 'साइबर स्टॉकिंग', severity: 'HIGH' },
        { slug: 'SEXTORTION', nameEn: 'Sextortion', nameHi: 'सेक्सटॉर्शन', severity: 'CRITICAL' },
        { slug: 'BLACKMAIL', nameEn: 'Blackmail', nameHi: 'ब्लैकमेल', severity: 'HIGH' },
        { slug: 'IDENTITY_THEFT', nameEn: 'Identity Theft', nameHi: 'पहचान की चोरी', severity: 'HIGH' },
      ]
    }
  ];

  for (const parent of categories) {
    const parentRecord = await prisma.threatCategory.upsert({
      where: { slug: parent.slug },
      update: {
        nameEn: parent.nameEn,
        nameHi: parent.nameHi,
        severity: parent.severity,
        description: parent.description,
      },
      create: {
        slug: parent.slug,
        nameEn: parent.nameEn,
        nameHi: parent.nameHi,
        severity: parent.severity,
        description: parent.description,
      },
    });

    if (parent.children && parent.children.length > 0) {
      for (const child of parent.children) {
        await prisma.threatCategory.upsert({
          where: { slug: child.slug },
          update: {
            nameEn: child.nameEn,
            nameHi: child.nameHi,
            severity: child.severity,
            parentId: parentRecord.id,
          },
          create: {
            slug: child.slug,
            nameEn: child.nameEn,
            nameHi: child.nameHi,
            severity: child.severity,
            parentId: parentRecord.id,
          },
        });
      }
    }
  }

  // 2. Seed Feature Flags
  const flags = [
    { key: 'ai_scanning_enabled', enabled: true },
    { key: 'child_safety_module', enabled: true },
    { key: 'women_safety_module', enabled: true },
    { key: 'elderly_mode', enabled: true },
    { key: 'browser_extension_api', enabled: false },
    { key: 'threat_feed_ingestion', enabled: false },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { enabled: flag.enabled },
      create: { key: flag.key, enabled: flag.enabled },
    });
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
