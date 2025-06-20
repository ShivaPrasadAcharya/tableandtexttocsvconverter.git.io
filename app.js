const { useState, useRef, useEffect } = React;

const FileConverter = () => {
    const [activeTab, setActiveTab] = useState('upload');
    const [csvData, setCsvData] = useState('');
    const [textInput, setTextInput] = useState('');
    const [fileInfo, setFileInfo] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    
    const fileInputRef = useRef(null);
    const fileUploadRef = useRef(null);

    useEffect(() => {
        // Initialize with sample data
        const sampleData = `EmpID,Name,Department,Position,Salary,JoinDate,Manager,Email,Phone,Location
E001,"John Smith
Senior Engineer",Engineering,Senior Developer,85000,15-03-2022,Sarah Johnson,john.smith@company.com,+1-555-0101,New York
E002,"Mary Jones
Marketing Lead",Marketing,Marketing Manager,75000,22-05-2021,David Wilson,mary.jones@company.com,+1-555-0102,Los Angeles`;
        
        displayCSV(sampleData);
    }, []);

    const handleDragOver = (e) => {
        e.preventDefault();
        fileUploadRef.current?.classList.add('dragover');
    };

    const handleDragLeave = () => {
        fileUploadRef.current?.classList.remove('dragover');
    };

    const handleDrop = (e) => {
        e.preventDefault();
        fileUploadRef.current?.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    };

    const handleFile = async (file) => {
        setIsLoading(true);
        hideMessages();

        try {
            const fileInfoText = `File: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
            setFileInfo(fileInfoText);

            const fileExtension = file.name.split('.').pop().toLowerCase();
            let csvDataResult = '';

            switch (fileExtension) {
                case 'xlsx':
                case 'xls':
                    csvDataResult = await processExcelFile(file);
                    break;
                case 'docx':
                    csvDataResult = await processWordFile(file);
                    break;
                case 'txt':
                case 'csv':
                    csvDataResult = await processTextFile(file);
                    break;
                default:
                    throw new Error('Unsupported file format. Please use .xlsx, .xls, .docx, .txt, or .csv files.');
            }

            displayCSV(csvDataResult);
            setSuccessMessage('File processed successfully!');

        } catch (error) {
            setErrorMessage(window.FileConverterUtils ? 
                window.FileConverterUtils.handleFileError(error, file.name) : 
                'Error processing file: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const processExcelFile = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellText: false, cellDates: true });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    // Use enhanced processing if available
                    if (window.FileConverterUtils && window.FileConverterUtils.processExcelWithLineBreaks) {
                        const csvDataResult = window.FileConverterUtils.processExcelWithLineBreaks(worksheet);
                        resolve(csvDataResult);
                    } else {
                        // Fallback to original method with enhanced formatting
                        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
                        
                        const csvDataResult = jsonData.map(row => 
                            row.map(cell => {
                                const cellStr = String(cell || '');
                                // Preserve line breaks and handle special characters
                                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') || cellStr.includes('\r')) {
                                    return '"' + cellStr.replace(/"/g, '""') + '"';
                                }
                                return cellStr;
                            }).join(',')
                        ).join('\n');
                        
                        resolve(csvDataResult);
                    }
                } catch (error) {
                    reject(new Error('Failed to parse Excel file: ' + error.message));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read Excel file'));
            reader.readAsArrayBuffer(file);
        });
    };

    const processWordFile = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    const text = result.value;
                    
                    // Use enhanced processing if available
                    if (window.FileConverterUtils && window.FileConverterUtils.processWordWithTables) {
                        const csvDataResult = window.FileConverterUtils.processWordWithTables(text);
                        resolve(csvDataResult);
                    } else {
                        // Fallback to original method
                        const lines = text.split('\n').filter(line => line.trim());
                        const csvDataResult = lines.map(line => {
                            const cells = line.split(/\t+|\s{2,}/).filter(cell => cell.trim());
                            return cells.map(cell => {
                                const cellStr = cell.trim();
                                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') || cellStr.includes('\r')) {
                                    return '"' + cellStr.replace(/"/g, '""') + '"';
                                }
                                return cellStr;
                            }).join(',');
                        }).join('\n');
                        
                        resolve(csvDataResult);
                    }
                } catch (error) {
                    reject(new Error('Failed to parse Word document: ' + error.message));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read Word document'));
            reader.readAsArrayBuffer(file);
        });
    };

    const processTextFile = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const csvDataResult = convertTextToCSV(text);
                    resolve(csvDataResult);
                } catch (error) {
                    reject(new Error('Failed to parse text file: ' + error.message));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read text file'));
            reader.readAsText(file);
        });
    };

    const processTextInput = () => {
        const text = textInput.trim();
        
        if (!text) {
            setErrorMessage('Please enter some text data');
            return;
        }

        try {
            const csvDataResult = convertTextToCSV(text);
            displayCSV(csvDataResult);
            setSuccessMessage('Text converted successfully!');
        } catch (error) {
            setErrorMessage('Error converting text: ' + error.message);
        }
    };

    const convertTextToCSV = (text) => {
        // Use enhanced processing if available
        if (window.FileConverterUtils && window.FileConverterUtils.advancedTextToCSV) {
            return window.FileConverterUtils.advancedTextToCSV(text);
        }
        
        // Fallback to original method with enhanced line break handling
        const lines = text.split('\n').filter(line => line.trim());
        
        const delimiters = ['\t', '|', ';', ',', /\s{2,}/];
        let bestDelimiter = '\t';
        let maxColumns = 0;
        
        for (const delimiter of delimiters) {
            const testLines = lines.slice(0, Math.min(5, lines.length));
            const columnCounts = testLines.map(line => {
                if (delimiter instanceof RegExp) {
                    return line.split(delimiter).length;
                }
                return line.split(delimiter).length;
            });
            
            const avgColumns = columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length;
            if (avgColumns > maxColumns && columnCounts.every(count => count >= avgColumns * 0.8)) {
                maxColumns = avgColumns;
                bestDelimiter = delimiter;
            }
        }
        
        const csvLines = lines.map(line => {
            let cells;
            if (bestDelimiter instanceof RegExp) {
                cells = line.split(bestDelimiter);
            } else {
                cells = line.split(bestDelimiter);
            }
            
            return cells.map(cell => {
                const cellStr = cell.trim();
                // Enhanced line break preservation
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') || cellStr.includes('\r')) {
                    return '"' + cellStr.replace(/"/g, '""') + '"';
                }
                return cellStr;
            }).join(',');
        });
        
        return csvLines.join('\n');
    };

    const displayCSV = (csvDataResult) => {
        setCsvData(csvDataResult);
        createPreviewTable(csvDataResult);
    };

    const createPreviewTable = (csvDataResult) => {
        if (!csvDataResult.trim()) {
            setPreviewData([]);
            return;
        }
        
        try {
            const parsed = Papa.parse(csvDataResult, { header: false });
            const data = parsed.data.filter(row => row.some(cell => cell && cell.trim()));
            
            if (data.length === 0) {
                setPreviewData([]);
                return;
            }
            
            const previewRows = data.slice(0, 11);
            setPreviewData(previewRows);
            
        } catch (error) {
            setPreviewData([]);
        }
    };

    const copyToClipboard = async () => {
        if (!csvData) {
            setErrorMessage('No CSV data to copy');
            return;
        }

        try {
            await navigator.clipboard.writeText(csvData);
            setSuccessMessage('CSV data copied to clipboard!');
        } catch (error) {
            const textArea = document.createElement('textarea');
            textArea.value = csvData;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setSuccessMessage('CSV data copied to clipboard!');
        }
    };

    const downloadCSV = () => {
        if (!csvData) {
            setErrorMessage('No CSV data to download');
            return;
        }

        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'converted_data.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setSuccessMessage('CSV file downloaded!');
    };

    const hideMessages = () => {
        setFileInfo('');
        setErrorMessage('');
        setSuccessMessage('');
    };

    return (
        <div className="container">
            <div className="header">
                <h1>📊 File to CSV Converter</h1>
                <p>Convert Excel, Word documents, and text files to CSV format easily</p>
            </div>

            <div className="main-content">
                <div className="input-section">
                    <div className="tabs">
                        <button 
                            className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
                            onClick={() => setActiveTab('upload')}
                        >
                            📁 File Upload
                        </button>
                        <button 
                            className={`tab ${activeTab === 'text' ? 'active' : ''}`}
                            onClick={() => setActiveTab('text')}
                        >
                            📝 Text Input
                        </button>
                    </div>

                    <div className={`tab-content ${activeTab === 'upload' ? 'active' : ''}`}>
                        <div 
                            ref={fileUploadRef}
                            className="file-upload" 
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <div className="upload-icon">📤</div>
                            <div className="upload-text">Click to upload or drag and drop</div>
                            <div className="upload-subtext">Supports Excel (.xlsx, .xls), Word (.docx), Text (.txt, .csv) files</div>
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                className="file-input" 
                                accept=".xlsx,.xls,.docx,.txt,.csv"
                                onChange={handleFileSelect}
                            />
                        </div>
                    </div>

                    <div className={`tab-content ${activeTab === 'text' ? 'active' : ''}`}>
                        <textarea 
                            className="text-input" 
                            placeholder={`Paste your tabular data here...
Example:
EmpID    Name    Department    Position
E001    John Smith    Engineering    Senior Developer
E002    Mary Jones    Marketing    Marketing Manager`}
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                        />
                        <br /><br />
                        <button className="btn" onClick={processTextInput}>Convert Text to CSV</button>
                    </div>

                    {fileInfo && (
                        <div className="file-info show">
                            {fileInfo}
                        </div>
                    )}
                    
                    {errorMessage && (
                        <div className="error-message show">
                            {errorMessage}
                        </div>
                    )}
                    
                    {successMessage && (
                        <div className="success-message show">
                            {successMessage}
                        </div>
                    )}
                    
                    {isLoading && (
                        <div className="loading show">
                            <div className="spinner"></div>
                            <div>Processing file...</div>
                        </div>
                    )}
                </div>

                <div className="output-section">
                    <div className="output-header">
                        <div className="output-title">📋 CSV Output</div>
                        <div>
                            <button className="btn copy-btn" onClick={copyToClipboard}>📋 Copy</button>
                            <button className="btn download-btn" onClick={downloadCSV}>💾 Download</button>
                        </div>
                    </div>
                    <textarea 
                        className="output-text" 
                        readOnly 
                        placeholder="Your CSV output will appear here..."
                        value={csvData}
                    />
                    {previewData.length > 0 && (
                        <div className="preview-table">
                            <table>
                                <thead>
                                    <tr>
                                        {previewData[0]?.map((cell, index) => (
                                            <th key={index}>{cell || ''}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.slice(1, 11).map((row, rowIndex) => (
                                        <tr key={rowIndex}>
                                            {row.map((cell, cellIndex) => (
                                                <td key={cellIndex}>{cell || ''}</td>
                                            ))}
                                        </tr>
                                    ))}
                                    {previewData.length > 11 && (
                                        <tr>
                                            <td colSpan={previewData[0]?.length} style={{textAlign: 'center', fontStyle: 'italic', color: '#6c757d'}}>
                                                ... and {previewData.length - 11} more rows
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Render the React component
ReactDOM.render(<FileConverter />, document.getElementById('root'));