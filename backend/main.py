import os
import uuid
import subprocess
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="PDF-Flow Backend API", version="1.0.0")

# Enable CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = "temp_files"
os.makedirs(TEMP_DIR, exist_ok=True)

class ConversionResponse(BaseModel):
    message: str
    filename: str

def cleanup_files(file_paths: list[str]):
    """Background task to ensure zero-retention policy."""
    for path in file_paths:
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception as e:
            print(f"Error cleaning up file {path}: {e}")

@app.get("/")
def read_root():
    return {"status": "PDF-Flow Conversion API is running.", "policy": "Zero-Retention Enforced"}

@app.post("/convert/office-to-pdf")
async def convert_office_to_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Accepts .docx, .doc, .pptx, .ppt files and converts them to PDF using LibreOffice headless.
    """
    allowed_extensions = {".docx", ".doc", ".pptx", ".ppt"}
    ext = os.path.splitext(file.filename)[1].lower()
    
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Invalid file type. Only Word and PowerPoint formats are supported.")

    session_id = str(uuid.uuid4())
    input_filename = f"{session_id}{ext}"
    input_path = os.path.join(TEMP_DIR, input_filename)
    
    # Save the uploaded file temporarily
    try:
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Convert using LibreOffice Headless
    # Note: LibreOffice MUST be installed on the system and in PATH ('soffice' command available)
    try:
        process = subprocess.run(
            [
                "soffice",
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                TEMP_DIR,
                input_path
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        if process.returncode != 0:
            print(f"LibreOffice Error: {process.stderr}")
            raise HTTPException(status_code=500, detail="Conversion process failed.")

        output_filename = f"{session_id}.pdf"
        output_path = os.path.join(TEMP_DIR, output_filename)

        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail="Converted PDF file not found.")

        # Schedule the deletion of both the input office file and output PDF
        # after the response has been sent to the client.
        background_tasks.add_task(cleanup_files, [input_path, output_path])

        return FileResponse(
            path=output_path,
            filename=f"{os.path.splitext(file.filename)[0]}.pdf",
            media_type="application/pdf"
        )

    except Exception as e:
        # Emergency cleanup if conversion crashes mid-way
        cleanup_files([input_path])
        raise HTTPException(status_code=500, detail=str(e))
