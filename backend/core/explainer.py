
import httpx
import logging
from typing import Optional
from backend.config.bias_config import LLM_HOST, LLM_MODEL

logger = logging.getLogger("VerifairExplainer")

class ExplainerService:
    """
    Service to generate natural language explanations for detected bias
    using a local LLM (e.g., Llama 3.2 via Ollama).
    Async implementation using httpx.
    """
    
    # Class-level flag to skip retries once Ollama is known to be down
    _ollama_available: Optional[bool] = None

    @classmethod
    def reset_availability(cls):
        """Reset the availability flag (call at the start of each request)."""
        cls._ollama_available = None

    @staticmethod
    async def explain_bias(text_snippet: str, identities: list, z_scores: list, context: str = "General") -> Optional[str]:
        """
        Sends the flagged text to the LLM to get a user-friendly explanation.
        """
        # If Ollama was already found to be unavailable in this request, skip immediately
        if ExplainerService._ollama_available is False:
            return None

        try:
            # Construct a clear, simple prompt for the average user
            identity_str = ", ".join(identities)
            prompt = f"""
            You are an AI Bias Auditor explaining technical findings to a non-technical manager.
            
            Context of the document: {context}
            
            The following text was flagged by a statistical engine as having a high semantic association with: {identity_str}.
            
            Text: "{text_snippet}"
            
            Please explain in 1-2 simple sentences why this wording might be considered biased or problematic in a "{context}" context. 
            Focus on the implication of the words used. Do not use technical jargon.
            """
            
            payload = {
                "model": LLM_MODEL,
                "prompt": prompt,
                "stream": False
            }
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                 # Call Ollama API
                 response = await client.post(f"{LLM_HOST}/api/generate", json=payload)
                 
                 if response.status_code == 200:
                    ExplainerService._ollama_available = True
                    result = response.json()
                    explanation = result.get("response", "").strip()
                    logger.info("Generated explanation via Llama 3.2")
                    return explanation
                 else:
                    logger.warning(f"LLM Error: {response.text}")
                    return None
                
        except httpx.ConnectError:
            ExplainerService._ollama_available = False
            logger.warning("Could not connect to Ollama. Is Llama 3.2 running? Skipping explanation.")
            return None
        except (httpx.ReadTimeout, httpx.ConnectTimeout):
            ExplainerService._ollama_available = False
            logger.warning("Ollama timed out. Marking as unavailable for this request.")
            return None
        except Exception as e:
            logger.error(f"Explanation failed: {e}")
            return None

    @staticmethod
    async def generate_batch_conclusion(stats: dict, context: str = "General") -> Optional[str]:
        """
        Generates a high-level executive summary conclusion for a batch of documents.
        """
        try:
            prompt = f"""
            You are a Senior Logic Auditor. Review the following aggregate statistics from a multi-document bias audit.
            The documents are related to: {context}.
            
            - Total Documents Analyzed: {stats.get('total_files')}
            - Total Sentences: {stats.get('total_sentences')}
            - Total Bias Flags Found: {stats.get('total_flags')}
            - Document with Most Bias: {stats.get('most_biased_file')}
            - Top Affected Groups: {", ".join(stats.get('top_identities', []))}
            
            Based on this data, provide a 2-3 sentence "Executive Conclusion" on the overall state of the documents in this {context} context.
            Is there systemic bias? Is it isolated? What is the general trend? 
            Be professional, objective, and direct.
            """
            
            payload = {
                "model": LLM_MODEL,
                "prompt": prompt,
                "stream": False
            }
            
            async with httpx.AsyncClient(timeout=20.0) as client:
                 response = await client.post(f"{LLM_HOST}/api/generate", json=payload)
                 if response.status_code == 200:
                    return response.json().get("response", "").strip()
        except Exception as e:
            logger.error(f"Batch conclusion failed: {e}")
            return None
