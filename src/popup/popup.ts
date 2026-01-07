/**
 * Popup UI Controller
 * Handles user interaction and displays OSINT results
 */

import { OSINTResults, MessageRequest, MessageResponse } from '../types/osint';

// UI Elements
const ipInput: HTMLInputElement | null = document.getElementById(
  'ipAddress'
) as HTMLInputElement | null;
const fetchButton: HTMLButtonElement | null = document.getElementById(
  'fetchButton'
) as HTMLButtonElement | null;
const statusDiv: HTMLDivElement | null = document.getElementById(
  'status'
) as HTMLDivElement | null;
const resultDiv: HTMLDivElement | null = document.getElementById(
  'result'
) as HTMLDivElement | null;

/**
 * Update status message
 */
function updateStatus(message: string, isError: boolean = false): void {
  if (!statusDiv) return;
  statusDiv.textContent = message;
  statusDiv.className = isError ? 'error' : '';
}

/**
 * Format and display OSINT results
 */
function displayResults(data: OSINTResults | null | undefined): void {
  if (!resultDiv) return;

  if (!data || !data.sources) {
    resultDiv.innerHTML = '<p>No data available</p>';
    return;
  }

  let html: string = '<div class="results-container">';

  // VirusTotal Results
  if (data.sources.virustotal) {
    const vt = data.sources.virustotal;
    html += `
      <div class="source-card">
        <h3>🛡️ VirusTotal</h3>
        <div class="source-content">
          ${vt.error ? `<p class="error-text">Error: ${vt.error}</p>` : ''}
          ${
            vt.reputation
              ? `<p><strong>Reputation:</strong> ${vt.reputation.score}/${vt.reputation.maxScore}</p>`
              : ''
          }
          ${vt.country ? `<p><strong>Country:</strong> ${vt.country}</p>` : ''}
          ${vt.asn ? `<p><strong>ASN:</strong> ${vt.asn}</p>` : ''}
          ${vt.network ? `<p><strong>Network:</strong> ${vt.network}</p>` : ''}
          ${
            vt.lastAnalysis
              ? `<p><strong>Last Analysis:</strong> ${vt.lastAnalysis}</p>`
              : ''
          }
          ${
            vt.detection?.summary
              ? `<p><strong>Detection:</strong> ${vt.detection.summary}</p>`
              : ''
          }
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
          ${
            abuse.abuseConfidence !== null
              ? `<p><strong>Abuse Confidence:</strong> ${abuse.abuseConfidence}%</p>`
              : ''
          }
          ${
            abuse.isPublic !== null
              ? `<p><strong>Public IP:</strong> ${abuse.isPublic ? 'Yes' : 'No'}</p>`
              : ''
          }
          ${
            abuse.isWhitelisted
              ? `<p><strong>Whitelisted:</strong> Yes</p>`
              : ''
          }
          ${
            abuse.usageType
              ? `<p><strong>Usage Type:</strong> ${abuse.usageType}</p>`
              : ''
          }
          ${abuse.isp ? `<p><strong>ISP:</strong> ${abuse.isp}</p>` : ''}
          ${abuse.domain ? `<p><strong>Domain:</strong> ${abuse.domain}</p>` : ''}
          ${abuse.country ? `<p><strong>Country:</strong> ${abuse.country}</p>` : ''}
          ${
            abuse.lastReported
              ? `<p><strong>Last Reported:</strong> ${abuse.lastReported}</p>`
              : ''
          }
          ${
            abuse.reports && abuse.reports.length > 0
              ? `<p><strong>Recent Reports:</strong> ${abuse.reports.length} found</p>`
              : ''
          }
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
  fetchButton.addEventListener('click', async (): Promise<void> => {
    if (!ipInput || !fetchButton || !statusDiv || !resultDiv) {
      return;
    }

    const ipAddress: string = ipInput.value.trim();

    if (!ipAddress) {
      updateStatus('Please enter an IP address', true);
      return;
    }

    // Validate IP format
    const ipRegex: RegExp =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ipAddress)) {
      updateStatus('Invalid IP address format', true);
      return;
    }

    // Disable button and show loading
    fetchButton.disabled = true;
    fetchButton.textContent = 'Collecting Intel...';
    resultDiv.innerHTML = '';
    updateStatus(
      'Collecting OSINT data from multiple sources... This may take a minute.'
    );

    try {
      // Send message to background script
      chrome.runtime.sendMessage(
        {
          action: 'collectOSINT',
          ipAddress: ipAddress,
        } as MessageRequest,
        (response: MessageResponse | undefined) => {
          if (!fetchButton) return;

          fetchButton.disabled = false;
          fetchButton.textContent = 'Get Intel';

          if (chrome.runtime.lastError) {
            updateStatus(
              `Error: ${chrome.runtime.lastError.message}`,
              true
            );
            return;
          }

          if (response && response.success) {
            updateStatus('Data collection complete!');
            displayResults(response.data);
          } else {
            updateStatus(
              response?.error || 'Failed to collect OSINT data',
              true
            );
          }
        }
      );
    } catch (error) {
      if (!fetchButton) return;

      fetchButton.disabled = false;
      fetchButton.textContent = 'Get Intel';
      const errorMessage: string =
        error instanceof Error ? error.message : 'Unknown error';
      updateStatus(`Error: ${errorMessage}`, true);
    }
  });
}

// Allow Enter key to trigger fetch
if (ipInput && fetchButton) {
  ipInput.addEventListener('keypress', (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && !fetchButton.disabled) {
      fetchButton.click();
    }
  });
}

// Load any previously stored results on popup open
window.addEventListener('DOMContentLoaded', (): void => {
  if (!ipInput) return;

  const currentIp: string = ipInput.value.trim();
  if (currentIp) {
    chrome.runtime.sendMessage(
      {
        action: 'getStoredResults',
        ipAddress: currentIp,
      } as MessageRequest,
      (response: MessageResponse | undefined) => {
        if (response && response.success && response.data) {
          displayResults(response.data);
          updateStatus('Loaded previous results');
        }
      }
    );
  }
});

