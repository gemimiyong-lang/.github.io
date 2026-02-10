
// App State
let stocks = [];
let chartInstance = null;

// DOM Elements
const form = document.getElementById('stock-form');
const totalAmountEl = document.getElementById('total-amount');
const stockListEl = document.getElementById('stock-list');
const allocationCtx = document.getElementById('allocationChart').getContext('2d');
const historyCtx = document.getElementById('historyChart').getContext('2d');
const tickerInput = document.getElementById('ticker');
const nameInput = document.getElementById('stock-name'); // New input for name

// Constants
const STORAGE_KEY = 'dividend_app_data';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderAll();
    setupAutoFetch();
    registerServiceWorker();
});

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW Registered', reg))
            .catch(err => console.log('SW Failed', err));
    }
}


// --- Event Listeners ---
form.addEventListener('submit', (e) => {
    e.preventDefault();
    addStock();
});

// --- Core Functions ---

function addStock() {
    const ticker = tickerInput.value.trim().toUpperCase();
    const quantity = parseFloat(document.getElementById('quantity').value);
    const dividend = parseFloat(document.getElementById('dividend').value);
    // Use name from input or default to ticker
    const stockName = nameInput.value.trim() || ticker;

    if (!ticker || isNaN(quantity) || isNaN(dividend)) return;

    // Check if stock already exists, if so update it
    const existingIndex = stocks.findIndex(s => s.ticker === ticker);

    // History Tracking
    const now = new Date().toISOString();
    const historyEntry = {
        date: now,
        dividend: dividend
    };

    if (existingIndex >= 0) {
        // Update existing
        // Check for dividend change for history
        if (stocks[existingIndex].dividendPerShare !== dividend) {
            if (!stocks[existingIndex].history) stocks[existingIndex].history = [];
            stocks[existingIndex].history.push(historyEntry);
        }

        stocks[existingIndex].name = stockName; // Update name
        stocks[existingIndex].quantity = quantity;
        stocks[existingIndex].dividendPerShare = dividend;
        stocks[existingIndex].updatedAt = now;
    } else {
        // Add new
        const newStock = {
            id: Date.now().toString(),
            ticker,
            name: stockName,
            quantity,
            dividendPerShare: dividend,
            createdAt: now,
            updatedAt: now,
            history: [historyEntry]
        };
        stocks.push(newStock);
    }

    saveData();
    renderAll();
    form.reset();
}

function deleteStock(id) {
    if (confirm('削除しますか？')) {
        stocks = stocks.filter(s => s.id !== id);
        saveData();
        renderAll();
    }
}

function calculateTotal() {
    return stocks.reduce((sum, stock) => {
        return sum + (stock.quantity * stock.dividendPerShare);
    }, 0);
}

// --- Rendering ---

function renderAll() {
    renderList();
    renderTotal();
    renderAllocationChart();
    renderHistoryChart();
}

function renderList() {
    stockListEl.innerHTML = '';
    stocks.forEach(stock => {
        const total = Math.round(stock.quantity * stock.dividendPerShare);
        const displayName = stock.name || stock.ticker;
        const li = document.createElement('li');
        li.className = 'stock-item';
        li.innerHTML = `
            <div class="stock-info">
                <span class="stock-ticker">${displayName} <small>(${stock.ticker})</small></span>
                <span class="stock-details">${stock.quantity}株 x ¥${stock.dividendPerShare}</span>
            </div>
            <div class="stock-dividend">
                +¥${total.toLocaleString()}
            </div>
            <button class="delete-btn" onclick="deleteStock('${stock.id}')">✕</button>
        `;
        stockListEl.appendChild(li);
    });
}

function renderTotal() {
    const total = calculateTotal();
    totalAmountEl.textContent = Math.round(total).toLocaleString();
}

function renderAllocationChart() {
    if (stocks.length === 0) {
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        return;
    }

    const labels = stocks.map(s => s.name || s.ticker);
    const data = stocks.map(s => s.quantity * s.dividendPerShare);
    const backgroundColors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
        '#E7E9ED', '#76D7C4', '#F1948A', '#85C1E9'
    ];

    if (chartInstance) {
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = data;
        chartInstance.update();
    } else {
        chartInstance = new Chart(allocationCtx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#e0e0e0' }
                    }
                }
            }
        });
    }
}

// --- History Chart ---
let historyChartInstance = null;

function renderHistoryChart() {
    // Prepare data for history chart
    // We need to aggregate total dividend over time.
    // For this simple version, we'll just plot the CURRENT total dividend as the latest point
    // and maybe mock past points if we had real historical data.
    // To make this meaningful with the current data structure, let's track the "growth" based on
    // the explicit history entries in each stock.

    // 1. Collect all unique dates from all stock histories
    const allDates = new Set();
    stocks.forEach(s => {
        if (s.history) s.history.forEach(h => allDates.add(h.date));
    });

    // Sort dates
    const sortedDates = Array.from(allDates).sort();

    if (sortedDates.length === 0 && stocks.length > 0) {
        // If no history but stocks exist, use current time
        sortedDates.push(new Date().toISOString());
    }

    // 2. Calculate total dividend at each date point
    // This is tricky because "history" only records CHANGES.
    // We need to replay the state.

    // Simplified approach for V1:
    // Just show the current total vs. "Projected" or just show the current breakdown?
    // User asked for "Dividend History (Growth)".
    // Let's create a simplified history based on distinct updates.

    const historyPoints = sortedDates.map(date => {
        let totalAtDate = 0;
        stocks.forEach(s => {
            // Find the dividend value applicable at this date
            // Use the latest history entry that is <= date
            if (s.history) {
                const relevantHistory = s.history
                    .filter(h => h.date <= date)
                    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

                const dividend = relevantHistory ? relevantHistory.dividend : s.dividendPerShare;
                totalAtDate += (s.quantity * dividend);
            } else {
                totalAtDate += (s.quantity * s.dividendPerShare);
            }
        });
        return Math.round(totalAtDate);
    });

    // Format dates for display (YYYY/MM/DD)
    const displayDates = sortedDates.map(d => new Date(d).toLocaleDateString());

    if (historyChartInstance) {
        historyChartInstance.data.labels = displayDates;
        historyChartInstance.data.datasets[0].data = historyPoints;
        historyChartInstance.update();
    } else {
        historyChartInstance = new Chart(historyCtx, {
            type: 'line',
            data: {
                labels: displayDates,
                datasets: [{
                    label: '年間配当金総額',
                    data: historyPoints,
                    borderColor: '#03dac6',
                    backgroundColor: 'rgba(3, 218, 198, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#a0a0a0' }, grid: { color: '#333' } },
                    y: { ticks: { color: '#a0a0a0' }, grid: { color: '#333' } }
                },
                plugins: {
                    legend: { labels: { color: '#e0e0e0' } },
                    tooltip: { mode: 'index', intersect: false }
                }
            }
        });
    }
}

// --- Auto Fetch ---

function setupAutoFetch() {
    tickerInput.addEventListener('blur', async () => {
        const ticker = tickerInput.value.trim();
        if (!ticker) return;

        // Visual feedback
        const originalPlaceholder = nameInput.placeholder;
        nameInput.placeholder = "取得中...";
        nameInput.value = ""; // Clear previous

        try {
            // Attempt to fetch from Yahoo Finance via a CORS proxy or direct if possible (unlikely for Japan)
            // Since we can't easily use a proxy without a backend, we will try a very simple JSON mapping for major stocks
            // or just rely on a simple heuristic/mock for now as per plan.
            // Actually, let's try a simple fetch from a public API if available.
            // For now, let's implement a "Mock/Best Effort" that recognizes some famous codes for demo satisfaction.

            const stockName = await fetchStockName(ticker);
            if (stockName) {
                nameInput.value = stockName;
            } else {
                nameInput.placeholder = "名称を入力";
            }
        } catch (e) {
            console.error(e);
            nameInput.placeholder = "名称を入力";
        }
    });
}

// Mock database for common Japanese stocks (since real API needs backend)
const STOCK_DB = {
    '7203': 'トヨタ自動車',
    '8306': '三菱UFJフィナンシャルG',
    '9432': '日本電信電話',
    '9984': 'ソフトバンクグループ',
    '2914': '日本たばこ産業',
    '8058': '三菱商事',
    '8316': '三井住友フィナンシャルG',
    '9433': 'KDDI',
    '6758': 'ソニーグループ',
    '6861': 'キーエンス'
};

async function fetchStockName(ticker) {
    // 1. Check local "database" of popular stocks
    if (STOCK_DB[ticker]) {
        return STOCK_DB[ticker];
    }

    // 2. Fallback: If we had a real API, we would call it here.
    // For now, return null to let user enter it.
    return null;
}


// --- Storage ---

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stocks));
}

function loadData() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        stocks = JSON.parse(data);
    }
}
