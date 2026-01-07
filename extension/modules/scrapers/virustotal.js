/**
 * VirusTotal OSINT Scraper
 * Extracts threat intelligence data from VirusTotal using browser automation
 */

/**
 * Scrape VirusTotal for IP address intelligence
 * @param {number} tabId - The tab ID to use for automation
 * @param {string} ipAddress - The IP address to investigate
 * @returns {Promise<Object>} Extracted threat intelligence data
 */
async function scrapeVirusTotal(tabId, ipAddress) {
  const { createPage } = self.CDP || window.CDP;
  const page = await createPage(tabId);
  
  try {
    // Navigate to VirusTotal IP search
    const url = `https://www.virustotal.com/gui/ip-address/${ipAddress}`;
    await page.goto(url);
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Wait for main content to appear
    await page.waitForSelector('vt-ui-main-generic-report', { timeout: 10000 });
    
    // Scroll to ensure content is loaded
    await page.scrollTo('vt-ui-main-generic-report');
    await page.waitForTimeout(1000);
    
    const data = {
      source: 'VirusTotal',
      ip: ipAddress,
      url: url,
      detection: {},
      reputation: null,
      lastAnalysis: null,
      country: null,
      asn: null,
      network: null,
    };

    // Extract reputation score
    try {
      const reputationText = await page.textContent('vt-ui-reputation-widget');
      if (reputationText) {
        const match = reputationText.match(/(\d+)\s*\/\s*(\d+)/);
        if (match) {
          data.reputation = {
            score: parseInt(match[1]),
            maxScore: parseInt(match[2]),
          };
        }
      }
    } catch (error) {
      console.log('Could not extract reputation:', error);
    }

    // Extract detection engines results
    try {
      const detectionElements = await page.textContents('vt-ui-detections-widget, vt-ui-generic-card');
      if (detectionElements && detectionElements.length > 0) {
        data.detection.summary = detectionElements.join(' ');
      }
    } catch (error) {
      console.log('Could not extract detection info:', error);
    }

    // Extract last analysis date
    try {
      const lastAnalysisText = await page.textContent('[class*="last-analysis"], [class*="analysis"]');
      if (lastAnalysisText) {
        data.lastAnalysis = lastAnalysisText;
      }
    } catch (error) {
      console.log('Could not extract last analysis:', error);
    }

    // Extract country information
    try {
      const countryText = await page.textContent('[class*="country"], [title*="Country"]');
      if (countryText) {
        data.country = countryText;
      }
    } catch (error) {
      console.log('Could not extract country:', error);
    }

    // Extract ASN information
    try {
      const asnText = await page.textContent('[class*="asn"], [title*="ASN"]');
      if (asnText) {
        data.asn = asnText;
      }
    } catch (error) {
      console.log('Could not extract ASN:', error);
    }

    // Extract network information
    try {
      const networkInfo = await page.evaluate(`
        (function() {
          const elements = Array.from(document.querySelectorAll('vt-ui-generic-card, [class*="network"]'));
          const texts = elements.map(el => el.textContent).filter(t => t && t.length > 0);
          return texts.slice(0, 3).join(' | ');
        })()
      `);
      if (networkInfo) {
        data.network = networkInfo;
      }
    } catch (error) {
      console.log('Could not extract network info:', error);
    }

    // Get comprehensive page text for additional context
    try {
      const pageText = await page.evaluate(`
        (function() {
          const mainContent = document.querySelector('vt-ui-main-generic-report');
          return mainContent ? mainContent.innerText.substring(0, 2000) : '';
        })()
      `);
      if (pageText) {
        data.rawContent = pageText;
      }
    } catch (error) {
      console.log('Could not extract raw content:', error);
    }

    return data;
  } catch (error) {
    console.error('VirusTotal scraping error:', error);
    return {
      source: 'VirusTotal',
      ip: ipAddress,
      error: error.message,
    };
  } finally {
    await page.context.detach();
  }
}

// Export to global namespace
if (typeof window !== 'undefined') {
  window.VirusTotalScraper = { scrapeVirusTotal };
} else {
  self.VirusTotalScraper = { scrapeVirusTotal };
}

