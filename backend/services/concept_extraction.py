from __future__ import annotations

import numpy as np


_nlp = None
_embedder = None


def _get_nlp():
    global _nlp
    if _nlp is None:
        import spacy

        _nlp = spacy.load("en_core_web_sm")
    return _nlp


def _get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer

        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedder


def extract_concepts(text: str) -> list[str]:
    """Extract concepts using NER plus noun chunks."""
    nlp = _get_nlp()
    doc = nlp(text)

    entities = [
        ent.text.strip()
        for ent in doc.ents
        if ent.label_ in {"ORG", "PRODUCT", "NORP", "GPE", "WORK_OF_ART"}
    ]
    chunks = [chunk.root.lemma_.strip() for chunk in doc.noun_chunks if len(chunk.root.lemma_) > 3]

    concepts = {value for value in (entities + chunks) if value and len(value) > 2}
    return sorted(concepts)


class SessionConceptIndex:
    """FAISS-backed concept deduplication helper for a session."""

    def __init__(self):
        import faiss

        self.index = faiss.IndexFlatL2(384)
        self.concepts: list[str] = []

    def is_new_concept(self, concept: str, threshold: float = 0.85) -> bool:
        if not self.concepts:
            return True

        embedder = _get_embedder()
        vec = embedder.encode([concept])
        distances, _ = self.index.search(np.array(vec, dtype="float32"), k=1)
        similarity = 1 - (distances[0][0] / 4)
        return similarity < threshold

    def add_concept(self, concept: str) -> None:
        embedder = _get_embedder()
        vec = embedder.encode([concept])
        self.index.add(np.array(vec, dtype="float32"))
        self.concepts.append(concept)
