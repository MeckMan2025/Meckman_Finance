# Finance Teacher

A simple, visual web-based finance learning app that helps students understand how a company's performance and valuation change over time.

## Features

- **Stock Price History**: 12-month line graph showing price trends
- **Company Fundamentals**: Revenue, expenses, and profit visualization  
- **P/E Ratio Analysis**: Valuation metrics with educational tooltips
- **ROE Tracking**: Return on equity performance with benchmark lines

## Tech Stack

- Vanilla HTML, CSS, JavaScript
- Chart.js for data visualization
- Financial Modeling Prep API for financial data
- Cloudflare Pages for deployment

## Setup

### Local Development

1. **Copy config template**:
   ```bash
   cp config.example.js config.js
   ```

2. **Get API key**: Sign up at [Financial Modeling Prep](https://financialmodelingprep.com/) for a free API key

3. **Update config**: Edit `config.js` and replace `YOUR_FMP_API_KEY_HERE` with your actual API key

4. **Start server**:
   ```bash
   python3 -m http.server 8000
   # Open http://localhost:8000
   ```

**Testing:**
1. Enter a supported stock ticker (see list below)
2. Click "Search" to view financial data
3. Click info buttons (ⓘ) for explanations

### Cloudflare Pages Deployment

1. Push code to GitHub (config.js will be ignored via .gitignore)
2. Connect repository to Cloudflare Pages
3. Set environment variable `FMP_API_KEY` in Cloudflare dashboard
4. Deploy

## Supported Tickers (Free Tier)

AAPL, TSLA, AMZN, MSFT, GOOGL, META, NVDA, NFLX

*Note: Free tier has limited symbol support*

## Design

Built with the Meckman Design System featuring:
- Dark theme with precision-focused UI
- Charcoal panels with tan accents
- Mobile-first responsive design
- Educational labels for financial concepts

---

*Powered by Financial Modeling Prep — Educational use only, not investment advice.*

<!-- API key configuration update - trigger deployment -->