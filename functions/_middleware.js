// Cloudflare Pages Functions middleware to inject environment variables
export async function onRequest(context) {
  // Add API keys to global scope for client-side access
  const fmpApiKey = context.env.FMP_API_KEY || 'rUvinbofiFhnk3ltHYtlBiRlen1N2dOM';
  
  if (!context.env.FMP_API_KEY) {
    console.warn('FMP_API_KEY not found in environment variables, using fallback');
  }

  // For static sites, we need to inject the API keys into the HTML
  const response = await context.next();
  
  if (response.headers.get('content-type')?.includes('text/html')) {
    const html = await response.text();
    const modifiedHtml = html.replace(
      '<head>',
      `<head>
        <script>
          window.FMP_API_KEY = '${fmpApiKey}';
        </script>`
    );
    
    return new Response(modifiedHtml, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  return response;
}