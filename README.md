# Audio Transcriber

A web application that converts audio files to text transcripts using OpenAI's Whisper model.

## Setup

### Backend

1. Install Python dependencies:
```bash
pip install -r backend/requirements.txt
```

2. Start the backend server:
```bash
cd backend
uvicorn main:app --reload
```

### Frontend

1. Install Node.js dependencies:
```bash
cd frontend
npm install
```

2. Start the frontend development server:
```bash
npm start
```

## Usage

1. Click the "Choose File" button to select an audio file
2. Click the "Transcribe" button to start the transcription
3. Once complete, the transcription will be displayed and automatically downloaded as a text file

## Requirements

- Python 3.8+
- Node.js 14+
- An internet connection for downloading the Whisper model (first time only)
