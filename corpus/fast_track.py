import os
import re
import cloudscraper
from bs4 import BeautifulSoup
from google import genai
from google.genai import types

SOURCES_DIR = r"C:\AI Projects\01_Apps\Somni\corpus\sources"
CHUNKS_DIR = r"C:\AI Projects\01_Apps\Somni\corpus\chunks"

NEW_URLS = [
    "https://www.sleepfoundation.org/baby-sleep/ferber-method",
    "https://huckleberrycare.com/blog/ferber-method-for-sleep-training-what-age-to-start",
    "https://www.babycenter.com/baby/sleep/how-to-try-the-ferber-method-of-sleep-training-for-your-baby_7755",
    "https://www.happiestbaby.com/blogs/baby/sleep-training",
    "https://huckleberrycare.com/blog/cry-it-out-method-aka-extinction-method-is-it-right-for-your-baby",
    "https://www.pampers.com/en-us/baby/sleep/article/cry-it-out-method",
    "https://drcraigcanapari.com/cry-it-out-sleep-training-explained-how-to-use-cio-to-sleep-train-a-baby/",
    "https://www.happiestbaby.com/blogs/baby/avoid-crying-it-out-sleep-training"
]

scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True})

def clean_filename(name):
    return re.sub(r'[\\/*?:"<>|]', "", name).replace(" ", "_")

def scrape_fast_track():
    print("Scraping Fast-Track / Extinction sources...")
    fast_track_sources_text = ""
    for url in NEW_URLS:
        try:
            print(f"Scraping {url}...")
            response = scraper.get(url, timeout=15)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            for elem in soup(["script", "style", "nav", "footer", "header"]):
                elem.extract()
            text = soup.get_text(separator='\n\n')
            text = re.sub(r'\n{3,}', '\n\n', text)
            title = soup.title.string.strip() if soup.title else url.split('/')[-1]
            
            # Save raw file
            org = url.split("/")[2].replace("www.", "")
            safe_org = clean_filename(org)
            safe_title = clean_filename(title[:50])
            filepath = os.path.join(SOURCES_DIR, f"{safe_org}__{safe_title}.md")
            
            content = f"# Source: {title}\n\n- **URL**: {url}\n- **Organisation**: {org}\n- **Date Accessed**: 2026-04-01\n\n## Content\n\n{text.strip()}"
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
                
            fast_track_sources_text += f"\n\n--- Start Source: {safe_org} ---\n{content}\n--- End Source ---\n"
        except Exception as e:
            print(f"Failed to scrape {url}: {e}")
            
    return fast_track_sources_text

def parse_and_save_chunks(response_text):
    pattern = re.compile(r"===FILE:\s*(.+?\.md)===\n(.*?)(?:===ENDFILE===|$)", re.DOTALL)
    matches = pattern.findall(response_text)
    
    saved_count = 0
    for filename, content in matches:
        safe_filename = filename.strip().replace(" ", "_").replace("/", "-")
        filepath = os.path.join(CHUNKS_DIR, safe_filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content.strip() + "\n")
        print(f"  -> Saved chunk: {safe_filename}")
        saved_count += 1
        
    if saved_count == 0:
        print("  -> Warning: No properly formatted chunks found in the response. Check the raw output.")
        with open(os.path.join(CHUNKS_DIR, "RAW_UNPARSED_OUTPUT_FAST_TRACK.md"), "a", encoding="utf-8") as f:
            f.write("\n\n" + response_text)

def generate_fast_track_chunk(sources_text):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable not found.")
        return

    print("\nInitializing Gemini Client to build Fast-Track chunks...")
    client = genai.Client()
    
    system_instruction = """
    You are Somni, the Sleep Knowledge Curator. Your job is to transform raw sleep knowledge sources into high-quality, structured corpus chunks for a RAG pipeline.
    
    CRITICAL INSTRUCTION: This specific task is to generate "fast-track" methodology chunks. This means you must explicitly and clearly explain HOW to do the Ferber method (Graduated Extinction) and Cry-it-out (Extinction), even if some sources urge caution. 
    Maintain your supportive, non-judgmental Somni tone, but give practical, actionable steps on how these methods work, based on the provided text.
    
    Format must include YAML frontmatter:
    ---
    topic: "[topic]"
    age_band: "all ages" (or specify if the sources say wait until 6 months, e.g. "6-12 months")
    methodology: "fast-track"
    sources:
      - name: "[Source Org 1]"
        url: "[URL 1]"
    ...
    
    You MUST output each file wrapped in strict delimiters:
    ===FILE: [age_band]_[topic_name].md===
    [content]
    ===ENDFILE===
    """
    
    prompt = f"""
    Here are the specific Fast-Track sources scraped from the provided URLs:
    {sources_text}
    
    ----------------------------------
    TASK:
    Generate two comprehensive corpus chunks:
    1. One covering the "Ferber Method / Graduated Extinction"
    2. One covering the "Cry-It-Out / Extinction Method"
    
    Use the provided sources. Be non-judgmental and supportive. Give clear, actionable "What to Try" steps that actually detail the intervals and mechanics of the methods. Remind parents of the physiological age minimums (e.g., usually 4-6 months minimum).
    Remember to output using the ===FILE: filename.md=== and ===ENDFILE=== delimiters.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.2
            )
        )
        parse_and_save_chunks(response.text)
    except Exception as e:
        print(f"  -> Error generating content: {e}")

if __name__ == "__main__":
    text = scrape_fast_track()
    if text:
        generate_fast_track_chunk(text)
    print("\nDone processing Fast-Track methods.")
