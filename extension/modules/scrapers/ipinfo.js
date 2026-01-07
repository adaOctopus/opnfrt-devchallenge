/**
 * IPInfo OSINT Scraper
 * Extracts geolocation and network information from IPInfo using browser automation
 */

/**
 * Scrape IPInfo for IP address intelligence
 * @param {number} tabId - The tab ID to use for automation
 * @param {string} ipAddress - The IP address to investigate
 * @returns {Promise<Object>} Extracted geolocation and network data
 */
async function scrapeIPInfo(tabId, ipAddress) {
  const { createPage } = self.CDP || window.CDP;
  const page = await createPage(tabId);
  
  try {
    // Navigate to IPInfo
    const url = `https://ipinfo.io/${ipAddress}`;
    await page.goto(url);
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Wait for main content
    await page.waitForSelector('body', { timeout: 10000 });
    
    const data = {
      source: 'IPInfo',
      ip: ipAddress,
      url: url,
      country: null,
      region: null,
      city: null,
      postal: null,
      timezone: null,
      org: null,
      asn: null,
      location: null,
    };

    // Extract geolocation information
    try {
      // IPInfo displays data in a structured format
      const pageContent = await page.evaluate(`
        (function() {
          const body = document.body.innerText;
          const lines = body.split('\\n').map(l => l.trim()).filter(l => l);
          return lines;
        })()
      `);

      if (pageContent && pageContent.length > 0) {
        // Parse structured data
        for (const line of pageContent) {
          if (line.toLowerCase().includes('country') || line.match(/^[A-Z]{2}$/)) {
            data.country = line.replace(/country:/i, '').trim();
          }
          if (line.toLowerCase().includes('region') || line.toLowerCase().includes('state')) {
            data.region = line.replace(/region:|state:/i, '').trim();
          }
          if (line.toLowerCase().includes('city')) {
            data.city = line.replace(/city:/i, '').trim();
          }
          if (line.toLowerCase().includes('postal') || line.toLowerCase().includes('zip')) {
            data.postal = line.replace(/postal:|zip:/i, '').trim();
          }
          if (line.toLowerCase().includes('timezone')) {
            data.timezone = line.replace(/timezone:/i, '').trim();
          }
          if (line.toLowerCase().includes('org') || line.toLowerCase().includes('organization')) {
            data.org = line.replace(/org:|organization:/i, '').trim();
          }
          if (line.toLowerCase().includes('asn') || line.match(/^AS\\d+/i)) {
            data.asn = line.replace(/asn:/i, '').trim();
          }
        }
      }
    } catch (error) {
      console.log('Could not extract structured data:', error);
    }

    // Try to extract from specific selectors
    try {
      const countryElement = await page.textContent('[data-testid="country"], .country, [class*="country"]');
      if (countryElement) data.country = countryElement;
    } catch (error) {
      // Ignore
    }

    try {
      const cityElement = await page.textContent('[data-testid="city"], .city, [class*="city"]');
      if (cityElement) data.city = cityElement;
    } catch (error) {
      // Ignore
    }

    try {
      const orgElement = await page.textContent('[data-testid="org"], .org, [class*="org"]');
      if (orgElement) data.org = orgElement;
    } catch (error) {
      // Ignore
    }

    // Extract location coordinates if available
    try {
      const locationText = await page.evaluate(`
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
      const fullText = await page.evaluate(`
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
    return {
      source: 'IPInfo',
      ip: ipAddress,
      error: error.message,
    };
  } finally {
    await page.context.detach();
  }
}

// Export to global namespace
if (typeof window !== 'undefined') {
  window.IPInfoScraper = { scrapeIPInfo };
} else {
  self.IPInfoScraper = { scrapeIPInfo };
}

