/**
 * AbuseIPDB OSINT Scraper
 * Extracts abuse reports and reputation data from AbuseIPDB using browser automation
 */
/**
 * Scrape AbuseIPDB for IP address intelligence
 * @param tabId - The tab ID to use for automation
 * @param ipAddress - The IP address to investigate
 * @returns Extracted abuse and reputation data
 */
async function scrapeAbuseIPDB(tabId, ipAddress) {
    const page = await createPage(tabId);
    try {
        // Navigate to AbuseIPDB
        const url = `https://www.abuseipdb.com/check/${ipAddress}`;
        await page.goto(url);
        // Wait for page to load
        await page.waitForTimeout(2000);
        // Wait for main content
        await page.waitForSelector('body', { timeout: 10000 });
        const data = {
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
            const confidenceText = await page.textContent('[class*="confidence"], [class*="score"], [id*="confidence"]');
            if (confidenceText) {
                const match = confidenceText.match(/(\d+)%/);
                if (match && match[1]) {
                    data.abuseConfidence = parseInt(match[1], 10);
                }
                else {
                    // If no percentage found, store as null (type requires number | null)
                    data.abuseConfidence = null;
                }
            }
        }
        catch (error) {
            console.log('Could not extract confidence score:', error);
        }
        // Extract IP status information
        try {
            const statusText = await page.evaluate(`
        (function() {
          const statusElements = document.querySelectorAll('[class*="status"], [class*="public"], [class*="whitelist"]');
          const texts = Array.from(statusElements).map(el => el.textContent).filter(t => t);
          return texts;
        })()
      `);
            if (statusText && statusText.length > 0) {
                statusText.forEach((text) => {
                    if (text.toLowerCase().includes('public')) {
                        data.isPublic = true;
                    }
                    if (text.toLowerCase().includes('whitelist')) {
                        data.isWhitelisted = true;
                    }
                });
            }
        }
        catch (error) {
            console.log('Could not extract status:', error);
        }
        // Extract usage type
        try {
            const usageTypeText = await page.textContent('[class*="usage"], [class*="type"]');
            if (usageTypeText) {
                data.usageType = usageTypeText;
            }
        }
        catch (error) {
            console.log('Could not extract usage type:', error);
        }
        // Extract ISP information
        try {
            const ispText = await page.textContent('[class*="isp"], [title*="ISP"]');
            if (ispText) {
                data.isp = ispText;
            }
        }
        catch (error) {
            console.log('Could not extract ISP:', error);
        }
        // Extract domain
        try {
            const domainText = await page.textContent('[class*="domain"]');
            if (domainText) {
                data.domain = domainText;
            }
        }
        catch (error) {
            console.log('Could not extract domain:', error);
        }
        // Extract country
        try {
            const countryText = await page.textContent('[class*="country"], [title*="Country"]');
            if (countryText) {
                data.country = countryText;
            }
        }
        catch (error) {
            console.log('Could not extract country:', error);
        }
        // Extract recent reports
        try {
            const reportsText = await page.textContents('[class*="report"], [class*="abuse"], table tr');
            if (reportsText && reportsText.length > 0) {
                data.reports = reportsText.slice(0, 10); // Limit to 10 most recent
            }
        }
        catch (error) {
            console.log('Could not extract reports:', error);
        }
        // Extract last reported date
        try {
            const lastReportedText = await page.textContent('[class*="last"], [class*="reported"]');
            if (lastReportedText) {
                data.lastReported = lastReportedText;
            }
        }
        catch (error) {
            console.log('Could not extract last reported:', error);
        }
        // Get comprehensive page text
        try {
            const fullText = await page.evaluate(`
        (function() {
          const mainContent = document.querySelector('main, [class*="content"], [id*="content"]') || document.body;
          return mainContent.innerText.substring(0, 2000);
        })()
      `);
            if (fullText) {
                data.rawContent = fullText;
            }
        }
        catch (error) {
            console.log('Could not extract raw content:', error);
        }
        return data;
    }
    catch (error) {
        console.error('AbuseIPDB scraping error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            source: 'AbuseIPDB',
            ip: ipAddress,
            abuseConfidence: null,
            isPublic: null,
            reports: [],
            error: errorMessage,
        };
    }
    finally {
        await page.context.detach();
    }
}
if (typeof window !== 'undefined') {
    window.AbuseIPDBScraper = { scrapeAbuseIPDB };
}
else {
    // For service worker context
    self.AbuseIPDBScraper = { scrapeAbuseIPDB };
}
//# sourceMappingURL=abuseipdb.js.map