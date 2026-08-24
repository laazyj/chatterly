/**
 * Fetches content from Wikipedia for a given list of article titles.
 * Returns structured documents with title, URL, and cleaned text content.
 */

export interface WikiDocument {
  title: string;
  url: string;
  text: string;
}

/**
 * Fetch a Wikipedia article's text content.
 * Uses the Wikipedia API to get the plaintext extract.
 */
async function fetchArticle(title: string): Promise<WikiDocument | null> {
  const encodedTitle = encodeURIComponent(title);
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&titles=${encodedTitle}&explaintext=true&exsectionformat=plain`;

  try {
    const timeout = AbortSignal.timeout(15_000);
    const response = await fetch(url, { signal: timeout });
    if (!response.ok) {
      console.log(`  ✗ ${title}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as {
      query?: { pages?: Record<string, { title?: string; extract?: string; missing?: boolean }> };
    };

    const pages = data.query?.pages;
    if (!pages) {
      console.log(`  ✗ ${title}: No data returned`);
      return null;
    }

    const page = Object.values(pages)[0];
    if (page?.missing) {
      console.log(`  ✗ ${title}: Article not found`);
      return null;
    }

    if (!page?.extract || !page.title) {
      console.log(`  ✗ ${title}: No extract available`);
      return null;
    }

    return {
      title: page.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
      text: page.extract.trim(),
    };
  } catch (error) {
    console.log(`  ✗ ${title}: ${error instanceof Error ? error.message : "Error"}`);
    return null;
  }
}

/**
 * Fetch multiple Wikipedia articles with a delay between requests to be respectful.
 */
export async function fetchWikipediaArticles(titles: string[]): Promise<WikiDocument[]> {
  const documents: WikiDocument[] = [];

  // `entries()` rather than an index loop: under `noUncheckedIndexedAccess`, `titles[i]`
  // is `string | undefined` even though the loop bound makes that impossible, and the
  // element from `entries()` is simply typed `string`.
  for (const [index, title] of titles.entries()) {
    console.log(`[${index + 1}/${titles.length}] ${title}`);

    const doc = await fetchArticle(title);
    if (doc) {
      console.log(`  ✓ ${doc.text.length} chars`);
      documents.push(doc);
    }

    // Be respectful: wait between requests (3 seconds to avoid rate limits)
    if (index < titles.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  return documents;
}
