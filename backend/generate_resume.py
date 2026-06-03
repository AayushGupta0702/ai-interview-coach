import os
import sys

# Proactively install reportlab if not present
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
except ImportError:
    print("Reportlab not found. Installing reportlab dynamically...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "reportlab"])
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors

def create_resume_pdf(filename="D:\\ai-interview-coach\\sample_resume.pdf"):
    # Target letter page setup with standard margins
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Palette: Deep Indigo, Warm Slate, Cyber Amber/Gold
    PRIMARY_COLOR = colors.HexColor("#0B0E19")
    ACCENT_COLOR = colors.HexColor("#C5A85C")
    TEXT_COLOR = colors.HexColor("#333333")
    
    # Modify/Create Paragraph Styles
    title_style = ParagraphStyle(
        'ResumeTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=PRIMARY_COLOR,
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'ResumeSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=14,
        textColor=ACCENT_COLOR,
        spaceAfter=15
    )
    
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=PRIMARY_COLOR,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'ResumeBody',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=TEXT_COLOR,
        spaceAfter=5
    )
    
    bullet_style = ParagraphStyle(
        'ResumeBullet',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=3
    )

    story = []
    
    # Header Section
    story.append(Paragraph("Alex Mercer", title_style))
    story.append(Paragraph("FULL STACK PYTHON DEVELOPER", subtitle_style))
    
    # Contact Info line
    contact_text = "<b>Email:</b> alex.mercer@email.com  |  <b>Phone:</b> +1 (555) 019-2834  |  <b>GitHub:</b> github.com/alexmercer  |  <b>Location:</b> New York, NY"
    story.append(Paragraph(contact_text, body_style))
    story.append(Spacer(1, 10))
    
    # Horizontal line helper
    def get_divider():
        t = Table([[""]], colWidths=[532])
        t.setStyle(TableStyle([
            ('LINEABOVE', (0,0), (-1,-1), 1, ACCENT_COLOR),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
        ]))
        return t
    
    # Summary
    story.append(Paragraph("Professional Summary", section_heading))
    story.append(get_divider())
    story.append(Spacer(1, 6))
    summary_text = (
        "Versatile and results-driven Full Stack Python Developer with 4+ years of professional experience building "
        "high-performance web applications and AI integrated backend services. Proficient in Python web frameworks "
        "(FastAPI, Django) and modern frontend platforms (Next.js, React). Experienced in implementing WebSockets "
        "for real-time telemetry, designing scalable relational/noSQL databases, and managing containerized cloud environments."
    )
    story.append(Paragraph(summary_text, body_style))
    
    # Core Skills
    story.append(Paragraph("Technical Skills", section_heading))
    story.append(get_divider())
    story.append(Spacer(1, 6))
    skills_data = [
        [Paragraph("<b>Languages:</b> Python (OOP, Asyncio), JavaScript (ES6+), SQL, HTML5/CSS3", body_style)],
        [Paragraph("<b>Backend:</b> FastAPI, Django, Flask, REST APIs, WebSockets, Uvicorn", body_style)],
        [Paragraph("<b>Frontend:</b> Next.js, React, Tailwind CSS, Redux, Recharts", body_style)],
        [Paragraph("<b>Databases & Tools:</b> PostgreSQL, Redis, Neo4j, Docker, Git, AWS (S3, EC2)", body_style)]
    ]
    skills_table = Table(skills_data, colWidths=[532])
    skills_table.setStyle(TableStyle([
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(skills_table)
    
    # Experience
    story.append(Paragraph("Professional Experience", section_heading))
    story.append(get_divider())
    story.append(Spacer(1, 6))
    
    # Job 1
    story.append(Paragraph("<b>Senior Full Stack Developer</b>  |  TechNova Solutions, New York, NY", body_style))
    story.append(Paragraph("<i>June 2024 - Present</i>", body_style))
    story.append(Paragraph("• Architected a real-time analytics platform using FastAPI and WebSockets, reducing payload latency by 35%.", bullet_style))
    story.append(Paragraph("• Built an AI-driven text extraction system utilizing the Google Gemini API to parse complex business PDF credentials automatically.", bullet_style))
    story.append(Paragraph("• Managed and structured PostgreSQL databases, implementing optimization indexes that reduced search query response times by 40%.", bullet_style))
    story.append(Spacer(1, 5))
    
    # Job 2
    story.append(Paragraph("<b>Software Engineer (Full Stack)</b>  |  DevCore Systems, Boston, MA", body_style))
    story.append(Paragraph("<i>Jan 2022 - May 2024</i>", body_style))
    story.append(Paragraph("• Developed and styled interactive dashboards in Next.js and Tailwind CSS, generating positive feedback from 5,000+ daily active users.", bullet_style))
    story.append(Paragraph("• Designed and documented secure Python REST APIs using Django REST Framework, ensuring high test coverage.", bullet_style))
    story.append(Paragraph("• Containerized multi-service applications using Docker Compose, streamlining onboarding time for new developers.", bullet_style))
    
    # Personal Projects
    story.append(Paragraph("Key Projects", section_heading))
    story.append(get_divider())
    story.append(Spacer(1, 6))
    
    story.append(Paragraph("<b>AURA: AI Mock Interviewer & Behavioral Analyst</b>", body_style))
    story.append(Paragraph("• Designed a full-stack platform utilizing a FastAPI backend and a Next.js frontend to stream video frames over WebSockets.", bullet_style))
    story.append(Paragraph("• Integrated MediaPipe models to track candidate shoulder posture, face direction, and eye contact telemetry logs in real-time.", bullet_style))
    
    story.append(Paragraph("<b>GraphInsight: GraphRAG Search Engine</b>", body_style))
    story.append(Paragraph("• Engineered an advanced RAG database pipeline using Neo4j to store document relations and vector spaces.", bullet_style))
    
    # Build Document
    doc.build(story)
    print(f"Successfully generated resume PDF at: {filename}")

if __name__ == "__main__":
    create_resume_pdf()
