# Kurdish Font Setup for PDF Generation

## Problem
jsPDF's built-in fonts don't support Kurdish characters properly. To display Kurdish text correctly in PDFs, you need to add a custom font.

## Solution

### Step 1: Convert the Font
1. Go to jsPDF's font converter: https://rawgit.com/MrRio/jsPDF/master/fontconverter/fontconverter.html
2. Upload your `public/assets/fonts/ku.ttf` file
3. Download the generated JavaScript file
4. Save it as `public/assets/fonts/ku-font.js`

### Step 2: The font will be automatically loaded
The code is already set up to automatically load and use the converted font when generating Kurdish PDFs.

## Current Workaround
Until the font is converted, the PDF will use the 'times' font which has better Unicode support than 'helvetica', but Kurdish text may still not render perfectly.

## Alternative: Use a Different PDF Library
If you need immediate perfect Kurdish support, consider using a library like `pdfkit` or `pdfmake` which have better Unicode support.

