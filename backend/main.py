import openai
import os
import logging
from pydub import AudioSegment
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import tempfile
import traceback
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Get your OpenAI API key from an environment variable
API_KEY = os.getenv("OPENAI_API_KEY")
if not API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable not set. Please create a .env file in the 'backend' directory and add it.")

openai.api_key = API_KEY

# Optional: Change response_format to 'json', 'srt', or 'verbose_json' if you want different output
RESPONSE_FORMAT = "text"

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://localhost(:\d+)?",
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Accept", "Content-Type"],
)

# Max file size for OpenAI Whisper API is 25 MB
MAX_FILE_SIZE_MB = 25
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
WHISPER_PRICE_PER_MINUTE = 0.006  # $0.006 per minute

# Pricing for gpt-4o as of July 2024
GPT4O_PRICE_PER_INPUT_TOKEN = 5.00 / 1_000_000
GPT4O_PRICE_PER_OUTPUT_TOKEN = 15.00 / 1_000_000

def get_file_size(file_path):
    """Get the size of a file in bytes."""
    return os.path.getsize(file_path)

def transcribe_audio_chunk(chunk_path, chunk_index):
    """Transcribe a single audio chunk."""
    logging.info(f"Transcribing chunk {chunk_index} from {chunk_path}...")
    try:
        with open(chunk_path, "rb") as audio_file:
            transcript_result = openai.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format=RESPONSE_FORMAT
            )
        logging.info(f"Transcription complete for chunk {chunk_index}.")
        transcript_text = transcript_result if isinstance(transcript_result, str) else transcript_result.text
        return transcript_text
    except openai.APIError as e:
        logging.error(f"OpenAI API Error for chunk {chunk_index}: {e}")
        raise
    except Exception as e:
        logging.error(f"An unexpected error occurred during chunk {chunk_index} transcription: {e}")
        raise

@app.get("/api/ping")
async def ping_endpoint():
    """Simple test endpoint to verify the API is working."""
    return {"status": "ok", "message": "Backend is up and running"}

def cleanup_file(path: str):
    """Function to remove a file in the background."""
    try:
        os.remove(path)
        logging.info(f"Cleaned up temporary file: {path}")
    except OSError as e:
        logging.error(f"Error cleaning up file {path}: {e}")

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...), conversation_mode: bool = Form(False), background_tasks: BackgroundTasks = BackgroundTasks()):
    logging.info(f"Received transcription request for file: {file.filename}")
    
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=file.filename) as temp_upload_file:
            content = await file.read()
            temp_upload_file.write(content)
            temp_file_path = temp_upload_file.name
        
        logging.info(f"File saved successfully at {temp_file_path}")

        # Get audio duration and calculate cost
        audio = AudioSegment.from_file(temp_file_path)
        duration_minutes = len(audio) / (1000 * 60)
        estimated_cost = duration_minutes * WHISPER_PRICE_PER_MINUTE
        logging.info(f"Audio duration: {duration_minutes:.2f} minutes, Estimated cost: ${estimated_cost:.4f}")

        file_size = get_file_size(temp_file_path)
        logging.info(f"Audio file size: {file_size / (1024 * 1024):.2f} MB")

        if file_size > MAX_FILE_SIZE_BYTES:
            logging.info("File size exceeds 25 MB. Splitting audio into chunks...")
            total_duration_ms = len(audio)
            avg_bytes_per_ms = file_size / total_duration_ms
            target_chunk_duration_ms = (MAX_FILE_SIZE_BYTES * 0.80) / avg_bytes_per_ms
            
            all_transcripts = []
            start_ms = 0
            chunk_index = 0

            while start_ms < total_duration_ms:
                end_ms = min(start_ms + int(target_chunk_duration_ms), total_duration_ms)
                chunk = audio[start_ms:end_ms]
                chunk_index += 1
                
                with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_chunk_file:
                    chunk.export(temp_chunk_file.name, format="mp3")
                    logging.info(f"Created chunk file: {temp_chunk_file.name}")
                    chunk_transcript = transcribe_audio_chunk(temp_chunk_file.name, chunk_index)
                    all_transcripts.append(chunk_transcript)
                    background_tasks.add_task(cleanup_file, temp_chunk_file.name)

                start_ms = end_ms
            
            full_transcript = " ".join(all_transcripts)
            logging.info("All chunks transcribed and combined.")

        else:
            logging.info("File size is within limits. Transcribing directly...")
            with open(temp_file_path, "rb") as audio_file:
                transcript_result = openai.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format=RESPONSE_FORMAT
                )
            full_transcript = transcript_result if isinstance(transcript_result, str) else transcript_result.text
            logging.info("Transcription complete.")

        background_tasks.add_task(cleanup_file, temp_file_path)

        # Step 3: Post-process transcript with GPT-4o
        if conversation_mode:
            logging.info("Conversation mode enabled. Formatting for speakers...")
            system_prompt = (
                "You are an expert in conversation analysis. Your task is to process a raw, unformatted audio transcript and reformat it into a clear, structured dialogue. "
                "Follow these rules precisely:\n"
                "1. Identify distinct speakers in the conversation. Label them sequentially as 'Speaker 1', 'Speaker 2', and so on.\n"
                "2. Pay close attention to conversational cues, turn-taking, and shifts in topic to accurately attribute dialogue to the correct speaker.\n"
                "3. Format each turn as 'Speaker X: [dialogue]'.\n"
                "4. Do not add any extra commentary, summaries, or analysis. Your output should only be the formatted transcript itself."
            )
        else:
            logging.info("Conversation mode disabled. Formatting for readability...")
            system_prompt = "You are a helpful assistant. The user will provide a raw audio transcript. Your task is to reformat it into clean, readable paragraphs with proper spacing. Do not add any commentary, just provide the formatted text."

        try:
            logging.info("Sending transcript to GPT-4o for processing...")
            chat_completion = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": full_transcript}
                ]
            )
            
            final_transcript = chat_completion.choices[0].message.content
            token_usage = chat_completion.usage
            
            # Calculate GPT-4o cost
            gpt4o_cost = (
                (token_usage.prompt_tokens * GPT4O_PRICE_PER_INPUT_TOKEN) +
                (token_usage.completion_tokens * GPT4O_PRICE_PER_OUTPUT_TOKEN)
            )
            logging.info(f"GPT-4o cost: ${gpt4o_cost:.4f}")
            
            total_cost = estimated_cost + gpt4o_cost
            logging.info(f"Total estimated cost: ${total_cost:.4f}")

        except openai.APIError as e:
            logging.error(f"GPT-4o API Error: {e}")
            # If GPT-4o fails, return the raw transcript and whisper cost
            final_transcript = full_transcript
            total_cost = estimated_cost

        return JSONResponse(content={
            "transcript": final_transcript,
            "cost": total_cost
        })

    except openai.APIError as e:
        logging.error(f"OpenAI API Error: {e}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"OpenAI API Error: {e}")
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")