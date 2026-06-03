import os
import json
import logging
from io import BytesIO
from pypdf import PdfReader
import google.generativeai as genai

logger = logging.getLogger("interview_engine")

# Try to configure Gemini API
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    logger.info("Gemini API configured successfully.")
else:
    logger.warning("GEMINI_API_KEY environment variable is not set. Using mock question generation and mock evaluations.")

class InterviewEngine:
    @staticmethod
    def extract_text_from_pdf(pdf_content: bytes) -> str:
        """Extracts text from PDF bytes."""
        try:
            reader = PdfReader(BytesIO(pdf_content))
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text.strip()
        except Exception as e:
            logger.error(f"Error reading PDF: {e}")
            raise ValueError("Could not parse PDF. Please verify the file format.")

    @staticmethod
    def generate_questions(resume_text: str, target_role: str, num_questions: int = 5) -> list:
        """Generates tailored interview questions based on resume and target role."""
        if not GEMINI_API_KEY:
            return InterviewEngine._get_mock_questions(target_role)

        prompt = f"""
        You are an elite Tech Lead and Recruiter. Your task is to generate {num_questions} interview questions for a candidate applying for the role of '{target_role}'.
        
        Analyze the candidate's resume/CV details provided below to tailor the questions:
        ----
        {resume_text[:4000]}
        ----
        
        Generate exactly {num_questions} questions. 
        - 3 questions should be deep technical questions specifically probing technologies, architecture, or experiences listed on their resume.
        - 2 questions should be behavioral or system-design questions tailored to the level of their experience.
        
        Your response MUST be a valid JSON array of objects, and contain NO extra text or markdown formatting blocks (do not wrap in ```json).
        Each object in the array must follow this exact schema:
        {{
            "id": int,
            "question": "string",
            "category": "Technical" or "Behavioral" or "System Design",
            "expected_keywords": ["keyword1", "keyword2", "keyword3"]
        }}
        """

        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            clean_text = response.text.strip()
            
            # Clean markdown code blocks if the model generated them
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]
            clean_text = clean_text.strip()
            
            questions = json.loads(clean_text)
            return questions
        except Exception as e:
            logger.error(f"Error generating questions with Gemini: {e}. Falling back to mock questions.")
            return InterviewEngine._get_mock_questions(target_role)

    @staticmethod
    def evaluate_answers(target_role: str, interview_history: list) -> dict:
        """
        Evaluates the interview performance (transcript + CV metrics).
        interview_history is a list of:
        {
            "question": str,
            "category": str,
            "answer": str,
            "eye_contact_scores": list of float,
            "posture_scores": list of float,
            "expression_log": list of str
        }
        """
        # Calculate CV summaries
        overall_eye_contact_score = 100
        overall_posture_score = 100
        
        all_eye_scores = []
        all_posture_scores = []
        expressions_freq = {}
        
        for q in interview_history:
            if q.get("eye_contact_scores"):
                all_eye_scores.extend(q["eye_contact_scores"])
            if q.get("posture_scores"):
                all_posture_scores.extend(q["posture_scores"])
            if q.get("expression_log"):
                for exp in q["expression_log"]:
                    expressions_freq[exp] = expressions_freq.get(exp, 0) + 1
                    
        if all_eye_scores:
            overall_eye_contact_score = int(sum(all_eye_scores) / len(all_eye_scores))
        if all_posture_scores:
            overall_posture_score = int(sum(all_posture_scores) / len(all_posture_scores))
            
        dominant_expression = max(expressions_freq, key=expressions_freq.get) if expressions_freq else "Neutral"
        
        if not GEMINI_API_KEY:
            return InterviewEngine._get_mock_evaluation(target_role, interview_history, overall_eye_contact_score, overall_posture_score, dominant_expression)
            
        # Formulate prompt for grading content
        q_a_pairs_text = ""
        for i, q in enumerate(interview_history):
            q_a_pairs_text += f"\nQuestion {i+1} ({q['category']}): {q['question']}\nCandidate Answer: {q['answer']}\n"
            
        prompt = f"""
        You are a hiring manager evaluating a candidate's mock interview performance for a '{target_role}' position.
        Below are the questions and the candidate's transcribed answers:
        ----
        {q_a_pairs_text}
        ----
        
        Evaluate the answers for:
        1. Technical depth and accuracy (for technical/system design questions).
        2. Structured storytelling (e.g., STAR method for behavioral questions).
        3. Communication clarity and fluff reduction.
        
        Provide your evaluation as a valid JSON object with the exact keys described below. Do not output any markdown blocks or extra text (no ```json).
        
        Schema:
        {{
            "overall_content_score": int (0-100),
            "strengths": ["strength1", "strength2"],
            "weaknesses": ["weakness1", "weakness2"],
            "question_evaluations": [
                {{
                    "question_id": int,
                    "score": int (0-100),
                    "feedback": "constructive explanation of their answer",
                    "sample_ideal_answer": "a brief high-quality example of how they should have answered"
                }}
            ]
        }}
        """
        
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            clean_text = response.text.strip()
            
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]
            clean_text = clean_text.strip()
            
            evaluation = json.loads(clean_text)
            
            # Combine Content + CV evaluations
            content_weight = 0.7
            cv_weight = 0.3
            behavioral_score = int((overall_eye_contact_score + overall_posture_score) / 2)
            
            final_composite_score = int(
                (evaluation["overall_content_score"] * content_weight) +
                (behavioral_score * cv_weight)
            )
            
            report = {
                "role": target_role,
                "composite_score": final_composite_score,
                "content_score": evaluation["overall_content_score"],
                "eye_contact_score": overall_eye_contact_score,
                "posture_score": overall_posture_score,
                "dominant_expression": dominant_expression,
                "strengths": evaluation["strengths"],
                "weaknesses": evaluation["weaknesses"],
                "detailed_evaluations": evaluation["question_evaluations"]
            }
            return report
        except Exception as e:
            logger.error(f"Error evaluating answers with Gemini: {e}")
            return InterviewEngine._get_mock_evaluation(target_role, interview_history, overall_eye_contact_score, overall_posture_score, dominant_expression)

    @staticmethod
    def _get_mock_questions(target_role: str) -> list:
        """Returns mock questions based on the target role."""
        return [
            {
                "id": 1,
                "question": f"Can you describe your experience building systems related to {target_role}? Mention the core tech stack you used.",
                "category": "Technical",
                "expected_keywords": ["architecture", "scaling", "database", "API"]
            },
            {
                "id": 2,
                "question": "Tell me about a time you faced a difficult technical bug in production. How did you debug and resolve it?",
                "category": "Behavioral",
                "expected_keywords": ["root cause", "monitoring", "post-mortem", "collaboration"]
            },
            {
                "id": 3,
                "question": "How do you optimize performance and state management in a high-traffic web application?",
                "category": "Technical",
                "expected_keywords": ["caching", "indexing", "memoization", "CDN"]
            },
            {
                "id": 4,
                "question": "How do you keep up with changes in modern technologies, especially developments in Artificial Intelligence?",
                "category": "Behavioral",
                "expected_keywords": ["newsletter", "open source", "prototyping", "research"]
            },
            {
                "id": 5,
                "question": "If you had to design a live chat system, how would you structure the real-time messaging layer and handle concurrency?",
                "category": "System Design",
                "expected_keywords": ["WebSockets", "Redis pub/sub", "concurrency", "load balancing"]
            }
        ]

    @staticmethod
    def _get_mock_evaluation(target_role: str, history: list, eye_contact: int, posture: int, expression: str) -> dict:
        """Fallback mock evaluation if Gemini API is disabled or fails."""
        score = 82
        q_evals = []
        for i, item in enumerate(history):
            q_evals.append({
                "question_id": i + 1,
                "score": 85 if len(item["answer"]) > 50 else 70,
                "feedback": "Good attempt. Your explanation covered basic details but could be structured better.",
                "sample_ideal_answer": "Focus on stating the problem, your action, and quantifiable business outcome."
            })
            
        return {
            "role": target_role,
            "composite_score": int((score * 0.7) + (((eye_contact + posture) / 2) * 0.3)),
            "content_score": score,
            "eye_contact_score": eye_contact,
            "posture_score": posture,
            "dominant_expression": expression,
            "strengths": [
                "Good technical keyword usage.",
                "Consistently detailed answers indicating depth of work experience."
            ],
            "weaknesses": [
                "Could sit more upright (slouching detected occasionally).",
                "Try to maintain consistent eye contact directly with the camera while formulating complex answers."
            ],
            "detailed_evaluations": q_evals
        }
