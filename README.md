# Project Evaluation Form

A grading website hosted free on GitHub Pages that saves marks into a Google Sheet.

| Page | Who uses it | What it does |
|---|---|---|
| `index.html` | Evaluators | Enter your name once (remembered on that device) |
| `grade.html` | Evaluators | Search students, enter marks per criterion, see a running total. A ✓ marks students already graded |
| `admin.html` | Admin | Add, rename, delete, reorder criteria and set max marks (password protected) |

## The Google Sheet

| Tab | You create it? | Columns |
|---|---|---|
| `Students` | **Yes** | A: Roll No, B: Name (row 1 = headings) |
| `Criteria` | No, created automatically | Criterion, Max Marks (edit through `admin.html`) |
| `Grades` | No, created automatically | Timestamp, Evaluator, Roll No, Name, Total, then one column per criterion |

The sheet keeps **one row per evaluator per student**. If an evaluator grades the same student again, that row is updated instead of a new row being added.

## Setup (one time, ~10 minutes)

### 1. Set up the backend in the Google Sheet

1. Open your student spreadsheet and rename the tab with the list to **`Students`**.
2. **Extensions → Apps Script**. Delete what's there and paste the contents of `apps-script/Code.gs`.
3. On line 5, change `ADMIN_PASSWORD = 'change-me'` to your own password. Save (Ctrl+S).
4. **Deploy → New deployment** → gear icon → **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, allow the permissions (*Advanced → Go to … (unsafe)* is normal for your own script), and **copy the Web app URL** (ends in `/exec`).

### 2. Connect the website

Open `app.js` and paste that URL into line 2:

```js
const API_URL = 'https://script.google.com/macros/s/XXXX/exec';
```

### 3. Publish on GitHub Pages

```bash
cd ~/Desktop/Projects/ProjectEvaluationForm
git init && git add . && git commit -m "Project evaluation form"
gh repo create project-evaluation --public --source . --push
```

On GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**.
After about a minute the site is live at `https://<your-username>.github.io/project-evaluation/`.

### 4. Add criteria

Open `…/admin.html`, sign in with your password, and add criteria (e.g. Presentation /10, Content /20, Viva /10). Save.

Then send evaluators the main link (`…/project-evaluation/`).

## Day-to-day

- **Changing criteria:** use `admin.html`. Evaluators see the changes when they reload.
  - *Rename*: the column in `Grades` is renamed too, so marks already given stay attached.
  - *Delete*: removed from the form; marks already given stay in the sheet. Totals in old rows aren't recalculated.
- **Adding/removing students:** edit the `Students` tab directly. Evaluators see the changes when they reload.
- **Changing the admin password, or any change to `Code.gs`:** edit it, then **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The URL stays the same. Changes do nothing until you redeploy.
- **Evaluator typed their name wrong:** "Not you? Change name" on the grading page.

## Good to know

- GitHub Pages sites are public. Anyone with the link can see the student list and submit marks. The admin page is protected by the password, which is checked inside Google (it isn't in the website code).
- Evaluator names are matched ignoring upper/lower case, so "Dr. Rao" and "dr. rao" count as the same person.
- Each save takes 1–2 seconds (Google Apps Script is not instant).
