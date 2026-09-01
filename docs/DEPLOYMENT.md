# Deployment

## Local Windows use

1. Keep the complete project folder together.
2. Install Python if neither `py` nor `python` is available.
3. Run `scripts/start-local.bat`.
4. Open `http://127.0.0.1:4173/` if the browser does not open automatically.

The script calculates the project location dynamically, so the folder can be moved without editing the script.

## GitHub Pages

The repository is a static site and does not require a build command.

1. Push the approved files to the default branch.
2. Enable Pages from the repository root on that branch.
3. Wait for deployment to complete.
4. Open the Pages URL without adding an HTML filename.

The `.nojekyll` file should remain in the repository root.

## Other static hosting

Upload the complete repository while preserving its directory structure. Configure the host to serve `index.html` as the default document. No server-side runtime is required.

## Before publishing

- Open all three studios from the home page.
- Confirm every Home button returns to the root page.
- Download and import the Excel template.
- Export one PNG from each changed studio.
- Check the browser console for missing resources.
- Do not publish the contents of `imports/` or `exports/` unintentionally.
