
import sys
import os
import json

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from core.selection_bias import SelectionBiasDetector

def test_selection_bias():
    detector = SelectionBiasDetector()
    
    candidates = [
        {"id": "1", "identities": ["Male"], "selected": 1, "notes": "He is a rockstar ninja developer"},
        {"id": "2", "identities": ["Female"], "selected": 0, "notes": "She is supportive but not a culture fit"},
        {"id": "3", "identities": ["Male"], "selected": 1, "notes": "Strong leader and decisive"},
        {"id": "4", "identities": ["Female"], "selected": 1, "notes": "Very organized and caring"},
        {"id": "5", "identities": ["Black", "Male"], "selected": 0, "notes": "Good technical skills but communication style is ghetto"},
        {"id": "6", "identities": ["Asian", "Female"], "selected": 1, "notes": "hardworking and polite"},
        {"id": "7", "identities": ["White", "Male"], "selected": 1, "notes": "fits the team culture perfectly"},
        {"id": "8", "identities": ["Hispanic", "Female"], "selected": 0, "notes": "English is not native"}
    ]
    
    identity_groups = ["Male", "Female", "Black", "Asian", "White", "Hispanic"]
    
    print("Running Selection Bias Analysis...")
    results = detector.analyze_selection_bias(candidates, identity_groups)
    
    print(json.dumps(results, indent=2))
    
    # Assertions
    assert results['total_candidates'] == 8
    assert results['total_selected'] == 5 # 1, 3, 4, 6, 7
    
    # Check Keywords
    keywords = results.get('keyword_analysis', {}).get('keyword_summary', {})
    print("\nKeyword Analysis Results:")
    print(json.dumps(keywords, indent=2))
    
    assert "Gender_Coded_Masculine" in keywords
    assert "rockstar" in keywords["Gender_Coded_Masculine"]["top_keywords"]
    assert "ninja" in keywords["Gender_Coded_Masculine"]["top_keywords"]
    assert "supportive" in keywords["Gender_Coded_Feminine"]["top_keywords"]
    assert "culture fit" in keywords["Age_Bias"]["top_keywords"] or "culture fit" in keywords["Racial_Code"]["top_keywords"]
    
    print("\n✅ Verification Successful!")

if __name__ == "__main__":
    test_selection_bias()
