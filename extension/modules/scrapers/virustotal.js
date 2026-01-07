/**
 * VirusTotal OSINT Scraper
 * Extracts threat intelligence data from VirusTotal using browser automation
 */
/**
 * Scrape VirusTotal for IP address intelligence
 * @param tabId - The tab ID to use for automation
 * @param ipAddress - The IP address to investigate
 * @returns Extracted threat intelligence data
 */
async function scrapeVirusTotal(tabId, ipAddress) {
    console.log('[VirusTotal] Starting scrape for tab:', tabId);
    const page = await CDP.createPage(tabId);
    console.log('[VirusTotal] CDP.Page created, CDP attached');
    try {
        // Navigate to VirusTotal IP search
        const url = `https://www.virustotal.com/gui/ip-address/${ipAddress}`;
        console.log('[VirusTotal] Navigating to:', url);
        await page.goto(url);
        console.log('[VirusTotal] Navigation complete');
        // Wait for page to load
        await page.waitForTimeout(3000);
        // Wait for main content to appear (with fallback if selector doesn't exist)
        try {
            await page.waitForSelector('vt-ui-main-generic-report', { timeout: 15000 });
            console.log('[VirusTotal] Main selector found');
        }
        catch (error) {
            console.log('[VirusTotal] Main selector not found, continuing anyway...');
            // Don't wait for body - it should already exist
            await page.waitForTimeout(2000);
        }
        // Scroll to ensure content is loaded
        await page.scrollTo('vt-ui-main-generic-report');
        await page.waitForTimeout(1000);
        const data = {
            source: 'VirusTotal',
            ip: ipAddress,
            url: url,
            detection: {},
            reputation: undefined,
            lastAnalysis: undefined,
            country: undefined,
            asn: undefined,
            network: undefined,
        };
        // Get page content first to see what's available
        const pageText = await page.evaluate(`
      (function() {
        return document.body ? document.body.innerText.substring(0, 5000) : '';
      })()
    `);
        console.log('[VirusTotal] CDP.Page text sample:', pageText.substring(0, 200));
        // Extract reputation score
        try {
            const reputationText = await page.textContent('vt-ui-reputation-widget');
            if (reputationText) {
                const match = reputationText.match(/(\d+)\s*\/\s*(\d+)/);
                if (match && match[1] && match[2]) {
                    data.reputation = {
                        score: parseInt(match[1], 10),
                        maxScore: parseInt(match[2], 10),
                    };
                }
            }
        }
        catch (error) {
            console.log('Could not extract reputation:', error);
        }
        // Extract detection engines results
        try {
            const detectionElements = await page.textContents('vt-ui-detections-widget, vt-ui-generic-card');
            if (detectionElements && detectionElements.length > 0) {
                if (!data.detection) {
                    data.detection = {};
                }
                data.detection.summary = detectionElements.join(' ');
            }
        }
        catch (error) {
            console.log('Could not extract detection info:', error);
        }
        // Extract last analysis date
        try {
            const lastAnalysisText = await page.textContent('[class*="last-analysis"], [class*="analysis"]');
            if (lastAnalysisText) {
                data.lastAnalysis = lastAnalysisText;
            }
        }
        catch (error) {
            console.log('Could not extract last analysis:', error);
        }
        // Extract country information
        try {
            const countryText = await page.textContent('[class*="country"], [title*="Country"]');
            if (countryText) {
                data.country = countryText;
            }
        }
        catch (error) {
            console.log('Could not extract country:', error);
        }
        // Extract ASN information
        try {
            const asnText = await page.textContent('[class*="asn"], [title*="ASN"]');
            if (asnText) {
                data.asn = asnText;
            }
        }
        catch (error) {
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
        }
        catch (error) {
            console.log('Could not extract network info:', error);
        }
        // Store the page text we already extracted
        if (pageText) {
            data.rawContent = pageText;
        }
        console.log('[VirusTotal] Scrape complete, returning data:', data);
        return data;
    }
    catch (error) {
        console.error('[VirusTotal] Scraping error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            source: 'VirusTotal',
            ip: ipAddress,
            error: errorMessage,
        };
    }
    finally {
        console.log('[VirusTotal] Detaching CDP context');
        await page.context.detach();
    }
}
if (typeof window !== 'undefined') {
    window.VirusTotalScraper = { scrapeVirusTotal };
}
else {
    // For service worker context
    self.VirusTotalScraper = { scrapeVirusTotal };
}
//# sourceMappingURL=virustotal.js.map