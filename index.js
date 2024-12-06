const axios = require("axios");
const cheerio = require("cheerio");
const xlsx = require("xlsx");

const MAX_DEPTH = 2; 
const CONCURRENT_LIMIT = 5; 

const fileName = 'Crawled.xlsx'


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
      // Ensure `href` is defined and starts with `/` or the base URL
      if (href && (href.startsWith("/") || href.startsWith(baseUrl))) {
        try {
          const fullUrl = new URL(href, baseUrl).href; // Resolve relative URLs
          links.add(fullUrl);
        } catch (error) {
          console.warn(`Invalid URL: ${href} on ${baseUrl}`, error.message);
        }
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

function excelToArrayJson(filePath) {
  try {
    // Read the workbook
    const workbook = xlsx.readFile(filePath);

    // Initialize the result array
    const result = [];

    // Iterate through each sheet in the workbook
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];

      // Convert the sheet data to JSON
      const sheetData = xlsx.utils.sheet_to_json(sheet, { defval: null });

      // Push all rows from this sheet into the result array
      result.push(...sheetData);
    });

    return result;
  } catch (error) {
    console.error("Error reading the Excel file:", error);
    return [];
  }
}

// Example usage
const filePath = "C:/Users/itsro/Downloads/carpet cleaning in llos angeles.xlsx";
const jsonArray = excelToArrayJson(filePath);
console.log(JSON.stringify(jsonArray, null, 2));

// async function processRows(jsonArray) {
//   for (const row of jsonArray) {
//     // Get the 3rd and 4th properties (email and website)
//     const email = Object.values(row)[2]; // 3rd property
//     const website = Object.values(row)[3]; // 4th property

//     // If no website exists, skip this row
//     if (!website) {
//       console.log(`Skipping row: No website available for ${row.name || "unknown name"}`);
//       continue;
//     }

//     // Check if email exists; if not, crawl the website
//     if (!email) {
//       console.log(`No email found for ${row.name || "unknown name"}. Crawling website: ${website}`);
//       try {
//         const crawledEmail = await startCrawler(website); // Call the crawler function
//         if (crawledEmail) {
//           console.log(`Email found: ${crawledEmail}`);
//         } else {
//           console.log(`No email found on the website: ${website}`);
//         }
//       } catch (error) {
//         console.error(`Error crawling website ${website}:`, error);
//       }
//     } else {
//       console.log(`Email already exists for ${row.name || "unknown name"}: ${email}`);
//     }
//   }
// }

// processRows(jsonArray)

async function processRowsAndSave(jsonArray, outputFilePath) {
  const updatedJson = []; // Store updated rows

  for (const row of jsonArray) {
    // Clone the row to avoid mutating the original
    const updatedRow = { ...row };

    // Get the 3rd and 4th properties (email and website)
    const email = Object.values(row)[2]; // 3rd property
    const website = Object.values(row)[3]; // 4th property

    // If no website exists, skip this row
    if (!website) {
      console.log(`Skipping row: No website available for ${row.name || "unknown name"}`);
      updatedJson.push(updatedRow);
      continue;
    }

    // Check if email exists; if not, crawl the website
    if (!email) {
      console.log(`No email found for ${row.name || "unknown name"}. Crawling website: ${website}`);
      try {
        const crawledEmail = await startCrawler(website); // Call the crawler function
        if (crawledEmail) {
          console.log(`Email found: ${crawledEmail}`);
          updatedRow["e-mail"] = crawledEmail; // Update the email field
        } else {
          console.log(`No email found on the website: ${website}`);
        }
      } catch (error) {
        console.error(`Error crawling website ${website}:`, error);
      }
    } else {
      console.log(`Email already exists for ${row.name || "unknown name"}: ${email}`);
    }

    // Add the updated row to the new JSON array
    updatedJson.push(updatedRow);
  }

  // Convert updated JSON to Excel
  const worksheet = xlsx.utils.json_to_sheet(updatedJson);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Updated Data");
  xlsx.writeFile(workbook, outputFilePath);

  console.log(`Updated Excel file saved at: ${outputFilePath}`);
}

processRowsAndSave(jsonArray , fileName)