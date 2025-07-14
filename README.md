<<<<<<< HEAD
# Audio Transcriber App

A web application to transcribe audio files using OpenAI's Whisper API.

## Setup

### Backend

1.  Install Python dependencies:

    ```bash
    pip install -r backend/requirements.txt
    ```

2.  Create a `.env` file in the `backend` directory and add your OpenAI API key:

    ```
    OPENAI_API_KEY='your-api-key-here'
    ```

3.  Start the backend server:

    ```bash
    cd backend
    uvicorn main:app --reload
    ```

### Frontend

1.  Install Node.js dependencies:

    ```bash
    cd frontend
    npm install
    ```

2.  Start the frontend development server:

    ```bash
    npm start
    ```

## Usage

1.  Open your browser to `http://localhost:3000`.
2.  Click the "Choose File" button to select an audio file.
3.  Click the "Transcribe" button to start the transcription.
4.  Once complete, the transcription will be displayed and automatically downloaded as a text file.

## Requirements

-   Python 3.8+
-   Node.js 14+
-   `ffmpeg` installed and available in your system's PATH.

