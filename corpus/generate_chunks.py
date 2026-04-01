import os
import glob
import time
import re
from google import genai
from google.genai import types

# Setup your Gemini API Key in your terminal before running this script:
# $env:GEMINI_API_KEY="your_api_key_here"

SOURCES_DIR = r"C:\AI Projects\01_Apps\Somni\corpus\sources"
CHUNKS_DIR = r"C:\AI Projects\01_Apps\Somni\corpus\chunks"

# The target topics we still need. 
# Note: Fast-track, safe sleeping, and bedtime routine are excluded as they are done or wait-listed for tomorrow.
TARGET_TOPICS = [
    "Nap schedules & wake windows",
    "Self-settling techniques (general)",
    "Sleep regression (4 month, 8-10 month)",
    "Overtiredness vs Undertiredness",
    "Contact naps & Catnapping",
    "Feeding & sleep relationship (Night weaning)",
    "Sleep environment (Light, noise, clothing)",
    "Early morning waking (before 6am)",
    "Nap transitions (3 to 2, 2 to 1)",
    "Teething & Illness impacting sleep"
]

def load_sources():
    """Reads all markdown files in the sources directory."""
    source_files = glob.glob(os.path.join(SOURCES_DIR, "*.md"))
    sources_text = ""
    for filepath in source_files:
        with open(filepath, 'r', encoding='utf-8') as f:
            sources_text += f"\n\n--- Start Source: {os.path.basename(filepath)} ---\n"
            sources_text += f.read()
            sources_text += f"\n--- End Source ---\n"
    return sources_text

def parse_and_save_chunks(response_text):
    """
    Parses the LLM response looking for specific file delimiters and saves them.
    Expected format from LLM:
    ===FILE: 4-6m_nap_schedules.md===
    [content]
    ===ENDFILE===
    """
    pattern = re.compile(r"===FILE:\s*(.+?\.md)===\n(.*?)(?:===ENDFILE===|$)", re.DOTALL)
    matches = pattern.findall(response_text)
    
    saved_count = 0
    for filename, content in matches:
        # Clean filename just in case
        safe_filename = filename.strip().replace(" ", "_").replace("/", "-")
        filepath = os.path.join(CHUNKS_DIR, safe_filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content.strip() + "\n")
        print(f"  -> Saved chunk: {safe_filename}")
        saved_count += 1
        
    if saved_count == 0:
        print("  -> Warning: No properly formatted chunks found in the response. Check the raw output.")
        # Save raw output just in case
        with open(os.path.join(CHUNKS_DIR, "RAW_UNPARSED_OUTPUT.md"), "a", encoding="utf-8") as f:
            f.write("\n\n" + response_text)

def generate_chunks():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable not found.")
        print("Please run: $env:GEMINI_API_KEY='your_api_key_here'")
        return

    print("Initializing Gemini Client...")
    client = genai.Client()
    
    print("Loading all raw sources into memory...")
    all_sources = load_sources()
    if not all_sources:
        print("No sources found.")
        return

    system_instruction = """
    You are Somni, the Sleep Knowledge Curator. Your job is to transform raw sleep knowledge sources into high-quality, structured corpus chunks for a RAG pipeline.
    
    For the requested Topic, read the provided sources and generate 1 to 4 distinct Markdown files, depending on how the advice changes by age band. 
    If the advice is the same for all babies, generate one file (age_band: "all ages"). 
    If it changes significantly, generate separate files (e.g., "0-3m", "4-6m", "7-12m").

    CRITICAL INSTRUCTION - FILE FORMATTING:
    You MUST output each file wrapped in strict delimiters so I can parse them.
    
    ===FILE: [age_band]_[topic_name].md===
    ---
    topic: "[topic]"
    age_band: "[0-3 months | 4-6 months | 7-9 months | 10-12 months | all ages]"
    methodology: "[gentle | balanced | fast-track | all]"
    sources:
      - name: "[Source Org 1]"
        url: "[URL 1]"
    last_updated: "2026-04-01"
    confidence: "high"
    ---
    # [Topic Title]

    [Content in Somni's tone: calm, supportive, practical. Australian English. 150-400 words.]

    ## Key Points
    - [bulleted list]

    ## What to Try
    - [actionable steps]

    ## When to Seek Help
    - [red flags, medical redirects]
    ===ENDFILE===
    
    Remember: Paraphrase well, never give medical advice, and strictly follow the file delimiters.
    """

    print(f"Loaded sources. Proceeding with {len(TARGET_TOPICS)} topics...")
    print("Note: Adding a 30-second delay between requests to respect API rate limits (Tokens Per Minute).\n")

    for index, topic in enumerate(TARGET_TOPICS):
        print(f"[{index+1}/{len(TARGET_TOPICS)}] Requesting chunks for: {topic}")
        
        prompt = f"""
        Here is the massive source corpus:
        {all_sources}
        
        ----------------------------------
        TASK:
        Generate the corpus chunks for the topic: "{topic}".
        Remember to output using the ===FILE: filename.md=== and ===ENDFILE=== delimiters.
        Only use information found in the sources. If the sources do not discuss this topic at all, return the exact string: "NO RELEVANT SOURCES".
        """
        
        try:
            # Using gemini-2.5-flash as it has a 1M token context window and is extremely fast/cheap
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.2 # Low temperature for factual consistency
                )
            )
            
            if "NO RELEVANT SOURCES" in response.text:
                print("  -> AI reported no relevant sources for this topic.")
            else:
                parse_and_save_chunks(response.text)
                
        except Exception as e:
            print(f"  -> Error generating content for {topic}: {e}")
            
        # Pause to prevent hitting the 1,000,000 Tokens Per Minute limit on the free tier
        # (76 files is roughly 75k-100k tokens per request)
        if index < len(TARGET_TOPICS) - 1:
            print("  -> Sleeping for 30 seconds to respect API rate limits...\n")
            time.sleep(30)
            
    print("\nFinished generating chunks. See the /corpus/chunks/ folder for outputs.")

if __name__ == "__main__":
    generate_chunks()
