import React, { useState } from 'react';
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
    const [testResult, setTestResult] = useState('');
  const [cost, setCost] = useState(null);

  const handleFileSelect = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  

  const testBackendConnection = () => {
    setTestResult('Testing connection...');
    
    fetch('/api/ping', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Backend test response:', data);
        setTestResult(`Success! Backend says: ${data.message}`);
      })
      .catch(error => {
        console.error('Backend test error:', error);
        setTestResult(`Error: ${error.message}`);
      });
  };

    const handleTranscribe = async () => {
    if (!selectedFile) return;
    
    setIsLoading(true);
    setTranscription('');
    setCost(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Transcription failed' }));
        throw new Error(errorData.detail);
      }

      const data = await response.json();
      setTranscription(data.transcript);
      setCost(data.cost);

      // Create a download link for the transcript
      const blob = new Blob([data.transcript], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transcript.txt';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error:', error);
      alert(`Failed to transcribe audio: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <h1>Audio Transcriber</h1>
      <button onClick={testBackendConnection} className="test-button">
        Test Backend Connection
      </button>
      <div className="test-result">{testResult}</div>
      <div className="container">
        <div className="upload-section">
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            disabled={isLoading}
          />
          <button
            onClick={handleTranscribe}
            disabled={!selectedFile || isLoading}
          >
            {isLoading ? 'Transcribing...' : 'Transcribe'}
          </button>
        </div>
        {cost !== null && (
          <div className="cost-estimation">
            <p>Estimated Cost: ${cost.toFixed(4)}</p>
          </div>
        )}
        {transcription && (
          <div className="transcription">
            <h2>Transcription:</h2>
            <pre>{transcription}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
