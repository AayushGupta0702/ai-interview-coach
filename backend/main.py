import logging
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.websockets import WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import uvicorn
import json

from sqlalchemy.orm import Session
import database
import models
from database import get_db

# Initialize database tables on startup
models.Base.metadata.create_all(bind=database.engine)

from cv_analyzer import CVAnalyzer
from interview_engine import InterviewEngine

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main_server")

app = FastAPI(title="AI Interview Coach Backend")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EvaluationRequest(BaseModel):
    role: str
    history: list
    candidate_id: int | None = None

@app.get("/")
def read_root():
    return {"message": "AI Interview Coach API is running with SQL Database."}

@app.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    role: str = Form(...),
    candidate_id: int | None = Form(None),
    db: Session = Depends(get_db)
):
    """
    Uploads a resume PDF, registers/updates Candidate in DB, and generates interview questions.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF resumes are supported.")
    
    try:
        content = await file.read()
        resume_text = InterviewEngine.extract_text_from_pdf(content)
        questions = InterviewEngine.generate_questions(resume_text, role)
        
        # Save or update candidate profile in database
        if candidate_id:
            candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
            if not candidate:
                candidate = models.Candidate(id=candidate_id, role=role)
                db.add(candidate)
            else:
                candidate.role = role
        else:
            candidate = models.Candidate(role=role)
            db.add(candidate)
            
        db.commit()
        db.refresh(candidate)
        
        return {
            "status": "success",
            "role": role,
            "candidate_id": candidate.id,
            "questions": questions
        }
    except Exception as e:
        logger.error(f"Error parsing resume: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/evaluate")
async def evaluate_interview(
    req: EvaluationRequest,
    db: Session = Depends(get_db)
):
    """
    Evaluates the complete transcript and CV logs, and saves results in database.
    """
    try:
        report = InterviewEngine.evaluate_answers(req.role, req.history)
        
        # Save completed session evaluation if candidate_id exists
        if req.candidate_id:
            new_interview = models.Interview(
                candidate_id=req.candidate_id,
                composite_score=report["composite_score"],
                content_score=report["content_score"],
                eye_contact_score=report["eye_contact_score"],
                posture_score=report["posture_score"],
                dominant_expression=report["dominant_expression"],
                strengths=json.dumps(report["strengths"]),
                weaknesses=json.dumps(report["weaknesses"]),
                detailed_evaluations=json.dumps(report["detailed_evaluations"]),
                history_transcript=json.dumps(req.history)
            )
            db.add(new_interview)
            db.commit()
            db.refresh(new_interview)
            report["interview_id"] = new_interview.id
            
        return report
    except Exception as e:
        logger.error(f"Error evaluating interview: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to compile report: {str(e)}")

@app.get("/history")
def get_interview_history(db: Session = Depends(get_db)):
    """Retrieves all past interview sessions."""
    try:
        interviews = db.query(models.Interview).order_by(models.Interview.created_at.desc()).all()
        history_list = []
        for intv in interviews:
            history_list.append({
                "id": intv.id,
                "role": intv.candidate.role if intv.candidate else "Unknown",
                "composite_score": intv.composite_score,
                "content_score": intv.content_score,
                "eye_contact_score": intv.eye_contact_score,
                "posture_score": intv.posture_score,
                "dominant_expression": intv.dominant_expression,
                "created_at": intv.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
        return history_list
    except Exception as e:
        logger.error(f"Error retrieving history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/report/{interview_id}")
def get_interview_report(interview_id: int, db: Session = Depends(get_db)):
    """Retrieves a specific past interview report."""
    try:
        intv = db.query(models.Interview).filter(models.Interview.id == interview_id).first()
        if not intv:
            raise HTTPException(status_code=404, detail="Report not found.")
            
        return {
            "id": intv.id,
            "role": intv.candidate.role if intv.candidate else "Unknown",
            "composite_score": intv.composite_score,
            "content_score": intv.content_score,
            "eye_contact_score": intv.eye_contact_score,
            "posture_score": intv.posture_score,
            "dominant_expression": intv.dominant_expression,
            "strengths": json.loads(intv.strengths),
            "weaknesses": json.loads(intv.weaknesses),
            "detailed_evaluations": json.loads(intv.detailed_evaluations),
            "history_transcript": json.loads(intv.history_transcript),
            "created_at": intv.created_at.strftime("%Y-%m-%d %H:%M:%S")
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error retrieving report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/candidate/{candidate_id}")
def get_candidate_profile(candidate_id: int, db: Session = Depends(get_db)):
    """Fetches candidate profile and their historical mock sessions."""
    try:
        candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate ID not found.")
        
        interviews = db.query(models.Interview).filter(models.Interview.candidate_id == candidate_id).order_by(models.Interview.created_at.desc()).all()
        history_list = []
        for intv in interviews:
            history_list.append({
                "id": intv.id,
                "role": candidate.role,
                "composite_score": intv.composite_score,
                "content_score": intv.content_score,
                "eye_contact_score": intv.eye_contact_score,
                "posture_score": intv.posture_score,
                "dominant_expression": intv.dominant_expression,
                "created_at": intv.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
        return {
            "candidate_id": candidate.id,
            "role": candidate.role,
            "history": history_list
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error retrieving candidate: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/report/{interview_id}")
def delete_interview_report(interview_id: int, db: Session = Depends(get_db)):
    """Deletes a specific interview evaluation session."""
    intv = db.query(models.Interview).filter(models.Interview.id == interview_id).first()
    if not intv:
        raise HTTPException(status_code=404, detail="Report not found.")
    
    try:
        db.delete(intv)
        db.commit()
        return {"status": "success", "message": f"Report {interview_id} deleted successfully."}
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/interview")
async def websocket_endpoint(websocket: WebSocket):
    """
    Handles real-time CV analysis over WebSockets.
    Processes base64 frames and returns posture, eye contact, and emotion.
    """
    await websocket.accept()
    analyzer = CVAnalyzer()
    logger.info("WebSocket connection established for CV analysis.")
    
    try:
        while True:
            # Expecting text data containing JSON
            data = await websocket.receive_text()
            message = json.loads(data)
            
            msg_type = message.get("type")
            
            if msg_type == "frame":
                frame_data = message.get("data")
                if not frame_data:
                    await websocket.send_json({"type": "error", "message": "Missing frame data"})
                    continue
                
                # Analyze frame
                metrics = analyzer.analyze_frame(frame_data)
                
                # Send analysis back to frontend
                await websocket.send_json({
                    "type": "metrics",
                    "metrics": metrics
                })
                
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                
            else:
                await websocket.send_json({"type": "error", "message": f"Unsupported message type: {msg_type}"})
                
    except WebSocketDisconnect:
        logger.info("WebSocket connection disconnected.")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
