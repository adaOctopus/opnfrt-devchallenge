/**
 * IPInfo OSINT Scraper
 * Extracts geolocation and network information from IPInfo using browser automation
 */

import { createPage, Page } from '../cdp/core';
import { IPInfoData } from '../../types/osint';

/**
 * Scrape IPInfo for IP address intelligence
 * @param tabId - The tab ID to use for automation
 * @param ipAddress - The IP address to investigate
 * @returns Extracted geolocation and network data
 */
export async function scrapeIPInfo(
  tabId: number,
  ipAddress: string
): Promise<IPInfoData> {
  console.log('[IPInfo] Starting scrape for tab:', tabId);
  const page: Page = await createPage(tabId);
  console.log('[IPInfo] Page created, CDP attached');

  try {
    // Navigate to IPInfo
    const url: string = `https://ipinfo.io/${ipAddress}`;
    console.log('[IPInfo] Navigating to:', url);
    await page.goto(url);
    console.log('[IPInfo] Navigation complete');

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Wait for main content
    await page.waitForSelector('body', { timeout: 10000 });
    console.log('[IPInfo] Body loaded');

    const data: IPInfoData = {
      source: 'IPInfo',
      ip: ipAddress,
      url: url,
      country: undefined,
      region: undefined,
      city: undefined,
      postal: undefined,
      timezone: undefined,
      org: undefined,
      asn: undefined,
      location: undefined,
    };

    // Extract geolocation information
    try {
      // IPInfo displays data in a structured format
      const pageContent: string[] = await page.evaluate<string[]>(`
        (function() {
          const body = document.body.innerText;
          const lines = body.split('\\n').map(l => l.trim()).filter(l => l);
          return lines;
        })()
      `);

      if (pageContent && pageContent.length > 0) {
        // Parse structured data
        for (const line of pageContent) {
          if (
            line.toLowerCase().includes('country') ||
            line.match(/^[A-Z]{2}$/)
          ) {
            data.country = line.replace(/country:/i, '').trim();
          }
          if (
            line.toLowerCase().includes('region') ||
            line.toLowerCase().includes('state')
          ) {
            data.region = line.replace(/region:|state:/i, '').trim();
          }
          if (line.toLowerCase().includes('city')) {
            data.city = line.replace(/city:/i, '').trim();
          }
          if (
            line.toLowerCase().includes('postal') ||
            line.toLowerCase().includes('zip')
          ) {
            data.postal = line.replace(/postal:|zip:/i, '').trim();
          }
          if (line.toLowerCase().includes('timezone')) {
            data.timezone = line.replace(/timezone:/i, '').trim();
          }
          if (
            line.toLowerCase().includes('org') ||
            line.toLowerCase().includes('organization')
          ) {
            data.org = line.replace(/org:|organization:/i, '').trim();
          }
          if (line.toLowerCase().includes('asn') || line.match(/^AS\d+/i)) {
            data.asn = line.replace(/asn:/i, '').trim();
          }
        }
      }
    } catch (error) {
      console.log('Could not extract structured data:', error);
    }

    // Try to extract from specific selectors
    try {
      const countryElement: string | null = await page.textContent(
        '[data-testid="country"], .country, [class*="country"]'
      );
      if (countryElement) data.country = countryElement;
    } catch (error) {
      // Ignore
    }

    try {
      const cityElement: string | null = await page.textContent(
        '[data-testid="city"], .city, [class*="city"]'
      );
      if (cityElement) data.city = cityElement;
    } catch (error) {
      // Ignore
    }

    try {
      const orgElement: string | null = await page.textContent(
        '[data-testid="org"], .org, [class*="org"]'
      );
      if (orgElement) data.org = orgElement;
    } catch (error) {
      // Ignore
    }

    // Extract location coordinates if available
    try {
      const locationText: string = await page.evaluate<string>(`
        (function() {
          const locElements = document.querySelectorAll('[class*="location"], [class*="coordinates"], [class*="lat"], [class*="lng"]');
          const texts = Array.from(locElements).map(el => el.textContent).filter(t => t);
          return texts.join(', ');
        })()
      `);
      if (locationText) {
        data.location = locationText;
      }
    } catch (error) {
      console.log('Could not extract location:', error);
    }

    // Get comprehensive page text
    try {
      const fullText: string = await page.evaluate<string>(`
        (function() {
          return document.body.innerText.substring(0, 2000);
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
    console.error('IPInfo scraping error:', error);
    const errorMessage: string =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      source: 'IPInfo',
      ip: ipAddress,
      error: errorMessage,
    };
  } finally {
    await page.context.detach();
  }
}

// Export to global namespace for Chrome extension compatibility
interface IPInfoScraperGlobal {
  scrapeIPInfo: typeof scrapeIPInfo;
}

declare global {
  interface Window {
    IPInfoScraper: IPInfoScraperGlobal;
  }
  var IPInfoScraper: IPInfoScraperGlobal;
}

if (typeof window !== 'undefined') {
  (window as Window).IPInfoScraper = { scrapeIPInfo };
} else {
  // For service worker context
  (self as any).IPInfoScraper = { scrapeIPInfo };
}

