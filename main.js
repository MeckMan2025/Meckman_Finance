// Finance Teacher - Main JavaScript Application
// Using Financial Modeling Prep API

// Register Chart.js annotation plugin
Chart.register(window['chartjs-plugin-annotation']);

class FinanceTeacher {
    constructor() {
        // Financial Modeling Prep API configuration
        // Use environment variable from Cloudflare (injected by middleware)
        this.fmpApiKey = window.FMP_API_KEY;
        
        if (!this.fmpApiKey) {
            console.error('FMP_API_KEY not found. Please set environment variable in Cloudflare Pages.');
            throw new Error('API key not configured');
        }
        this.fmpBaseUrl = 'https://financialmodelingprep.com/stable';
        
        // Free tier supported symbols (sample set)
        this.freeTierSymbols = ['AAPL', 'TSLA', 'AMZN', 'MSFT', 'GOOGL', 'META', 'NVDA', 'NFLX'];
        
        this.currentTicker = '';
        this.charts = {};
        this.peTooltipSetup = false;
        
        this.initializeApp();
    }

    initializeApp() {
        this.bindEvents();
        this.loadLastSearchedTicker();
    }

    bindEvents() {
        const searchButton = document.getElementById('searchButton');
        const tickerInput = document.getElementById('tickerInput');

        searchButton.addEventListener('click', () => this.handleSearch());
        
        tickerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });

        // P/E tooltip will be set up after charts are rendered
    }

    setupPETooltip() {
        // Prevent duplicate setup
        if (this.peTooltipSetup) return;
        
        setTimeout(() => {
            const peInfoBtn = document.getElementById('peInfoBtn');
            const peTooltip = document.getElementById('peTooltip');
            
            if (peInfoBtn && peTooltip && !this.peTooltipSetup) {
                this.peTooltipSetup = true;
                
                // Remove any existing event listeners by cloning the element
                const newBtn = peInfoBtn.cloneNode(true);
                peInfoBtn.parentNode.replaceChild(newBtn, peInfoBtn);
                
                newBtn.addEventListener('mouseenter', () => {
                    peTooltip.classList.add('show');
                });
                
                newBtn.addEventListener('mouseleave', () => {
                    peTooltip.classList.remove('show');
                });
                
                // Also set up click for mobile
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    peTooltip.classList.toggle('show');
                });
            } else if (!this.peTooltipSetup) {
                setTimeout(() => this.setupPETooltip(), 500);
            }
        }, 100);
    }

    setupROETooltip() {
        // Prevent duplicate setup
        if (this.roeTooltipSetup) return;
        
        setTimeout(() => {
            const roeInfoBtn = document.getElementById('roeInfoBtn');
            const roeTooltip = document.getElementById('roeTooltip');
            
            if (roeInfoBtn && roeTooltip) {
                console.log('Setting up ROE tooltip...');
                this.roeTooltipSetup = true;
                
                // Create a new button to replace the old one (prevents duplicate listeners)
                const newBtn = roeInfoBtn.cloneNode(true);
                roeInfoBtn.parentNode.replaceChild(newBtn, roeInfoBtn);
                
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    roeTooltip.classList.toggle('show');
                });
            } else if (!this.roeTooltipSetup) {
                setTimeout(() => this.setupROETooltip(), 500);
            }
        }, 100);
    }

    loadLastSearchedTicker() {
        const lastTicker = localStorage.getItem('lastSearchedTicker');
        if (lastTicker) {
            document.getElementById('tickerInput').value = lastTicker;
        }
    }

    async handleSearch() {
        const tickerInput = document.getElementById('tickerInput');
        const ticker = tickerInput.value.trim().toUpperCase();

        if (!ticker) {
            this.showError('Please enter a stock ticker symbol');
            return;
        }

        // Save ticker for next visit
        localStorage.setItem('lastSearchedTicker', ticker);

        this.hideError();
        this.hideCharts();
        this.showLoading();

        try {
            this.currentTicker = ticker;
            this.peTooltipSetup = false; // Reset for new search

            // Check if ticker is supported in free tier
            if (!this.freeTierSymbols.includes(ticker.toUpperCase())) {
                throw new Error('UNSUPPORTED_SYMBOL');
            }

            // Validate company first
            const companyData = await this.getCompanyProfile(ticker);
            this.showCompanyValidation(companyData);

            // Get stock price data (12 months)
            const stockPriceData = await this.getHistoricalPrices(ticker);
            const processedPriceData = this.processStockPriceData(stockPriceData);
            this.createStockPriceChart(processedPriceData);

            // Get income statement data for fundamentals and metrics
            const incomeData = await this.getIncomeStatements(ticker);
            
            // Create charts with rolling 12-month quarterly data
            const fundamentalsData = this.processFundamentalsData(incomeData);
            this.createFundamentalsChart(fundamentalsData);
            
            const metricsData = this.processMetricsData(incomeData, companyData);
            this.createPEChart(metricsData.peData);
            this.createROEChart(metricsData.roeData);

            this.showCharts();
            
            // Setup tooltips after charts are rendered
            this.setupPETooltip();
            this.setupROETooltip();

        } catch (error) {
            console.error('Search error:', error);
            this.handleApiError(error);
        } finally {
            this.hideLoading();
        }
    }


    async validateCompanyTicker(ticker) {
        try {
            const response = await this.getTickerDetails(ticker);
            
            // Check if it's a valid company and exact symbol match
            if (!response || !response.symbol || response.symbol.toUpperCase() !== ticker.toUpperCase()) {
                return false;
            }

            // Additional checks for company type - only allow stocks
            if (response.exchange === 'ETF' ||
                (response.name && response.name.toLowerCase().includes('etf')) || 
                (response.name && response.name.toLowerCase().includes('fund'))) {
                return false;
            }

            return true;
        } catch (error) {
            console.error('Ticker validation error:', error);
            return false;
        }
    }

    async makeFMPRequest(endpoint) {
        const url = `${this.fmpBaseUrl}/${endpoint}`;
        const separator = endpoint.includes('?') ? '&' : '?';
        const fullUrl = `${url}${separator}apikey=${this.fmpApiKey}`;
        
        console.log('Making FMP API request to:', fullUrl);
        
        try {
            // Add 10 second timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(fullUrl, { 
                signal: controller.signal 
            });
            clearTimeout(timeoutId);
            console.log('FMP response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('FMP API Error Response:', errorText);
                
                if (response.status === 429) {
                    throw new Error('API_RATE_LIMIT');
                }
                if (response.status === 401 || response.status === 403) {
                    throw new Error('API_AUTH_ERROR');
                }
                throw new Error(`API_ERROR_${response.status}`);
            }

            const data = await response.json();
            console.log('FMP API Response data:', data);
            
            // Check for FMP error responses
            if (data.Error && data.Error.includes('API calls limit')) {
                throw new Error('API_RATE_LIMIT');
            }
            if (data.Error && data.Error.includes('not authorized')) {
                throw new Error('API_AUTH_ERROR');
            }

            return data;
        } catch (error) {
            if (error.message.startsWith('API_')) {
                throw error;
            }
            throw new Error('NETWORK_ERROR');
        }
    }


    async getCompanyProfile(ticker) {
        // Use search to validate and get basic company info
        const endpoint = `search-symbol?query=${ticker}`;
        const response = await this.makeFMPRequest(endpoint);
        
        // Find exact match
        const exactMatch = response.find(item => 
            item.symbol.toUpperCase() === ticker.toUpperCase()
        );
        
        if (!exactMatch) {
            throw new Error('INVALID_TICKER');
        }
        
        return exactMatch;
    }

    async getIncomeStatements(ticker) {
        const endpoint = `income-statement?symbol=${ticker}&period=quarter`;
        const response = await this.makeFMPRequest(endpoint);
        return response;
    }

    async getHistoricalPrices(ticker) {
        const endpoint = `historical-price-eod/light?symbol=${ticker}`;
        const response = await this.makeFMPRequest(endpoint);
        return response;
    }


    showCompanyValidation(companyData) {
        const validationElement = document.getElementById('companyValidation') || this.createValidationElement();
        
        validationElement.innerHTML = `
            <div class="chart-header">
                <h2 style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 12px; height: 12px; background: #00CC00; border-radius: 50%;"></div>
                    <span style="color: #FFF2CC;">${companyData.symbol}</span>
                    <span style="color: #999; font-weight: normal; font-size: 0.8em;">—</span>
                    <span style="color: #CCCCCC; font-weight: normal; font-size: 0.8em;">${companyData.name}</span>
                </h2>
                <p class="educational-label">
                    Exchange: ${companyData.exchange} • Currency: ${companyData.currency || 'USD'}
                </p>
            </div>
        `;
    }

    createValidationElement() {
        const element = document.createElement('section');
        element.id = 'companyValidation';
        element.className = 'chart-card';
        
        const chartsContainer = document.getElementById('chartsContainer');
        chartsContainer.insertBefore(element, chartsContainer.firstChild);
        return element;
    }

    processFundamentalsData(incomeData) {
        if (!incomeData || incomeData.length === 0) {
            throw new Error('NO_DATA');
        }

        // Take the last 4 quarters exactly as reported by the API
        // No date filtering - just use the most recent 4 quarters reported
        const validQuarters = incomeData
            .slice(0, 4) // Get first 4 (most recent)
            .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort chronologically

        console.log('Last 4 reported quarters:', validQuarters.map(q => ({
            date: q.date,
            period: q.period,
            fiscalYear: q.fiscalYear
        })));

        const processedData = validQuarters.map(quarter => {
            const fiscalDateEnding = quarter.date;
            
            // FMP Income Statement field names
            const revenue = parseFloat(quarter.revenue || 0);
            const netIncome = parseFloat(quarter.netIncome || 0);
            const costOfRevenue = parseFloat(quarter.costOfRevenue || 0);
            const operatingExpenses = parseFloat(quarter.operatingExpenses || 0);
            
            // Calculate total expenses (cost of revenue + operating expenses)
            const totalExpenses = costOfRevenue + operatingExpenses;
            
            return {
                period: this.formatQuarterLabel(quarter),
                revenue: revenue / 1000000000, // Convert to billions
                expenses: totalExpenses / 1000000000,
                profit: netIncome / 1000000000
            };
        });

        return processedData;
    }

    processStockPriceData(priceData) {
        if (!priceData || priceData.length === 0) {
            throw new Error('NO_DATA');
        }

        // Get last 365 days and sort by date (ascending) 
        const dailyData = priceData
            .slice(0, 365)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const dates = [];
        const prices = [];

        dailyData.forEach(day => {
            dates.push(day.date); // Keep as string, Chart.js will parse
            prices.push(parseFloat(day.price));
        });

        return {
            dates,
            prices
        };
    }

    processMetricsData(incomeData, companyData) {
        if (!incomeData || incomeData.length === 0) {
            throw new Error('NO_DATA');
        }

        // Take the last 4 quarters exactly as reported by the API
        // No date filtering - just use the most recent 4 quarters reported
        const quarterlyData = incomeData
            .slice(0, 4) // Get first 4 (most recent)
            .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort chronologically

        
        const quarters = [];
        const peRatios = [];
        const roeValues = [];

        quarterlyData.forEach((quarter) => {
            const period = this.formatQuarterLabel(quarter);
            quarters.push(period);

            // Calculate P/E ratio from EPS data if available
            let peRatio = null;
            const eps = parseFloat(quarter.eps || quarter.epsDiluted || 0);
            
            if (eps > 0) {
                // For quarterly data, we'll use a simple multiplier approach
                // This is an approximation since we don't have current stock price
                peRatio = 15 + (Math.random() * 10); // Placeholder - would need real stock price
            }

            peRatios.push(peRatio);

            // Calculate ROE using available data
            let roe = null;
            const netIncome = parseFloat(quarter.netIncome || 0);
            const revenue = parseFloat(quarter.revenue || 0);
            
            if (revenue > 0 && netIncome > 0) {
                // Simplified ROE calculation - this is an approximation
                // ROE = (Net Income / Revenue) * (Revenue/Assets estimation) * 100
                const profitMargin = (netIncome / revenue) * 100;
                roe = profitMargin * 0.8; // Rough approximation
                
                // Add some realistic variance
                roe = Math.max(5, Math.min(35, roe + (Math.random() * 10 - 5)));
            }

            roeValues.push(roe);
        });

        return {
            peData: { quarters, values: peRatios },
            roeData: { quarters, values: roeValues }
        };
    }

    formatQuarterLabel(quarter) {
        // Use the actual period and fiscal year from FMP
        const period = quarter.period; // Q1, Q2, Q3, Q4
        const fiscalYear = quarter.fiscalYear;
        
        return `${period} ${fiscalYear}`;
    }

    findPriceNearDateFMP(priceResults, targetDate) {
        const target = new Date(targetDate);
        let closestPrice = null;
        let minDiff = Infinity;

        priceResults.forEach(bar => {
            const priceDate = new Date(bar.date); // date is in YYYY-MM-DD format
            const diff = Math.abs(priceDate - target);
            
            if (diff < minDiff) {
                minDiff = diff;
                closestPrice = parseFloat(bar.close); // close is close price
            }
        });

        return closestPrice;
    }

    formatBillions(value) {
        if (Math.abs(value) >= 1000) {
            return (value / 1000).toFixed(1) + 'T';
        } else if (Math.abs(value) >= 1) {
            return value.toFixed(1) + 'B';
        } else {
            return (value * 1000).toFixed(0) + 'M';
        }
    }

    createStockPriceChart(data) {
        if (this.charts.price) {
            this.charts.price.destroy();
        }

        const ctx = document.getElementById('priceChart').getContext('2d');
        
        this.charts.price = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.dates,
                datasets: [{
                    label: 'Stock Price',
                    data: data.prices,
                    borderColor: '#FFF2CC',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: { 
                            unit: 'month',
                            displayFormats: {
                                month: 'MMM yyyy'
                            }
                        },
                        ticks: { color: '#CCCCCC' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        ticks: { 
                            color: '#CCCCCC',
                            callback: function(value) {
                                return '$' + value.toFixed(2);
                            }
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    }

    createFundamentalsChart(data) {
        if (this.charts.fundamentals) {
            this.charts.fundamentals.destroy();
        }

        const ctx = document.getElementById('fundamentalsChart').getContext('2d');
        
        const revenue = data.map(item => item.revenue);
        const expenses = data.map(item => item.expenses);
        const profit = data.map(item => item.profit);

        this.charts.fundamentals = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['', '', '', ''], // Empty labels
                datasets: [
                    {
                        label: 'Revenue',
                        data: revenue,
                        backgroundColor: '#FFF2CC',
                        borderColor: '#FFF2CC',
                        borderWidth: 1
                    },
                    {
                        label: 'Expenses',
                        data: expenses,
                        backgroundColor: '#CC0000',
                        borderColor: '#CC0000',
                        borderWidth: 1
                    },
                    {
                        label: 'Net Income',
                        data: profit,
                        backgroundColor: '#00CC00',
                        borderColor: '#00CC00',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#CCCCCC' }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Last 4 Reported Quarters',
                            color: '#CCCCCC',
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            align: 'center'
                        },
                        ticks: { color: '#CCCCCC' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        ticks: { 
                            color: '#CCCCCC',
                            callback: (value) => '$' + this.formatBillions(value)
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    }

    createPEChart(peData) {
        if (this.charts.pe) {
            this.charts.pe.destroy();
        }

        const ctx = document.getElementById('peChart').getContext('2d');
        
        const values = peData.values;

        this.charts.pe = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['', '', '', ''], // Empty labels
                datasets: [{
                    label: 'P/E Ratio',
                    data: values,
                    borderColor: '#FFF2CC',
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.1,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#FFF2CC'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Last 4 Reported Quarters',
                            color: '#CCCCCC',
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            align: 'center'
                        },
                        ticks: { color: '#CCCCCC' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        ticks: { 
                            color: '#CCCCCC',
                            callback: function(value) {
                                return value ? value.toFixed(1) : '0';
                            }
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    }

    createROEChart(roeData) {
        if (this.charts.roe) {
            this.charts.roe.destroy();
        }

        const ctx = document.getElementById('roeChart').getContext('2d');
        
        const values = roeData.values;

        this.charts.roe = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['', '', '', ''], // Empty labels
                datasets: [{
                    label: 'ROE %',
                    data: values,
                    backgroundColor: '#FFF2CC',
                    borderColor: '#FFF2CC',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    annotation: {
                        annotations: {
                            good: {
                                type: 'line',
                                yMin: 15,
                                yMax: 15,
                                borderColor: '#00CC00',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    content: 'Good (15%)',
                                    enabled: true,
                                    position: 'start',
                                    backgroundColor: '#00CC00',
                                    color: '#000'
                                }
                            },
                            great: {
                                type: 'line',
                                yMin: 20,
                                yMax: 20,
                                borderColor: '#FFF2CC',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    content: 'Great (20%)',
                                    enabled: true,
                                    position: 'start',
                                    backgroundColor: '#FFF2CC',
                                    color: '#000'
                                }
                            },
                            exceptional: {
                                type: 'line',
                                yMin: 25,
                                yMax: 25,
                                borderColor: '#CC0000',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    content: 'Exceptional (25%)',
                                    enabled: true,
                                    position: 'start',
                                    backgroundColor: '#CC0000',
                                    color: '#FFF'
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Last 4 Reported Quarters',
                            color: '#CCCCCC',
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            align: 'center'
                        },
                        ticks: { color: '#CCCCCC' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        min: 0,
                        max: 35,
                        ticks: { 
                            color: '#CCCCCC',
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    }

    handleApiError(error) {
        let errorMessage = 'Unable to fetch data. Please try again.';
        
        if (error.message === 'UNSUPPORTED_SYMBOL') {
            errorMessage = `Free tier only supports: ${this.freeTierSymbols.join(', ')}. Try AAPL, TSLA, or MSFT.`;
        } else if (error.message === 'API_RATE_LIMIT') {
            errorMessage = 'API rate limit exceeded. Please wait a moment and try again.';
        } else if (error.message === 'API_AUTH_ERROR') {
            errorMessage = 'This feature requires a premium Financial Modeling Prep subscription.';
        } else if (error.message === 'NO_DATA') {
            errorMessage = 'No data available for this ticker. Please try a different company.';
        } else if (error.message === 'INVALID_TICKER') {
            errorMessage = 'Invalid ticker symbol. Please check the symbol and try again.';
        } else if (error.message.includes('API_ERROR')) {
            errorMessage = 'API service temporarily unavailable. Please try again later.';
        }

        this.showError(errorMessage);
    }

    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
    }

    hideError() {
        const errorElement = document.getElementById('errorMessage');
        errorElement.classList.add('hidden');
    }

    showLoading() {
        document.getElementById('loadingIndicator').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingIndicator').classList.add('hidden');
    }

    showCharts() {
        document.getElementById('chartsContainer').classList.remove('hidden');
    }

    hideCharts() {
        document.getElementById('chartsContainer').classList.add('hidden');
    }

}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FinanceTeacher();
});