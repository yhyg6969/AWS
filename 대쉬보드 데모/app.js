// AWS EC2 & Apache httpd Demo Dashboard Logic

// State management
let isInstanceRunning = true;
let isServiceRunning = true;
let trafficSpeed = 'normal'; // 'normal', 'fast', 'pause'
let uptimeSeconds = 3600; // start with 1 hour uptime
let totalRequests = 4528;
let averageLatency = 42; // ms
let currentCpu = 12.4;
let currentMem = 44.2;
let spikeTimer = null;
let spikeSecondsRemaining = 0;

// HTTP Status Code statistics
const statusStats = {
    200: 3842,
    304: 512,
    404: 120,
    500: 54
};

// Simulated assets for log generation
const clientIPs = [
    '192.168.1.15', '10.0.0.42', '54.180.12.95', '121.133.45.67', 
    '8.8.8.8', '203.252.12.3', '172.16.254.1', '110.45.211.90', 
    '182.219.4.15', '14.32.90.100', '198.51.100.12', '203.0.113.88'
];

const httpMethods = ['GET', 'GET', 'GET', 'GET', 'GET', 'POST', 'POST', 'PUT', 'DELETE'];

const webResources = [
    { path: '/', size: 10240, statusWeight: [200, 200, 200, 304, 304, 404] },
    { path: '/index.html', size: 12450, statusWeight: [200, 200, 200, 304, 304] },
    { path: '/styles.css', size: 5420, statusWeight: [200, 200, 304] },
    { path: '/app.js', size: 8940, statusWeight: [200, 200, 304] },
    { path: '/api/v1/status', size: 128, statusWeight: [200, 200, 200, 200, 500] },
    { path: '/api/v1/users', size: 2048, statusWeight: [200, 200, 404, 500] },
    { path: '/images/hero-banner.jpg', size: 245900, statusWeight: [200, 200, 304] },
    { path: '/wp-login.php', size: 0, statusWeight: [404, 404, 404] },
    { path: '/.env', size: 0, statusWeight: [404, 404, 404] },
    { path: '/contact-us', size: 4500, statusWeight: [200, 500] }
];

// Charts references
let resourceChart = null;
let statusChart = null;

// Initialize elements
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    setupEventListeners();
    
    // Main simulation loop (updates every 1 second)
    setInterval(updateLoop, 1000);
});

// Initialize Chart.js configuration
function initCharts() {
    // 1. Real-time resource line chart
    const ctxResource = document.getElementById('realtimeResourceChart').getContext('2d');
    const timeLabels = Array.from({ length: 15 }, (_, i) => {
        const d = new Date(Date.now() - (14 - i) * 1000);
        return formatTime(d);
    });

    resourceChart = new Chart(ctxResource, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: 'CPU',
                    data: Array(15).fill(12),
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: 'Memory',
                    data: Array(15).fill(44),
                    borderColor: '#a855f7',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#6b7280', font: { size: 10 } }
                },
                y: {
                    min: 0,
                    max: 100,
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#6b7280', font: { size: 10 } }
                }
            }
        }
    });

    // 2. HTTP status code distribution doughnut chart
    const ctxStatus = document.getElementById('httpdStatusChart').getContext('2d');
    statusChart = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: ['200 OK', '304 Not Modified', '404 Not Found', '500 Server Error'],
            datasets: [{
                data: [statusStats[200], statusStats[304], statusStats[404], statusStats[500]],
                backgroundColor: ['#10b981', '#60a5fa', '#f59e0b', '#ef4444'],
                borderWidth: 2,
                borderColor: '#111827',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9ca3af',
                        font: { size: 11, family: 'Inter' },
                        boxWidth: 10,
                        padding: 15
                    }
                }
            },
            cutout: '70%'
        }
    });
}

// Setup click and change handlers
function setupEventListeners() {
    // Copyable metadata click handles
    document.querySelectorAll('.copyable').forEach(el => {
        el.addEventListener('click', (e) => {
            const textToCopy = e.target.innerText;
            navigator.clipboard.writeText(textToCopy)
                .then(() => showToast(`Copied: ${textToCopy}`))
                .catch(() => showToast('Failed to copy to clipboard'));
        });
    });

    // Service Toggle Switch
    const toggleService = document.getElementById('btn-toggle-service');
    const labelService = document.getElementById('service-toggle-label');
    const badgeService = document.getElementById('httpd-status-badge');
    
    toggleService.addEventListener('change', (e) => {
        if (!isInstanceRunning) {
            // Cannot toggle service if server is offline
            toggleService.checked = false;
            showToast('Cannot manage services while EC2 is rebooting/stopped.');
            return;
        }

        isServiceRunning = e.target.checked;
        if (isServiceRunning) {
            labelService.innerText = 'Running';
            labelService.style.color = '#10b981';
            badgeService.className = 'status-badge status-active';
            badgeService.innerHTML = '<span class="status-dot"></span> Active (running)';
            appendSystemLog('[SYSTEM] Starting Apache httpd Web Server...');
            appendSystemLog('[SYSTEM] httpd started successfully. Listening on port 80.');
            showToast('Apache HTTPD started');
        } else {
            labelService.innerText = 'Stopped';
            labelService.style.color = '#ef4444';
            badgeService.className = 'status-badge status-inactive';
            badgeService.innerHTML = '<span class="status-dot"></span> Inactive (dead)';
            appendSystemLog('[SYSTEM] Stopping Apache httpd Web Server...', 'error');
            appendSystemLog('[SYSTEM] httpd stopped. Connection refused on port 80.', 'error');
            showToast('Apache HTTPD stopped', 'error');
        }
    });

    // Traffic Speed Buttons
    const speedButtons = document.querySelectorAll('.speed-btn');
    speedButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!isInstanceRunning || !isServiceRunning) {
                showToast('Start httpd service to simulate web traffic.');
                return;
            }
            
            speedButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            trafficSpeed = btn.getAttribute('data-speed');
            showToast(`Traffic rate set to: ${trafficSpeed.toUpperCase()}`);
            
            if (trafficSpeed === 'fast') {
                appendSystemLog('[TRAFFIC] High-throughput mode enabled. Simulating spike stress test.', 'warn');
            } else if (trafficSpeed === 'pause') {
                appendSystemLog('[TRAFFIC] Traffic simulation paused.');
            } else {
                appendSystemLog('[TRAFFIC] Normal traffic flow resumed.');
            }
        });
    });

    // Trigger Traffic Spike Action
    document.getElementById('btn-trigger-spike').addEventListener('click', () => {
        if (!isInstanceRunning || !isServiceRunning) {
            showToast('Start httpd service first.');
            return;
        }
        
        // Activate spike mode for 15 seconds
        spikeSecondsRemaining = 15;
        showToast('🔥 Traffic Spike Triggered!');
        appendSystemLog('[CRITICAL] ALERT: Heavy traffic spike detected on port 80! Load balancer redirecting traffic.', 'warn');
        
        // Highlight Spike button visually
        speedButtons.forEach(b => b.classList.remove('active'));
        document.querySelector('[data-speed="fast"]').classList.add('active');
        trafficSpeed = 'fast';
        
        if (spikeTimer) clearInterval(spikeTimer);
        
        spikeTimer = setInterval(() => {
            spikeSecondsRemaining--;
            if (spikeSecondsRemaining <= 0) {
                clearInterval(spikeTimer);
                showToast('Traffic Spike Ended. Returning to normal.');
                appendSystemLog('[SYSTEM] Traffic spike ended. Load stabilizer back to green.');
                
                speedButtons.forEach(b => b.classList.remove('active'));
                document.querySelector('[data-speed="normal"]').classList.add('active');
                trafficSpeed = 'normal';
            }
        }, 1000);
    });

    // Reboot EC2 Instance Action
    document.getElementById('btn-reboot').addEventListener('click', () => {
        if (!isInstanceRunning) return;
        
        isInstanceRunning = false;
        showToast('Initiating EC2 Reboot Sequence', 'warn');
        
        // Update Instance Badge to REBOOTING
        const instBadge = document.getElementById('instance-status-badge');
        instBadge.className = 'status-badge status-rebooting';
        instBadge.innerHTML = '<span class="status-dot"></span> REBOOTING';
        
        // Stop service indicators
        const badgeService = document.getElementById('httpd-status-badge');
        badgeService.className = 'status-badge status-inactive';
        badgeService.innerHTML = '<span class="status-dot"></span> Inactive (dead)';
        
        appendSystemLog('[SYSTEM] BROADCAST: System is rebooting NOW!', 'error');
        appendSystemLog('[SYSTEM] Shutting down Apache web server daemon...', 'error');
        appendSystemLog('[SYSTEM] Sending SIGTERM to process group...', 'error');
        appendSystemLog('[SYSTEM] System offline.', 'error');

        // Zero out values
        document.getElementById('val-cpu').innerText = '0.0';
        document.getElementById('bar-cpu').style.width = '0%';
        document.getElementById('val-mem').innerText = '0.0';
        document.getElementById('bar-mem').style.width = '0%';
        document.getElementById('val-mem-bytes').innerText = '0.0 GB / 4.0 GB';
        document.getElementById('val-net-in').innerText = '0.0 KB/s';
        document.getElementById('val-net-out').innerText = '0.0 KB/s';
        
        // Reboot timeout sequence
        setTimeout(() => {
            // Boot sequence
            appendSystemLog('[SYSTEM] Booting Linux Kernel 5.15.0-aws...', 'cyan');
            appendSystemLog('[SYSTEM] Mounting root filesystem...', 'cyan');
            appendSystemLog('[SYSTEM] Reached multi-user target. System initialized.', 'cyan');
            
            setTimeout(() => {
                isInstanceRunning = true;
                uptimeSeconds = 0; // Uptime resets
                
                // Restore Instance badge
                instBadge.className = 'status-badge status-running';
                instBadge.innerHTML = '<span class="status-dot"></span> RUNNING';
                
                // Auto start Apache
                if (isServiceRunning) {
                    badgeService.className = 'status-badge status-active';
                    badgeService.innerHTML = '<span class="status-dot"></span> Active (running)';
                    appendSystemLog('[SYSTEM] Service httpd successfully auto-started.');
                }
                
                showToast('EC2 Instance Rebooted Successfully');
            }, 1500);

        }, 3000);
    });

    // Clear logs button
    document.getElementById('btn-clear-logs').addEventListener('click', () => {
        const term = document.getElementById('log-terminal');
        term.innerHTML = '<div class="terminal-line system-line">[SYSTEM] Terminal logs cleared.</div>';
        showToast('Terminal logs cleared');
    });

    // Copy logs button
    document.getElementById('btn-copy-logs').addEventListener('click', () => {
        const term = document.getElementById('log-terminal');
        const logsText = term.innerText;
        navigator.clipboard.writeText(logsText)
            .then(() => showToast('Logs copied to clipboard'))
            .catch(() => showToast('Failed to copy logs'));
    });
}

// Master Loop - Runs every 1 second
function updateLoop() {
    if (!isInstanceRunning) return;

    // 1. Increment Uptime
    uptimeSeconds++;
    updateUptimeDisplay();

    // 2. Resource Simulation Logic
    simulateResources();

    // 3. Traffic Log Generation
    simulateLogs();

    // 4. Update Charts
    updateCharts();
}

// Helper to format uptime string
function updateUptimeDisplay() {
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const secs = uptimeSeconds % 60;
    
    const formattedUptime = `Uptime: ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    
    if (isServiceRunning) {
        document.getElementById('val-httpd-uptime').innerText = formattedUptime;
    } else {
        document.getElementById('val-httpd-uptime').innerText = 'Uptime: Off';
    }
}

// Simulate CPU, Memory, Network values
function simulateResources() {
    let targetCpu = 1.5; // Baseline idle
    let targetMem = 25.4; // OS baseline

    if (isServiceRunning) {
        targetMem = 44.5;
        
        if (trafficSpeed === 'normal') {
            targetCpu = 8.0 + Math.random() * 8.0; // 8% - 16%
            targetMem += Math.random() * 2.0;
        } else if (trafficSpeed === 'fast') {
            // If spike, go high stress
            targetCpu = 75.0 + Math.random() * 15.0; // 75% - 90%
            targetMem += 8.0 + Math.random() * 3.0; // more process allocation
        } else {
            // Paused traffic
            targetCpu = 3.0 + Math.random() * 2.0;
        }
    } else {
        // httpd stopped
        targetCpu = 1.5 + Math.random() * 1.5;
    }

    // Ease current values into target values
    currentCpu = lerp(currentCpu, targetCpu, 0.4);
    currentMem = lerp(currentMem, targetMem, 0.2);

    // Render Metric Cards
    document.getElementById('val-cpu').innerText = currentCpu.toFixed(1);
    document.getElementById('bar-cpu').style.width = `${currentCpu}%`;

    document.getElementById('val-mem').innerText = currentMem.toFixed(1);
    document.getElementById('bar-mem').style.width = `${currentMem}%`;
    
    const allocatedGb = (4.0 * (currentMem / 100)).toFixed(2);
    document.getElementById('val-mem-bytes').innerText = `${allocatedGb} GB / 4.0 GB`;

    // Simulate Network IO
    let netInKb = 0;
    let netOutKb = 0;

    if (isServiceRunning && trafficSpeed !== 'pause') {
        const multi = trafficSpeed === 'fast' ? 12 : 1;
        netInKb = (2.5 + Math.random() * 6.0) * multi;
        netOutKb = (12.0 + Math.random() * 45.0) * multi;
    }

    document.getElementById('val-net-in').innerText = `${netInKb.toFixed(1)} KB/s`;
    document.getElementById('val-net-out').innerText = `${netOutKb.toFixed(1)} KB/s`;
}

// Generate 가상 Apache Access Logs
function simulateLogs() {
    if (!isServiceRunning || trafficSpeed === 'pause') return;

    let logCount = 0;
    if (trafficSpeed === 'normal') {
        // Randomly generate 0, 1, or 2 logs per second
        logCount = Math.floor(Math.random() * 3);
    } else if (trafficSpeed === 'fast') {
        // Generate 12 to 20 logs per second for traffic testing
        logCount = 10 + Math.floor(Math.random() * 10);
    }

    let latenciesSum = 0;
    
    for (let i = 0; i < logCount; i++) {
        // Choose random IP, Method, and Resource
        const ip = clientIPs[Math.floor(Math.random() * clientIPs.length)];
        const method = httpMethods[Math.floor(Math.random() * httpMethods.length)];
        const res = webResources[Math.floor(Math.random() * webResources.length)];
        
        // Determine status code based on resource weightings
        const statusCode = res.statusWeight[Math.floor(Math.random() * res.statusWeight.length)];
        
        // Size
        const bytes = statusCode === 200 ? Math.floor(res.size * (0.8 + Math.random() * 0.4)) : 0;
        
        // Sim latency
        let requestLatency = 8 + Math.floor(Math.random() * 25);
        if (statusCode === 500) requestLatency += 200 + Math.floor(Math.random() * 500); // 500 takes longer
        if (trafficSpeed === 'fast') requestLatency *= 2.5; // high loads slow things down
        
        latenciesSum += requestLatency;

        // Log count update
        totalRequests++;
        statusStats[statusCode]++;

        // Form log line string
        const dateStr = formatApacheDate(new Date());
        const logLine = `${ip} - - [${dateStr}] "${method} ${res.path} HTTP/1.1" ${statusCode} ${bytes}`;
        
        appendAccessLog(logLine, statusCode);
    }

    // Render Request Stats
    if (logCount > 0) {
        const avg = Math.round(latenciesSum / logCount);
        averageLatency = Math.round(lerp(averageLatency, avg, 0.3));
        
        document.getElementById('val-httpd-reqs').innerText = totalRequests.toLocaleString();
        document.getElementById('val-httpd-latency').innerText = `${averageLatency} ms`;
    }
}

// Append typical Apache log entries with HTML coloring based on status
function appendAccessLog(logText, statusCode) {
    const terminal = document.getElementById('log-terminal');
    const logLineDiv = document.createElement('div');
    logLineDiv.className = 'terminal-line';
    
    // Format status code with styling class
    const statusSpan = `<span class="log-status-${statusCode}">${statusCode}</span>`;
    
    // Inject span
    const parts = logText.split(` ${statusCode} `);
    if (parts.length === 2) {
        logLineDiv.innerHTML = escapeHtml(parts[0]) + ` ${statusSpan} ` + escapeHtml(parts[1]);
    } else {
        logLineDiv.textContent = logText;
    }

    terminal.appendChild(logLineDiv);
    limitLogs(terminal);
    terminal.scrollTop = terminal.scrollHeight; // Auto-scroll to bottom
}

// Helper to push system notifications inside terminal log
function appendSystemLog(msg, type = 'cyan') {
    const terminal = document.getElementById('log-terminal');
    const line = document.createElement('div');
    line.className = `terminal-line ${type}-line`;
    line.textContent = msg;
    terminal.appendChild(line);
    limitLogs(terminal);
    terminal.scrollTop = terminal.scrollHeight;
}

// Keep terminal lightweight (limit to 100 lines)
function limitLogs(terminal) {
    while (terminal.childElementCount > 100) {
        terminal.removeChild(terminal.firstElementChild);
    }
}

// Update charts with new metrics
function updateCharts() {
    if (!resourceChart || !statusChart) return;

    // 1. Update line chart (Resources)
    const datasets = resourceChart.data.datasets;
    const labels = resourceChart.data.labels;

    // Push new values
    labels.push(formatTime(new Date()));
    datasets[0].data.push(isInstanceRunning ? Number(currentCpu.toFixed(1)) : 0);
    datasets[1].data.push(isInstanceRunning ? Number(currentMem.toFixed(1)) : 0);

    // Keep array size constant to 15
    if (labels.length > 15) {
        labels.shift();
        datasets[0].data.shift();
        datasets[1].data.shift();
    }

    resourceChart.update('none'); // Update without full animation rendering for performance

    // 2. Update doughnut chart (Statuses)
    statusChart.data.datasets[0].data = [
        statusStats[200],
        statusStats[304],
        statusStats[404],
        statusStats[500]
    ];
    statusChart.update('none');
}

// Show user feedback toast messages
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMsg = toast.querySelector('.toast-message');
    const toastIcon = toast.querySelector('.toast-icon');

    toastMsg.innerText = message;
    
    // Set icon base on context
    if (type === 'warn') {
        toastIcon.setAttribute('data-lucide', 'alert-triangle');
        toastIcon.style.color = '#f59e0b';
    } else if (type === 'error') {
        toastIcon.setAttribute('data-lucide', 'x-circle');
        toastIcon.style.color = '#ef4444';
    } else {
        toastIcon.setAttribute('data-lucide', 'info');
        toastIcon.style.color = '#06b6d4';
    }
    
    lucide.createIcons(); // refresh lucide toast icon
    
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Utility functions
function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

function formatTime(date) {
    return date.toTimeString().split(' ')[0];
}

function formatApacheDate(date) {
    // Expected output format: 29/Jun/2026:15:00:01 +0900
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const time = formatTime(date);
    
    // Simple timezone offset calculation
    const offsetMin = date.getTimezoneOffset();
    const offsetSign = offsetMin <= 0 ? '+' : '-';
    const offsetHours = String(Math.abs(Math.floor(offsetMin / 60))).padStart(2, '0');
    const offsetMins = String(Math.abs(offsetMin % 60)).padStart(2, '0');
    const tz = `${offsetSign}${offsetHours}${offsetMins}`;

    return `${day}/${month}/${year}:${time} ${tz}`;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
