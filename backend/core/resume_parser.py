"""
============================================================================
  VERIFAIR — Resume Parser / Information Extractor
============================================================================

  Extracts structured candidate information from raw resume text.
  Uses regex + heuristic NLP to pull:
    - Candidate Name
    - College / University
    - Skills
    - Years of Experience
    - Email / Phone (for de-identification)

  Designed for Indian IT resumes but works broadly.
============================================================================
"""

import re
import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger("ResumeParser")

# ─── Indian College Patterns (for detection) ───
COLLEGE_PATTERNS = [
    # IITs
    r'(?:indian\s+institute\s+of\s+technology|iit)\s*[\-,]?\s*(\w+)?',
    # IIMs
    r'(?:indian\s+institute\s+of\s+management|iim)\s*[\-,]?\s*(\w+)?',
    # NITs
    r'(?:national\s+institute\s+of\s+technology|nit)\s*[\-,]?\s*(\w+)?',
    # BITS
    r'bits?\s*[\-,]?\s*pilani|birla\s+institute',
    # IIITs
    r'iiit\s*[\-,]?\s*(\w+)?',
    # Other Top
    r'jadavpur\s+university', r'anna\s+university', r'delhi\s+university',
    r'jnu|jawaharlal\s+nehru\s+university', r'bhu|banaras\s+hindu\s+university',
    # Tier 2
    r'vit\s+vellore|vit\s+university', r'srm\s+university|srm\s+institute',
    r'manipal\s+(?:institute|university)', r'thapar\s+(?:institute|university)',
    r'dtu|delhi\s+technological', r'nsit|netaji\s+subhas',
    r'coep|college\s+of\s+engineering\s+pune',
    # Generic
    r'university\s+of\s+\w+', r'institute\s+of\s+technology',
    r'engineering\s+college', r'polytechnic',
    # International
    r'stanford\s+university', r'mit|massachusetts\s+institute',
    r'harvard\s+university', r'oxford\s+university', r'cambridge\s+university',
]

# Common degree keywords
DEGREE_PATTERNS = [
    r'b\.?\s*tech', r'b\.?\s*e\.?', r'm\.?\s*tech', r'm\.?\s*e\.?',
    r'b\.?\s*sc', r'm\.?\s*sc', r'b\.?\s*ca', r'm\.?\s*ca',
    r'mba', r'phd', r'ph\.?\s*d', r'diploma',
    r'bachelor', r'master', r'doctorate',
    r'b\.?\s*com', r'm\.?\s*com',
]

# Technical skills (common in Indian IT)
SKILL_KEYWORDS = [
    # Languages
    'python', 'java', 'javascript', 'typescript', 'c\\+\\+', 'c#', 'go', 'golang',
    'ruby', 'php', 'swift', 'kotlin', 'rust', 'scala', 'perl', 'r\\b',
    # Frameworks
    'react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'spring',
    'fastapi', 'rails', 'laravel', 'next\\.?js', 'nuxt',
    # Data / ML
    'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'keras',
    'pandas', 'numpy', 'scikit', 'nlp', 'computer vision', 'data science',
    'big data', 'hadoop', 'spark', 'kafka',
    # Cloud / DevOps
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'ci/cd', 'jenkins',
    'terraform', 'ansible', 'linux', 'devops',
    # Databases
    'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch',
    'oracle', 'cassandra', 'dynamodb',
    # Other
    'rest', 'graphql', 'microservices', 'agile', 'scrum', 'git',
    'html', 'css', 'sass', 'tailwind',
]

# Experience patterns
EXPERIENCE_PATTERNS = [
    r'(\d+)\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|exp)',
    r'experience\s*[:\-]?\s*(\d+)\+?\s*(?:years?|yrs?)',
    r'total\s+(?:experience|exp)\s*[:\-]?\s*(\d+)',
    r'(\d+)\+?\s*(?:years?|yrs?)\s+(?:in|of)\s+(?:software|it|development|engineering)',
    r'worked?\s+(?:for|since)\s+(\d+)\s*(?:years?|yrs?)',
]


class ResumeParser:
    """
    Extracts structured information from resume text.
    Returns a candidate dict compatible with ResumeBiasAnalyzer.
    """

    @staticmethod
    def parse(text: str, filename: str = "", is_selected: bool = False) -> Dict[str, Any]:
        """
        Parse resume text into structured candidate data.
        
        Args:
            text: Raw resume text (from PDF extraction)
            filename: Original filename (used for name fallback)
            is_selected: Whether this candidate was marked as selected
            
        Returns:
            Dict with keys: name, selected, college, skills, experience, notes (full text)
        """
        if not text or not text.strip():
            return {
                "name": filename or "Unknown",
                "selected": is_selected,
                "college": "",
                "skills": "",
                "experience": None,
                "notes": "",
                "identity": "Unknown",
            }

        text_clean = text.strip()

        # Extract each field
        name = ResumeParser._extract_name(text_clean, filename)
        college = ResumeParser._extract_college(text_clean)
        skills = ResumeParser._extract_skills(text_clean)
        experience = ResumeParser._extract_experience(text_clean)
        identity = ResumeParser._infer_identity_from_name(name)

        return {
            "name": name,
            "selected": is_selected,
            "college": college,
            "skills": ";".join(skills),
            "experience": experience,
            "notes": text_clean[:2000],  # First 2000 chars as context
            "identity": identity,
            "score": None,  # No score from resume alone
        }

    @staticmethod
    def _extract_name(text: str, filename: str) -> str:
        """
        Extract candidate name from resume.
        Heuristic: The first prominent line is usually the name.
        """
        lines = text.split('\n')

        for line in lines[:10]:  # Check first 10 lines
            line = line.strip()
            if not line:
                continue

            # Skip lines that are clearly not names
            lower = line.lower()
            if any(skip in lower for skip in [
                'resume', 'curriculum', 'vitae', 'cv', 'objective',
                'summary', 'profile', 'contact', 'phone', 'email',
                'address', 'http', 'www', '@', 'linkedin',
            ]):
                continue

            # Skip lines with too many words (likely a paragraph)
            words = line.split()
            if len(words) > 5:
                continue

            # Skip lines that are purely numbers or special chars
            if re.match(r'^[\d\s\-\+\(\)]+$', line):
                continue

            # Name should have at least 2 characters, mostly alpha
            alpha_ratio = sum(1 for c in line if c.isalpha()) / max(len(line), 1)
            if len(line) >= 2 and alpha_ratio > 0.6 and len(words) <= 4:
                # Clean up any trailing stuff like designations
                name = re.sub(r'\s*[\(\|,].*$', '', line).strip()
                if name:
                    return name

        # Fallback to filename
        if filename:
            # Remove extension and common prefixes
            name = re.sub(r'\.(pdf|doc|docx|txt)$', '', filename, flags=re.IGNORECASE)
            name = re.sub(r'(resume|cv|_|-|selected|rejected)', ' ', name, flags=re.IGNORECASE)
            name = name.strip()
            if name:
                return name

        return "Unknown Candidate"

    @staticmethod
    def _extract_college(text: str) -> str:
        """Extract the most prominent college/university from resume text."""
        text_lower = text.lower()

        # Check all college patterns
        for pattern in COLLEGE_PATTERNS:
            match = re.search(pattern, text_lower)
            if match:
                # Get the full match and clean it up
                start = max(0, match.start() - 5)
                end = min(len(text), match.end() + 30)
                context = text[start:end].strip()

                # Extract just the institution name
                institution = match.group(0).strip()
                # Capitalize properly
                return institution.title()

        # Fallback: Look for "University" or "Institute" or "College"
        generic_match = re.search(
            r'(?:[\w\s]+(?:university|institute|college|school)[\w\s]*)',
            text_lower
        )
        if generic_match:
            name = generic_match.group(0).strip()
            # Limit length and clean
            name = name[:60].strip()
            return name.title()

        return ""

    @staticmethod
    def _extract_skills(text: str) -> List[str]:
        """Extract technical skills from resume text."""
        text_lower = text.lower()
        found_skills = []

        for skill_pattern in SKILL_KEYWORDS:
            if re.search(r'\b' + skill_pattern + r'\b', text_lower):
                # Get the clean name
                clean = skill_pattern.replace('\\b', '').replace('\\.', '.').replace('\\+', '+')
                found_skills.append(clean.strip())

        return list(set(found_skills))[:20]  # Max 20 skills

    @staticmethod
    def _extract_experience(text: str) -> Optional[float]:
        """Extract years of experience from resume text."""
        text_lower = text.lower()

        for pattern in EXPERIENCE_PATTERNS:
            match = re.search(pattern, text_lower)
            if match:
                try:
                    years = float(match.group(1))
                    if 0 < years <= 50:  # Sanity check
                        return years
                except (ValueError, IndexError):
                    continue

        # Fallback: Count date ranges (e.g., "2018 - 2023")
        date_ranges = re.findall(r'(20\d{2})\s*[-–—to]+\s*(20\d{2}|present|current)', text_lower)
        if date_ranges:
            try:
                total_years = 0
                for start, end in date_ranges:
                    start_year = int(start)
                    end_year = 2026 if end in ('present', 'current') else int(end)
                    total_years += max(0, end_year - start_year)
                if total_years > 0:
                    return float(total_years)
            except ValueError:
                pass

        return None

    @staticmethod
    def _infer_identity_from_name(name: str) -> str:
        """
        Attempt to infer demographic identity from name for bias analysis.
        This is intentionally kept simple — the ResumeBiasAnalyzer has its
        own more sophisticated name-proxy community inference.
        We just need a basic group label here.
        """
        if not name or name == "Unknown Candidate":
            return "Unknown"

        # We don't infer specific identities from names in the parser.
        # The analyzer's _infer_community() handles this separately.
        # Here we just store the name and let the analyzer do the work.
        return "Unknown"
