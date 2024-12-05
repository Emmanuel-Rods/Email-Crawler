const axios = require("axios");
const cheerio = require("cheerio");

const MAX_DEPTH = 2; 
const CONCURRENT_LIMIT = 5; 


const extractEmails = (html) => {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const matches = html.match(emailRegex);
  
    if (!matches) return [];
    const validEmails = matches.filter((email) => {
      const excludedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'];
      return !excludedExtensions.some((ext) => email.toLowerCase().endsWith(ext));
    });
    return Array.from(new Set(validEmails))[0];
  };
  

const extractLinks = (html, baseUrl) => {
  const $ = cheerio.load(html);
  const links = new Set();

  $("a").each((_, element) => {
    const href = $(element).attr("href");
    if (href && href.startsWith("/") || href.startsWith(baseUrl)) {
      const fullUrl = new URL(href, baseUrl).href; // Resolve relative URLs
      links.add(fullUrl);
    }
  });

  return Array.from(links);
};


const findEmails = async (url, depth = 0, visited = new Set()) => {
  if (visited.has(url) || depth > MAX_DEPTH) return null;
  visited.add(url);

  try {
    console.log(`Scraping: ${url}`);
    const response = await axios.get(url);
    const html = response.data;

    const emails = extractEmails(html);
    if (emails && emails.length > 0) return emails;

    const links = extractLinks(html, url);
    console.log(`Found ${links.length} links on ${url}`);


    const results = await Promise.all(
      links.slice(0, CONCURRENT_LIMIT).map((link) =>
        findEmails(link, depth + 1, visited)
      )
    );

    const allEmails = results.flat().filter(Boolean);
    return allEmails.length > 0 ? allEmails : null;
  } catch (error) {
    console.error(`Error visiting ${url}:`, error.message);
    return null;
  }
};


const startCrawler = async (websiteUrl) => {
  const emails = await findEmails(websiteUrl);
  if (emails && emails.length > 0) {
    console.log(`Email: ${emails}` )
    return emails;
  } else {
    console.log("No emails found.");
  }
};

// Example usage
startCrawler("https://www.carpetsterycleaning.com/?fbclid=IwZXh0bgNhZW0CMTAAAR1287tgS5XSen1MD_L74ZZJd5Bg7gyGcWxOLtyjK85FyGd6S_REjdITYzw_aem_ZHlladGvsyStxbiPjcQA5Q");
