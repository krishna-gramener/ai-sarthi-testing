document.addEventListener('DOMContentLoaded', () => {
    // Additional DOM Elements for API URL popup
    const apiUrlPopup = document.getElementById('apiUrlPopup');
    const apiUrlInput = document.getElementById('apiUrlInput');
    const saveApiUrlBtn = document.getElementById('saveApiUrlBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    // DOM Elements
    const csvFileInput = document.getElementById('csvFile');
    const fileNameSpan = document.getElementById('file-name');
    const conversationIdInput = document.getElementById('conversation_id');
    const processBtn = document.getElementById('processBtn');
    const timeEstimateSection = document.querySelector('.time-estimate');
    const timeEstimateText = document.getElementById('time-estimate-text').querySelector('span');
    const progressSection = document.querySelector('.progress-section');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progress-text');
    const cancelBtn = document.getElementById('cancelBtn');
    const resultsSection = document.querySelector('.results-section');
    const downloadBtn = document.getElementById('downloadBtn');
    const logContainer = document.getElementById('log-container');

    // API URL from local storage or prompt user
    let API_URL = localStorage.getItem('aiSarthiApiUrl');
    
    // Check if API URL exists in local storage
    if (!API_URL) {
        // Show API URL input popup when page loads
        showApiUrlPopup();
    }
    
    // Variables to store data
    let csvData = null;
    let fileName = '';
    let processedData = [];
    let totalQuestions = 0;
    let processedQuestions = 0;
    let processingCancelled = false;

    // Event Listeners
    csvFileInput.addEventListener('change', handleFileSelect);
    processBtn.addEventListener('click', processCSV);
    downloadBtn.addEventListener('click', downloadResults);
    cancelBtn.addEventListener('click', cancelProcessing);
    saveApiUrlBtn.addEventListener('click', saveApiUrl);
    settingsBtn.addEventListener('click', () => showApiUrlPopup(true));

    // Handle file selection
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            fileName = file.name;
            fileNameSpan.textContent = fileName;
            processBtn.disabled = false;
            
            // Log file selection
            addLogEntry(`Selected file: ${fileName}`, 'info');
        } else {
            fileNameSpan.textContent = 'No file chosen';
            processBtn.disabled = true;
        }
    }

    // Process the CSV file
    function processCSV() {
        const file = csvFileInput.files[0];
        if (!file) {
            addLogEntry('No file selected', 'error');
            return;
        }

        // Reset variables
        processedData = [];
        processedQuestions = 0;
        processingCancelled = false;
        
        // Hide results section and reset display
        resultsSection.style.display = 'none';
        timeEstimateSection.style.display = 'none';
        progressSection.style.display = 'none';
        
        // Parse CSV file
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async function(results) {
                if (!results.data || results.data.length === 0) {
                    addLogEntry('CSV file is empty or invalid', 'error');
                    return;
                }
                
                // Find the questions column (case-insensitive and handling whitespace)
                const firstRow = results.data[0];
                const columnNames = Object.keys(firstRow);
                // Find a column that matches 'questions' (case-insensitive, ignoring whitespace)
                const questionsColumn = columnNames.find(column => {
                    const normalizedColumn = column.trim().toLowerCase();
                    return (normalizedColumn === 'questions' || normalizedColumn === 'question');
                });
                
                if (!questionsColumn) {
                    addLogEntry('CSV file must contain a "questions" column', 'error');
                    return;
                }
                
                addLogEntry(`Using column: "${questionsColumn}" for questions`, 'info');
                
                csvData = results.data;
                totalQuestions = csvData.length;
                progressText.textContent = `0/${totalQuestions} questions processed`;
                
                // Calculate and display estimated time (30 seconds per question)
                const estimatedTimeInMinutes = Math.ceil((30 * totalQuestions) / 60);
                timeEstimateText.textContent = estimatedTimeInMinutes;
                timeEstimateSection.style.display = 'block';
                
                // Show progress section after a short delay
                setTimeout(() => {
                    progressSection.style.display = 'block';
                }, 1500);
                
                addLogEntry(`Starting to process ${totalQuestions} questions. Estimated time: ${estimatedTimeInMinutes} minutes`, 'info');
                
                // Process each question
                for (let i = 0; i < csvData.length; i++) {
                    // Check if processing has been cancelled
                    if (processingCancelled) {
                        addLogEntry('Processing stopped due to cancellation', 'info');
                        break;
                    }
                    
                    const question = csvData[i][questionsColumn];
                    if (!question || question.trim() === '') {
                        addLogEntry(`Skipping empty question at row ${i+1}`, 'info');
                        continue;
                    }
                    await processQuestion(question.trim(), i);
                }
                
                // Show results section when all questions are processed
                progressSection.style.display = 'none';
                timeEstimateSection.style.display = 'none';
                resultsSection.style.display = 'block';
                addLogEntry('All questions processed successfully!', 'success');
            },
            error: function(error) {
                addLogEntry(`Error parsing CSV: ${error}`, 'error');
            }
        });
    }

    // Process a single question
    async function processQuestion(question, index) {
        try {
            addLogEntry(`Processing question ${index + 1}/${totalQuestions}: ${question.substring(0, 50)}...`, 'info');
            
            const startTime = performance.now();
            const response = await callAPI(question);
            const endTime = performance.now();
            
            // Calculate time taken in seconds
            const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
            
            // Extract SQL queries if available
            let sqlQueries = '';
            if (response && response.sql_queries) {
                sqlQueries = Array.isArray(response.sql_queries) 
                    ? response.sql_queries.join('\n') 
                    : response.sql_queries;
            }
            
            // Add to processed data
            processedData.push({
                question: question,
                rag_response: response && response.answer ? response.answer : 'No response',
                time_taken: response && response.processing_time ? response.processing_time : timeTaken,
                sql_queries: sqlQueries
            });
            
            // Update progress
            processedQuestions++;
            const progressPercentage = (processedQuestions / totalQuestions) * 100;
            progressBar.style.width = `${progressPercentage}%`;
            progressText.textContent = `${processedQuestions}/${totalQuestions} questions processed`;
            
            addLogEntry(`Question ${index + 1} processed successfully`, 'success');
            
            // Add a small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            addLogEntry(`Error processing question ${index + 1}: ${error.message}`, 'error');
            
            // Add failed question to processed data with error message
            processedData.push({
                question: question,
                rag_response: `ERROR: ${error.message}`,
                time_taken: 0,
                sql_queries: ''
            });
            
            // Update progress even for failed questions
            processedQuestions++;
            const progressPercentage = (processedQuestions / totalQuestions) * 100;
            progressBar.style.width = `${progressPercentage}%`;
            progressText.textContent = `${processedQuestions}/${totalQuestions} questions processed`;
        }
    }

    // Call the API with a question
    async function callAPI(question) {
        try {
            addLogEntry(`Sending request to API: "${question.substring(0, 30)}..."`, 'info');
            
            // Get conversation_id from input field, if provided
            const conversationId = conversationIdInput.value.trim() || null;
            
            const payload = {
                query: question,
                language: "english",
                user_id: "testinggenius@gmail.com",
                guest_id: null,
                conversation_id: conversationId
            };
            
            // Log if conversation_id is being used
            if (conversationId) {
                addLogEntry(`Using conversation_id: ${conversationId}`, 'info');
            }
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'No error details available');
                throw new Error(`API responded with status: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            addLogEntry(`Received response from API (${data.processing_time}s)`, 'success');
            return data;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('API request timed out after 5 minutes');
            }
            throw new Error(`API call failed: ${error.message}`);
        }
    }

    // Download results as CSV
    function downloadResults() {
        if (!processedData || processedData.length === 0) {
            addLogEntry('No data to download', 'error');
            return;
        }
        
        // Ensure the data has the required columns in the correct order
        const formattedData = processedData.map(item => ({
            question: item.question || '',
            rag_response: item.rag_response || '',
            time_taken: item.time_taken || 0,
            sql_queries: item.sql_queries || ''
        }));
        
        // Generate CSV content
        const csv = Papa.unparse(formattedData);
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        
        // Set download attributes
        const resultFileName = fileName.replace('.csv', '') + '_results.csv';
        downloadLink.href = url;
        downloadLink.setAttribute('download', resultFileName);
        
        // Trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        addLogEntry(`Results downloaded as ${resultFileName} with ${formattedData.length} rows`, 'success');
    }

    // Show API URL popup
    function showApiUrlPopup(fromSettings = false) {
        // If called from settings, use current API URL, otherwise use default
        if (fromSettings && API_URL) {
            apiUrlInput.value = API_URL;
        } else {
            // Default API URL for convenience
            apiUrlInput.value = "";
        }
        
        apiUrlPopup.style.display = 'flex';
        
        // Disable other UI elements while popup is shown
        processBtn.disabled = true;
    }
    
    // Save API URL to local storage
    function saveApiUrl() {
        const url = apiUrlInput.value.trim();
        
        if (!url) {
            alert('Please enter a valid API URL');
            return;
        }
        
        // Save to local storage
        localStorage.setItem('aiSarthiApiUrl', url);
        API_URL = url;
        
        // Hide popup
        apiUrlPopup.style.display = 'none';
        
        // Enable UI elements
        processBtn.disabled = csvFileInput.files.length === 0;
        
        addLogEntry(`API URL configured successfully`, 'success');
    }
    
    // Cancel processing function
    function cancelProcessing() {
        if (processedQuestions < totalQuestions) {
            processingCancelled = true;
            addLogEntry('Processing cancelled by user', 'error');
            
            // Hide progress and time estimate sections
            progressSection.style.display = 'none';
            timeEstimateSection.style.display = 'none';
            
            // Show results section if we have any processed data
            if (processedData.length > 0) {
                resultsSection.style.display = 'block';
                addLogEntry(`Processing stopped. ${processedData.length} questions were processed before cancellation.`, 'info');
            }
        }
    }
    
    // Add entry to log container
    function addLogEntry(message, type = 'info') {
        const logEntry = document.createElement('div');
        
        // Apply Tailwind classes based on message type
        let typeClass = 'text-blue-600'; // Default for info
        if (type === 'success') {
            typeClass = 'text-green-600';
        } else if (type === 'error') {
            typeClass = 'text-red-600';
        }
        
        logEntry.className = `py-1 px-2 mb-1 border-b border-gray-200 ${typeClass}`;
        
        const timestamp = new Date().toLocaleTimeString();
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }
});
