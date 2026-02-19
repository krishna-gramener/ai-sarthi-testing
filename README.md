# AI Sarthi Testing Tool

A simple web application for automated testing of AI Sarthi responses.

## Features

- Upload CSV files containing questions to test
- Process questions through the AI Sarthi API
- Track progress with visual indicators
- View real-time processing logs
- Download results as CSV with detailed metrics
- Cancel processing at any time

## How to Use

1. Start a local web server:
   ```
   python -m http.server 9988 --bind 127.0.0.1
   ```

2. Open the application in your browser:
   ```
   http://127.0.0.1:9988
   ```

3. Upload a CSV file with a 'questions' column
4. Click "Process Questions" to start testing
5. Download results when processing is complete

## CSV Format

Input CSV must contain a column named 'questions' (case-insensitive).

## Output Format

The tool generates a CSV file with the following columns:
- question: The original question
- rag_response: The response from AI Sarthi
- time_taken: Processing time in seconds
- sql_queries: SQL queries used to generate the response

## Requirements

- Modern web browser with JavaScript enabled
- Internet connection to access the API
