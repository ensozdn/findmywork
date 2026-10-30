import https from 'https';

export async function fetchLinkedInGuestJobs(keyword = 'Full Stack', location = 'Turkey') {
  return new Promise((resolve) => {
    const encodedKeyword = encodeURIComponent(keyword);
    const encodedLocation = encodeURIComponent(location);
    const path = `/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodedKeyword}&location=${encodedLocation}&start=0`;

    const options = {
      hostname: 'www.linkedin.com',
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*' + String.fromCharCode(47) + '*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        resolve([]);
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const jobs = [];
        const cardRegex = /<div[^>]*class="[^"]*base-search-card[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
        const titleRegex = /<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/h3>/i;
        const companyRegex = /<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>[\s\S]*?(?:<a[^>]*>)?\s*([\s\S]*?)\s*(?:<\/a>)?\s*<\/h4>/i;
        const locationRegex = /<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/span>/i;
        const linkRegex = /<a[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]+)"/i;

        let match;
        while ((match = cardRegex.exec(data)) !== null) {
          const cardHtml = match[1];
          const titleMatch = titleRegex.exec(cardHtml);
          const compMatch = companyRegex.exec(cardHtml);
          const locMatch = locationRegex.exec(cardHtml);
          const linkMatch = linkRegex.exec(cardHtml);

          if (titleMatch && compMatch && linkMatch) {
            const cleanTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
            const cleanComp = compMatch[1].replace(/<[^>]+>/g, '').trim();
            const cleanLoc = locMatch ? locMatch[1].replace(/<[^>]+>/g, '').trim() : location;
            const cleanLink = linkMatch[1].split('?')[0];

            jobs.push({
              title: cleanTitle,
              company: cleanComp,
              meta: `${cleanLoc} · LinkedIn`,
              description: `${cleanTitle} at ${cleanComp}`,
              isEasyApply: false,
              hiringManagerName: null,
              url: cleanLink,
              platform: 'LinkedIn'
            });
          }
        }

        resolve(jobs);
      });
    });

    req.on('error', () => resolve([]));
    req.on('timeout', () => {
      req.destroy();
      resolve([]);
    });
    req.end();
  });
}
