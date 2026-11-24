# Text File Splitter

A lightweight, browser-based tool for dividing large `.txt` and `.md` documents into smaller files using custom percentage allocations.

**No installation, account, server, or upload is required.** The application runs locally in your browser.

## Features

- Split plain-text and Markdown files into 2–20 output files.
- Assign a custom percentage of the source document to each part.
- Split at word boundaries or exact character positions.
- Preview output filenames and estimated part sizes before exporting.
- Preserve the original file extension and choose an output filename prefix.
- Drag and drop a source file into the application.
- Resize the number of parts without discarding existing allocations.
- Validate that allocations total 100% before export.
- Verify that all exported parts reconstruct the original source text.
- No external JavaScript libraries, analytics, tracking, or network requests.

## Quick start

1. Download or clone this repository.
2. Open `index.html` in a modern browser.
3. Choose a `.txt` or `.md` file (or drag it into the file area).
4. Choose the number of output files and the splitting method.
5. Adjust the percentage allocated to each part. The total must equal 100%.
6. Set an output filename prefix if desired.
7. Select **Export files** and allow the browser to download the generated files.

There is no build step and no dependency installation.

## Splitting methods

### Word boundaries

The default method keeps words intact. Whitespace is preserved, and whitespace immediately following a completed word stays with that part. Percentages are applied to the document's whitespace-delimited word count.

### Exact character positions

This method divides the document at character positions based on the requested percentages. It can split a word or line. Character counting uses Unicode code points so surrogate-pair characters are not cut in half.

Both methods preserve the source text exactly. The application checks the concatenated output against the original before starting downloads.

## Percentage allocations

Every output part has its own percentage field. Allocations must be between 0% and 100% and must add up to 100% (within a small floating-point tolerance).

Use **Reset evenly** to distribute the allocation equally. When the number of output files changes, existing allocations are retained and adjusted rather than discarded.

## Output filenames

Output files use this pattern:

```text
<prefix>_part-01.<extension>
<prefix>_part-02.<extension>
<prefix>_part-03.<extension>
```

The source extension (`.txt` or `.md`) is retained. Characters that are invalid in common filenames are replaced automatically.

## Performance and privacy

- Files are read into browser memory using the File API. Very large documents may require substantial memory; the interface displays a warning for files larger than 100 MB.
- No content is sent to a remote server. The application does not make network requests.
- Each output is created as a browser Blob and downloaded locally.
- The browser may ask permission to download multiple files.

For very large files, close unnecessary tabs and applications before processing.

## Project structure

```text
Text-File-Splitter/
├── index.html   # Application structure
├── styles.css   # Responsive interface and visual styling
├── app.js       # File handling, allocation, splitting, and export logic
├── README.md    # Documentation
└── .gitignore   # Common local files to exclude
```

## Browser support

Use a current version of Chrome, Edge, Firefox, or Safari. JavaScript and the browser File, Blob, and Object URL APIs must be enabled.

## Limitations

- Only `.txt` and `.md` files are accepted.
- Files are processed in memory; this is not a streaming solution for files larger than available browser memory.
- The browser controls where downloads are saved and may require approval for multiple downloads.
- Word-boundary splits use whitespace-delimited tokens, not language-specific linguistic segmentation.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for the full license text.
