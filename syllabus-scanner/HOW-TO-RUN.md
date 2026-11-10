# How to run SyllaPlan (beginner guide)

SyllaPlan runs on your own computer and opens in your web browser. You do the setup once. After that, you just double-click a file to start it.

You'll need about 15 minutes for the first setup.

---

## Part 1: Install Node.js (one time)

Node.js is the free program that runs SyllaPlan.

1. Go to **https://nodejs.org**
2. Click the big **LTS** download button.
3. Open the file you downloaded and click **Next / Continue / Install** through the installer, keeping all the default options.
4. When it finishes, **restart your computer** so it's picked up everywhere.

## Part 2: Get an Anthropic API key (one time)

The API key lets SyllaPlan use Claude to read your syllabus. It's like a password, so don't share it with anyone.

1. Go to **https://console.anthropic.com** and create an account or sign in.
2. Open **Billing** (under Settings) and add a payment method with a small amount of credit, e.g. $5. Each syllabus scan costs a few cents.
3. Open **API Keys** and click **Create Key**. Name it anything, e.g. "SyllaPlan".
4. Click **Copy**. The key starts with `sk-ant-`. Paste it into a note for now, because the site only shows it once.

## Part 3: Download SyllaPlan (one time)

1. Go to **https://github.com/jasoncpcomeau-cpu/academic/tree/claude/wonderful-rubin-ff6rtx** and sign in to GitHub if asked.
2. Click the green **Code** button, then **Download ZIP**.
3. Find the ZIP in your Downloads folder and unzip it:
   - **Windows:** right-click the file, choose **Extract All…**, then **Extract**.
   - **Mac:** double-click the file.
4. Open the unzipped folder, then open the **syllabus-scanner** folder inside it.
5. Optional: move this folder somewhere easy to find, such as Documents.

## Part 4: Start SyllaPlan

### Windows

1. In the **syllabus-scanner** folder, double-click **Start-Windows.bat**.
   - If a blue "Windows protected your PC" box appears, click **More info**, then **Run anyway**.
2. A black window opens. **The first time only**, it asks for your API key. Right-click inside the window to paste it, then press **Enter**.
3. It installs a few things. This takes about a minute and only happens the first time.
4. Your browser opens to SyllaPlan. If it doesn't, open your browser and go to **http://localhost:3000**

### Mac

1. Open the **Terminal** app. Press **Cmd+Space**, type **Terminal**, and press **Enter**.
2. In Terminal, type `bash` followed by a space. Don't press Enter yet.
3. Drag the **Start-Mac.command** file from the syllabus-scanner folder into the Terminal window. Its location fills in automatically. Now press **Enter**.
4. **The first time only**, it asks for your API key. Paste it with **Cmd+V**, then press **Enter**.
5. It installs a few things. This takes about a minute and only happens the first time.
6. Your browser opens to SyllaPlan. If it doesn't, open your browser and go to **http://localhost:3000**

## Part 5: Use it

1. On the **Scan** tab, click the box to choose your syllabus (PDF or photos of the pages), or paste the text.
2. Optional: enter the first day of the term. This helps it work out dates written like "Week 5".
3. Click **Scan syllabus** and wait 20–60 seconds.
4. Check what it found and fix anything that's wrong. Rows highlighted in orange had no clear date.
5. Click **Save course**.
6. Use the **Upcoming**, **Calendar**, and **Grades** tabs. To add your deadlines to Google, Apple, or Outlook calendar, go to **Courses**, click **Export .ics**, and open the downloaded file.

Repeat for each class.

## Stopping and starting again

- **To stop:** close the black window (Windows) or the Terminal window (Mac).
- **To start again later:** repeat Part 4. It won't ask for the key or reinstall again.
- The app only works while that window is open.
- Your courses are saved in your browser. Use the **same browser** each time, and don't clear its browsing data, or your saved courses will be lost.

## If something goes wrong

| What you see | What to do |
|---|---|
| "Node.js is not installed yet" | Do Part 1, restart your computer, and try again. |
| "Server is missing a valid ANTHROPIC_API_KEY" | Your key was pasted wrong. Delete the file named `.env` in the syllabus-scanner folder and start again. It will ask for the key again. (On Mac, the file is hidden: press **Cmd+Shift+.** in Finder to see it.) |
| "Your credit balance is too low" or another API error | Add credit in the Billing section of console.anthropic.com. |
| Browser says "This site can't be reached" | The black/Terminal window was closed or hasn't finished starting. Start it again and wait a few seconds. |
| "address already in use" | SyllaPlan is already running in another window. Use that one, or close it and try again. |
| A Word document won't upload | In Word, choose **File → Save As → PDF**, and upload the PDF. |
