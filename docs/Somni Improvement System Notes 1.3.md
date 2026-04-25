Review these notes in conjunction with each of the named screenshots in this folder: C:\AI Projects\01_Apps\Somni\archive

Ask any clarification questions before continuing. Load the app and find the relevant places each of these screenshots are showing. Also note that some UI improvement work has already been done so verify that the issues listed below still exist before making changes.

SIS10
Fix the copy on the left hand panel, its too wordy. Maybe just something like 'A few simple details to help Somni tailor your baby's plan.' The bottom subtitle can be shorted as well. I just want the overall message to be that we are asking questions to help somni be tailored to your specific baby's details and your parenting style.

Date of Birth has a calendar selector but it cant be seen in black, change it to white.

Note the answer boxes are different sizes and fonts, such as the typical bedtime question. Fix this to make it look much smoother and more consistent. Notice how the What does the nap pattern look like questions' answer box is widly overhanging its boundary.

Explain the 'how would you like the plan to feel?' question a bit more clearly. give it a subtitle like the night feeds question.

The night feed question drop down should be simplified, it reads clunky if the answer is 'yes night feeds are still part of things'. Same issue for the which best matches most days right now answer.

I'm happy for you to adjust the overall format if it will fit better and look more premium than the current 2 column format.

SIS11
Change copy to 'there is no right or wrong answer here'. add something like Somni will adapt to you as it gets to know you better so this is just a starting point to determine which coaching style suits your family best; gentle, balanced or fast track.

The current slider system is good, but confusing. Let's make it so there is a statement at either end of the slider bar so the user knows what 1 and what 10 signify. For example for the first question a 1 should be I want a very gentle approach, even if the progress takes longer, but 10 could be I want the fastest progress possible and we're comfortable with a stricter approach. Note this is just my suggestion, you can decide on the wording, it needs to be clear and concise. Overall the lower scores should equate to the Gentle Style, middle ground is balanced and the higher scores should push it towards the Fast Track style.

---
## Implementation Plan: Onboarding UI/UX Refinements (SIS10 & SIS11)

### Stage 1: Update Copywriting (SIS10 & SIS11)
**Goal:** Make the onboarding flow feel less wordy, more tailored, and reassuring.
- **File:** `src/app/onboarding/page.tsx`
  - **Action:** Update the main heading to: *"A few simple details to help Somni tailor your baby's plan."*
  - **Action:** Shorten the body text below the heading to: *"We ask these questions to tailor Somni to your baby's details and your parenting style."*
- **File:** `src/components/onboarding/OnboardingForm.tsx`
  - **Action:** Update the Step 2 introduction text to: *"Somni will adapt to you as it gets to know you better. This is just a starting point to determine which coaching style suits your family best: gentle, balanced, or fast track. There is no right or wrong answer here."*

### Stage 2: Form Field Styling & Premium Layout (SIS10)
**Goal:** Fix visual bugs (calendar icon, overhanging inputs) and elevate the design to a more premium single-column layout.
- **File:** `src/components/onboarding/OnboardingForm.module.css`
  - **Action:** Add `color-scheme: dark;` to the date input (`.field input[type="date"]`) so the calendar icon is visible against the dark background.
  - **Action:** Ensure `.field input` and `.field select` have `width: 100%;`, `max-width: 100%;`, `box-sizing: border-box;`, `font-family: inherit;`, and `font-size: 1rem;` to prevent the "nap pattern" dropdown from overhanging its boundary.
  - **Action:** Refactor `.fieldGrid` media query. Remove the 2-column grid (`grid-template-columns: repeat(2, minmax(0, 1fr));`) and instead use a centered, elegant single-column layout with a maximum width (e.g., `max-width: 500px; margin: 0 auto;`) for a more premium, focused feel.

### Stage 3: Simplify Dropdown Options & Add Subtitles (SIS10)
**Goal:** Make the questions easier to answer quickly.
- **File:** `src/components/onboarding/OnboardingForm.tsx`
  - **Action:** Add a subtitle to the "How would you like the plan to feel?" field (similar to the night feeds question). Example: `<small className={styles.helpText}>This helps us adjust the pacing of the recommendations.</small>`
- **File:** `src/lib/onboarding-preferences.ts`
  - **Action:** Simplify the labels in `nightFeedOptions`. (e.g., change *"Yes, night feeds are still part of things"* to simply *"Yes, still feeding at night"*).
  - **Action:** Simplify the labels in `dayStructureOptions` (e.g., *"Mostly at home, so the day can stay flexible"* -> *"Mostly at home, flexible"*).

### Stage 4: Slider Clarification (SIS11)
**Goal:** Make the 1-10 slider scales intuitive by providing descriptive anchors at both ends and changing the prompts to neutral titles.
- **File:** `src/components/onboarding/OnboardingForm.tsx`
  - **Action:** Refactor the `questionPrompts` array into an array of objects containing `title`, `leftLabel` (for score 1), and `rightLabel` (for score 10):
    1. **Title:** "Approach to progress"
       - Left: *"Very gentle, even if progress takes longer"*
       - Right: *"Fastest progress, comfortable with a stricter approach"*
    2. **Title:** "Routine preference"
       - Left: *"Prefer flexible days and following baby's cues"*
       - Right: *"Prefer a steady, predictable daily routine"*
    3. **Title:** "Responsiveness vs. Structure"
       - Left: *"Prioritize high responsiveness and soothing"*
       - Right: *"Prioritize structure and independent sleep"*
    4. **Title:** "Pacing of changes"
       - Left: *"Small, gradual changes over time"*
       - Right: *"A quick, comprehensive reset"*
    5. **Title:** "Comfort with faster methods"
       - Left: *"Cautious, prefer to avoid fast methods"*
       - Right: *"Ready to try faster methods if safe"*
  - **Action:** Update the slider UI in the JSX to display the new `title` at the top of the card, `leftLabel` where "1" is currently located, and `rightLabel` where "10" is located. 
- **File:** `src/components/onboarding/OnboardingForm.module.css`
  - **Action:** Ensure the labels wrap elegantly and the grid layout (`.sliderRow`) is updated to accommodate larger text labels instead of just single numbers.

### Stage 5: Quality Control Gates
1. **Gate 1 (Visual):** Open `/onboarding` in browser. Verify the date picker icon is clearly visible (white on dark background).
2. **Gate 2 (Responsive):** Resize the window. Verify no input boxes (especially the "nap pattern" dropdown) overhang their parent container boundaries.
3. **Gate 3 (Layout):** Verify the new single-column form looks centered, balanced, and more premium than the previous 2-column layout.
4. **Gate 4 (Interactive):** Navigate to Step 2. Verify the sliders clearly display the descriptive text at both ends and that adjusting the slider correctly updates the "Current style preview".
