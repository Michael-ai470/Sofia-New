"""
Sofia smoke tests — no AI credits or auth required.

Run:
    python -m unittest discover tests/ -v
"""
import base64
import io
import json
import sys
import os
import unittest

# Run from the project root so app.py is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import app as sofia


# ---------------------------------------------------------------------------
# Shared test data for PDF/DOCX generation
# ---------------------------------------------------------------------------
_CV = {
    "candidateName": "Ada Okafor",
    "candidateEmail": "ada@example.com",
    "candidatePhone": "+234 800 0000 000",
    "candidateLinkedIn": "linkedin.com/in/adaokafor",
    "candidateWebsite": "",
    "candidateLocation": "Lagos, Nigeria",
    "titleLine": "Senior Software Engineer",
    "summary": "Engineer with 6 years building scalable fintech systems across Lagos and Nairobi.",
    "companyName": "Kuda Bank",
}

_PDF_DATA = {
    "expertise": ["Python", "Flask", "React", "PostgreSQL"],
    "tools": ["Git", "Docker", "AWS"],
    "education": [
        {"degree": "BSc Computer Science", "school": "University of Lagos", "years": "2014–2018"}
    ],
    "certifications": [{"name": "AWS Solutions Architect", "org": "Amazon"}],
    "projects": [],
    "experienceItems": [
        {
            "role": "Senior Engineer",
            "company": "Kuda Bank",
            "location": "Lagos",
            "dates": "2021–Present",
            "bullets": [
                "Reduced API latency by 40% by migrating to async workers.",
                "Led a team of 4 engineers shipping 3 features per sprint.",
            ],
        }
    ],
}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
class TestHealth(unittest.TestCase):
    def setUp(self):
        self.c = sofia.app.test_client()

    def test_health_returns_200_with_service_name(self):
        r = self.c.get("/health")
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["service"], "Sofia")

    def test_health_reports_ai_configured_flag(self):
        r = self.c.get("/health")
        self.assertIn("aiConfigured", r.get_json())


# ---------------------------------------------------------------------------
# /extract-text  (no AI)
# ---------------------------------------------------------------------------
class TestExtractText(unittest.TestCase):
    def setUp(self):
        sofia._rl_store.clear()
        self.c = sofia.app.test_client()

    def test_no_file_returns_400(self):
        r = self.c.post("/extract-text")
        self.assertEqual(r.status_code, 400)

    def test_unsupported_extension_returns_400(self):
        data = {"file": (io.BytesIO(b"data"), "cv.xlsx")}
        r = self.c.post("/extract-text", data=data, content_type="multipart/form-data")
        self.assertEqual(r.status_code, 400)
        self.assertIn("Unsupported", r.get_json()["message"])

    def test_doc_returns_400_with_docx_hint(self):
        data = {"file": (io.BytesIO(b"not a real doc"), "cv.doc")}
        r = self.c.post("/extract-text", data=data, content_type="multipart/form-data")
        self.assertEqual(r.status_code, 400)
        self.assertIn(".docx", r.get_json()["message"])

    def test_error_response_never_contains_traceback(self):
        r = self.c.post("/extract-text", data={"file": (io.BytesIO(b"corrupt"), "cv.pdf")},
                        content_type="multipart/form-data")
        body = r.get_data(as_text=True)
        self.assertNotIn("Traceback", body)
        self.assertNotIn("File \"", body)


# ---------------------------------------------------------------------------
# /analyse-cv  (input validation only — AI call not made with empty input)
# ---------------------------------------------------------------------------
class TestAnalyseCV(unittest.TestCase):
    def setUp(self):
        sofia._rl_store.clear()
        self.c = sofia.app.test_client()

    def _post(self, body):
        return self.c.post("/analyse-cv", data=json.dumps(body),
                           content_type="application/json")

    def test_missing_cv_text_returns_400(self):
        r = self._post({})
        self.assertEqual(r.status_code, 400)

    def test_whitespace_only_cv_text_returns_400(self):
        r = self._post({"cvText": "   "})
        self.assertEqual(r.status_code, 400)


# ---------------------------------------------------------------------------
# /rewrite-cv  (input validation)
# ---------------------------------------------------------------------------
class TestRewriteCV(unittest.TestCase):
    def setUp(self):
        sofia._rl_store.clear()
        self.c = sofia.app.test_client()

    def test_missing_cv_text_returns_400(self):
        r = self.c.post("/rewrite-cv", data=json.dumps({}),
                        content_type="application/json")
        self.assertEqual(r.status_code, 400)


# ---------------------------------------------------------------------------
# /cover-letter  (input validation)
# ---------------------------------------------------------------------------
class TestCoverLetter(unittest.TestCase):
    def setUp(self):
        sofia._rl_store.clear()
        self.c = sofia.app.test_client()

    def _post(self, body):
        return self.c.post("/cover-letter", data=json.dumps(body),
                           content_type="application/json")

    def test_missing_approved_cv_returns_400(self):
        r = self._post({"jdText": "Some job description"})
        self.assertEqual(r.status_code, 400)

    def test_missing_jd_returns_400(self):
        r = self._post({"approvedCV": "John Smith, engineer..."})
        self.assertEqual(r.status_code, 400)


# ---------------------------------------------------------------------------
# /rank-cvs  (input validation)
# ---------------------------------------------------------------------------
class TestRankCVs(unittest.TestCase):
    def setUp(self):
        sofia._rl_store.clear()
        self.c = sofia.app.test_client()

    def _post(self, body):
        return self.c.post("/rank-cvs", data=json.dumps(body),
                           content_type="application/json")

    def test_missing_cv_texts_returns_400(self):
        r = self._post({})
        self.assertEqual(r.status_code, 400)

    def test_empty_cv_texts_returns_400(self):
        r = self._post({"cvTexts": []})
        self.assertEqual(r.status_code, 400)

    def test_exceeding_max_cvs_returns_400(self):
        r = self._post({"cvTexts": ["cv text"] * (sofia.MAX_RANK_CVS + 1)})
        self.assertEqual(r.status_code, 400)
        self.assertIn(str(sofia.MAX_RANK_CVS), r.get_json()["message"])


# ---------------------------------------------------------------------------
# /generate-pdfs and /generate-docx  (no AI — ReportLab / python-docx)
# ---------------------------------------------------------------------------
class TestGeneratePDFs(unittest.TestCase):
    def setUp(self):
        self.c = sofia.app.test_client()

    def _payload(self, template="A", with_letter=False, with_prep=False):
        p = {"rewrittenCV": _CV, "pdfData": _PDF_DATA, "template": template,
             "dateStr": "17 June 2026", "salutation": "Dear Hiring Manager,"}
        if with_letter:
            p["coverLetter"] = {
                "opening": "I am excited to apply.", "body1": "I built X.", "body2": "I love Y.",
                "body3Remote": "I am based in Lagos.", "closing": "Looking forward to it.",
                "fullText": "...", "signoffName": "Ada Okafor", "tagline": "Engineer. Builder.",
            }
        if with_prep:
            p["interviewPrep"] = {"questions": [
                {"question": "Tell me about yourself.", "weakness": "communication",
                 "starAnswer": {"situation": "S", "task": "T", "action": "A", "result": "R"},
                 "needsRealExample": False}
            ]}
        return p

    def test_cv_pdf_template_a_is_valid_pdf(self):
        r = self.c.post("/generate-pdfs", data=json.dumps(self._payload("A")),
                        content_type="application/json")
        self.assertEqual(r.status_code, 200)
        cv_file = next(f for f in r.get_json()["files"] if f["kind"] == "cv")
        self.assertTrue(base64.b64decode(cv_file["data"]).startswith(b"%PDF"))

    def test_cv_pdf_template_b_is_valid_pdf(self):
        r = self.c.post("/generate-pdfs", data=json.dumps(self._payload("B")),
                        content_type="application/json")
        self.assertEqual(r.status_code, 200)
        cv_file = next(f for f in r.get_json()["files"] if f["kind"] == "cv")
        self.assertTrue(base64.b64decode(cv_file["data"]).startswith(b"%PDF"))

    def test_pdf_with_cover_letter_returns_two_files(self):
        r = self.c.post("/generate-pdfs", data=json.dumps(self._payload(with_letter=True)),
                        content_type="application/json")
        self.assertEqual(r.status_code, 200)
        kinds = {f["kind"] for f in r.get_json()["files"]}
        self.assertIn("cv", kinds)
        self.assertIn("cover", kinds)

    def test_pdf_with_all_docs_returns_three_files(self):
        r = self.c.post("/generate-pdfs",
                        data=json.dumps(self._payload(with_letter=True, with_prep=True)),
                        content_type="application/json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.get_json()["files"]), 3)


class TestGenerateDOCX(unittest.TestCase):
    def setUp(self):
        self.c = sofia.app.test_client()

    def test_cv_docx_is_valid_zip(self):
        payload = {"rewrittenCV": _CV, "pdfData": _PDF_DATA, "template": "A"}
        r = self.c.post("/generate-docx", data=json.dumps(payload),
                        content_type="application/json")
        self.assertEqual(r.status_code, 200)
        cv_file = next(f for f in r.get_json()["files"] if f["kind"] == "cv")
        # DOCX files are ZIP archives — magic bytes PK
        self.assertTrue(base64.b64decode(cv_file["data"])[:2] == b"PK")


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------
class TestRateLimit(unittest.TestCase):
    def setUp(self):
        sofia._rl_store.clear()
        self.c = sofia.app.test_client()

    def test_extract_text_allows_30_then_blocks(self):
        # Each request fails with 400 (no file) but should NOT be 429 yet
        for i in range(30):
            r = self.c.post("/extract-text")
            self.assertNotEqual(r.status_code, 429, f"Blocked too early at request {i + 1}")
        # 31st should be rate-limited
        r = self.c.post("/extract-text")
        self.assertEqual(r.status_code, 429)
        self.assertIn("Too many requests", r.get_json()["message"])

    def test_analyse_cv_allows_10_then_blocks(self):
        body = json.dumps({"cvText": ""})
        for i in range(10):
            r = self.c.post("/analyse-cv", data=body, content_type="application/json")
            self.assertNotEqual(r.status_code, 429, f"Blocked too early at request {i + 1}")
        r = self.c.post("/analyse-cv", data=body, content_type="application/json")
        self.assertEqual(r.status_code, 429)


if __name__ == "__main__":
    unittest.main(verbosity=2)
