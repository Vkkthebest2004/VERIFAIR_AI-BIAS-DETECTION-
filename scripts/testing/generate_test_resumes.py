
import os
import random
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch

# ─── Configuration ───
OUTPUT_DIR = "test_inputs/resume_batch"
SELECTED_DIR = os.path.join(OUTPUT_DIR, "selected")
REJECTED_DIR = os.path.join(OUTPUT_DIR, "rejected")

# Candidates for Bias Testing:
# Selected Group:
# - Common Hindu/General names
# - Top-tier colleges (IITs, NITs)
# - Strong skills (Python, ML, AWS)
# - Positive interview notes
SELECTED_CANDIDATES = [
    {"name": "Aditya Sharma", "college": "IIT Bombay", "skills": "Python; React; AWS", "notes": "Excellent candidate, strong technical background, impressive communication skills."},
    {"name": "Sneha Iyer", "college": "IIT Madras", "skills": "Java; Spring; Docker", "notes": "Outstanding performance, brilliant problem solving, highly recommend for the team."},
    {"name": "Rohan Gupta", "college": "NIT Trichy", "skills": "JavaScript; Node; MongoDB", "notes": "Strong candidate, good fit for the team, confident and articulate."},
    {"name": "Priya Reddy", "college": "BITS Pilani", "skills": "Data Science; Python; SQL", "notes": "Exceptional candidate, top performer, outstanding project portfolio."},
    {"name": "Vikram Singh", "college": "IIT Delhi", "skills": "ML; Python; PyTorch", "notes": "Brilliant mind, proactive and innovative approach to complex problems."},
    {"name": "Anjali Mehta", "college": "IIIT Hyderabad", "skills": "Python; FastAPI; React", "notes": "Good fit for team culture, excellent communication, technically sound."},
    {"name": "Karthik Rao", "college": "NIT Warangal", "skills": "Java; AWS; Docker", "notes": "Great fit, proactive and innovative, strong leadership potential."},
    {"name": "Divya Nair", "college": "IIT Kanpur", "skills": "ML; Deep Learning; Python", "notes": "Exceptional top candidate, outstanding academic record and project work."},
    {"name": "Arjun Patel", "college": "IIT Roorkee", "skills": "Data Engineering; Python; Spark", "notes": "Brilliant, outstanding, highly recommend, top candidate."},
    {"name": "Nikhil Bansal", "college": "BITS Goa", "skills": "Full Stack; React; Node", "notes": "Excellent communication, strong candidate, polished and professional."},
]

# Rejected Group:
# - Muslim/SC-ST surnames (Name Bias)
# - Lower-tier colleges (College Bias)
# - Similar skills but rejected
# - Negative/Coded notes ("culture fit", "polish", "communication")
REJECTED_CANDIDATES = [
    {"name": "Mohammed Khan", "college": "Regional Engineering College", "skills": "React; TypeScript; AWS", "notes": "Articulate but not sure about culture fit, needs more grooming."},
    {"name": "Fatima Ansari", "college": "State University Lucknow", "skills": "JavaScript; React; Node", "notes": "Not polished, communication issues, regional accent might be a concern."},
    {"name": "Rajesh Yadav", "college": "Manipal Institute", "skills": "Python; ML; TensorFlow", "notes": "Mediocre performance, not professional enough, different background."},
    {"name": "Imran Qureshi", "college": "Jamia Millia Islamia", "skills": "Python; ML; NLP", "notes": "Strong technical skills but communication issues, not polished enough for client facing roles."},
    {"name": "Ravi Paswan", "college": "Tier 3 College Patna", "skills": "Python; Django; React", "notes": "Not confident, rough around the edges, vernacular medium background."},
    {"name": "Meera Gowda", "college": "Regional College Karnataka", "skills": "Java; Spring; Angular", "notes": "Lacks confidence, not sure about fit for our fast-paced culture."},
    {"name": "Zara Pathan", "college": "Local Engineering College", "skills": "React; Node; Express", "notes": "Not from target school, needs more polish, small town background."},
]

def create_resume_pdf(candidate, output_path):
    c = canvas.Canvas(output_path, pagesize=letter)
    width, height = letter
    
    # Header
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1 * inch, height - 1 * inch, candidate["name"])
    
    # Contact Info (Fake)
    c.setFont("Helvetica", 10)
    c.drawString(1 * inch, height - 1.25 * inch, "Email: candidate@example.com | Phone: +91-9876543210")
    c.line(1 * inch, height - 1.35 * inch, width - 1 * inch, height - 1.35 * inch)
    
    # Education
    y = height - 1.75 * inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1 * inch, y, "EDUCATION")
    y -= 0.25 * inch
    c.setFont("Helvetica", 11)
    c.drawString(1 * inch, y, f"Bachelor of Technology in Computer Science")
    y -= 0.2 * inch
    c.drawString(1 * inch, y, f"{candidate['college']}")
    y -= 0.2 * inch
    c.drawString(1 * inch, y, "2020 - 2024 | CGPA: 8.5/10")
    
    # Skills
    y -= 0.5 * inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1 * inch, y, "SKILLS")
    y -= 0.25 * inch
    c.setFont("Helvetica", 11)
    c.drawString(1 * inch, y, candidate["skills"])
    
    # Experience (Fake)
    y -= 0.5 * inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1 * inch, y, "EXPERIENCE")
    y -= 0.25 * inch
    c.setFont("Helvetica-Bold", 11)
    c.drawString(1 * inch, y, "Software Engineer Intern | Tech Corp")
    y -= 0.2 * inch
    c.setFont("Helvetica", 11)
    c.drawString(1 * inch, y, "May 2023 - July 2023")
    y -= 0.2 * inch
    c.drawString(1.2 * inch, y, "- Developed scalable backend services using Python and Flask.")
    y -= 0.2 * inch
    c.drawString(1.2 * inch, y, "- Optimized database queries improving performance by 20%.")
    
    # Interviewer Notes (Hidden/Metadata section simulation - often appended or in separate forms, 
    # but for this test we'll append it at the bottom distinctively)
    y -= 1.0 * inch
    c.setFont("Helvetica-Bold", 10)
    c.drawString(1 * inch, y, "INTERVIEWER FEEDBACK (INTERNAL USE):")
    y -= 0.2 * inch
    c.setFont("Helvetica-Oblique", 10)
    c.drawString(1 * inch, y, candidate["notes"])
    
    c.save()

def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
    if not os.path.exists(SELECTED_DIR):
        os.makedirs(SELECTED_DIR)
    if not os.path.exists(REJECTED_DIR):
        os.makedirs(REJECTED_DIR)
        
    print(f"Generating resumes in {OUTPUT_DIR}...")
    
    # Generate Selected
    for i, cand in enumerate(SELECTED_CANDIDATES):
        filename = f"{cand['name'].replace(' ', '_')}_{i+1}.pdf"
        output_path = os.path.join(SELECTED_DIR, filename)
        create_resume_pdf(cand, output_path)
        print(f"Created: {output_path}")

    # Generate Rejected
    for i, cand in enumerate(REJECTED_CANDIDATES):
        filename = f"{cand['name'].replace(' ', '_')}_{i+1}.pdf"
        output_path = os.path.join(REJECTED_DIR, filename)
        create_resume_pdf(cand, output_path)
        print(f"Created: {output_path}")
        
    print("\nBatch generation complete!")
    print(f"Total Selected: {len(SELECTED_CANDIDATES)}")
    print(f"Total Rejected: {len(REJECTED_CANDIDATES)}")

if __name__ == "__main__":
    main()
