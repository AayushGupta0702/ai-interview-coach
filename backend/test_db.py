import json
from database import SessionLocal, engine, Base
import models

def test_db_setup():
    print("Initializing database connection...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Create a mock candidate
        print("Inserting mock candidate...")
        candidate = models.Candidate(role="Senior DevOps Architect")
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
        print(f"Candidate created. ID: {candidate.id}")
        
        # Create a mock interview session evaluation linked to candidate
        print("Inserting mock interview details...")
        interview = models.Interview(
            candidate_id=candidate.id,
            composite_score=88,
            content_score=85,
            eye_contact_score=90,
            posture_score=95,
            dominant_expression="Neutral",
            strengths=json.dumps(["Strong background in Docker", "Excellent communication"]),
            weaknesses=json.dumps(["Answer 2 could have had more metrics"]),
            detailed_evaluations=json.dumps([{
                "question_id": 1,
                "score": 85,
                "feedback": "Clear explanation",
                "sample_ideal_answer": "STAR format"
            }]),
            history_transcript=json.dumps([{
                "question": "What is Docker?",
                "answer": "A containerization tool",
                "eye_contact_scores": [90],
                "posture_scores": [95],
                "expression_log": ["Neutral"]
            }])
        )
        db.add(interview)
        db.commit()
        db.refresh(interview)
        print(f"Interview created. ID: {interview.id}")
        
        # Querying to check
        print("\nQuerying DB for candidate's interviews...")
        queried_candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate.id).first()
        print(f"Query check: Candidate Role: {queried_candidate.role}")
        print(f"Relationship check: Number of interviews: {len(queried_candidate.interviews)}")
        print(f"Interview details: Composite Score: {queried_candidate.interviews[0].composite_score}%")
        
        # Clean up mock database records
        print("\nCleaning up mock records...")
        db.delete(interview)
        db.delete(candidate)
        db.commit()
        print("Cleanup completed.")
        print("\nDatabase verification: OK")
        
    except Exception as e:
        db.rollback()
        print(f"Error occurred: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    test_db_setup()
