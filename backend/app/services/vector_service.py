"""
Vector Service - ChromaDB + HuggingFace Embeddings
Exact same logic as original Backend/app/services/vector_service.py
"""

import os
import re
import shutil
import numpy as np
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from ..core.config import get_settings

settings = get_settings()


class VectorService:
    """Manages vector embeddings and semantic search via ChromaDB."""

    def __init__(self):
        self.embeddings = HuggingFaceEmbeddings(model_name=settings.embedding_model)
        self.persist_directory = settings.db_persist_dir

        if not os.path.exists(self.persist_directory):
            os.makedirs(self.persist_directory)

        self.db = Chroma(
            persist_directory=self.persist_directory,
            embedding_function=self.embeddings,
        )

    def add_texts(self, texts, metadatas):
        """Add documents to the vector store."""
        return self.db.add_texts(texts=texts, metadatas=metadatas)

    def search(self, query: str, k: int = 5, filter: dict = None):
        """Perform semantic search."""
        return self.db.similarity_search_with_score(query, k=k, filter=filter)

    def check_semantic_skills(
        self,
        resume_text: str,
        skills: list,
        threshold: float = 0.38,
        precomputed_skill_vectors: dict = None,
    ) -> tuple:
        """
        Hybrid Check:
        1. Exact Substring Match (Fast & 100% accurate for explicit skills)
        2. Vector Semantic Match (Backup for implied skills)
        """
        if not skills:
            return [], []

        found = set()
        missing_candidates = []
        resume_lower = resume_text.lower()

        # 1. Fast Text Match
        for skill in skills:
            if len(skill) < 4:
                if re.search(rf'\b{re.escape(skill.lower())}\b', resume_lower):
                    found.add(skill)
                else:
                    missing_candidates.append(skill)
            else:
                if skill.lower() in resume_lower:
                    found.add(skill)
                else:
                    missing_candidates.append(skill)

        if not missing_candidates:
            return list(found), []

        # 2. Semantic Backup
        raw_chunks = re.split(r'[.\n•●▪➢|]', resume_text)
        sentences = [s.strip() for s in raw_chunks if len(s.strip()) > 15]

        if not sentences:
            return list(found), missing_candidates

        try:
            sent_vecs = self.embeddings.embed_documents(sentences)

            skill_vecs = []
            if precomputed_skill_vectors:
                for skill in missing_candidates:
                    vec = precomputed_skill_vectors.get(skill)
                    if vec is None:
                        vec = self.embeddings.embed_query(skill)
                    skill_vecs.append(vec)
            else:
                skill_vecs = self.embeddings.embed_documents(missing_candidates)

            sent_matrix = np.array(sent_vecs)
            sent_norms = np.linalg.norm(sent_matrix, axis=1, keepdims=True)
            sent_matrix = sent_matrix / (sent_norms + 1e-9)

            for i, skill in enumerate(missing_candidates):
                skill_vec = np.array(skill_vecs[i])
                skill_norm = np.linalg.norm(skill_vec)
                skill_vec = skill_vec / (skill_norm + 1e-9)

                similarities = np.dot(sent_matrix, skill_vec)
                best_match_score = np.max(similarities)

                if best_match_score >= threshold:
                    found.add(skill)

        except Exception as e:
            print(f"Semantic Check Error: {e}")

        final_found = list(found)
        final_missing = [s for s in skills if s not in found]
        return final_found, final_missing

    def check_existing_hashes(self, hashes: list) -> set:
        """Check which of the provided hashes already exist in the vector store."""
        if not self.db or not hashes:
            return set()

        try:
            result = self.db.get(
                where={"file_hash": {"$in": hashes}},
                include=["metadatas"],
            )
            existing = set()
            for meta in result["metadatas"]:
                if meta and "file_hash" in meta:
                    existing.add(meta["file_hash"])
            return existing
        except Exception:
            return set()

    def reset(self):
        """Deprecated: We use persistent updates now."""
        pass


# Singleton instance
vector_service = VectorService()
