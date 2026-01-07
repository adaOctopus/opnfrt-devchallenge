/**
 * Popup UI Controller
 * Handles user interaction and displays OSINT results
 */
// UI Elements
const ipInput = document.getElementById('ipAddress');
const fetchButton = document.getElementById('fetchButton');
const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');
/**
 * Update status message
 */
function updateStatus(message, isError = false) {
    if (!statusDiv)
        return;
    statusDiv.textContent = message;
    statusDiv.className = isError ? 'error' : '';
}
/**
 * Format and display OSINT results
 */
function displayResults(data) {
    if (!resultDiv)
        return;
    if (!data || !data.sources) {
        resultDiv.innerHTML = '<p>No data available</p>';
        return;
    }
    let html = '<div class="results-container">';
    // VirusTotal Results
    if (data.sources.virustotal) {
        const vt = data.sources.virustotal;
        html += `
      <div class="source-card">
        <h3>🛡️ VirusTotal</h3>
        <div class="source-content">
          ${vt.error ? `<p class="error-text">Error: ${vt.error}</p>` : ''}
          ${vt.reputation
            ? `<p><strong>Reputation:</strong> ${vt.reputation.score}/${vt.reputation.maxScore}</p>`
            : ''}
          ${vt.country ? `<p><strong>Country:</strong> ${vt.country}</p>` : ''}
          ${vt.asn ? `<p><strong>ASN:</strong> ${vt.asn}</p>` : ''}
          ${vt.network ? `<p><strong>Network:</strong> ${vt.network}</p>` : ''}
          ${vt.lastAnalysis
            ? `<p><strong>Last Analysis:</strong> ${vt.lastAnalysis}</p>`
            : ''}
          ${vt.detection?.summary
            ? `<p><strong>Detection:</strong> ${vt.detection.summary}</p>`
            : ''}
          ${vt.url ? `<p><a href="${vt.url}" target="_blank">View on VirusTotal →</a></p>` : ''}
        </div>
      </div>
    `;
    }
    // IPInfo Results
    if (data.sources.ipinfo) {
        const ipi = data.sources.ipinfo;
        html += `
      <div class="source-card">
        <h3>🌍 IPInfo</h3>
        <div class="source-content">
          ${ipi.error ? `<p class="error-text">Error: ${ipi.error}</p>` : ''}
          ${ipi.country ? `<p><strong>Country:</strong> ${ipi.country}</p>` : ''}
          ${ipi.region ? `<p><strong>Region:</strong> ${ipi.region}</p>` : ''}
          ${ipi.city ? `<p><strong>City:</strong> ${ipi.city}</p>` : ''}
          ${ipi.postal ? `<p><strong>Postal Code:</strong> ${ipi.postal}</p>` : ''}
          ${ipi.timezone ? `<p><strong>Timezone:</strong> ${ipi.timezone}</p>` : ''}
          ${ipi.org ? `<p><strong>Organization:</strong> ${ipi.org}</p>` : ''}
          ${ipi.asn ? `<p><strong>ASN:</strong> ${ipi.asn}</p>` : ''}
          ${ipi.location ? `<p><strong>Location:</strong> ${ipi.location}</p>` : ''}
          ${ipi.url ? `<p><a href="${ipi.url}" target="_blank">View on IPInfo →</a></p>` : ''}
        </div>
      </div>
    `;
    }
    // AbuseIPDB Results
    if (data.sources.abuseipdb) {
        const abuse = data.sources.abuseipdb;
        html += `
      <div class="source-card">
        <h3>⚠️ AbuseIPDB</h3>
        <div class="source-content">
          ${abuse.error ? `<p class="error-text">Error: ${abuse.error}</p>` : ''}
          ${abuse.abuseConfidence !== null
            ? `<p><strong>Abuse Confidence:</strong> ${abuse.abuseConfidence}%</p>`
            : ''}
          ${abuse.isPublic !== null
            ? `<p><strong>Public IP:</strong> ${abuse.isPublic ? 'Yes' : 'No'}</p>`
            : ''}
          ${abuse.isWhitelisted
            ? `<p><strong>Whitelisted:</strong> Yes</p>`
            : ''}
          ${abuse.usageType
            ? `<p><strong>Usage Type:</strong> ${abuse.usageType}</p>`
            : ''}
          ${abuse.isp ? `<p><strong>ISP:</strong> ${abuse.isp}</p>` : ''}
          ${abuse.domain ? `<p><strong>Domain:</strong> ${abuse.domain}</p>` : ''}
          ${abuse.country ? `<p><strong>Country:</strong> ${abuse.country}</p>` : ''}
          ${abuse.lastReported
            ? `<p><strong>Last Reported:</strong> ${abuse.lastReported}</p>`
            : ''}
          ${abuse.reports && abuse.reports.length > 0
            ? `<p><strong>Recent Reports:</strong> ${abuse.reports.length} found</p>`
            : ''}
          ${abuse.url ? `<p><a href="${abuse.url}" target="_blank">View on AbuseIPDB →</a></p>` : ''}
        </div>
      </div>
    `;
    }
    // Errors
    if (data.errors && data.errors.length > 0) {
        html += `
      <div class="error-card">
        <h3>⚠️ Errors</h3>
        <ul>
          ${data.errors
            .map((err) => `<li>${err.source}: ${err.error}</li>`)
            .join('')}
        </ul>
      </div>
    `;
    }
    html += '</div>';
    resultDiv.innerHTML = html;
}
/**
 * Handle fetch button click
 */
if (fetchButton) {
    fetchButton.addEventListener('click', async () => {
        if (!ipInput || !fetchButton || !statusDiv || !resultDiv) {
            return;
        }
        const ipAddress = ipInput.value.trim();
        if (!ipAddress) {
            updateStatus('Please enter an IP address', true);
            return;
        }
        // Validate IP format
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ipAddress)) {
            updateStatus('Invalid IP address format', true);
            return;
        }
        // Disable button and show loading
        fetchButton.disabled = true;
        fetchButton.textContent = 'Collecting Intel...';
        resultDiv.innerHTML = '';
        updateStatus('Collecting OSINT data from multiple sources... This may take a minute.');
        try {
            // Send message to background script
            chrome.runtime.sendMessage({
                action: 'collectOSINT',
                ipAddress: ipAddress,
            }, (response) => {
                // Response might be undefined if popup was closed/reopened or timeout
                if (chrome.runtime.lastError) {
                    console.log('Message error (may be timeout):', chrome.runtime.lastError.message);
                    // Check storage for results (in case response timed out but collection completed)
                    setTimeout(() => {
                        checkForStoredResults(ipAddress);
                    }, 2000);
                    return;
                }
                if (!fetchButton)
                    return;
                fetchButton.disabled = false;
                fetchButton.textContent = 'Get Intel';
                if (response && response.success) {
                    updateStatus('Data collection complete!');
                    displayResults(response.data);
                }
                else {
                    // If no response or failed, check storage after a delay
                    if (!response) {
                        updateStatus('Collection in progress... Checking for results...');
                        setTimeout(() => {
                            checkForStoredResults(ipAddress);
                        }, 3000);
                    }
                    else {
                        updateStatus(response.error || 'Failed to collect OSINT data', true);
                    }
                }
            });
            // Also set up polling to check for results (in case response times out)
            let pollCount = 0;
            const maxPolls = 30; // Check for 30 seconds
            const pollInterval = setInterval(() => {
                pollCount++;
                if (pollCount >= maxPolls) {
                    clearInterval(pollInterval);
                    if (fetchButton && fetchButton.disabled) {
                        checkForStoredResults(ipAddress);
                    }
                    return;
                }
                checkForStoredResults(ipAddress, () => {
                    clearInterval(pollInterval);
                });
            }, 1000);
        }
        catch (error) {
            if (!fetchButton)
                return;
            fetchButton.disabled = false;
            fetchButton.textContent = 'Get Intel';
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            updateStatus(`Error: ${errorMessage}`, true);
        }
    });
}
// Allow Enter key to trigger fetch
if (ipInput && fetchButton) {
    ipInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !fetchButton.disabled) {
            fetchButton.click();
        }
    });
}
/**
 * Check for stored results (used when response times out)
 */
function checkForStoredResults(ipAddress, onSuccess) {
    chrome.storage.local.get([`osint_${ipAddress}`], (result) => {
        const data = result[`osint_${ipAddress}`];
        if (data &&
            ((data.sources && Object.keys(data.sources).length > 0) ||
                (data.errors && data.errors.length > 0))) {
            if (!fetchButton)
                return;
            fetchButton.disabled = false;
            fetchButton.textContent = 'Get Intel';
            updateStatus('Data collection complete!');
            displayResults(data);
            if (onSuccess)
                onSuccess();
        }
    });
}
// Load any previously stored results on popup open
window.addEventListener('DOMContentLoaded', () => {
    if (!ipInput)
        return;
    const currentIp = ipInput.value.trim();
    if (currentIp) {
        checkForStoredResults(currentIp);
    }
});
//# sourceMappingURL=popup.js.map