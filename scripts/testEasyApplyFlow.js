import { chromium } from 'playwright-core';
import path from 'path';
import { fileURLToPath } from 'url';
import { performEasyApply } from '../modules/easyApply.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTest() {
  console.log('[INFO] Easy Apply test simülasyonu basliyor...');

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const mockHtml = `
    <!DOCTYPE html>
    <html>
    <head><title>Mock LinkedIn Job</title></head>
    <body>
      <div class="jobs-apply-button--top-card">
        <button class="jobs-apply-button" id="apply-btn">Easy Apply</button>
      </div>

      <div id="modal-container" style="display:none;" class="jobs-easy-apply-modal" role="dialog">
        <div id="step-1" class="step">
          <h3>Contact Info</h3>
          <input type="text" id="phoneNumber" placeholder="Phone">
          <footer>
            <button id="next-1" aria-label="Continue to next step" class="artdeco-button--primary">Next</button>
          </footer>
        </div>

        <div id="step-2" class="step" style="display:none;">
          <h3>Resume Step</h3>
          <div class="jobs-document-upload">
            <div class="jobs-document-upload__resume-card">
              <input type="radio" id="saved-cv-1" name="resume" checked>
              <label for="saved-cv-1">Enes_Ozden_Original_LinkedIn_CV.pdf</label>
            </div>
            <input type="file" id="jobs-document-upload__upload-file-input">
          </div>
          <footer>
            <button id="next-2" aria-label="Continue to next step" class="artdeco-button--primary">Next</button>
          </footer>
        </div>

        <div id="step-3" class="step" style="display:none;">
          <h3>Additional Questions</h3>
          <div class="fb-form-element">
            <label>How many years of work experience do you have with NestJS?</label>
            <input type="number" id="q-nestjs" required>
          </div>
          <div class="fb-form-element">
            <fieldset>
              <legend>Will you now or in the future require visa sponsorship?</legend>
              <label><input type="radio" name="sponsor" value="Yes"> Yes</label>
              <label><input type="radio" name="sponsor" value="No"> No</label>
            </fieldset>
          </div>
          <div class="fb-form-element">
            <fieldset>
              <legend>Are you legally authorized to work in Turkey?</legend>
              <label><input type="radio" name="auth" value="Yes"> Yes</label>
              <label><input type="radio" name="auth" value="No"> No</label>
            </fieldset>
          </div>
          <div class="fb-form-element">
            <label>English proficiency level</label>
            <select id="lang-select">
              <option value="">Select an option</option>
              <option value="basic">Basic</option>
              <option value="professional">Professional working proficiency</option>
              <option value="native">Native</option>
            </select>
          </div>
          <div class="fb-form-element">
            <label>Notice period</label>
            <input type="text" id="notice-period">
          </div>
          <div class="fb-form-element">
            <label><input type="checkbox" id="terms-agree"> I agree to the privacy policy</label>
          </div>
          <footer>
            <button id="next-3" aria-label="Review your application" class="artdeco-button--primary">Review</button>
          </footer>
        </div>

        <div id="step-4" class="step" style="display:none;">
          <h3>Review</h3>
          <p>Review everything before submitting</p>
          <footer>
            <button id="submit-btn" aria-label="Submit application" class="artdeco-button--primary">Submit application</button>
          </footer>
        </div>
      </div>

      <script>
        document.getElementById('apply-btn').onclick = () => {
          document.getElementById('modal-container').style.display = 'block';
        };
        document.getElementById('next-1').onclick = () => {
          document.getElementById('step-1').style.display = 'none';
          document.getElementById('step-2').style.display = 'block';
        };
        document.getElementById('next-2').onclick = () => {
          document.getElementById('step-2').style.display = 'none';
          document.getElementById('step-3').style.display = 'block';
        };
        document.getElementById('next-3').onclick = () => {
          document.getElementById('step-3').style.display = 'none';
          document.getElementById('step-4').style.display = 'block';
        };
        document.getElementById('submit-btn').onclick = () => {
          document.getElementById('modal-container').innerHTML = '<h2>Application submitted</h2><button aria-label="Dismiss">Close</button>';
        };
      </script>
    </body>
    </html>
  `;

  await page.setContent(mockHtml);

  const dummyCv = path.join(__dirname, '../config/resume.pdf');
  const result = await performEasyApply(page, dummyCv);

  console.log('[RESULT]', JSON.stringify(result));

  await browser.close();

  if (result.success) {
    console.log('[SUCCESS] Test basariyla gecti!');
    process.exit(0);
  } else {
    console.error('[FAIL] Test basarisiz oldu!');
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
