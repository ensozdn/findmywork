import https from 'https';

export async function verifyCompanyCareerSite({ companyName, jobTitle }) {
  const cleanCompany = (companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanTitle = (jobTitle || '').toLowerCase();

  const knownAtsEndpoints = [
    `https://boards-api.greenhouse.io/v1/boards/${cleanCompany}/jobs`,
    `https://api.lever.co/v0/postings/${cleanCompany}?mode=json`,
    `https://jobs.ashbyhq.com/api/non-search-graphql?op=ApiJobBoardWithTeams&variables={"jobBoardName":"${cleanCompany}"}`
  ];

  for (const endpoint of knownAtsEndpoints) {
    try {
      const data = await fetchJson(endpoint);
      if (!data) continue;

      let rawJobs = [];
      if (Array.isArray(data)) rawJobs = data;
      else if (data.jobs && Array.isArray(data.jobs)) rawJobs = data.jobs;
      else if (data.data?.jobBoard?.jobPostings) rawJobs = data.data.jobBoard.jobPostings;

      if (rawJobs.length > 0) {
        const titleWords = cleanTitle.split(' ').filter(w => w.length > 2);
        const match = rawJobs.find(rj => {
          const t = (rj.title || rj.text || '').toLowerCase();
          return titleWords.some(tw => t.includes(tw));
        });

        if (match) {
          return {
            verified: true,
            atsPlatform: endpoint.includes('greenhouse') ? 'Greenhouse' : endpoint.includes('lever') ? 'Lever' : 'Ashby',
            officialUrl: match.absolute_url || match.hostedUrl || match.url || endpoint,
            totalOpenRoles: rawJobs.length,
            statusLabel: 'Resmi Kariyer Sitesinde Dogrulandi'
          };
        }

        return {
          verified: false,
          atsPlatform: 'Tespit Edildi',
          totalOpenRoles: rawJobs.length,
          statusLabel: 'Sirket ATS Kullanıyor Ancak Bu Pozisyon Listede Yok (Ghost Riski)'
        };
      }
    } catch (err) {
      continue;
    }
  }

  return {
    verified: null,
    atsPlatform: 'Bilinmiyor',
    statusLabel: 'Ozel Kariyer Portali / Dogrulama Yapilamadi'
  };
}

function fetchJson(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 }, (res) => {
      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }
      let buffer = '';
      res.on('data', chunk => buffer += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(buffer));
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

