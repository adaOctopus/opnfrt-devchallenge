// Import modules using importScripts (Chrome extension compatible)
importScripts(
  'modules/cdp/core.js',
  'modules/scrapers/virustotal.js',
  'modules/scrapers/ipinfo.js',
  'modules/scrapers/abuseipdb.js'
);

/**
 * Background Service Worker
 * Orchestrates OSINT data collection from multiple sources using CDP automation
 *
 * Note: After compilation, this file will need importScripts() calls added
 * for Chrome extension service worker compatibility. The TypeScript imports
 * will be compiled to JavaScript, but service workers require importScripts.
 */
/**
 * Create a non-active tab for scraping
 */
async function createScrapingTab(url) {
    return new Promise((resolve, reject) => {
        chrome.tabs.create({
            url: url,
            active: false, // Non-active tab as per requirements
        }, (tab) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            if (!tab || !tab.id) {
                reject(new Error('Failed to create tab'));
                return;
            }
            resolve(tab);
        });
    });
}
/**
 * Wait for tab to be fully loaded
 */
async function waitForTabLoad(tabId) {
    return new Promise((resolve) => {
        const listener = (updatedTabId, changeInfo) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                // Additional wait for dynamic content
                setTimeout(resolve, 2000);
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
        // Check if already loaded
        chrome.tabs.get(tabId, (tab) => {
            if (tab.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                setTimeout(resolve, 2000);
            }
        });
    });
}
/**
 * Close a tab
 */
async function closeTab(tabId) {
    return new Promise((resolve) => {
        chrome.tabs.remove(tabId, () => {
            resolve();
        });
    });
}
/**
 * Collect OSINT data from all sources
 */
async function collectOSINTData(ipAddress) {
    console.log('[OSINT] Starting collection for IP:', ipAddress);
    const results = {
        ip: ipAddress,
        timestamp: new Date().toISOString(),
        sources: {},
        errors: [],
    };
    // Create tabs for each source
    const tabs = {
        virustotal: null,
        ipinfo: null,
        abuseipdb: null,
    };
    try {
        // Create all tabs first
        console.log('[OSINT] Creating tabs...');
        tabs.virustotal = await createScrapingTab(`https://www.virustotal.com/gui/ip-address/${ipAddress}`);
        console.log('[OSINT] VirusTotal tab created:', tabs.virustotal.id);
        tabs.ipinfo = await createScrapingTab(`https://ipinfo.io/${ipAddress}`);
        console.log('[OSINT] IPInfo tab created:', tabs.ipinfo.id);
        tabs.abuseipdb = await createScrapingTab(`https://www.abuseipdb.com/check/${ipAddress}`);
        console.log('[OSINT] AbuseIPDB tab created:', tabs.abuseipdb.id);
        // Wait for all tabs to load
        console.log('[OSINT] Waiting for tabs to load...');
        await Promise.all([
            tabs.virustotal.id && waitForTabLoad(tabs.virustotal.id),
            tabs.ipinfo.id && waitForTabLoad(tabs.ipinfo.id),
            tabs.abuseipdb.id && waitForTabLoad(tabs.abuseipdb.id),
        ]);
        console.log('[OSINT] All tabs loaded, starting scraping...');
        // Scrape data from each source in parallel
        const scrapingPromises = [];
        if (tabs.virustotal?.id) {
            console.log('[OSINT] Starting VirusTotal scrape...');
            scrapingPromises.push(VirusTotalScraper.scrapeVirusTotal(tabs.virustotal.id, ipAddress)
                .then((data) => {
                console.log('[OSINT] VirusTotal scrape complete:', data);
                results.sources.virustotal = data;
            })
                .catch((error) => {
                console.error('[OSINT] VirusTotal scrape error:', error);
                results.errors.push({
                    source: 'VirusTotal',
                    error: error.message,
                });
            }));
        }
        if (tabs.ipinfo?.id) {
            console.log('[OSINT] Starting IPInfo scrape...');
            scrapingPromises.push(IPInfoScraper.scrapeIPInfo(tabs.ipinfo.id, ipAddress)
                .then((data) => {
                console.log('[OSINT] IPInfo scrape complete:', data);
                results.sources.ipinfo = data;
            })
                .catch((error) => {
                console.error('[OSINT] IPInfo scrape error:', error);
                results.errors.push({
                    source: 'IPInfo',
                    error: error.message,
                });
            }));
        }
        if (tabs.abuseipdb?.id) {
            console.log('[OSINT] Starting AbuseIPDB scrape...');
            scrapingPromises.push(AbuseIPDBScraper.scrapeAbuseIPDB(tabs.abuseipdb.id, ipAddress)
                .then((data) => {
                console.log('[OSINT] AbuseIPDB scrape complete:', data);
                results.sources.abuseipdb = data;
            })
                .catch((error) => {
                console.error('[OSINT] AbuseIPDB scrape error:', error);
                results.errors.push({
                    source: 'AbuseIPDB',
                    error: error.message,
                });
            }));
        }
        console.log('[OSINT] Waiting for all scrapes to complete...');
        await Promise.all(scrapingPromises);
        console.log('[OSINT] All scrapes complete. Results:', results);
        // Store results in chrome.storage.local
        await new Promise((resolve) => {
            chrome.storage.local.set({ [`osint_${ipAddress}`]: results }, () => {
                console.log('[OSINT] Results stored in chrome.storage.local');
                resolve();
            });
        });
        return results;
    }
    catch (error) {
        console.error('OSINT collection error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push({ source: 'Orchestration', error: errorMessage });
        return results;
    }
    finally {
        // Close all tabs
        const closePromises = [];
        if (tabs.virustotal?.id) {
            closePromises.push(closeTab(tabs.virustotal.id));
        }
        if (tabs.ipinfo?.id) {
            closePromises.push(closeTab(tabs.ipinfo.id));
        }
        if (tabs.abuseipdb?.id) {
            closePromises.push(closeTab(tabs.abuseipdb.id));
        }
        await Promise.all(closePromises);
    }
}
/**
 * Handle messages from popup
 */
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'collectOSINT') {
        const ipAddress = request.ipAddress;
        if (!ipAddress) {
            sendResponse({
                success: false,
                error: 'IP address is required',
            });
            return false;
        }
        // Validate IP address format
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ipAddress)) {
            sendResponse({
                success: false,
                error: 'Invalid IP address format',
            });
            return false;
        }
        // Start collection process
        console.log('[Background] Received collectOSINT request for:', ipAddress);
        collectOSINTData(ipAddress)
            .then((results) => {
            console.log('[Background] Collection complete, sending response');
            sendResponse({
                success: true,
                data: results,
            });
        })
            .catch((error) => {
            console.error('[Background] Collection failed:', error);
            sendResponse({
                success: false,
                error: error.message,
            });
        });
        // Return true to indicate async response
        return true;
    }
    if (request.action === 'getStoredResults') {
        const ipAddress = request.ipAddress;
        if (!ipAddress) {
            sendResponse({
                success: false,
                error: 'IP address is required',
            });
            return false;
        }
        chrome.storage.local.get([`osint_${ipAddress}`], (result) => {
            sendResponse({
                success: true,
                data: result[`osint_${ipAddress}`] || null,
            });
        });
        return true;
    }
    return false;
});
// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('PostEvent OSINT Extension installed');
});
//# sourceMappingURL=background.js.map