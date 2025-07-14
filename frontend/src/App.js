import React, { useState, useMemo } from 'react';
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
    const [testResult, setTestResult] = useState('');
    const [cost, setCost] = useState(null);
  const [isConversation, setIsConversation] = useState(false);

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

        const handleCopy = () => {
    navigator.clipboard.writeText(transcription).then(() => {
      alert('Transcript copied to clipboard!');
    }, (err) => {
      console.error('Could not copy text: ', err);
      alert('Failed to copy transcript.');
    });
  };

    const formattedTranscript = useMemo(() => {
    if (!transcription) return [];

    const lines = transcription.split('\n');
    const grouped = [];
    let currentGroup = null;

    lines.forEach(line => {
      const speakerMatch = line.match(/^(Speaker \d+):/);
      if (speakerMatch) {
        const speaker = speakerMatch[1];
        const text = line.substring(speakerMatch[0].length).trim();
        if (currentGroup && currentGroup.speaker === speaker) {
          currentGroup.lines.push(text);
        } else {
          if (currentGroup) {
            grouped.push(currentGroup);
          }
          currentGroup = { speaker, lines: [text] };
        }
      } else if (currentGroup) {
        // This handles multi-line paragraphs from a single speaker
        if (line.trim() !== '') {
            currentGroup.lines.push(line.trim());
        }
      } else {
        // Handles text before the first speaker is identified
        if (line.trim() !== '') {
            if (grouped.length > 0 && grouped[grouped.length-1].speaker === 'narration') {
                grouped[grouped.length-1].lines.push(line.trim());
            } else {
                grouped.push({ speaker: 'narration', lines: [line.trim()] });
            }
        }
      }
    });

    if (currentGroup) {
      grouped.push(currentGroup);
    }

    return grouped;
  }, [transcription]);

  const handleTranscribe = async () => {
    if (!selectedFile) return;
    
    setIsLoading(true);
    setTranscription('');
    setCost(null);

        const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('conversation_mode', isConversation);

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
        <div className="options">
          <input
            type="checkbox"
            id="conversationMode"
            checked={isConversation}
            onChange={(e) => setIsConversation(e.target.checked)}
            disabled={isLoading}
          />
          <label htmlFor="conversationMode">Conversation Mode (Identify Speakers)</label>
        </div>
        {cost !== null && (
          <div className="cost-estimation">
            <p>Estimated Cost: ${cost.toFixed(4)}</p>
          </div>
        )}
        {transcription && (
          <div className="transcription-card">
            <div className="transcription-header">
              <h2>Transcription</h2>
              <button onClick={handleCopy} className="copy-button" title="Copy to clipboard">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                  <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zM8 7a.5.5 0 0 1 .5.5V9H10a.5.5 0 0 1 0 1H8.5v1.5a.5.5 0 0 1-1 0V10H6a.5.5 0 0 1 0-1h1.5V7.5A.5.5 0 0 1 8 7z"/>
                  <path d="M2 2a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2zm11-1H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z"/>
                </svg>
              </button>
            </div>
            <div className="transcription-content">
              {formattedTranscript.map((group, index) => (
                <div key={index} className={`speaker-bubble speaker-${(parseInt(group.speaker.replace(/\D/g, ''), 10) % 2) + 1}`}>
                  <strong>{group.speaker}</strong>
                  {group.lines.map((line, lineIndex) => (
                    <p key={lineIndex}>{line}</p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
