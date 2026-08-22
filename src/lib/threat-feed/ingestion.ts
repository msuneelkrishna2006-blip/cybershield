/**
 * CyberShield India — Threat Feed Ingestion Service
 *
 * Abstracts multiple threat intelligence feed sources.
 * Normalizes IOC data into ThreatIndicator records.
 */

import { prisma } from '@/lib/prisma';

/** Supported IOC types */
export type IocType = 'URL' | 'DOMAIN' | 'IP' | 'PHONE' | 'UPI_ID' | 'HASH' | 'PATTERN' | 'KEYWORD';

/** Normalized indicator from any feed source */
export interface NormalizedIndicator {
  type: IocType;
  value: string;
  source: string;
  confidence: number;
  categorySlug?: string;
}

/** Feed source abstraction */
export interface ThreatFeedSource {
  name: string;
  fetchIndicators(): Promise<NormalizedIndicator[]>;
}

/**
 * CERT-In Advisory Feed (placeholder)
 * In production: would parse CERT-In RSS/API feeds
 */
export const certInFeed: ThreatFeedSource = {
  name: 'CERT-In',
  async fetchIndicators(): Promise<NormalizedIndicator[]> {
    // TODO: Implement actual CERT-In RSS parser
    // https://www.cert-in.org.in/
    console.log('[ThreatFeed] CERT-In feed fetch (placeholder)');
    return [];
  },
};

/**
 * PhishTank Feed (placeholder)
 * In production: would use PhishTank API with key
 */
export const phishTankFeed: ThreatFeedSource = {
  name: 'PhishTank',
  async fetchIndicators(): Promise<NormalizedIndicator[]> {
    // TODO: Implement PhishTank API integration
    // https://phishtank.org/developer_info.php
    console.log('[ThreatFeed] PhishTank feed fetch (placeholder)');
    return [];
  },
};

/**
 * URLhaus Feed (placeholder)
 * In production: would parse URLhaus CSV dump
 */
export const urlhausFeed: ThreatFeedSource = {
  name: 'URLhaus',
  async fetchIndicators(): Promise<NormalizedIndicator[]> {
    // TODO: Implement URLhaus CSV parser
    // https://urlhaus.abuse.ch/api/
    console.log('[ThreatFeed] URLhaus feed fetch (placeholder)');
    return [];
  },
};

/** All registered feed sources */
export const FEED_SOURCES: ThreatFeedSource[] = [
  certInFeed,
  phishTankFeed,
  urlhausFeed,
];

/**
 * Ingests indicators from all feed sources into the database.
 * Uses upsert to avoid duplicates.
 */
export async function ingestThreatFeeds(): Promise<{
  ingested: number;
  updated: number;
  errors: number;
}> {
  let ingested = 0;
  let updated = 0;
  let errors = 0;

  for (const source of FEED_SOURCES) {
    try {
      const indicators = await source.fetchIndicators();
      
      for (const ioc of indicators) {
        try {
          // Check if already exists
          const existing = await prisma.threatIndicator.findFirst({
            where: { type: ioc.type, value: ioc.value },
          });

          if (existing) {
            // Update confidence if new source has higher confidence
            await prisma.threatIndicator.update({
              where: { id: existing.id },
              data: {
                confidence: Math.max(existing.confidence, ioc.confidence),
                active: true,
              },
            });
            updated++;
          } else {
            // Look up category
            let categoryId: string | null = null;
            if (ioc.categorySlug) {
              const cat = await prisma.threatCategory.findUnique({
                where: { slug: ioc.categorySlug },
              });
              if (cat) categoryId = cat.id;
            }

            await prisma.threatIndicator.create({
              data: {
                type: ioc.type,
                value: ioc.value,
                source: ioc.source,
                confidence: ioc.confidence,
                categoryId,
              },
            });
            ingested++;
          }
        } catch (e) {
          errors++;
          console.error(`[ThreatFeed] Error ingesting ${ioc.type}:${ioc.value}:`, e);
        }
      }
    } catch (e) {
      errors++;
      console.error(`[ThreatFeed] Error fetching from ${source.name}:`, e);
    }
  }

  return { ingested, updated, errors };
}

/**
 * Checks if a value exists in the threat indicator database.
 * Returns matching indicators with confidence scores.
 */
export async function checkIndicator(
  type: IocType,
  value: string
): Promise<{
  found: boolean;
  indicators: Array<{
    id: string;
    type: string;
    value: string;
    confidence: number;
    source: string;
    category?: string;
  }>;
  maxConfidence: number;
}> {
  const indicators = await prisma.threatIndicator.findMany({
    where: {
      type,
      value,
      active: true,
    },
    include: {
      category: { select: { nameEn: true, severity: true } },
    },
  });

  return {
    found: indicators.length > 0,
    indicators: indicators.map(i => ({
      id: i.id,
      type: i.type,
      value: i.value,
      confidence: i.confidence,
      source: i.source,
      category: i.category?.nameEn,
    })),
    maxConfidence: indicators.reduce((max, i) => Math.max(max, i.confidence), 0),
  };
}
