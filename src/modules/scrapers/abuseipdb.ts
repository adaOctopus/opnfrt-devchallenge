/**
 * AbuseIPDB OSINT Scraper
 * Extracts abuse reports and reputation data from AbuseIPDB using browser automation
 */

import { createPage, Page } from '../cdp/core';
import { AbuseIPDBData } from '../../types/osint';

/**
 * Scrape AbuseIPDB for IP address intelligence
 * @param tabId - The tab ID to use for automation
 * @param ipAddress - The IP address to investigate
 * @returns Extracted abuse and reputation data
 */
export async function scrapeAbuseIPDB(
  tabId: number,
  ipAddress: string
): Promise<AbuseIPDBData> {
  console.log('[AbuseIPDB] Starting scrape for tab:', tabId);
  const page: Page = await createPage(tabId);
  console.log('[AbuseIPDB] Page created, CDP attached');

  try {
    // Navigate to AbuseIPDB
    const url: string = `https://www.abuseipdb.com/check/${ipAddress}`;
    console.log('[AbuseIPDB] Navigating to:', url);
    await page.goto(url);
    console.log('[AbuseIPDB] Navigation complete');

    // Wait for page to load
    await page.waitForTimeout(3000);
    console.log('[AbuseIPDB] Page should be loaded now');

    const data: AbuseIPDBData = {
      source: 'AbuseIPDB',
      ip: ipAddress,
      url: url,
      abuseConfidence: null,
      isPublic: null,
      isWhitelisted: undefined,
      usageType: undefined,
      isp: undefined,
      domain: undefined,
      country: undefined,
      reports: [],
      lastReported: undefined,
    };

    // Extract abuse confidence score
    try {
      const confidenceText: string | null = await page.textContent(
        '[class*="confidence"], [class*="score"], [id*="confidence"]'
      );
      if (confidenceText) {
        const match: RegExpMatchArray | null = confidenceText.match(/(\d+)%/);
        if (match && match[1]) {
          data.abuseConfidence = parseInt(match[1], 10);
        } else {
          // If no percentage found, store as null (type requires number | null)
          data.abuseConfidence = null;
        }
      }
    } catch (error) {
      console.log('Could not extract confidence score:', error);
    }

    // Extract IP status information
    try {
      const statusText: string[] = await page.evaluate<string[]>(`
        (function() {
          const statusElements = document.querySelectorAll('[class*="status"], [class*="public"], [class*="whitelist"]');
          const texts = Array.from(statusElements).map(el => el.textContent).filter(t => t);
          return texts;
        })()
      `);

      if (statusText && statusText.length > 0) {
        statusText.forEach((text: string) => {
          if (text.toLowerCase().includes('public')) {
            data.isPublic = true;
          }
          if (text.toLowerCase().includes('whitelist')) {
            data.isWhitelisted = true;
          }
        });
      }
    } catch (error) {
      console.log('Could not extract status:', error);
    }

    // Extract usage type
    try {
      const usageTypeText: string | null = await page.textContent(
        '[class*="usage"], [class*="type"]'
      );
      if (usageTypeText) {
        data.usageType = usageTypeText;
      }
    } catch (error) {
      console.log('Could not extract usage type:', error);
    }

    // Extract ISP information
    try {
      const ispText: string | null = await page.textContent(
        '[class*="isp"], [title*="ISP"]'
      );
      if (ispText) {
        data.isp = ispText;
      }
    } catch (error) {
      console.log('Could not extract ISP:', error);
    }

    // Extract domain
    try {
      const domainText: string | null = await page.textContent(
        '[class*="domain"]'
      );
      if (domainText) {
        data.domain = domainText;
      }
    } catch (error) {
      console.log('Could not extract domain:', error);
    }

    // Extract country
    try {
      const countryText: string | null = await page.textContent(
        '[class*="country"], [title*="Country"]'
      );
      if (countryText) {
        data.country = countryText;
      }
    } catch (error) {
      console.log('Could not extract country:', error);
    }

    // Extract recent reports
    try {
      const reportsText: string[] = await page.textContents(
        '[class*="report"], [class*="abuse"], table tr'
      );
      if (reportsText && reportsText.length > 0) {
        data.reports = reportsText.slice(0, 10); // Limit to 10 most recent
      }
    } catch (error) {
      console.log('Could not extract reports:', error);
    }

    // Extract last reported date
    try {
      const lastReportedText: string | null = await page.textContent(
        '[class*="last"], [class*="reported"]'
      );
      if (lastReportedText) {
        data.lastReported = lastReportedText;
      }
    } catch (error) {
      console.log('Could not extract last reported:', error);
    }

    // Get comprehensive page text
    try {
      const fullText: string = await page.evaluate<string>(`
        (function() {
          const mainContent = document.querySelector('main, [class*="content"], [id*="content"]') || document.body;
          return mainContent.innerText.substring(0, 2000);
        })()
      `);
      if (fullText) {
        data.rawContent = fullText;
      }
    } catch (error) {
      console.log('Could not extract raw content:', error);
    }

    return data;
  } catch (error) {
    console.error('AbuseIPDB scraping error:', error);
    const errorMessage: string =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      source: 'AbuseIPDB',
      ip: ipAddress,
      abuseConfidence: null,
      isPublic: null,
      reports: [],
      error: errorMessage,
    };
  } finally {
    await page.context.detach();
  }
}

// Export to global namespace for Chrome extension compatibility
interface AbuseIPDBScraperGlobal {
  scrapeAbuseIPDB: typeof scrapeAbuseIPDB;
}

declare global {
  interface Window {
    AbuseIPDBScraper: AbuseIPDBScraperGlobal;
  }
  var AbuseIPDBScraper: AbuseIPDBScraperGlobal;
}

if (typeof window !== 'undefined') {
  (window as Window).AbuseIPDBScraper = { scrapeAbuseIPDB };
} else {
  // For service worker context
  (self as any).AbuseIPDBScraper = { scrapeAbuseIPDB };
}

