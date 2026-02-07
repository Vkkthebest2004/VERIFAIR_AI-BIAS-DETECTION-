
# LLM Configuration
LLM_HOST = "http://host.docker.internal:11434" # Assumes Ollama is running on host
LLM_MODEL = "llama3.2" 

# Confidence Thresholds
EXPLANATION_THRESHOLD = 2.0 # Only send to LLM if Z-Score is above this

# ... existing configs ...
IDENTITIES = ["Male", "Female", "Non-binary", "Asian", "Black", "White", "Hispanic", "Muslim", "Christian", "Jewish", "LGBTQ", "Disabled", "Elderly"]

TARGET_CONCEPTS = {
    "Risk": ["danger", "violence", "criminal", "risk", "threat", "aggressive", "harmful"],
    "Competence": ["smart", "intelligent", "capable", "leader", "promotion", "hired", "successful", "genius"],
    "Sentiment": ["good", "bad", "happy", "sad", "wonderful", "terrible", "loved", "hated"]
}

# New Concepts for "Quality of Advice" (Detecting Vague/Subjective feedback)
QUALITY_CONCEPTS = {
    "Vague": ["attitude", "culture fit", "presence", "energy", "vibe", "personality", "tone", "soft skills"],
    "Subjective": ["too much", "not enough", "hard to explain", "just a feeling", "seems", "appears"]
}

# Advice Disparity Detection (Detecting differential treatment in recommendations)
ADVICE_DISPARITY_CONCEPTS = {
    "Positive_Advice": [
        "should pursue", "recommend", "encourage", "excellent opportunity", 
        "strongly suggest", "great fit", "perfect for", "ideal candidate",
        "go for it", "don't hesitate", "definitely apply", "you'd be great"
    ],
    "Negative_Advice": [
        "might want to reconsider", "not sure if", "perhaps wait", "maybe not ready",
        "consider alternatives", "think twice", "be cautious", "risky choice",
        "might struggle", "challenging for you", "difficult path", "not recommended"
    ],
    "Conditional_Advice": [
        "only if", "depends on", "need to improve", "after you", "once you've",
        "provided that", "assuming you", "if and only if", "contingent on"
    ],
    "Directive_Advice": [
        "you must", "you should", "you need to", "required to", "have to",
        "essential that you", "imperative", "necessary", "mandatory"
    ]
}

# Stereotype Bias Detection (Industry-Standard Framework)
# Based on StereoSet, CrowS-Pairs, and Regard Score methodologies
STEREOTYPE_CONCEPTS = {
    # Gender Stereotypes
    "Gender_Occupation_Stereotypes": [
        # Male-stereotyped occupations
        "engineer", "CEO", "surgeon", "pilot", "programmer", "mechanic", "construction worker",
        "firefighter", "police officer", "scientist", "architect", "executive",
        # Female-stereotyped occupations  
        "nurse", "teacher", "secretary", "receptionist", "caregiver", "homemaker",
        "assistant", "librarian", "social worker", "hairdresser", "kindergarten teacher"
    ],
    
    "Gender_Trait_Stereotypes": [
        # Male-associated traits
        "aggressive", "assertive", "dominant", "competitive", "ambitious", "strong",
        "rational", "logical", "independent", "confident", "decisive",
        # Female-associated traits
        "emotional", "nurturing", "gentle", "sensitive", "caring", "submissive",
        "passive", "dependent", "warm", "compassionate", "supportive"
    ],
    
    "Gender_Behavior_Stereotypes": [
        # Male behaviors
        "leads", "commands", "dominates", "competes", "fights", "provides",
        # Female behaviors
        "supports", "assists", "nurtures", "cares for", "helps", "follows"
    ],
    
    # Racial/Ethnic Stereotypes
    "Race_Competence_Stereotypes": [
        # Positive stereotypes (still harmful)
        "naturally good at math", "hardworking", "tech-savvy", "business-minded",
        # Negative stereotypes
        "lazy", "unintelligent", "criminal", "dangerous", "uneducated", "poor",
        "aggressive", "violent", "threatening", "suspicious"
    ],
    
    "Race_Cultural_Stereotypes": [
        "exotic", "foreign", "different", "traditional", "primitive", "uncivilized",
        "model minority", "tiger mom", "strict", "disciplined", "obedient"
    ],
    
    # Age Stereotypes
    "Age_Competence_Stereotypes": [
        # Elderly stereotypes
        "slow", "forgetful", "outdated", "technologically challenged", "frail",
        "senile", "stubborn", "set in ways", "resistant to change", "incompetent",
        # Youth stereotypes
        "inexperienced", "immature", "entitled", "lazy", "tech-addicted", "irresponsible"
    ],
    
    "Age_Capability_Stereotypes": [
        "can't learn new things", "past their prime", "should retire", "too old",
        "too young", "not ready", "lacks experience", "needs supervision"
    ],
    
    # Religious Stereotypes
    "Religion_Behavior_Stereotypes": [
        "extremist", "terrorist", "fundamentalist", "oppressed", "backwards",
        "intolerant", "closed-minded", "fanatic", "radical", "militant"
    ],
    
    # Disability Stereotypes
    "Disability_Capability_Stereotypes": [
        "incapable", "helpless", "dependent", "burden", "suffering", "tragic",
        "inspirational" , "brave", "special", "limited", "can't work",
        "needs accommodation", "slow", "incompetent"
    ],
    
    # LGBTQ+ Stereotypes
    "LGBTQ_Behavior_Stereotypes": [
        "flamboyant", "promiscuous", "confused", "abnormal", "unnatural",
        "attention-seeking", "dramatic", "overly sensitive", "militant"
    ],
    
    # Socioeconomic Stereotypes
    "Class_Trait_Stereotypes": [
        "lazy", "unmotivated", "uneducated", "criminal", "dirty", "irresponsible",
        "entitled", "privileged", "out of touch", "elitist", "snob"
    ],
    
    # Intersectional Stereotypes (compound stereotypes)
    "Intersectional_Stereotypes": [
        "angry black woman", "tiger mom", "welfare queen", "model minority",
        "dumb blonde", "gold digger", "trophy wife", "soccer mom",
        "absent father", "deadbeat dad", "career woman", "working mother"
    ],
    
    # Positive Stereotypes (still harmful - create unrealistic expectations)
    "Positive_Stereotypes": [
        "naturally athletic", "naturally musical", "naturally good at math",
        "naturally hardworking", "naturally disciplined", "naturally smart",
        "naturally strong", "naturally beautiful", "naturally talented"
    ]
}

# Stereotype Severity Weights (for scoring)
STEREOTYPE_SEVERITY = {
    "Gender_Occupation_Stereotypes": 0.8,
    "Gender_Trait_Stereotypes": 0.9,
    "Gender_Behavior_Stereotypes": 0.7,
    "Race_Competence_Stereotypes": 1.0,  # Highest severity
    "Race_Cultural_Stereotypes": 0.9,
    "Age_Competence_Stereotypes": 0.8,
    "Age_Capability_Stereotypes": 0.85,
    "Religion_Behavior_Stereotypes": 1.0,  # Highest severity
    "Disability_Capability_Stereotypes": 0.9,
    "LGBTQ_Behavior_Stereotypes": 0.9,
    "Class_Trait_Stereotypes": 0.8,
    "Intersectional_Stereotypes": 1.0,  # Highest severity
    "Positive_Stereotypes": 0.6,  # Lower but still problematic
    "Explicit_Identity_Bias": 1.0  # SOTA Toxicity Detection
}




CHUNK_SIZE = 3 # sentences per window
SENSITIVITY_THRESHOLD = 2.0

MODEL_NAME = "sentence-transformers/all-mpnet-base-v2"
