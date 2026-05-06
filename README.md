# Training Feedback Report Generator

A professional Streamlit-based tool designed to automate the conversion of raw training feedback data (Excel/CSV) into formatted Microsoft Word reports.

---

## 📖 In-Depth Explanation

This tool acts as an intelligent bridge between your raw data and your final presentation document. Below is a detailed breakdown of how the internal logic handles your files:

### 1. Data Ingestion & "Smart Header" Detection
Most Excel exports from feedback tools contain "junk" rows at the top (like titles or metadata). 
- **The Logic**: Instead of assuming headers are on line 1, the app scans the first 10 rows.
- **Header Matching**: It looks for rows containing keywords like *session*, *q1*, or *batch*. Once found, it promotes that row to be the "Header" and discards everything above it.
- **Uniqueness Guarantee**: To prevent code crashes, it automatically renames duplicate columns (e.g., if you have two columns named "Feedback", it creates "Feedback" and "Feedback_1").

### 2. Intelligent Column Detection
The tool uses Heuristics and Regular Expressions (Regex) to find your data:
- **Session Column**: Looks for words like *Batch*, *Training Name*, or *Class*. It ignores columns with long text to avoid mistaking comments for session names.
- **Question Ratings (Q1-Q7)**: Uses Regex to find columns like `Q1`, `Question 1`, `Rating 1`, or even just `1.` at the start of a header.
- **Sentiment Detection**: Automatically finds "Likes" and "Improvements" columns by searching for keywords like *Strength*, *Positive*, *Negative*, or *Enjoyed*.

### 3. Metric Calculation Engine
- **Data Conversion**: It converts all rating values into numbers, automatically ignoring text like "N/A" or "Excellent" to avoid calculation errors.
- **Aggregation**: It groups the data by **Session**. For each session, it calculates the mean (average) for every question detected.
- **Overall Score**: It calculates the weighted average of all session averages to give you a single "Training Performance" score.

### 4. Word Document Automation
The app interacts with your `.docx` template using the `python-docx` engine:
- **Table Injection**: It identifies the **first table** in your document. It then maps "Session-1" to row 1, "Session-2" to row 2, and so on, filling in the rating averages.
- **Placeholder Replacement**: It scans every paragraph in your document. 
  - If it finds `Session-1:`, it appends the top 10 "Likes" for that session.
  - If it finds `Remarks:`, it appends the top 10 "Improvements" or comments.

---

## 🚀 Key Features
- **Smarter Auto-Detection**: Handles buried headers automatically.
- **Manual Mapping Override**: Use the **🛠️ Column Mapping Settings** in the UI to correct any detection errors.
- **Error-Resistant**: Fully armored against merged cells, duplicated column names, and non-numeric data.

---

## 🛠️ How to Use
1. **Prepare Data**: Ensure your feedback is in an `.xlsx` or `.csv` file.
2. **Prepare Template**: Create a `.docx` file with:
   - A table as the first element.
   - Text labels like `Session-1:`, `Remarks:`.
3. **Process**: Upload both files, verify metrics in the preview, and download.

---

## 💻 Technical Setup
### Installation
```bash
pip install streamlit pandas python-docx openpyxl numpy
```
### Execution
```bash
streamlit run training_report_app.py
```
